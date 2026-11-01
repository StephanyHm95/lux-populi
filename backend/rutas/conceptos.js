//Rutas 8-11: conceptos del presupuesto

const express = require("express");
const db = require("../db");
const {requiereSesion, requiereRol} = require("../middleware/sesion");

const router = express.Router();
// Valida los 4 campos al crear o modificar un concepto.
// Devuelve el error del primero que esté mal, o null si todo está bien.
function validar(datos) {
  const { nombre, precio, aplicaA, soloPlana } = datos || {};

  if (typeof nombre !== "string" || nombre.trim().length < 1 || nombre.trim().length > 100) {
    return { error: "El nombre tiene que tener de 1 a 100 caracteres", campo: "nombre" };
  }
  if (typeof precio !== "number" || !Number.isFinite(precio) || precio < 0) {
    return { error: "El precio tiene que ser un número de 0 o más", campo: "precio" };
  }
  if (!["casa", "edificio", "ambos"].includes(aplicaA)) {
    return { error: "Tiene que ser casa, edificio o ambos", campo: "aplicaA" };
  }
  if (typeof soloPlana !== "boolean") {
    return { error: "Tiene que ser true o false", campo: "soloPlana" };
  }
  return null;
}

// Pasa una fila de la base de datos al formato del contrato
function aContrato(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    precio: Number(fila.precio),
    aplicaA: fila.aplica_a,
    // MySQL guarda el boolean como 0 o 1: lo pasamos a false o true
    soloPlana: fila.solo_plana === 1 || fila.solo_plana === true,
  };
}

// Ruta 8. GET /api/conceptos: lista los conceptos (solo admin)
router.get("/", requiereRol("admin"), async (req, res) => {
  try {
    const [filas] = await db.query("SELECT * FROM concepto ORDER BY id");
    res.json(filas.map(aContrato));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ruta 9. POST /api/conceptos: crea un concepto (solo admin)
router.post("/", requiereRol("admin"), async (req, res) => {
  try {
    const datos = req.body || {};
    const fallo = validar(datos);
    if (fallo) return res.status(400).json(fallo);

    const [resultado] = await db.query(
      "INSERT INTO concepto (nombre, precio, aplica_a, solo_plana) VALUES (?, ?, ?, ?)",
      [datos.nombre.trim(), datos.precio, datos.aplicaA, datos.soloPlana]
    );

    res.status(201).json({
      id: resultado.insertId,
      nombre: datos.nombre.trim(),
      precio: datos.precio,
      aplicaA: datos.aplicaA,
      soloPlana: datos.soloPlana,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ruta 10. PUT /api/conceptos/:id: modifica un concepto (solo admin)
router.put("/:id", requiereRol("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: "No existe ese concepto" });
    }

    const datos = req.body || {};
    const fallo = validar(datos);
    if (fallo) return res.status(400).json(fallo);

    const [resultado] = await db.query(
      "UPDATE concepto SET nombre = ?, precio = ?, aplica_a = ?, solo_plana = ? WHERE id = ?",
      [datos.nombre.trim(), datos.precio, datos.aplicaA, datos.soloPlana, id]
    );
    // Si no se ha tocado ninguna fila, ese id no existe
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "No existe ese concepto" });
    }

    res.json({
      id,
      nombre: datos.nombre.trim(),
      precio: datos.precio,
      aplicaA: datos.aplicaA,
      soloPlana: datos.soloPlana,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ruta 11. DELETE /api/conceptos/:id: borra un concepto (solo admin)
router.delete("/:id", requiereRol("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: "No existe ese concepto" });
    }

    const [resultado] = await db.query("DELETE FROM concepto WHERE id = ?", [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: "No existe ese concepto" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});
module.exports = router;