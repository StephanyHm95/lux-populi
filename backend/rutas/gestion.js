// Rutas 22-23: consultar las solicitudes del admin
const express = require("express");
const db = require("../db");
const { requiereRol } = require("../middleware/sesion");
const router = express.Router();

// Todas las rutas de este archivo son solo para el administrador
router.use(requiereRol("admin"));

function idValido(id) {
    if (!Number.isSafeInteger(id)) return false;
    if (id < 1) return false;
    if (id > 2147483647) return false;
    return true;
}

// Datos de una solicitud para la pantalla del administrador
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

module.exports = router;
