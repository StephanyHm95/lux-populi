//Rutas 6-7: parametros del calculo
const express = require("express");
const db = require("../db");
const {requiereSesion, requiereRol} = require("../middleware/sesion");

const router = express.Router();
// Tabla de traducción: clave en la base de datos -> nombre en el json
const NOMBRES = {
  precio_kwp: "precioKwp",
  potencia_panel: "potenciaPanel",
  precio_luz: "precioLuz",
  precio_compensacion: "precioCompensacion",
};

// Lee las 4 filas de la tabla y las junta en un solo objeto.
// La usan las dos rutas, para no repetir código.
async function leerParametros() {
  const [filas] = await db.query("SELECT clave, valor FROM parametro");
  const resultado = {};
  for (const fila of filas) {
    const nombreJson = NOMBRES[fila.clave];
    if (nombreJson) resultado[nombreJson] = Number(fila.valor);
  }
  return resultado;
}

// Ruta 6. GET /api/parametros: devuelve los 4 parámetros (solo admin)
router.get("/", requiereRol("admin"), async (req, res) => {
  try {
    res.json(await leerParametros());
  } catch (error) {
    // Mostramos el error y devolvemos un 500 genérico
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// Ruta 7. PUT /api/parametros: guarda los 4 parámetros (solo admin)
router.put("/", requiereRol("admin"), async (req, res) => {
  try {
    // Recogemos los datos que llegan en el json
    const datos = req.body || {};

    // Primero se validan los 4. Si falla uno, no se guarda ninguno.
    for (const nombreJson of Object.values(NOMBRES)) {
      const valor = datos[nombreJson];
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
        return res.status(400).json({
          error: "Tiene que ser un número mayor que 0",
          campo: nombreJson,
        });
      }
    }

    // Un UPDATE por cada parámetro
    for (const [clave, nombreJson] of Object.entries(NOMBRES)) {
      await db.query("UPDATE parametro SET valor = ? WHERE clave = ?", [
        datos[nombreJson],
        clave,
      ]);
    }

    // Se vuelven a leer de la base de datos y se responden
    res.json(await leerParametros());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor" });
  }
});
module.exports = router;