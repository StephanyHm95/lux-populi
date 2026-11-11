const express = require("express");
const router = express.Router();

const IA_URL = process.env.IA_URL || "http://ia:8000";

router.post("/", async (req, res) => {
  const mensaje = req.body?.mensaje;

  if (typeof mensaje !== "string" || !mensaje.trim() || mensaje.length > 500) {
    return res.status(400).json({ error: "El mensaje debe contener entre 1 y 500 caracteres." });
  }

  const historial = req.body?.historial ?? [];

  if (
    !Array.isArray(historial) ||
    historial.length > 10 ||
    !historial.every(item =>
      item &&
      typeof item === "object" &&
      ["usuario", "asistente"].includes(item.rol) &&
      typeof item.texto === "string" &&
      item.texto.length <= 5000
    )
  ) {
    return res.status(400).json({ error: "Historial de conversación no válido." });
  }

  try {
    const respuesta = await fetch(`${IA_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        pregunta: mensaje.trim(),
        historial,
        categoria: "deduccion_fiscal",
        ambito: "España",
        fecha_referencia: new Date().toISOString().slice(0, 10)
      })
    });

    if (!respuesta.ok) {
      throw new Error(`FastAPI devolvió HTTP ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    if (typeof datos.respuesta !== "string") {
      throw new Error("Respuesta no válida del servicio IA");
    }

    return res.json({ respuesta: datos.respuesta });
  } catch (error) {
    console.error("Error del chatbot:", error.message);
    return res.status(503).json({
      error: "El asistente no está disponible temporalmente."
    });
  }
});

module.exports = router;
