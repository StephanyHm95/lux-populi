const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const mysql = require("mysql2/promise");
const { crearServidorCorreo } = require("./ayuda/smtp");
require("dotenv").config({ quiet: true });

test("gestion, correo y PDF con MySQL, SMTP local y sesiones reales", { timeout: 120000 }, async t => {
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST));
    const nombrePruebas = "luxpopuli_pruebas_" + process.pid + "_" + Date.now();
    const administracion = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PUERTO),
        user: process.env.DB_USER, password: process.env.DB_CONTRASENA
    });
    let db, servidor, correo, carpeta, baseCreada = false;
    try {
        await administracion.query("CREATE DATABASE `" + nombrePruebas + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        baseCreada = true;
        process.env.DB_NOMBRE = nombrePruebas;
        carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "luxpopuli-presupuestos-"));
        process.env.CARPETA_PRESUPUESTOS = carpeta;
        correo = await crearServidorCorreo();
        process.env.SMTP_HOST = "127.0.0.1";
        process.env.SMTP_PUERTO = String(correo.puerto);
        process.env.SMTP_USUARIO = "";
        process.env.SMTP_CONTRASENA = "";
        process.env.SMTP_SEGURO = "false";
        process.env.EMAIL_EMPRESA = "contacto@example.test";
        db = require("../backend/db");
        const sql = await fs.readFile(path.join(__dirname, "../database/luxpopuli.sql"), "utf8");
        const conexion = await db.getConnection();
        try {
            await conexion.query("SET FOREIGN_KEY_CHECKS = 0");
            for (const tabla of sql.matchAll(/CREATE TABLE `[\s\S]*?;/g)) await conexion.query(tabla[0]);
            await conexion.query("SET FOREIGN_KEY_CHECKS = 1");
            for (const tabla of ["provincia", "parametro", "concepto"]) {
                const insertar = sql.match(new RegExp("INSERT INTO `" + tabla + "` VALUES[\\s\\S]*?;"));
                await conexion.query(insertar[0]);
            }
            await conexion.query("UPDATE provincia SET produccion_anual = 1559.25, radiacion_anual = 1961.85, fecha_pvgis = NOW() WHERE id = 8");
            for (let mes = 1; mes <= 12; mes++) {
                await conexion.query("INSERT INTO produccion_mensual (provincia_id, mes, produccion, radiacion) VALUES (8, ?, 100, 120)", [mes]);
            }
        } finally {
            conexion.release();
        }
        const express = require("express");
        const session = require("express-session");
        const bcrypt = require("bcryptjs");
        const hash = await bcrypt.hash("Prueba2026!", 4);
        const usuarios = [];
        for (let i = 0; i < 3; i++) {
            const rol = i === 2 ? "admin" : "cliente";
            const email = "prueba" + i + "@example.test";
            await db.query("INSERT INTO usuario (nombre, apellidos, email, telefono, password_hash, rol) VALUES ('Prueba', 'Local', ?, '600000001', ?, ?)", [email, hash, rol]);
            usuarios.push({ email });
        }
        const app = express();
        app.use(express.json());
        app.use(session({ secret: "gestion-pruebas-locales", resave: false, saveUninitialized: false }));
        app.use(express.static(path.join(__dirname, "../frontend")));
        app.use("/api/auth", require("../backend/rutas/auth"));
        app.use("/api/simulaciones", require("../backend/rutas/simulaciones"));
        app.use("/api/solicitudes", require("../backend/rutas/solicitudes"));
        app.use("/api/gestion", require("../backend/rutas/gestion"));
        servidor = await new Promise(resolve => {
            const local = app.listen(0, "127.0.0.1", () => resolve(local));
        });
        const base = "http://127.0.0.1:" + servidor.address().port;
        async function pedir(ruta, datos, cookie, method) {
            const headers = {};
            if (cookie) headers.Cookie = cookie;
            let body = datos;
            if (datos !== undefined && !(datos instanceof FormData)) {
                headers["Content-Type"] = "application/json";
                body = JSON.stringify(datos);
            }
            const r = await fetch(base + ruta, { method: method || (datos === undefined ? "GET" : "POST"), headers, body, signal: AbortSignal.timeout(30000) });
            const bytes = Buffer.from(await r.arrayBuffer());
            let respuesta = bytes;
            if (r.headers.get("content-type")?.includes("application/json")) respuesta = JSON.parse(bytes.toString());
            return { status: r.status, body: respuesta, headers: r.headers, cookie: r.headers.get("set-cookie")?.split(";")[0] };
        }
        for (const usuario of usuarios) {
            const r = await pedir("/api/auth/login", { email: usuario.email, password: "Prueba2026!" });
            assert.equal(r.status, 200);
            usuario.cookie = r.cookie;
        }
        const admin = usuarios[2].cookie;
        let dia = 5;
        async function crearSolicitud(cliente = 0) {
            const simulacion = await pedir("/api/simulaciones", { codigoPostal: "08201", tipoInstalacion: "casa", tipoTejado: "inclinado", superficie: 25, consumoMensual: 290 });
            assert.equal(simulacion.status, 201);
            const [franja] = await db.query("INSERT INTO franja (provincia_id, fecha, hora_inicio, hora_fin) VALUES (8, DATE_ADD(CURDATE(), INTERVAL ? DAY), '10:00', '12:00')", [dia++]);
            const r = await pedir("/api/solicitudes", {
                simulacionId: simulacion.body.id, franjaId: franja.insertId,
                direccion: "Calle de prueba 1", municipio: "Sabadell", codigoPostal: "08201", aceptaEnvioDatos: true
            }, usuarios[cliente].cookie);
            assert.equal(r.status, 201, JSON.stringify(r.body));
            return r.body.id;
        }
        const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
        function formulario(importe = "4100", bytes = pdf, nombre = "presupuesto.pdf", tipo = "application/pdf") {
            const form = new FormData();
            if (importe !== undefined) form.append("importe", importe);
            if (bytes !== null) form.append("pdf", new Blob([bytes], { type: tipo }), nombre);
            return form;
        }
        let solicitud;
        await t.test("solo el administrador puede listar y ver solicitudes", async () => {
            assert.equal((await pedir("/api/gestion/solicitudes")).status, 401);
            assert.equal((await pedir("/api/gestion/solicitudes", undefined, usuarios[0].cookie)).status, 403);
            assert.deepEqual((await pedir("/api/gestion/solicitudes", undefined, admin)).body, []);
            solicitud = await crearSolicitud();
            assert.equal((await pedir("/api/gestion/solicitudes/" + solicitud, undefined, usuarios[0].cookie)).status, 403);
            assert.equal((await pedir("/api/gestion/solicitudes/no-existe", undefined, admin)).status, 404);
            assert.equal((await pedir("/api/gestion/solicitudes/2147483647", undefined, admin)).status, 404);
        });

        await t.test("listado y detalle respetan filtros, formatos y acciones permitidas", async () => {
            const lista = await pedir("/api/gestion/solicitudes?estado=solicitada&provincia=08", undefined, admin);
            assert.equal(lista.body.length, 1);
            assert.equal(lista.body[0].id, solicitud);
            assert.equal(lista.body[0].cliente, "Prueba Local");
            assert.equal(lista.body[0].horaInicio, "10:00");
            assert.deepEqual((await pedir("/api/gestion/solicitudes?provincia=28", undefined, admin)).body, []);
            assert.equal((await pedir("/api/gestion/solicitudes?estado=no-existe", undefined, admin)).status, 400);
            assert.equal((await pedir("/api/gestion/solicitudes?provincia=53", undefined, admin)).status, 400);
            const detalle = (await pedir("/api/gestion/solicitudes/" + solicitud, undefined, admin)).body;
            assert.deepEqual(detalle.accionesPermitidas, ["enviar", "cancelar"]);
            assert.equal(detalle.cliente.email, usuarios[0].email);
            assert.equal(detalle.emailInstalador, null);
            assert.equal(detalle.presupuesto, null);
            assert.equal(detalle.simulacion.incluirZonasComunes, false);
            assert.equal(detalle.simulacion.tejadoLimita, false);
            assert.equal(detalle.simulacion.consumoMensual, 290);
            assert.equal(JSON.stringify(detalle).includes("password"), false);
            assert.match(detalle.fechaEstado, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
        });

        await t.test("email incorrecto, configuracion ausente y rechazo SMTP no cambian el estado", async () => {
            const ruta = "/api/gestion/solicitudes/" + solicitud + "/enviar";
            assert.equal((await pedir(ruta, { emailInstalador: "instalador@example.test" })).status, 401);
            assert.equal((await pedir("/api/gestion/solicitudes/2147483647/enviar", { emailInstalador: "instalador@example.test" }, admin)).status, 404);
            for (const email of [undefined, 1, "sin-arroba", "a@example.test\r\nBcc:otro@example.test", "a".repeat(151)]) {
                assert.equal((await pedir(ruta, { emailInstalador: email }, admin)).status, 400);
            }
            assert.equal((await pedir(ruta, { emailInstalador: "instalador@example.test" }, usuarios[0].cookie)).status, 403);
            process.env.SMTP_HOST = "";
            assert.equal((await pedir(ruta, { emailInstalador: "instalador@example.test" }, admin)).status, 503);
            process.env.SMTP_HOST = "127.0.0.1";
            correo.estado.rechazar = true;
            assert.equal((await pedir(ruta, { emailInstalador: "instalador@example.test" }, admin)).status, 503);
            correo.estado.rechazar = false;
            const [[fila]] = await db.query("SELECT estado, email_instalador FROM solicitud WHERE id = ?", [solicitud]);
            assert.equal(fila.estado, "solicitada");
            assert.equal(fila.email_instalador, null);
            assert.equal(correo.mensajes.length, 0);
        });

        await t.test("dos envios simultaneos solo generan un correo y un cambio de estado", async () => {
            const ruta = "/api/gestion/solicitudes/" + solicitud + "/enviar";
            const respuestas = await Promise.all([1, 2].map(() => pedir(ruta, { emailInstalador: " INSTALADOR@example.test " }, admin)));
            assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]);
            assert.equal(correo.mensajes.length, 1);
            assert.match(correo.mensajes[0].destinatario, /instalador@example.test/);
            assert.match(correo.mensajes[0].texto, /Reply-To:.*contacto@example.test/i);
            assert.match(correo.mensajes[0].texto, /600000001/);
            assert.match(correo.mensajes[0].texto, /Calle de prueba 1/);
            const detalle = (await pedir("/api/gestion/solicitudes/" + solicitud, undefined, admin)).body;
            assert.equal(detalle.estado, "enviada");
            assert.equal(detalle.emailInstalador, "instalador@example.test");
            assert.deepEqual(detalle.accionesPermitidas, ["cancelar", "subir_presupuesto"]);
        });

        await t.test("la subida comprueba permisos, importe, tipo y tamano del PDF", async () => {
            const ruta = "/api/gestion/solicitudes/" + solicitud + "/presupuesto";
            assert.equal((await pedir(ruta, formulario())).status, 401);
            assert.equal((await pedir(ruta, formulario(), usuarios[0].cookie)).status, 403);
            assert.equal((await pedir("/api/gestion/solicitudes/2147483647/presupuesto", formulario(), admin)).status, 404);
            const demasiadoGrande = Buffer.alloc(5 * 1024 * 1024 + 1, 32);
            pdf.copy(demasiadoGrande);
            const casos = [
                ["0", pdf, "prueba.pdf", "application/pdf", "importe"],
                ["-1", pdf, "prueba.pdf", "application/pdf", "importe"],
                ["100000000", pdf, "prueba.pdf", "application/pdf", "importe"],
                ["1.001", pdf, "prueba.pdf", "application/pdf", "importe"],
                ["4100", null, "prueba.pdf", "application/pdf", "pdf"],
                ["4100", pdf, "prueba.txt", "application/pdf", "pdf"],
                ["4100", pdf, "prueba.pdf", "image/png", "pdf"],
                ["4100", Buffer.from("No soy un PDF"), "prueba.pdf", "application/pdf", "pdf"],
                ["4100", demasiadoGrande, "prueba.pdf", "application/pdf", "pdf"]
            ];
            for (const [importe, bytes, nombre, tipo, campo] of casos) {
                const r = await pedir(ruta, formulario(importe, bytes, nombre, tipo), admin);
                assert.equal(r.status, 400, JSON.stringify(r.body));
                assert.equal(r.body.campo, campo, JSON.stringify(r.body));
            }
            const doble = formulario();
            doble.append("pdf", new Blob([pdf], { type: "application/pdf" }), "otro.pdf");
            assert.equal((await pedir(ruta, doble, admin)).status, 400);
            assert.equal((await fs.readdir(carpeta)).length, 0);
            const [[cuenta]] = await db.query("SELECT COUNT(*) AS total FROM presupuesto");
            assert.equal(cuenta.total, 0);
        });

        let nombrePdf;
        await t.test("dos subidas simultaneas guardan un solo PDF privado y un presupuesto", async () => {
            const ruta = "/api/gestion/solicitudes/" + solicitud + "/presupuesto";
            const respuestas = await Promise.all([1, 2].map(() => pedir(ruta, formulario(), admin)));
            assert.deepEqual(respuestas.map(r => r.status).sort(), [201, 409], JSON.stringify(respuestas.map(r => r.body)));
            const r = respuestas.find(r => r.status === 201);
            assert.equal(r.body.estado, "presupuesto_enviado");
            assert.equal(r.body.presupuesto.importe, 4100);
            assert.equal(r.body.presupuesto.fechaRespuesta, null);
            const [[fila]] = await db.query("SELECT archivo_pdf FROM presupuesto WHERE solicitud_id = ?", [solicitud]);
            nombrePdf = fila.archivo_pdf;
            assert.match(nombrePdf, /^[a-f0-9-]+\.pdf$/);
            assert.deepEqual(await fs.readFile(path.join(carpeta, nombrePdf)), pdf);
            assert.equal((await fs.readdir(carpeta)).length, 1);
            const detalle = (await pedir("/api/gestion/solicitudes/" + solicitud, undefined, admin)).body;
            assert.deepEqual(detalle.accionesPermitidas, []);
            assert.equal(detalle.presupuesto.importe, 4100);
            assert.equal((await pedir("/api/gestion/solicitudes?estado=presupuesto_enviado", undefined, admin)).body.length, 1);
        });

        await t.test("descarga: solo su cliente y el admin, sin exponer la carpeta privada", async () => {
            const ruta = "/api/solicitudes/" + solicitud + "/presupuesto";
            assert.equal((await pedir(ruta)).status, 401);
            assert.equal((await pedir(ruta, undefined, usuarios[1].cookie)).status, 403);
            for (const cookie of [usuarios[0].cookie, admin]) {
                const r = await pedir(ruta, undefined, cookie);
                assert.equal(r.status, 200, JSON.stringify(r.body));
                assert.match(r.headers.get("content-type"), /application\/pdf/);
                assert.match(r.headers.get("content-disposition"), /attachment;/);
                assert.equal(r.headers.get("cache-control"), "private, no-store");
                assert.deepEqual(r.body, pdf);
            }
            assert.equal((await pedir("/uploads/presupuestos/" + nombrePdf, undefined, usuarios[0].cookie)).status, 404);
            await db.query("UPDATE presupuesto SET archivo_pdf = '../fuera.pdf' WHERE solicitud_id = ?", [solicitud]);
            assert.equal((await pedir(ruta, undefined, usuarios[0].cookie)).status, 404);
            await db.query("UPDATE presupuesto SET archivo_pdf = 'no-existe.pdf' WHERE solicitud_id = ?", [solicitud]);
            assert.equal((await pedir(ruta, undefined, admin)).status, 404);
            await db.query("UPDATE presupuesto SET archivo_pdf = ? WHERE solicitud_id = ?", [nombrePdf, solicitud]);
            assert.equal((await pedir("/api/solicitudes/2147483647/presupuesto", undefined, admin)).status, 404);
        });

        await t.test("el cliente puede aceptar el PDF subido y el admin ve el resultado", async () => {
            const r = await pedir("/api/solicitudes/" + solicitud + "/respuesta", { respuesta: "aceptado" }, usuarios[0].cookie, "PUT");
            assert.equal(r.status, 200);
            const detalle = (await pedir("/api/gestion/solicitudes/" + solicitud, undefined, admin)).body;
            assert.equal(detalle.estado, "aceptado");
            assert.deepEqual(detalle.accionesPermitidas, []);
            assert.match(detalle.presupuesto.fechaRespuesta, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
            assert.equal((await pedir("/api/solicitudes/" + solicitud + "/presupuesto", undefined, usuarios[0].cookie)).status, 200);
            const correosAntes = correo.mensajes.length;
            assert.equal((await pedir("/api/gestion/solicitudes/" + solicitud + "/enviar", { emailInstalador: "instalador@example.test" }, admin)).status, 409);
            assert.equal((await pedir("/api/gestion/solicitudes/" + solicitud + "/presupuesto", formulario(), admin)).status, 409);
            assert.equal(correo.mensajes.length, correosAntes);
        });

        await t.test("un fallo de base de datos despues de escribir el PDF deshace y borra el archivo", async () => {
            const segunda = await crearSolicitud(1);
            assert.equal((await pedir("/api/solicitudes/" + segunda + "/presupuesto", undefined, usuarios[1].cookie)).status, 404);
            assert.equal((await pedir("/api/gestion/solicitudes/" + segunda + "/presupuesto", formulario(), admin)).status, 409);
            assert.equal((await pedir("/api/gestion/solicitudes/" + segunda + "/enviar", { emailInstalador: "instalador@example.test" }, admin)).status, 200);
            const getConnection = db.getConnection.bind(db);
            let fallarRollback = false;
            db.getConnection = async () => {
                const conexion = await getConnection();
                const query = conexion.query.bind(conexion);
                const rollback = conexion.rollback.bind(conexion);
                conexion.query = async (sql, valores) => {
                    if (sql.startsWith("INSERT INTO presupuesto")) {
                        const error = new Error("Fallo de guardado de prueba");
                        error.code = "ER_DUP_ENTRY";
                        throw error;
                    }
                    return query(sql, valores);
                };
                conexion.rollback = async () => {
                    // Deshacemos realmente antes de simular el error de conexion.
                    await rollback();
                    if (fallarRollback) throw new Error("Fallo al deshacer de prueba");
                };
                const release = conexion.release.bind(conexion);
                conexion.release = () => {
                    conexion.query = query;
                    conexion.rollback = rollback;
                    conexion.release = release;
                    release();
                };
                return conexion;
            };
            try {
                assert.equal((await pedir("/api/gestion/solicitudes/" + segunda + "/presupuesto", formulario(), admin)).status, 409);
                fallarRollback = true;
                const registrarRollback = console.error;
                console.error = (...errores) => {
                    if (!errores.some(error => error?.message === "Fallo al deshacer de prueba")) registrarRollback(...errores);
                };
                try {
                    const respuesta = await pedir("/api/gestion/solicitudes/" + segunda + "/presupuesto", formulario(), admin);
                    assert.equal(respuesta.status, 409);
                    assert.equal(typeof respuesta.body.error, "string", "El fallo debe devolver un error en JSON");
                    assert.equal((await fs.readdir(carpeta)).length, 1, "El PDF nuevo debe borrarse aunque falle rollback");
                    const [[solicitudTrasFallo]] = await db.query("SELECT estado FROM solicitud WHERE id = ?", [segunda]);
                    assert.equal(solicitudTrasFallo.estado, "enviada");
                    const [[presupuestosTrasFallo]] = await db.query("SELECT COUNT(*) AS total FROM presupuesto WHERE solicitud_id = ?", [segunda]);
                    assert.equal(presupuestosTrasFallo.total, 0);
                } finally {
                    console.error = registrarRollback;
                    fallarRollback = false;
                }
            } finally {
                db.getConnection = getConnection;
            }
            const [[fila]] = await db.query("SELECT estado FROM solicitud WHERE id = ?", [segunda]);
            assert.equal(fila.estado, "enviada");
            assert.equal((await fs.readdir(carpeta)).length, 1);
            const [[cuenta]] = await db.query("SELECT COUNT(*) AS total FROM presupuesto WHERE solicitud_id = ?", [segunda]);
            assert.equal(cuenta.total, 0);
            // Tambien limpiamos un archivo si falla su escritura antes de llegar al INSERT
            const abrir = fs.open;
            const registrar = console.error;
            fs.open = async (...argumentos) => {
                const archivo = await abrir(...argumentos);
                archivo.writeFile = async () => { throw new Error("Fallo de escritura de prueba"); };
                return archivo;
            };
            console.error = error => {
                if (error.message !== "Fallo de escritura de prueba") registrar(error);
            };
            try {
                assert.equal((await pedir("/api/gestion/solicitudes/" + segunda + "/presupuesto", formulario(), admin)).status, 500);
            } finally {
                fs.open = abrir;
                console.error = registrar;
            }
            assert.equal((await fs.readdir(carpeta)).length, 1);
            const limiteExacto = Buffer.alloc(5 * 1024 * 1024, 32);
            pdf.copy(limiteExacto);
            const subidaLimite = await pedir("/api/gestion/solicitudes/" + segunda + "/presupuesto", formulario("4100", limiteExacto), admin);
            assert.equal(subidaLimite.status, 201, JSON.stringify(subidaLimite.body));
            const descargaLimite = await pedir("/api/solicitudes/" + segunda + "/presupuesto", undefined, usuarios[1].cookie);
            assert.equal(descargaLimite.status, 200);
            assert.deepEqual(descargaLimite.body, limiteExacto);
        });

        await t.test("el PDF sigue disponible al arrancar otro proceso con los mismos datos", async () => {
            await new Promise((resolve, reject) => {
                servidor.close(error => error ? reject(error) : resolve());
                servidor.closeAllConnections();
            });
            servidor = null;

            // Un proceso nuevo tiene su propia conexion y sus propias sesiones.
            // Solo recibe la base y la carpeta temporales; no vuelve a crear el PDF.
            const codigo = `
                const express = require("express");
                const session = require("express-session");
                const path = require("node:path");
                const app = express();
                app.use(express.json());
                app.use(session({ secret: "gestion-pruebas-locales", resave: false, saveUninitialized: false }));
                app.use(express.static(path.resolve("frontend")));
                app.use("/api/auth", require(path.resolve("backend/rutas/auth")));
                app.use("/api/solicitudes", require(path.resolve("backend/rutas/solicitudes")));
                const servidor = app.listen(0, "127.0.0.1", () => {
                    process.send({ puerto: servidor.address().port });
                });
                process.on("disconnect", () => process.exit(0));
            `;
            const proceso = spawn(process.execPath, ["-e", codigo], {
                cwd: path.resolve(__dirname, ".."),
                env: { ...process.env },
                stdio: ["ignore", "ignore", "pipe", "ipc"],
                windowsHide: true
            });
            let errores = "";
            proceso.stderr.on("data", datos => { errores = (errores + datos.toString()).slice(-4000); });
            try {
                const puerto = await new Promise((resolve, reject) => {
                    const limite = setTimeout(() => reject(new Error("El nuevo servidor no arranca. " + errores)), 15000);
                    proceso.once("message", mensaje => {
                        clearTimeout(limite);
                        resolve(mensaje.puerto);
                    });
                    proceso.once("error", error => { clearTimeout(limite); reject(error); });
                    proceso.once("exit", codigoSalida => {
                        clearTimeout(limite);
                        reject(new Error("El nuevo servidor termino con codigo " + codigoSalida + ". " + errores));
                    });
                });
                const nuevoOrigen = "http://127.0.0.1:" + puerto;
                const ruta = nuevoOrigen + "/api/solicitudes/" + solicitud + "/presupuesto";
                const anterior = await fetch(ruta, { headers: { Cookie: usuarios[0].cookie }, signal: AbortSignal.timeout(20000) });
                assert.equal(anterior.status, 401);
                await anterior.arrayBuffer();
                const login = await fetch(nuevoOrigen + "/api/auth/login", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: usuarios[0].email, password: "Prueba2026!" }),
                    signal: AbortSignal.timeout(20000)
                });
                assert.equal(login.status, 200);
                await login.arrayBuffer();
                const cookie = login.headers.get("set-cookie")?.split(";")[0];
                assert.ok(cookie);
                const descarga = await fetch(ruta, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
                assert.equal(descarga.status, 200);
                assert.match(descarga.headers.get("content-type"), /application\/pdf/);
                assert.deepEqual(Buffer.from(await descarga.arrayBuffer()), pdf);
            } finally {
                if (proceso.exitCode === null && proceso.signalCode === null) {
                    await new Promise(resolve => {
                        proceso.once("close", resolve);
                        proceso.kill();
                    });
                }
            }
        });
    } finally {
        if (servidor) await new Promise(resolve => servidor.close(resolve));
        if (correo) await correo.cerrar();
        if (db) await db.end();
        if (baseCreada && /^luxpopuli_pruebas_\d+_\d+$/.test(nombrePruebas)) {
            await administracion.query("DROP DATABASE `" + nombrePruebas + "`");
        }
        await administracion.end();
        if (carpeta) {
            assert.equal(path.dirname(path.resolve(carpeta)), path.resolve(os.tmpdir()));
            assert.match(path.basename(carpeta), /^luxpopuli-presupuestos-/);
            await fs.rm(carpeta, { recursive: true, force: true });
        }
    }
});
