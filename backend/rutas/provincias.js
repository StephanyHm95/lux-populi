//Rutas: Provincias para calculadora

const express = require("express");
const db = require("../db");
const {requiereSesion, requiereRol} = require("../middleware/sesion");

const router = express.Router();
// GET /api/provincias: devuelve la lista de provincias (ruta pública)
router.get("/", async (req, res) => {
  // try catch para controlar los errores si falla algo
  try {
    // ROUND redondea a entero y AS pone el nombre que espera el contrato
    const [filas] = await db.query(
      `SELECT id, codigo, nombre,
              ROUND(produccion_anual) AS produccionKwp,
              ROUND(radiacion_anual)  AS radiacionAnual
       FROM provincia
       ORDER BY nombre`
    );
    // Enviamos las provincias en formato json
    res.json(filas);
  } catch (error) {
    // Mostramos el error y devolvemos un 500 genérico
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});
module.exports = router;