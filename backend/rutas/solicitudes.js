// Rutas 16-21: solicitudes del cliente
const express = require("express");
const db = require("../db");
const { requiereSesion, requiereRol } = require("../middleware/sesion");
const router = express.Router();

function idValido(id) {
    if (!Number.isSafeInteger(id)) return false;
    if (id < 1) return false;
    if (id > 2147483647) return false;
    return true;
}

function textoValido(texto, longitudMaxima) {
    if (typeof texto !== "string") return false;
    if (texto.trim().length === 0) return false;
    if (texto.trim().length > longitudMaxima) return false;
    return true;
}

function codigoPostalValido(codigo) {
    if (typeof codigo !== "string") return false;
    return /^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$/.test(codigo);
}

function reservaEnUso(error) {
    if (error.code === "ER_LOCK_DEADLOCK") return true;
    if (error.code === "ER_LOCK_WAIT_TIMEOUT") return true;
    return false;
}

// Ruta 16: crear una solicitud y reservar su hueco
router.post("/", requiereRol("cliente"), async (req, res) => {
    let conexion;
    try {
        if (!req.body) {
            return res.status(400).json({ error: "Faltan los datos de la solicitud" });
        }
        const datos = req.body;
        if (!idValido(datos.simulacionId)) {
            return res.status(400).json({ error: "Elige una simulacion valida", campo: "simulacionId" });
        }
        if (!idValido(datos.franjaId)) {
            return res.status(400).json({ error: "Elige un hueco valido", campo: "franjaId" });
        }
        if (!textoValido(datos.direccion, 200)) {
            return res.status(400).json({ error: "Escribe una direccion de 1 a 200 caracteres", campo: "direccion" });
        }
        if (!textoValido(datos.municipio, 100)) {
            return res.status(400).json({ error: "Escribe un municipio de 1 a 100 caracteres", campo: "municipio" });
        }
        if (!codigoPostalValido(datos.codigoPostal)) {
            return res.status(400).json({ error: "Introduce un codigo postal valido de Espana", campo: "codigoPostal" });
        }
        if (datos.aceptaEnvioDatos !== true) {
            return res.status(400).json({ error: "Tienes que aceptar el envio de tus datos al instalador", campo: "aceptaEnvioDatos" });
        }

        conexion = await db.getConnection();
        await conexion.beginTransaction();
        // Esperamos a que termine cualquier otra solicitud del mismo cliente
        await conexion.query("SELECT id FROM usuario WHERE id = ? FOR UPDATE", [req.session.usuario.id]);
        const resultadoSimulacion = await conexion.query("SELECT * FROM simulacion WHERE id = ? FOR UPDATE", [datos.simulacionId]);
        if (resultadoSimulacion[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "La simulacion no existe" });
        }
        const simulacion = resultadoSimulacion[0][0];
        const resultadoProvincia = await conexion.query("SELECT codigo FROM provincia WHERE id = ?", [simulacion.provincia_id]);
        if (datos.codigoPostal.slice(0, 2) !== resultadoProvincia[0][0].codigo) {
            await conexion.rollback();
            return res.status(400).json({ error: "El codigo postal no es de la misma provincia que la simulacion", campo: "codigoPostal" });
        }
        const resultadoActivas = await conexion.query(
            "SELECT id FROM solicitud WHERE usuario_id = ? AND estado IN ('solicitada', 'enviada', 'presupuesto_enviado')",
            [req.session.usuario.id]
        );
        if (resultadoActivas[0].length > 0) {
            await conexion.rollback();
            return res.status(409).json({ error: "Ya tienes una solicitud activa: modificala o cancelala" });
        }
        const resultadoAnterior = await conexion.query("SELECT id FROM solicitud WHERE simulacion_id = ?", [datos.simulacionId]);
        if (resultadoAnterior[0].length > 0) {
            await conexion.rollback();
            return res.status(409).json({ error: "Esta simulacion ya tiene una solicitud" });
        }
        const resultadoFranja = await conexion.query("SELECT * FROM franja WHERE id = ? FOR UPDATE", [datos.franjaId]);
        if (resultadoFranja[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "No existe ese hueco" });
        }
        if (resultadoFranja[0][0].provincia_id !== simulacion.provincia_id) {
            await conexion.rollback();
            return res.status(400).json({ error: "Ese hueco no es de tu provincia", campo: "franjaId" });
        }
        // Solo una peticion puede cambiar este hueco de libre a ocupado
        const reserva = await conexion.query(
            "UPDATE franja SET ocupada = TRUE WHERE id = ? AND ocupada = FALSE AND TIMESTAMP(fecha, hora_inicio) > NOW()",
            [datos.franjaId]
        );
        if (reserva[0].affectedRows === 0) {
            await conexion.rollback();
            return res.status(409).json({ error: "Ese hueco ya no esta libre", campo: "franjaId" });
        }
        const insertar = await conexion.query(
            `INSERT INTO solicitud (usuario_id, simulacion_id, franja_id, direccion, municipio, codigo_postal, estado, fecha_estado)
             VALUES (?, ?, ?, ?, ?, ?, 'solicitada', NOW())`,
            [req.session.usuario.id, datos.simulacionId, datos.franjaId, datos.direccion.trim(), datos.municipio.trim(), datos.codigoPostal]
        );
        await conexion.commit();
        res.status(201).json({ id: insertar[0].insertId, estado: "solicitada" });
    } catch (error) {
        if (conexion) await conexion.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Esta simulacion ya tiene una solicitud" });
        }
        if (reservaEnUso(error)) {
            return res.status(409).json({ error: "Se esta modificando la reserva. Intentalo de nuevo" });
        }
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    } finally {
        if (conexion) conexion.release();
    }
});

// Ruta 17: ver la solicitud mas reciente del cliente
router.get("/mia", requiereRol("cliente"), async (req, res) => {
    try {
        const resultado = await db.query(
            `SELECT s.id, s.estado, s.direccion, s.municipio, s.codigo_postal,
                DATE_FORMAT(s.fecha_solicitud, '%Y-%m-%d %H:%i') AS fechaSolicitud,
                DATE_FORMAT(s.fecha_estado, '%Y-%m-%d %H:%i') AS fechaEstado,
                p.nombre AS provincia, f.id AS franjaId,
                DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(f.hora_inicio, '%H:%i') AS horaInicio, TIME_FORMAT(f.hora_fin, '%H:%i') AS horaFin,
                TIMESTAMP(f.fecha, f.hora_inicio) > DATE_ADD(NOW(), INTERVAL 2 HOUR) AS enPlazo,
                si.tipo_instalacion, si.tipo_tejado, si.superficie, si.paneles_finales, si.potencia_instalada,
                si.coste, si.ahorro_anual, si.amortizacion, si.coste_por_vivienda, si.ahorro_por_vivienda,
                b.id AS presupuestoId, b.importe,
                DATE_FORMAT(b.fecha_envio, '%Y-%m-%d %H:%i') AS fechaEnvio,
                DATE_FORMAT(b.fecha_respuesta, '%Y-%m-%d %H:%i') AS fechaRespuesta
             FROM solicitud s
             JOIN simulacion si ON si.id = s.simulacion_id
             JOIN provincia p ON p.id = si.provincia_id
             JOIN franja f ON f.id = s.franja_id
             LEFT JOIN presupuesto b ON b.solicitud_id = s.id
             WHERE s.usuario_id = ? ORDER BY s.fecha_solicitud DESC, s.id DESC LIMIT 1`,
            [req.session.usuario.id]
        );
        if (resultado[0].length === 0) {
            return res.status(404).json({ error: "Todavia no tienes ninguna solicitud" });
        }
        const fila = resultado[0][0];
        let presupuesto = null;
        if (fila.presupuestoId !== null) {
            presupuesto = { importe: fila.importe, fechaEnvio: fila.fechaEnvio, fechaRespuesta: fila.fechaRespuesta };
        }
        res.json({
            id: fila.id,
            estado: fila.estado,
            fechaSolicitud: fila.fechaSolicitud,
            fechaEstado: fila.fechaEstado,
            sePuedeModificar: fila.estado === "solicitada" && fila.enPlazo === 1,
            provincia: fila.provincia,
            franja: { id: fila.franjaId, fecha: fila.fecha, horaInicio: fila.horaInicio, horaFin: fila.horaFin },
            direccion: fila.direccion,
            municipio: fila.municipio,
            codigoPostal: fila.codigo_postal,
            simulacion: {
                tipoInstalacion: fila.tipo_instalacion,
                tipoTejado: fila.tipo_tejado,
                superficie: fila.superficie,
                panelesFinales: fila.paneles_finales,
                potenciaInstalada: fila.potencia_instalada,
                coste: fila.coste,
                ahorroAnual: fila.ahorro_anual,
                amortizacion: fila.amortizacion,
                costePorVivienda: fila.coste_por_vivienda,
                ahorroPorVivienda: fila.ahorro_por_vivienda
            },
            presupuesto: presupuesto
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    }
});

// Ruta 18: cambiar el hueco de una solicitud propia
router.put("/:id/franja", requiereRol("cliente"), async (req, res) => {
    let conexion;
    try {
        const id = Number(req.params.id);
        if (!idValido(id)) return res.status(404).json({ error: "La solicitud no existe" });
        let franjaId;
        if (req.body) franjaId = req.body.franjaId;
        if (!idValido(franjaId)) {
            return res.status(400).json({ error: "Elige un hueco valido", campo: "franjaId" });
        }
        conexion = await db.getConnection();
        await conexion.beginTransaction();
        await conexion.query("SELECT id FROM usuario WHERE id = ? FOR UPDATE", [req.session.usuario.id]);
        const resultado = await conexion.query(
            `SELECT s.*, si.provincia_id FROM solicitud s JOIN simulacion si ON si.id = s.simulacion_id
             WHERE s.id = ? FOR UPDATE`, [id]
        );
        if (resultado[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "La solicitud no existe" });
        }
        const solicitud = resultado[0][0];
        if (solicitud.usuario_id !== req.session.usuario.id) {
            await conexion.rollback();
            return res.status(403).json({ error: "No es tu solicitud" });
        }
        if (solicitud.estado === "enviada") {
            await conexion.rollback();
            return res.status(409).json({ error: "La solicitud ya se ha enviado al instalador. Para cambiarla, llama a la empresa" });
        }
        if (solicitud.estado !== "solicitada") {
            await conexion.rollback();
            return res.status(409).json({ error: "Esta solicitud ya no se puede modificar" });
        }
        const plazo = await conexion.query(
            "SELECT TIMESTAMP(fecha, hora_inicio) > DATE_ADD(NOW(), INTERVAL 2 HOUR) AS enPlazo FROM franja WHERE id = ?",
            [solicitud.franja_id]
        );
        if (plazo[0][0].enPlazo !== 1) {
            await conexion.rollback();
            return res.status(409).json({ error: "Solo se puede modificar hasta 2 horas antes" });
        }
        const resultadoFranja = await conexion.query(
            `SELECT id, provincia_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                TIME_FORMAT(hora_inicio, '%H:%i') AS horaInicio, TIME_FORMAT(hora_fin, '%H:%i') AS horaFin
             FROM franja WHERE id = ? FOR UPDATE`, [franjaId]
        );
        if (resultadoFranja[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "No existe ese hueco" });
        }
        const franja = resultadoFranja[0][0];
        if (franja.provincia_id !== solicitud.provincia_id) {
            await conexion.rollback();
            return res.status(400).json({ error: "Ese hueco no es de tu provincia", campo: "franjaId" });
        }
        const reserva = await conexion.query(
            "UPDATE franja SET ocupada = TRUE WHERE id = ? AND ocupada = FALSE AND TIMESTAMP(fecha, hora_inicio) > NOW()",
            [franja.id]
        );
        if (reserva[0].affectedRows === 0) {
            await conexion.rollback();
            return res.status(409).json({ error: "Ese hueco ya no esta libre", campo: "franjaId" });
        }
        await conexion.query("UPDATE franja SET ocupada = FALSE WHERE id = ?", [solicitud.franja_id]);
        await conexion.query("UPDATE solicitud SET franja_id = ? WHERE id = ?", [franja.id, id]);
        await conexion.commit();
        res.json({ id: id, estado: "solicitada", franja: { id: franja.id, fecha: franja.fecha, horaInicio: franja.horaInicio, horaFin: franja.horaFin } });
    } catch (error) {
        if (conexion) await conexion.rollback();
        if (reservaEnUso(error)) {
            return res.status(409).json({ error: "Se esta modificando la reserva. Intentalo de nuevo" });
        }
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    } finally {
        if (conexion) conexion.release();
    }
});

// Ruta 19: cancelar y liberar el hueco
router.put("/:id/cancelar", requiereSesion, async (req, res) => {
    let conexion;
    try {
        const id = Number(req.params.id);
        if (!idValido(id)) return res.status(404).json({ error: "La solicitud no existe" });
        conexion = await db.getConnection();
        await conexion.beginTransaction();
        await conexion.query("SELECT id FROM usuario WHERE id = ? FOR UPDATE", [req.session.usuario.id]);
        const resultado = await conexion.query("SELECT * FROM solicitud WHERE id = ? FOR UPDATE", [id]);
        if (resultado[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "La solicitud no existe" });
        }
        const solicitud = resultado[0][0];
        if (req.session.usuario.rol === "admin") {
            if (solicitud.estado !== "solicitada" && solicitud.estado !== "enviada") {
                await conexion.rollback();
                return res.status(409).json({ error: "Esta solicitud ya no se puede cancelar" });
            }
        } else {
            if (solicitud.usuario_id !== req.session.usuario.id) {
                await conexion.rollback();
                return res.status(403).json({ error: "No es tu solicitud" });
            }
            if (solicitud.estado === "enviada") {
                await conexion.rollback();
                return res.status(409).json({ error: "La solicitud ya se ha enviado al instalador. Para anularla, llama a la empresa" });
            }
            if (solicitud.estado !== "solicitada") {
                await conexion.rollback();
                return res.status(409).json({ error: "Esta solicitud ya no se puede cancelar" });
            }
            const plazo = await conexion.query(
                "SELECT TIMESTAMP(fecha, hora_inicio) > DATE_ADD(NOW(), INTERVAL 2 HOUR) AS enPlazo FROM franja WHERE id = ?",
                [solicitud.franja_id]
            );
            if (plazo[0][0].enPlazo !== 1) {
                await conexion.rollback();
                return res.status(409).json({ error: "Solo se puede cancelar hasta 2 horas antes" });
            }
        }
        await conexion.query("UPDATE solicitud SET estado = 'cancelada', fecha_estado = NOW() WHERE id = ?", [id]);
        await conexion.query("UPDATE franja SET ocupada = FALSE WHERE id = ?", [solicitud.franja_id]);
        await conexion.commit();
        res.json({ id: id, estado: "cancelada" });
    } catch (error) {
        if (conexion) await conexion.rollback();
        if (reservaEnUso(error)) {
            return res.status(409).json({ error: "Se esta modificando la reserva. Intentalo de nuevo" });
        }
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    } finally {
        if (conexion) conexion.release();
    }
});

// Ruta 20: aceptar o rechazar un presupuesto propio
router.put("/:id/respuesta", requiereRol("cliente"), async (req, res) => {
    let conexion;
    try {
        const id = Number(req.params.id);
        if (!idValido(id)) return res.status(404).json({ error: "La solicitud no existe" });
        let respuesta;
        if (req.body) respuesta = req.body.respuesta;
        if (respuesta !== "aceptado" && respuesta !== "rechazado") {
            return res.status(400).json({ error: "Elige aceptado o rechazado", campo: "respuesta" });
        }
        conexion = await db.getConnection();
        await conexion.beginTransaction();
        await conexion.query("SELECT id FROM usuario WHERE id = ? FOR UPDATE", [req.session.usuario.id]);
        const resultado = await conexion.query("SELECT * FROM solicitud WHERE id = ? FOR UPDATE", [id]);
        if (resultado[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "La solicitud no existe" });
        }
        const solicitud = resultado[0][0];
        if (solicitud.usuario_id !== req.session.usuario.id) {
            await conexion.rollback();
            return res.status(403).json({ error: "No es tu solicitud" });
        }
        if (solicitud.estado !== "presupuesto_enviado") {
            await conexion.rollback();
            return res.status(409).json({ error: "Esta solicitud no tiene un presupuesto pendiente de respuesta" });
        }
        const presupuesto = await conexion.query("SELECT id FROM presupuesto WHERE solicitud_id = ? FOR UPDATE", [id]);
        if (presupuesto[0].length === 0) {
            await conexion.rollback();
            return res.status(404).json({ error: "Esta solicitud no tiene presupuesto" });
        }
        await conexion.query("UPDATE presupuesto SET fecha_respuesta = NOW() WHERE solicitud_id = ?", [id]);
        await conexion.query("UPDATE solicitud SET estado = ?, fecha_estado = NOW() WHERE id = ?", [respuesta, id]);
        await conexion.commit();
        res.json({ id: id, estado: respuesta });
    } catch (error) {
        if (conexion) await conexion.rollback();
        if (reservaEnUso(error)) {
            return res.status(409).json({ error: "Se esta modificando la solicitud. Intentalo de nuevo" });
        }
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    } finally {
        if (conexion) conexion.release();
    }
});

// Pendiente: ruta 21, descargar el PDF del presupuesto
module.exports = router;
