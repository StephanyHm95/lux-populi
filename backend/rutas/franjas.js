//Rutas 12-15: franjas horarias calendario

const express = require("express");
const db = require("../db");
const {requiereSesion, requiereRol} = require("../middleware/sesion");

const router = express.Router();
// Trozos de SQL que se repiten: fecha y horas con el formato del contrato
const FORMATO = `
  DATE_FORMAT(f.fecha, '%Y-%m-%d')      AS fecha,
  TIME_FORMAT(f.hora_inicio, '%H:%i')   AS horaInicio,
  TIME_FORMAT(f.hora_fin, '%H:%i')      AS horaFin`;

// Ruta 12. GET /api/franjas/libres?provincia=08: huecos libres de una provincia (pública)
router.get("/libres", async (req, res) => {
  try {
    const codigo = req.query.provincia;
    if (!codigo) {
      return res.status(400).json({ error: "Falta la provincia", campo: "provincia" });
    }

    // Libres y que todavía no han empezado, de esa provincia
    const [filas] = await db.query(
      `SELECT f.id, ${FORMATO}
       FROM franja f
       JOIN provincia p ON p.id = f.provincia_id
       WHERE p.codigo = ?
         AND f.ocupada = FALSE
         AND TIMESTAMP(f.fecha, f.hora_inicio) > NOW()
       ORDER BY f.fecha, f.hora_inicio`,
      [String(codigo)]
    );
    res.json(filas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ruta 13. GET /api/franjas?ver=proximas&provincia=08: calendario del admin (solo admin)
router.get("/", requiereRol("admin"), async (req, res) => {
  try {
    const ver = req.query.ver === "todas" ? "todas" : "proximas";

    // Los filtros se añaden solo si hacen falta
    const condiciones = [];
    const valores = [];
    if (ver === "proximas") condiciones.push("f.fecha >= CURDATE()");
    if (req.query.provincia) {
      condiciones.push("p.codigo = ?");
      valores.push(String(req.query.provincia));
    }
    const where = condiciones.length ? "WHERE " + condiciones.join(" AND ") : "";

    // LEFT JOIN: salen también los huecos sin solicitud (con NULL).
    // La condición de "no cancelada" va en el ON, no en el WHERE.
    const [filas] = await db.query(
      `SELECT f.id, ${FORMATO}, f.ocupada,
              p.nombre AS provincia,
              s.id AS solicitudId,
              CONCAT(u.nombre, ' ', u.apellidos) AS cliente,
              s.municipio, s.estado
       FROM franja f
       JOIN provincia p ON p.id = f.provincia_id
       LEFT JOIN solicitud s ON s.franja_id = f.id AND s.estado <> 'cancelada'
       LEFT JOIN usuario u ON u.id = s.usuario_id
       ${where}
       ORDER BY f.fecha, f.hora_inicio`,
      valores
    );

    // Cada hueco lleva su solicitud dentro, o null si no tiene
    res.json(
      filas.map((fila) => ({
        id: fila.id,
        fecha: fila.fecha,
        horaInicio: fila.horaInicio,
        horaFin: fila.horaFin,
        ocupada: Boolean(fila.ocupada),
        provincia: fila.provincia,
        solicitud: fila.solicitudId
          ? {
              id: fila.solicitudId,
              cliente: fila.cliente,
              municipio: fila.municipio,
              estado: fila.estado,
            }
          : null,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ruta 14. POST /api/franjas: crea un hueco (solo admin)
router.post("/", requiereRol("admin"), async (req, res) => {
  try {
    const { provincia, fecha, horaInicio, horaFin } = req.body || {};

    // Validaciones, en este orden
    if (typeof provincia !== "string" || provincia === "") {
      return res.status(400).json({ error: "Falta la provincia", campo: "provincia" });
    }
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: "La fecha tiene que ser AAAA-MM-DD", campo: "fecha" });
    }
    const formatoHora = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (typeof horaInicio !== "string" || !formatoHora.test(horaInicio)) {
      return res.status(400).json({ error: "La hora tiene que ser HH:MM", campo: "horaInicio" });
    }
    if (typeof horaFin !== "string" || !formatoHora.test(horaFin)) {
      return res.status(400).json({ error: "La hora tiene que ser HH:MM", campo: "horaFin" });
    }
    if (horaFin <= horaInicio) {
      return res.status(400).json({ error: "La hora de fin tiene que ser posterior a la de inicio", campo: "horaFin" });
    }

    // ¿Existe la fecha? (el 30 de febrero pasaría a ser el 2 de marzo)
    const [anio, mes, dia] = fecha.split("-").map(Number);
    const objetoFecha = new Date(anio, mes - 1, dia);
    if (objetoFecha.getMonth() !== mes - 1 || objetoFecha.getDate() !== dia) {
      return res.status(400).json({ error: "Esa fecha no existe", campo: "fecha" });
    }

    // ¿Empieza en el futuro?
    const [h, m] = horaInicio.split(":").map(Number);
    if (new Date(anio, mes - 1, dia, h, m) <= new Date()) {
      return res.status(400).json({ error: "El hueco tiene que empezar en el futuro", campo: "fecha" });
    }

    // Buscar la provincia por su código
    const [provincias] = await db.query(
      "SELECT id, nombre FROM provincia WHERE codigo = ?",
      [provincia]
    );
    if (provincias.length === 0) {
      return res.status(400).json({ error: "Esa provincia no existe", campo: "provincia" });
    }
    const provinciaId = provincias[0].id;

    // ¿Se pisa con otro hueco de la misma provincia y día?
    // Se pisan si uno empieza antes de que acabe el otro y acaba después de que empiece.
    const [solapes] = await db.query(
      `SELECT COUNT(*) AS total FROM franja
       WHERE provincia_id = ? AND fecha = ?
         AND hora_inicio < ? AND hora_fin > ?`,
      [provinciaId, fecha, horaFin, horaInicio]
    );
    if (solapes[0].total > 0) {
      return res.status(409).json({ error: "Se solapa con otro hueco" });
    }

    const [resultado] = await db.query(
      "INSERT INTO franja (provincia_id, fecha, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)",
      [provinciaId, fecha, horaInicio, horaFin]
    );

    res.status(201).json({
      id: resultado.insertId,
      fecha,
      horaInicio,
      horaFin,
      ocupada: false,
      provincia: provincias[0].nombre,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ruta 15. DELETE /api/franjas/:id: borra un hueco (solo admin)
router.delete("/:id", requiereRol("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: "No existe ese hueco" });
    }

    const [huecos] = await db.query("SELECT id FROM franja WHERE id = ?", [id]);
    if (huecos.length === 0) {
      return res.status(404).json({ error: "No existe ese hueco" });
    }

    // Solo se borran los que nunca han tenido una solicitud (ni cancelada)
    const [solicitudes] = await db.query(
      "SELECT COUNT(*) AS total FROM solicitud WHERE franja_id = ?",
      [id]
    );
    if (solicitudes[0].total > 0) {
      return res.status(409).json({
        error: "Este hueco tiene o ha tenido una solicitud y no se puede borrar",
      });
    }

    await db.query("DELETE FROM franja WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});
module.exports = router;