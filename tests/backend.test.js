// Estas pruebas crean y eliminan su propia base de datos local. No cambian la del proyecto.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

test("calculadora y solicitudes con MySQL y sesiones reales", { timeout: 120000 }, async t => {
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST), "Las pruebas solo se ejecutan en MySQL local");
    const nombrePruebas = "luxpopuli_pruebas_" + process.pid + "_" + Date.now();
    const administracion = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO),
        user: process.env.DB_USER, password: process.env.DB_CONTRASENA
    });
    const fetchReal = global.fetch;
    let db, servidor, baseCreada = false;
    try {
        await administracion.query("CREATE DATABASE `" + nombrePruebas + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        baseCreada = true;
        process.env.DB_NOMBRE = nombrePruebas;
        db = require("../backend/db");
        const sql = fs.readFileSync(path.join(__dirname, "../database/luxpopuli.sql"), "utf8");
        const conexion = await db.getConnection();
        try {
            await conexion.query("SET FOREIGN_KEY_CHECKS = 0");
            for (const tabla of sql.matchAll(/CREATE TABLE `[\s\S]*?;/g)) {
                await conexion.query(tabla[0]);
            }
            await conexion.query("SET FOREIGN_KEY_CHECKS = 1");
            for (const tabla of ["provincia", "parametro", "concepto"]) {
                const insertar = sql.match(new RegExp("INSERT INTO `" + tabla + "` VALUES[\\s\\S]*?;"));
                assert.ok(insertar, "Faltan los datos iniciales de " + tabla);
                await conexion.query(insertar[0]);
            }
        } finally {
            conexion.release();
        }

        const express = require("express");
        const session = require("express-session");
        const bcrypt = require("bcryptjs");
        const password = "Prueba2026!";
        const hash = await bcrypt.hash(password, 4);
        const usuarios = [];
        for (let i = 0; i < 11; i++) {
            const rol = i === 10 ? "admin" : "cliente";
            const email = "cliente" + i + "@example.test";
            const [insertar] = await db.query(
                "INSERT INTO usuario (nombre, apellidos, email, telefono, password_hash, rol) VALUES ('Prueba', 'Local', ?, '600000001', ?, ?)",
                [email, hash, rol]
            );
            usuarios.push({ id: insertar.insertId, email: email });
        }
        const app = express();
        app.use(express.json());
        app.use(session({ secret: "solo-pruebas-locales", resave: false, saveUninitialized: false }));
        app.use("/api/auth", require("../backend/rutas/auth"));
        app.use("/api/simulaciones", require("../backend/rutas/simulaciones"));
        app.use("/api/solicitudes", require("../backend/rutas/solicitudes"));
        servidor = await new Promise(resolve => {
            const servidorLocal = app.listen(0, "127.0.0.1", () => resolve(servidorLocal));
        });
        const base = "http://127.0.0.1:" + servidor.address().port;
        async function pedir(ruta, datos, cookie, metodo) {
            const headers = {};
            if (datos !== undefined) headers["Content-Type"] = "application/json";
            if (cookie) headers.Cookie = cookie;
            const respuesta = await fetchReal(base + ruta, {
                method: metodo || (datos === undefined ? "GET" : "POST"), headers: headers,
                body: datos === undefined ? undefined : JSON.stringify(datos), signal: AbortSignal.timeout(20000)
            });
            return { status: respuesta.status, body: await respuesta.json(), cookie: respuesta.headers.get("set-cookie")?.split(";")[0] };
        }
        for (const usuario of usuarios) {
            const sesion = await pedir("/api/auth/login", { email: usuario.email, password: password });
            assert.equal(sesion.status, 200);
            usuario.cookie = sesion.cookie;
        }

        const casa = { codigoPostal: "08201", tipoInstalacion: "casa", tipoTejado: "inclinado", superficie: 25, consumoMensual: 290 };
        const datosApi = {
            outputs: {
                totals: { fixed: { E_y: 1559.25, "H(i)_y": 1961.85 } },
                monthly: { fixed: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, E_m: 100 + i, "H(i)_m": 120 + i })) }
            }
        };
        function apiCorrecta() {
            global.fetch = async () => {
                return { ok: true, json: async () => structuredClone(datosApi) };
            };
        }
        apiCorrecta();
        async function simular(cambios = {}) {
            const r = await pedir("/api/simulaciones", { ...casa, ...cambios });
            assert.equal(r.status, 201, JSON.stringify(r.body));
            return r.body.id;
        }
        let numeroFranja = 0;
        async function nuevaFranja(provincia = 8) {
            numeroFranja++;
            const [insertar] = await db.query(
                "INSERT INTO franja (provincia_id, fecha, hora_inicio, hora_fin) VALUES (?, DATE_ADD(CURDATE(), INTERVAL ? DAY), '10:00', '12:00')",
                [provincia, 7 + numeroFranja]
            );
            return insertar.insertId;
        }
        function datosSolicitud(simulacionId, franjaId) {
            return { simulacionId, franjaId, direccion: " Calle de prueba 1 ", municipio: " Sabadell ", codigoPostal: "08201", aceptaEnvioDatos: true };
        }
        async function nuevaSolicitud(cliente) {
            const simulacionId = await simular();
            const franjaId = await nuevaFranja();
            const datos = datosSolicitud(simulacionId, franjaId);
            const r = await pedir("/api/solicitudes", datos, usuarios[cliente].cookie);
            assert.equal(r.status, 201, JSON.stringify(r.body));
            return { id: r.body.id, simulacionId, franjaId, datos };
        }

        await t.test("la API publica valida los campos antes de guardar", async () => {
            const casos = [
                ["codigoPostal", 8201], ["codigoPostal", "00001"], ["codigoPostal", "53001"], ["codigoPostal", "08abc"],
                ["tipoInstalacion", "otro"], ["tipoTejado", "otro"], ["superficie", "25"], ["superficie", -1],
                ["superficie", 0], ["superficie", 1000000], ["consumoMensual", 0], ["consumoMensual", null]
            ];
            for (const [campo, valor] of casos) {
                const r = await pedir("/api/simulaciones", { ...casa, [campo]: valor });
                assert.equal(r.status, 400, JSON.stringify(r));
                assert.equal(r.body.campo, campo);
            }
            const sinDatos = await pedir("/api/simulaciones", undefined, undefined, "POST");
            assert.equal(sinDatos.status, 400);
            const [[cuenta]] = await db.query("SELECT COUNT(*) AS total FROM simulacion");
            assert.equal(cuenta.total, 0);
        });

        await t.test("Barcelona: calcula, guarda PVGIS completo y reutiliza los datos sin internet", async () => {
            if (process.env.PRUEBA_PVGIS_REAL === "1") global.fetch = fetchReal;
            const r = await pedir("/api/simulaciones", casa);
            assert.equal(r.status, 201, JSON.stringify(r));
            assert.equal(r.body.coste, 3925);
            assert.equal(r.body.ahorroAnual, 416);
            assert.equal(r.body.produccionMensual.length, 12);
            assert.equal(r.body.provincia.codigo, "08");
            const [[provincia]] = await db.query("SELECT * FROM provincia WHERE id = 8");
            assert.equal(provincia.produccion_anual, 1559.25);
            assert.ok(provincia.fecha_pvgis);
            const [[meses]] = await db.query("SELECT COUNT(*) AS total FROM produccion_mensual WHERE provincia_id = 8");
            assert.equal(meses.total, 12);
            const [[guardada]] = await db.query("SELECT * FROM simulacion WHERE id = ?", [r.body.id]);
            assert.equal(guardada.produccion_usada, 1559.25);
            assert.equal(guardada.consumo_vivienda, null);
            global.fetch = async () => { throw new Error("No deberia llamar a PVGIS teniendo los datos guardados"); };
            const repetida = await pedir("/api/simulaciones", casa);
            assert.equal(repetida.status, 201);
            assert.deepEqual(repetida.body.produccionMensual, r.body.produccionMensual);
            const pequena = await pedir("/api/simulaciones", { ...casa, superficie: 1 });
            assert.equal(pequena.status, 400);
            assert.equal(pequena.body.campo, "superficie");
            apiCorrecta();
        });

        await t.test("edificios, zonas comunes y limite de almacenamiento", async () => {
            const edificio = { ...casa, tipoInstalacion: "edificio", tipoTejado: "plano", superficie: 150,
                numViviendas: 10, consumoVivienda: 290, incluirZonasComunes: true, consumoZonasComunes: 300 };
            const r = await pedir("/api/simulaciones", edificio);
            assert.equal(r.status, 201);
            assert.equal(r.body.panelesFinales, 26);
            assert.equal(r.body.costePorVivienda, 1721);
            const [[fila]] = await db.query("SELECT * FROM simulacion WHERE id = ?", [r.body.id]);
            assert.equal(fila.consumo_mensual, null);
            assert.equal(fila.consumo_zonas_comunes, 300);
            for (const [campo, valor] of [["numViviendas", 1], ["numViviendas", 2.5], ["consumoVivienda", -1], ["incluirZonasComunes", "true"], ["consumoZonasComunes", -1]]) {
                const mal = await pedir("/api/simulaciones", { ...edificio, [campo]: valor });
                assert.equal(mal.status, 400);
                assert.equal(mal.body.campo, campo);
            }
            const sinComunes = await pedir("/api/simulaciones", { ...edificio, incluirZonasComunes: false });
            assert.equal(sinComunes.status, 201);
            const [[sinZonas]] = await db.query("SELECT consumo_zonas_comunes FROM simulacion WHERE id = ?", [sinComunes.body.id]);
            assert.equal(sinZonas.consumo_zonas_comunes, null);
            const enorme = await pedir("/api/simulaciones", { ...edificio, superficie: 999999, numViviendas: 2147483647 });
            assert.equal(enorme.status, 400);
        });

        await t.test("PVGIS caido o incompleto devuelve 503 sin guardar datos a medias", async () => {
            global.fetch = async () => { throw new Error("Servicio de prueba caido"); };
            assert.equal((await pedir("/api/simulaciones", { ...casa, codigoPostal: "17001" })).status, 503);
            global.fetch = async () => ({ ok: false });
            assert.equal((await pedir("/api/simulaciones", { ...casa, codigoPostal: "17001" })).status, 503);
            for (const cambio of ["faltanMeses", "mesDuplicado", "valorIncorrecto", "sinDatos"]) {
                const mal = structuredClone(datosApi);
                if (cambio === "faltanMeses") mal.outputs.monthly.fixed.pop();
                if (cambio === "mesDuplicado") mal.outputs.monthly.fixed[1].month = 1;
                if (cambio === "valorIncorrecto") mal.outputs.monthly.fixed[0].E_m = "100";
                global.fetch = async () => ({ ok: true, json: async () => cambio === "sinDatos" ? {} : mal });
                assert.equal((await pedir("/api/simulaciones", { ...casa, codigoPostal: "17001" })).status, 503);
            }
            const [[provincia]] = await db.query("SELECT produccion_anual FROM provincia WHERE id = 17");
            assert.equal(provincia.produccion_anual, null);
            const [[cuenta]] = await db.query("SELECT COUNT(*) AS total FROM produccion_mensual WHERE provincia_id = 17");
            assert.equal(cuenta.total, 0);
            apiCorrecta();
        });

        await t.test("un fallo de guardado deshace el total anual y los meses", async () => {
            const getConnection = db.getConnection.bind(db);
            db.getConnection = async () => {
                const conexion = await getConnection();
                const query = conexion.query.bind(conexion);
                conexion.query = async (sql, valores) => {
                    if (sql.startsWith("INSERT INTO produccion_mensual") && valores[1] === 6) throw new Error("Fallo de guardado de prueba");
                    return query(sql, valores);
                };
                const release = conexion.release.bind(conexion);
                conexion.release = () => { conexion.query = query; conexion.release = release; release(); };
                return conexion;
            };
            try {
                const [[provincia]] = await db.query("SELECT * FROM provincia WHERE id = 17");
                const { obtenerProduccionSolarProvincia } = require("../backend/servicios/pvgis");
                await assert.rejects(obtenerProduccionSolarProvincia(provincia), /Fallo de guardado de prueba/);
            } finally {
                db.getConnection = getConnection;
            }
            const [[provincia]] = await db.query("SELECT produccion_anual, fecha_pvgis FROM provincia WHERE id = 17");
            assert.equal(provincia.produccion_anual, null);
            assert.equal(provincia.fecha_pvgis, null);
            const [[cuenta]] = await db.query("SELECT COUNT(*) AS total FROM produccion_mensual WHERE provincia_id = 17");
            assert.equal(cuenta.total, 0);
        });

        let primera;
        await t.test("sesion, validaciones y primera solicitud del cliente", async () => {
            const simulacionId = await simular();
            const franjaId = await nuevaFranja();
            const datos = datosSolicitud(simulacionId, franjaId);
            assert.equal((await pedir("/api/solicitudes", datos)).status, 401);
            assert.equal((await pedir("/api/solicitudes", datos, usuarios[10].cookie)).status, 403);
            assert.equal((await pedir("/api/solicitudes/mia")).status, 401);
            assert.equal((await pedir("/api/solicitudes/mia", undefined, usuarios[10].cookie)).status, 403);
            assert.equal((await pedir("/api/solicitudes/mia", undefined, usuarios[1].cookie)).status, 404);
            for (const [campo, valor] of [["simulacionId", "1"], ["franjaId", -1], ["direccion", " "], ["municipio", "x".repeat(101)], ["codigoPostal", "00000"], ["aceptaEnvioDatos", false]]) {
                const r = await pedir("/api/solicitudes", { ...datos, [campo]: valor }, usuarios[0].cookie);
                assert.equal(r.status, 400);
                assert.equal(r.body.campo, campo);
            }
            const otraProvincia = await pedir("/api/solicitudes", { ...datos, codigoPostal: "28001" }, usuarios[0].cookie);
            assert.equal(otraProvincia.status, 400);
            const franjaGirona = await nuevaFranja(17);
            assert.equal((await pedir("/api/solicitudes", { ...datos, franjaId: franjaGirona }, usuarios[0].cookie)).status, 400);
            assert.equal((await pedir("/api/solicitudes", { ...datos, simulacionId: 2147483647 }, usuarios[0].cookie)).status, 404);
            const franjaPasada = await nuevaFranja();
            await db.query("UPDATE franja SET fecha = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id = ?", [franjaPasada]);
            assert.equal((await pedir("/api/solicitudes", { ...datos, franjaId: franjaPasada }, usuarios[0].cookie)).status, 409);
            const r = await pedir("/api/solicitudes", datos, usuarios[0].cookie);
            assert.equal(r.status, 201, JSON.stringify(r));
            primera = { id: r.body.id, simulacionId, franjaId, datos };
            const mia = await pedir("/api/solicitudes/mia", undefined, usuarios[0].cookie);
            assert.equal(mia.body.id, primera.id);
            assert.equal(mia.body.sePuedeModificar, true);
            assert.equal(mia.body.direccion, "Calle de prueba 1");
            assert.equal(mia.body.presupuesto, null);
            assert.match(mia.body.fechaSolicitud, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
            assert.equal(mia.body.franja.horaInicio, "10:00");
            assert.equal(mia.body.simulacion.coste, 3925);
            const otrosDatos = datosSolicitud(await simular(), await nuevaFranja());
            assert.equal((await pedir("/api/solicitudes", otrosDatos, usuarios[0].cookie)).status, 409);
            assert.equal((await pedir("/api/solicitudes", datos, usuarios[1].cookie)).status, 409);
        });

        await t.test("cambio de hueco: propietario, provincia, ocupacion y rollback", async () => {
            const nueva = await nuevaFranja();
            const ruta = "/api/solicitudes/" + primera.id + "/franja";
            assert.equal((await pedir(ruta, { franjaId: nueva }, usuarios[1].cookie, "PUT")).status, 403);
            const deMadrid = await nuevaFranja(28);
            assert.equal((await pedir(ruta, { franjaId: deMadrid }, usuarios[0].cookie, "PUT")).status, 400);
            assert.equal((await pedir(ruta, { franjaId: primera.franjaId }, usuarios[0].cookie, "PUT")).status, 409);
            const [[anterior]] = await db.query("SELECT ocupada FROM franja WHERE id = ?", [primera.franjaId]);
            assert.equal(anterior.ocupada, 1);
            const r = await pedir(ruta, { franjaId: nueva }, usuarios[0].cookie, "PUT");
            assert.equal(r.status, 200);
            assert.equal(r.body.franja.id, nueva);
            const [[liberada]] = await db.query("SELECT ocupada FROM franja WHERE id = ?", [primera.franjaId]);
            assert.equal(liberada.ocupada, 0);
            primera.franjaId = nueva;
        });

        await t.test("cancelar libera el hueco, conserva el historial y permite otra simulacion", async () => {
            const ruta = "/api/solicitudes/" + primera.id + "/cancelar";
            assert.equal((await pedir(ruta, undefined, usuarios[1].cookie, "PUT")).status, 403);
            assert.equal((await pedir(ruta, undefined, usuarios[0].cookie, "PUT")).status, 200);
            assert.equal((await pedir(ruta, undefined, usuarios[0].cookie, "PUT")).status, 409);
            const [[franja]] = await db.query("SELECT ocupada FROM franja WHERE id = ?", [primera.franjaId]);
            assert.equal(franja.ocupada, 0);
            const repetida = await pedir("/api/solicitudes", { ...primera.datos, franjaId: await nuevaFranja() }, usuarios[0].cookie);
            assert.equal(repetida.status, 409);
            const nueva = await nuevaSolicitud(0);
            assert.equal((await pedir("/api/solicitudes/mia", undefined, usuarios[0].cookie)).body.id, nueva.id);
        });

        await t.test("si falla la solicitud despues de reservar, el hueco vuelve a quedar libre", async () => {
            const datos = datosSolicitud(await simular(), await nuevaFranja());
            const getConnection = db.getConnection.bind(db);
            db.getConnection = async () => {
                const conexion = await getConnection();
                const query = conexion.query.bind(conexion);
                conexion.query = async (sql, valores) => {
                    if (sql.includes("INSERT INTO solicitud")) {
                        const error = new Error("Fallo de insercion de prueba");
                        error.code = "ER_DUP_ENTRY";
                        throw error;
                    }
                    return query(sql, valores);
                };
                const release = conexion.release.bind(conexion);
                conexion.release = () => { conexion.query = query; conexion.release = release; release(); };
                return conexion;
            };
            try {
                assert.equal((await pedir("/api/solicitudes", datos, usuarios[5].cookie)).status, 409);
            } finally {
                db.getConnection = getConnection;
            }
            const [[franja]] = await db.query("SELECT ocupada FROM franja WHERE id = ?", [datos.franjaId]);
            const [[solicitudes]] = await db.query("SELECT COUNT(*) AS total FROM solicitud WHERE simulacion_id = ?", [datos.simulacionId]);
            assert.equal(franja.ocupada, 0);
            assert.equal(solicitudes.total, 0);
            assert.equal((await pedir("/api/solicitudes", datos, usuarios[5].cookie)).status, 201);
        });

        await t.test("dos clientes no pueden reservar el mismo hueco a la vez", async () => {
            const franja = await nuevaFranja();
            const simulaciones = [await simular(), await simular()];
            const respuestas = await Promise.all([2, 3].map((cliente, i) => pedir("/api/solicitudes", datosSolicitud(simulaciones[i], franja), usuarios[cliente].cookie)));
            assert.deepEqual(respuestas.map(r => r.status).sort(), [201, 409]);
            const [[cuenta]] = await db.query("SELECT COUNT(*) AS total FROM solicitud WHERE franja_id = ? AND estado <> 'cancelada'", [franja]);
            assert.equal(cuenta.total, 1);
        });

        await t.test("un cliente tampoco puede crear dos solicitudes activas a la vez", async () => {
            const franjas = [await nuevaFranja(), await nuevaFranja()];
            const simulaciones = [await simular(), await simular()];
            const respuestas = await Promise.all(franjas.map((franja, i) => pedir("/api/solicitudes", datosSolicitud(simulaciones[i], franja), usuarios[4].cookie)));
            assert.deepEqual(respuestas.map(r => r.status).sort(), [201, 409]);
            const [[cuenta]] = await db.query("SELECT COUNT(*) AS total FROM solicitud WHERE usuario_id = ? AND estado = 'solicitada'", [usuarios[4].id]);
            assert.equal(cuenta.total, 1);
            const [[ocupadas]] = await db.query("SELECT SUM(ocupada) AS total FROM franja WHERE id IN (?, ?)", franjas);
            assert.equal(Number(ocupadas.total), 1);
        });

        await t.test("el plazo de dos horas se comprueba en el servidor y el admin puede cancelar", async () => {
            const solicitud = await nuevaSolicitud(6);
            await db.query("UPDATE franja SET fecha = DATE(DATE_ADD(NOW(), INTERVAL 90 MINUTE)), hora_inicio = TIME(DATE_ADD(NOW(), INTERVAL 90 MINUTE)), hora_fin = '23:59:59' WHERE id = ?", [solicitud.franjaId]);
            const mia = await pedir("/api/solicitudes/mia", undefined, usuarios[6].cookie);
            assert.equal(mia.body.sePuedeModificar, false);
            assert.equal((await pedir("/api/solicitudes/" + solicitud.id + "/franja", { franjaId: await nuevaFranja() }, usuarios[6].cookie, "PUT")).status, 409);
            assert.equal((await pedir("/api/solicitudes/" + solicitud.id + "/cancelar", undefined, usuarios[6].cookie, "PUT")).status, 409);
            assert.equal((await pedir("/api/solicitudes/" + solicitud.id + "/cancelar", undefined, usuarios[10].cookie, "PUT")).status, 200);
        });

        await t.test("una solicitud enviada solo puede cancelarla el admin", async () => {
            const solicitud = await nuevaSolicitud(7);
            await db.query("UPDATE solicitud SET estado = 'enviada' WHERE id = ?", [solicitud.id]);
            assert.equal((await pedir("/api/solicitudes/" + solicitud.id + "/franja", { franjaId: await nuevaFranja() }, usuarios[7].cookie, "PUT")).status, 409);
            assert.equal((await pedir("/api/solicitudes/" + solicitud.id + "/cancelar", undefined, usuarios[7].cookie, "PUT")).status, 409);
            assert.equal((await pedir("/api/solicitudes/" + solicitud.id + "/cancelar", undefined, usuarios[10].cookie, "PUT")).status, 200);
        });

        await t.test("aceptar y rechazar el presupuesto guarda la fecha y comprueba el propietario y el estado", async () => {
            for (const [cliente, respuesta] of [[8, "aceptado"], [9, "rechazado"]]) {
                const solicitud = await nuevaSolicitud(cliente);
                const ruta = "/api/solicitudes/" + solicitud.id + "/respuesta";
                assert.equal((await pedir(ruta, { respuesta }, usuarios[cliente].cookie, "PUT")).status, 409);
                await db.query("INSERT INTO presupuesto (solicitud_id, importe, archivo_pdf) VALUES (?, 4100, 'prueba.pdf')", [solicitud.id]);
                await db.query("UPDATE solicitud SET estado = 'presupuesto_enviado' WHERE id = ?", [solicitud.id]);
                assert.equal((await pedir(ruta, { respuesta }, usuarios[1].cookie, "PUT")).status, 403);
                assert.equal((await pedir(ruta, { respuesta: "otro" }, usuarios[cliente].cookie, "PUT")).status, 400);
                assert.equal((await pedir("/api/solicitudes/" + solicitud.id + "/cancelar", undefined, usuarios[10].cookie, "PUT")).status, 409);
                const r = await pedir(ruta, { respuesta }, usuarios[cliente].cookie, "PUT");
                assert.equal(r.status, 200);
                assert.equal(r.body.estado, respuesta);
                assert.equal((await pedir(ruta, { respuesta }, usuarios[cliente].cookie, "PUT")).status, 409);
                const mia = await pedir("/api/solicitudes/mia", undefined, usuarios[cliente].cookie);
                assert.equal(mia.body.presupuesto.importe, 4100);
                assert.match(mia.body.presupuesto.fechaRespuesta, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
            }
        });
    } finally {
        global.fetch = fetchReal;
        if (servidor) await new Promise(resolve => servidor.close(resolve));
        if (db) await db.end();
        if (baseCreada && /^luxpopuli_pruebas_\d+_\d+$/.test(nombrePruebas)) {
            await administracion.query("DROP DATABASE `" + nombrePruebas + "`");
        }
        await administracion.end();
    }
});
