// Estas pruebas usan una base de datos y una carpeta temporales propias.
// El presupuesto se prepara directamente, sin usar las rutas de envio o subida.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

test("consultas y descarga de presupuestos con MySQL y sesiones reales", { timeout: 120000 }, async t => {
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST), "Las pruebas solo se ejecutan en MySQL local");
    const nombrePruebas = "luxpopuli_pruebas_" + process.pid + "_" + Date.now();
    const entornoAnterior = {
        DB_NOMBRE: process.env.DB_NOMBRE,
        CARPETA_PRESUPUESTOS: process.env.CARPETA_PRESUPUESTOS
    };
    const fetchReal = global.fetch;
    const administracion = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO),
        user: process.env.DB_USER, password: process.env.DB_CONTRASENA
    });
    let db, servidor, carpetaTemporal, baseCreada = false;
    try {
        await administracion.query("CREATE DATABASE `" + nombrePruebas + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        baseCreada = true;
        process.env.DB_NOMBRE = nombrePruebas;
        carpetaTemporal = await fs.mkdtemp(path.join(os.tmpdir(), "luxpopuli-consultas-"));
        const carpetaPdf = path.join(carpetaTemporal, "presupuestos");
        await fs.mkdir(carpetaPdf);
        process.env.CARPETA_PRESUPUESTOS = carpetaPdf;

        db = require("../backend/db");
        const sql = await fs.readFile(path.join(__dirname, "../database/luxpopuli.sql"), "utf8");
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
            await conexion.query("UPDATE provincia SET produccion_anual = 1559.25, radiacion_anual = 1961.85, fecha_pvgis = NOW() WHERE id = 8");
            for (let mes = 1; mes <= 12; mes++) {
                await conexion.query("INSERT INTO produccion_mensual (provincia_id, mes, produccion, radiacion) VALUES (8, ?, 100, 120)", [mes]);
            }
        } finally {
            conexion.release();
        }
        // Los datos solares ya estan preparados: la prueba no necesita internet.
        global.fetch = async () => { throw new Error("Esta prueba no debe consultar servicios externos"); };

        const express = require("express");
        const session = require("express-session");
        const bcrypt = require("bcryptjs");
        const password = "Prueba2026!";
        const hash = await bcrypt.hash(password, 4);
        const usuarios = [];
        for (let i = 0; i < 3; i++) {
            const rol = i === 2 ? "admin" : "cliente";
            const email = "consultas" + i + "@example.test";
            await db.query(
                "INSERT INTO usuario (nombre, apellidos, email, telefono, password_hash, rol) VALUES ('Prueba', 'Local', ?, '600000001', ?, ?)",
                [email, hash, rol]
            );
            usuarios.push({ email });
        }
        const app = express();
        app.use(express.json());
        app.use(session({ secret: "consultas-pruebas-locales", resave: false, saveUninitialized: false }));
        // Es la misma carpeta publica que utiliza el servidor del proyecto.
        app.use(express.static(path.join(__dirname, "../frontend")));
        app.use("/api/auth", require("../backend/rutas/auth"));
        app.use("/api/simulaciones", require("../backend/rutas/simulaciones"));
        app.use("/api/solicitudes", require("../backend/rutas/solicitudes"));
        app.use("/api/gestion", require("../backend/rutas/gestion"));
        servidor = await new Promise((resolve, reject) => {
            const local = app.listen(0, "127.0.0.1", () => resolve(local));
            local.once("error", reject);
        });
        const base = "http://127.0.0.1:" + servidor.address().port;
        async function pedir(ruta, datos, cookie) {
            const headers = {};
            if (cookie) headers.Cookie = cookie;
            if (datos !== undefined) headers["Content-Type"] = "application/json";
            const respuesta = await fetchReal(base + ruta, {
                method: datos === undefined ? "GET" : "POST", headers,
                body: datos === undefined ? undefined : JSON.stringify(datos),
                signal: AbortSignal.timeout(20000)
            });
            const bytes = Buffer.from(await respuesta.arrayBuffer());
            const body = respuesta.headers.get("content-type")?.includes("application/json")
                ? JSON.parse(bytes.toString()) : bytes;
            return {
                status: respuesta.status, body, headers: respuesta.headers,
                cookie: respuesta.headers.get("set-cookie")?.split(";")[0]
            };
        }
        for (const usuario of usuarios) {
            const sesion = await pedir("/api/auth/login", { email: usuario.email, password });
            assert.equal(sesion.status, 200);
            assert.ok(sesion.cookie, "El inicio de sesion debe devolver una cookie");
            usuario.cookie = sesion.cookie;
        }
        const admin = usuarios[2].cookie;
        let dia = 7;
        async function crearSolicitud(cliente) {
            const simulacion = await pedir("/api/simulaciones", {
                codigoPostal: "08201", tipoInstalacion: "casa", tipoTejado: "inclinado",
                superficie: 25, consumoMensual: 290
            });
            assert.equal(simulacion.status, 201, JSON.stringify(simulacion.body));
            const [franja] = await db.query(
                "INSERT INTO franja (provincia_id, fecha, hora_inicio, hora_fin) VALUES (8, DATE_ADD(CURDATE(), INTERVAL ? DAY), '10:00', '12:00')",
                [dia++]
            );
            const solicitud = await pedir("/api/solicitudes", {
                simulacionId: simulacion.body.id, franjaId: franja.insertId,
                direccion: "Calle de prueba 1", municipio: "Sabadell", codigoPostal: "08201", aceptaEnvioDatos: true
            }, usuarios[cliente].cookie);
            assert.equal(solicitud.status, 201, JSON.stringify(solicitud.body));
            return solicitud.body.id;
        }

        const conPresupuesto = await crearSolicitud(0);
        const sinPresupuesto = await crearSolicitud(1);
        const nombrePdf = "presupuesto-prueba.pdf";
        const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
        await fs.writeFile(path.join(carpetaPdf, nombrePdf), pdf);
        await fs.writeFile(path.join(carpetaTemporal, "fuera.pdf"), Buffer.from("Archivo fuera de la carpeta de presupuestos"));
        await db.query("INSERT INTO presupuesto (solicitud_id, importe, archivo_pdf) VALUES (?, 4100, ?)", [conPresupuesto, nombrePdf]);
        await db.query("UPDATE solicitud SET estado = 'presupuesto_enviado', fecha_estado = NOW() WHERE id = ?", [conPresupuesto]);

        await t.test("solo el administrador puede consultar el listado y el detalle", async () => {
            for (const ruta of ["/api/gestion/solicitudes", "/api/gestion/solicitudes/" + conPresupuesto]) {
                assert.equal((await pedir(ruta)).status, 401);
                assert.equal((await pedir(ruta, undefined, usuarios[0].cookie)).status, 403);
                assert.equal((await pedir(ruta, undefined, admin)).status, 200);
            }
        });

        await t.test("el listado filtra por estado y provincia y rechaza filtros incorrectos", async () => {
            const lista = await pedir("/api/gestion/solicitudes?estado=solicitada&provincia=08", undefined, admin);
            assert.equal(lista.status, 200);
            assert.equal(lista.body.length, 1);
            assert.equal(lista.body[0].id, sinPresupuesto);
            assert.equal(lista.body[0].cliente, "Prueba Local");
            assert.equal(lista.body[0].provincia, "Barcelona");
            assert.equal(lista.body[0].horaInicio, "10:00");
            const vacia = await pedir("/api/gestion/solicitudes?provincia=28", undefined, admin);
            assert.equal(vacia.status, 200);
            assert.deepEqual(vacia.body, []);
            for (const filtro of ["estado=no-existe", "provincia=53", "provincia=8", "provincia=08&provincia=28"]) {
                assert.equal((await pedir("/api/gestion/solicitudes?" + filtro, undefined, admin)).status, 400, filtro);
            }
        });

        await t.test("el detalle muestra los datos necesarios sin contrasenas", async () => {
            const respuesta = await pedir("/api/gestion/solicitudes/" + conPresupuesto, undefined, admin);
            assert.equal(respuesta.status, 200);
            const detalle = respuesta.body;
            assert.equal(detalle.id, conPresupuesto);
            assert.equal(detalle.cliente.email, usuarios[0].email);
            assert.equal(detalle.simulacion.consumoMensual, 290);
            assert.equal(detalle.simulacion.incluirZonasComunes, false);
            assert.equal(detalle.simulacion.tejadoLimita, false);
            assert.equal(detalle.presupuesto.importe, 4100);
            assert.equal(detalle.presupuesto.fechaRespuesta, null);
            assert.match(detalle.fechaEstado, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
            assert.doesNotMatch(JSON.stringify(detalle), /password|contrasena|contraseña|\$2[aby]\$/i);
            for (const id of ["no-existe", "0", "2147483647"]) {
                assert.equal((await pedir("/api/gestion/solicitudes/" + id, undefined, admin)).status, 404);
            }
        });

        await t.test("las acciones disponibles cambian con el estado de la solicitud", async () => {
            const consultar = id => pedir("/api/gestion/solicitudes/" + id, undefined, admin);
            const inicial = await consultar(sinPresupuesto);
            assert.equal(inicial.status, 200);
            assert.deepEqual(inicial.body.accionesPermitidas, ["enviar", "cancelar"]);
            assert.equal(inicial.body.presupuesto, null);
            try {
                await db.query("UPDATE solicitud SET estado = 'enviada' WHERE id = ?", [sinPresupuesto]);
                const enviada = await consultar(sinPresupuesto);
                assert.equal(enviada.status, 200);
                assert.deepEqual(enviada.body.accionesPermitidas, ["cancelar", "subir_presupuesto"]);
                const presupuestada = await consultar(conPresupuesto);
                assert.equal(presupuestada.status, 200);
                assert.equal(presupuestada.body.estado, "presupuesto_enviado");
                assert.deepEqual(presupuestada.body.accionesPermitidas, []);
            } finally {
                await db.query("UPDATE solicitud SET estado = 'solicitada' WHERE id = ?", [sinPresupuesto]);
            }
        });

        await t.test("el cliente y el administrador descargan el PDF correcto", async () => {
            for (const cookie of [usuarios[0].cookie, admin]) {
                const respuesta = await pedir("/api/solicitudes/" + conPresupuesto + "/presupuesto", undefined, cookie);
                assert.equal(respuesta.status, 200);
                assert.deepEqual(respuesta.body, pdf);
                assert.match(respuesta.headers.get("content-type"), /application\/pdf/);
                assert.match(respuesta.headers.get("content-disposition"), /attachment;/);
                assert.ok(respuesta.headers.get("content-disposition").includes("presupuesto-" + conPresupuesto + ".pdf"));
                assert.equal(respuesta.headers.get("cache-control"), "private, no-store");
                assert.equal(respuesta.headers.get("x-content-type-options"), "nosniff");
            }
        });

        await t.test("la descarga rechaza a otras personas y los presupuestos inexistentes", async () => {
            const ruta = "/api/solicitudes/" + conPresupuesto + "/presupuesto";
            assert.equal((await pedir(ruta)).status, 401);
            assert.equal((await pedir(ruta, undefined, usuarios[1].cookie)).status, 403);
            for (const id of ["no-existe", "0", "2147483647", sinPresupuesto]) {
                assert.equal((await pedir("/api/solicitudes/" + id + "/presupuesto", undefined, admin)).status, 404);
            }
            assert.equal((await pedir("/api/solicitudes/" + sinPresupuesto + "/presupuesto", undefined, usuarios[1].cookie)).status, 404);
        });

        await t.test("no se descargan archivos ausentes ni archivos fuera de la carpeta privada", async () => {
            const ruta = "/api/solicitudes/" + conPresupuesto + "/presupuesto";
            try {
                for (const nombre of ["no-existe.pdf", "../fuera.pdf", "..\\fuera.pdf"]) {
                    await db.query("UPDATE presupuesto SET archivo_pdf = ? WHERE solicitud_id = ?", [nombre, conPresupuesto]);
                    const respuesta = await pedir(ruta, undefined, usuarios[0].cookie);
                    assert.equal(respuesta.status, 404, nombre);
                }
            } finally {
                await db.query("UPDATE presupuesto SET archivo_pdf = ? WHERE solicitud_id = ?", [nombrePdf, conPresupuesto]);
            }
            for (const rutaPublica of ["/uploads/presupuestos/" + nombrePdf, "/presupuestos/" + nombrePdf]) {
                assert.equal((await pedir(rutaPublica, undefined, usuarios[0].cookie)).status, 404);
            }
        });
    } finally {
        global.fetch = fetchReal;
        const erroresLimpieza = [];
        async function limpiar(operacion) {
            try { await operacion(); } catch (error) { erroresLimpieza.push(error); }
        }
        if (servidor) await limpiar(() => new Promise((resolve, reject) => {
            servidor.close(error => error ? reject(error) : resolve());
            servidor.closeAllConnections();
        }));
        if (db) await limpiar(() => db.end());
        if (baseCreada) await limpiar(async () => {
            assert.match(nombrePruebas, /^luxpopuli_pruebas_\d+_\d+$/);
            await administracion.query("DROP DATABASE `" + nombrePruebas + "`");
        });
        await limpiar(() => administracion.end());
        if (carpetaTemporal) await limpiar(async () => {
            const destino = path.resolve(carpetaTemporal);
            assert.equal(path.dirname(destino), path.resolve(os.tmpdir()));
            assert.match(path.basename(destino), /^luxpopuli-consultas-/);
            await fs.rm(destino, { recursive: true, force: true });
        });
        for (const [clave, valor] of Object.entries(entornoAnterior)) {
            if (valor === undefined) delete process.env[clave];
            else process.env[clave] = valor;
        }
        if (erroresLimpieza.length) throw new AggregateError(erroresLimpieza, "No se pudieron limpiar todos los datos temporales de la prueba");
    }
});
