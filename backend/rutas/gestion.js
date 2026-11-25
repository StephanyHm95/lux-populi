// Rutas 22-25: gestion del admin
const express = require("express");
const db = require("../db");
const { requiereRol } = require("../middleware/sesion");
const { enviarSolicitud, emailValido } = require("../servicios/email");
const { carpetaPresupuestos, rutaPresupuesto } = require("../servicios/presupuestos");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const router = express.Router();

// Todas las rutas de este archivo son solo para el administrador
router.use(requiereRol("admin"));

function idValido(id) {
    if (!Number.isSafeInteger(id)) return false;
    if (id < 1) return false;
    if (id > 2147483647) return false;
    return true;
}

function reservaEnUso(error) {
    if (error.code === "ER_LOCK_DEADLOCK") return true;
    if (error.code === "ER_LOCK_WAIT_TIMEOUT") return true;
    return false;
}

// Se usa al consultar el detalle y al preparar el correo al instalador
async function leerSolicitud(conexion, id) {
    const resultado = await conexion.query(
        `SELECT s.id, s.estado, s.direccion, s.municipio, s.codigo_postal, s.email_instalador,
            DATE_FORMAT(s.fecha_solicitud, '%Y-%m-%d %H:%i') AS fechaSolicitud,
            DATE_FORMAT(s.fecha_estado, '%Y-%m-%d %H:%i') AS fechaEstado,
            u.nombre, u.apellidos, u.email, u.telefono, p.nombre AS provincia,
            DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
            TIME_FORMAT(f.hora_inicio, '%H:%i') AS horaInicio, TIME_FORMAT(f.hora_fin, '%H:%i') AS horaFin,
            si.tipo_instalacion, si.codigo_postal AS codigoPostalSimulacion, si.tipo_tejado, si.superficie,
            si.consumo_mensual, si.num_viviendas, si.consumo_vivienda, si.incluir_zonas_comunes, si.consumo_zonas_comunes,
            si.paneles_finales, si.potencia_instalada, si.tejado_limita, si.coste, si.ahorro_anual, si.amortizacion,
            si.coste_por_vivienda, si.ahorro_por_vivienda, b.id AS presupuestoId, b.importe,
            DATE_FORMAT(b.fecha_envio, '%Y-%m-%d %H:%i') AS fechaEnvio,
            DATE_FORMAT(b.fecha_respuesta, '%Y-%m-%d %H:%i') AS fechaRespuesta
         FROM solicitud s
         JOIN usuario u ON u.id = s.usuario_id
         JOIN simulacion si ON si.id = s.simulacion_id
         JOIN provincia p ON p.id = si.provincia_id
         JOIN franja f ON f.id = s.franja_id
         LEFT JOIN presupuesto b ON b.solicitud_id = s.id
         WHERE s.id = ?`, [id]
    );
    if (resultado[0].length === 0) return null;
    const fila = resultado[0][0];
    const acciones = [];
    if (fila.estado === "solicitada") acciones.push("enviar", "cancelar");
    if (fila.estado === "enviada") acciones.push("cancelar", "subir_presupuesto");
    let presupuesto = null;
    if (fila.presupuestoId !== null) {
        presupuesto = { importe: fila.importe, fechaEnvio: fila.fechaEnvio, fechaRespuesta: fila.fechaRespuesta };
    }
    return {
        id: fila.id,
        estado: fila.estado,
        fechaSolicitud: fila.fechaSolicitud,
        fechaEstado: fila.fechaEstado,
        accionesPermitidas: acciones,
        cliente: { nombre: fila.nombre, apellidos: fila.apellidos, email: fila.email, telefono: fila.telefono },
        direccion: fila.direccion,
        municipio: fila.municipio,
        codigoPostal: fila.codigo_postal,
        provincia: fila.provincia,
        emailInstalador: fila.email_instalador,
        franja: { fecha: fila.fecha, horaInicio: fila.horaInicio, horaFin: fila.horaFin },
        simulacion: {
            tipoInstalacion: fila.tipo_instalacion,
            codigoPostal: fila.codigoPostalSimulacion,
            tipoTejado: fila.tipo_tejado,
            superficie: fila.superficie,
            consumoMensual: fila.consumo_mensual,
            numViviendas: fila.num_viviendas,
            consumoVivienda: fila.consumo_vivienda,
            incluirZonasComunes: fila.incluir_zonas_comunes === 1,
            consumoZonasComunes: fila.consumo_zonas_comunes,
            panelesFinales: fila.paneles_finales,
            potenciaInstalada: fila.potencia_instalada,
            tejadoLimita: fila.tejado_limita === 1,
            coste: fila.coste,
            ahorroAnual: fila.ahorro_anual,
            amortizacion: fila.amortizacion,
            costePorVivienda: fila.coste_por_vivienda,
            ahorroPorVivienda: fila.ahorro_por_vivienda
        },
        presupuesto: presupuesto
    };
}

// Ruta 22: lista de solicitudes con filtros opcionales
router.get("/solicitudes", async (req, res) => {
    try {
        let estado = "todos";
        if (req.query.estado !== undefined) estado = req.query.estado;
        const estados = ["todos", "solicitada", "enviada", "presupuesto_enviado", "aceptado", "rechazado", "cancelada"];
        if (!estados.includes(estado)) {
            return res.status(400).json({ error: "Elige un estado valido", campo: "estado" });
        }
        let sql = `SELECT s.id, CONCAT(u.nombre, ' ', u.apellidos) AS cliente, s.municipio,
            p.nombre AS provincia, si.tipo_instalacion AS tipoInstalacion,
            DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(f.hora_inicio, '%H:%i') AS horaInicio, s.estado
            FROM solicitud s JOIN usuario u ON u.id = s.usuario_id
            JOIN simulacion si ON si.id = s.simulacion_id JOIN provincia p ON p.id = si.provincia_id
            JOIN franja f ON f.id = s.franja_id WHERE 1 = 1`;
        const valores = [];
        if (estado !== "todos") {
            sql += " AND s.estado = ?";
            valores.push(estado);
        }
        if (req.query.provincia !== undefined) {
            if (typeof req.query.provincia !== "string") {
                return res.status(400).json({ error: "Elige una provincia valida", campo: "provincia" });
            }
            if (/^(0[1-9]|[1-4][0-9]|5[0-2])$/.test(req.query.provincia) === false) {
                return res.status(400).json({ error: "Elige una provincia valida", campo: "provincia" });
            }
            sql += " AND p.codigo = ?";
            valores.push(req.query.provincia);
        }
        sql += " ORDER BY f.fecha, f.hora_inicio, s.id";
        const resultado = await db.query(sql, valores);
        res.json(resultado[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    }
});

// Ruta 23: detalle de una solicitud y botones que se pueden mostrar
router.get("/solicitudes/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!idValido(id)) return res.status(404).json({ error: "La solicitud no existe" });
        const solicitud = await leerSolicitud(db, id);
        if (solicitud === null) return res.status(404).json({ error: "La solicitud no existe" });
        res.json(solicitud);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    }
});

// Ruta 24: enviar al instalador. El estado cambia solo si el correo se acepta.
router.post("/solicitudes/:id/enviar", async (req, res) => {
    let conexion;
    try {
        const id = Number(req.params.id);
        if (!idValido(id)) return res.status(404).json({ error: "La solicitud no existe" });
        let emailInstalador;
        if (req.body) emailInstalador = req.body.emailInstalador;
        if (typeof emailInstalador === "string") emailInstalador = emailInstalador.trim().toLowerCase();
        if (!emailValido(emailInstalador)) {
            return res.status(400).json({ error: "Escribe un email valido de hasta 150 caracteres", campo: "emailInstalador" });
        }
        conexion = await db.getConnection();
        await conexion.beginTransaction();
        // Bloqueamos solo la solicitud, para no enviar dos correos a la vez
        const resultado = await conexion.query("SELECT estado FROM solicitud WHERE id = ? FOR UPDATE", [id]);
        if (resultado[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "La solicitud no existe" });
        }
        if (resultado[0][0].estado !== "solicitada") {
            await conexion.rollback();
            return res.status(409).json({ error: "Esta solicitud ya no se puede enviar" });
        }
        const solicitud = await leerSolicitud(conexion, id);
        await enviarSolicitud(solicitud, emailInstalador);
        await conexion.query(
            "UPDATE solicitud SET estado = 'enviada', email_instalador = ?, fecha_estado = NOW() WHERE id = ?",
            [emailInstalador, id]
        );
        await conexion.commit();
        res.json({ id: id, estado: "enviada", emailInstalador: emailInstalador });
    } catch (error) {
        if (conexion) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error(errorRollback);
            }
        }
        if (error.status === 503) return res.status(503).json({ error: error.message });
        if (reservaEnUso(error)) return res.status(409).json({ error: "Se esta modificando la solicitud. Intentalo de nuevo" });
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    } finally {
        if (conexion) conexion.release();
    }
});

// Multer recibe un PDF de hasta 5 MB. Aun no lo escribe en el disco.
const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2, fieldSize: 100 }
});
function leerPdf(req, res, next) {
    subida.single("pdf")(req, res, error => {
        if (error) {
            let mensaje = "Envia el importe y un solo archivo en el campo pdf";
            if (error.code === "LIMIT_FILE_SIZE") mensaje = "El PDF no puede superar los 5 MB";
            return res.status(400).json({ error: mensaje, campo: "pdf" });
        }
        next();
    });
}

// Ruta 25: guardar el PDF y cambiar el estado del presupuesto
router.post("/solicitudes/:id/presupuesto", leerPdf, async (req, res) => {
    let conexion;
    let archivoGuardado = null;
    try {
        const id = Number(req.params.id);
        if (!idValido(id)) return res.status(404).json({ error: "La solicitud no existe" });
        if (!req.file) return res.status(400).json({ error: "Adjunta el presupuesto en PDF", campo: "pdf" });
        if (path.extname(req.file.originalname).toLowerCase() !== ".pdf") {
            return res.status(400).json({ error: "Solo se permiten archivos PDF", campo: "pdf" });
        }
        if (req.file.mimetype !== "application/pdf") {
            return res.status(400).json({ error: "Solo se permiten archivos PDF", campo: "pdf" });
        }
        if (req.file.buffer.subarray(0, 5).toString() !== "%PDF-") {
            return res.status(400).json({ error: "El archivo no es un PDF", campo: "pdf" });
        }
        if (typeof req.body.importe !== "string") {
            return res.status(400).json({ error: "Introduce un importe valido", campo: "importe" });
        }
        const textoImporte = req.body.importe.trim();
        if (/^\d+(\.\d{1,2})?$/.test(textoImporte) === false) {
            return res.status(400).json({ error: "Introduce un importe positivo con hasta dos decimales", campo: "importe" });
        }
        const importe = Number(textoImporte);
        let importeValido = Number.isFinite(importe);
        if (importe <= 0) importeValido = false;
        if (importe > 99999999.99) importeValido = false;
        if (!importeValido) {
            return res.status(400).json({ error: "Introduce un importe entre 0,01 y 99999999,99", campo: "importe" });
        }

        conexion = await db.getConnection();
        await conexion.beginTransaction();
        const resultado = await conexion.query("SELECT estado FROM solicitud WHERE id = ? FOR UPDATE", [id]);
        if (resultado[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "La solicitud no existe" });
        }
        if (resultado[0][0].estado !== "enviada") {
            await conexion.rollback();
            return res.status(409).json({ error: "Solo se puede subir el presupuesto de una solicitud enviada" });
        }
        const anterior = await conexion.query("SELECT id FROM presupuesto WHERE solicitud_id = ?", [id]);
        if (anterior[0].length > 0) {
            await conexion.rollback();
            return res.status(409).json({ error: "Esta solicitud ya tiene presupuesto" });
        }
        // El nombre lo crea el servidor. No usamos el nombre enviado por el navegador.
        const nombre = randomUUID() + ".pdf";
        await fs.mkdir(carpetaPresupuestos, { recursive: true });
        const rutaArchivo = rutaPresupuesto(nombre);
        const archivo = await fs.open(rutaArchivo, "wx");
        archivoGuardado = rutaArchivo;
        try {
            await archivo.writeFile(req.file.buffer);
        } finally {
            await archivo.close();
        }
        await conexion.query(
            "INSERT INTO presupuesto (solicitud_id, importe, archivo_pdf) VALUES (?, ?, ?)", [id, importe, nombre]
        );
        await conexion.query("UPDATE solicitud SET estado = 'presupuesto_enviado', fecha_estado = NOW() WHERE id = ?", [id]);
        const presupuesto = await conexion.query(
            `SELECT importe, DATE_FORMAT(fecha_envio, '%Y-%m-%d %H:%i') AS fechaEnvio, fecha_respuesta AS fechaRespuesta
             FROM presupuesto WHERE solicitud_id = ?`, [id]
        );
        await conexion.commit();
        archivoGuardado = null;
        res.status(201).json({ id: id, estado: "presupuesto_enviado", presupuesto: presupuesto[0][0] });
    } catch (error) {
        if (conexion) {
            try {
                await conexion.rollback();
            } catch (errorRollback) {
                console.error(errorRollback);
            }
        }
        // Si falla el guardado en la base de datos, quitamos el archivo que acabamos de escribir
        if (archivoGuardado !== null) {
            try {
                await fs.unlink(archivoGuardado);
            } catch (errorArchivo) {
                if (errorArchivo.code !== "ENOENT") console.error(errorArchivo);
            }
        }
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Esta solicitud ya tiene presupuesto" });
        if (reservaEnUso(error)) return res.status(409).json({ error: "Se esta modificando la solicitud. Intentalo de nuevo" });
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    } finally {
        if (conexion) conexion.release();
    }
});

module.exports = router;
