//Rutas 1-4: Registro, login, logout, quien soy

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requiereSesion, requiereRol } = require("../middleware/sesion");

const router = express.Router();

// Ruta 2: POST /api/auth/login  -> inicia sesión
router.post("/login", async (req, res) => {
    try {
        //Leer
        if (!req.body) {
            return res.status(400).json({ error: "Faltan los datos" });
        }

        //leer los datos
        const email = req.body.email;
        const password = req.body.password;

        //Validar
        if (!email) {
            return res.status(400).json({ error: "Escribe tu email", campo: "email" });
        }

        if (!password) {
            return res.status(400).json({ error: "Escribe tu contraseña", campo: "password" });
        }

        //Buscar el usuario en la base de datos
        const resultado = await db.query("SELECT id, nombre, rol, password_hash FROM usuario WHERE email = ?", [email]);

        const filas = resultado[0];

        //Sin resultados, el email no existe
        if (filas.length === 0) {
            return res.status(401).json({ error: "Email o contraseña incorrectos" });
        }

        const usuario = filas[0];

        //comprobar la contraseña
        const correcta = await bcrypt.compare(password, usuario.password_hash);
        if (!correcta) {
            return res.status(401).json({ error: "Email o contraseña incorrectos" });
        }

        //guardar el usario en la sesion    
        req.session.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            rol: usuario.rol
        };

        //Responder
        res.status(200).json(req.session.usuario);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    }
});

//Ruta 4: GET /api/auth/yo  - quien inicia sesión
router.get("/yo", requiereSesion, (req, res) => {
    res.status(200).json(req.session.usuario);
});




module.exports = router;