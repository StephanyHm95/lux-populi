//Rutas 1-4: Registro, login, logout, quien soy

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requiereSesion, requiereRol } = require("../middleware/sesion");

const router = express.Router();

//Ruta 1: POST /api/auth/register  - crear una cuenta
router.post("/registro", async (req, res) => {
    try {
        //Leer que hay datos    
        if (!req.body) {
            return res.status(400).json({ error: "Faltan datos" });
        }

        //Leer los datos del formulario
        const nombre = req.body.nombre;
        const apellidos = req.body.apellidos;
        const email = req.body.email;
        const telefono = req.body.telefono;
        const password = req.body.password;
        const password2 = req.body.password2;
        const aceptaPrivacidad = req.body.aceptaPrivacidad;

        //Validar los datos nombre
        if (typeof nombre !== "string") {
            return res.status(400).json({
                error: "Escribe tu nombre",
                campo: "nombre"
            });
        }

        if (nombre.trim() === "") {
            return res.status(400).json({
                error: "El nombre no puede estar vacío",
                campo: "nombre"
            });
        }

        if (nombre.trim().length > 100) {
            return res.status(400).json({
                error: "El nombre no puede tener más de 100 caracteres",
                campo: "nombre"
            });
        }

        //validar datos apellidos
        if (typeof apellidos !== "string") {
            return res.status(400).json({
                error: "Escribe tus apellidos",
                campo: "apellidos"
            });
        }

        if (apellidos.trim() === "") {
            return res.status(400).json({
                error: "Los apellidos no pueden estar vacíos",
                campo: "apellidos"
            });
        }

        if (apellidos.trim().length > 150) {
            return res.status(400).json({
                error: "Los apellidos no pueden tener más de 150 caracteres",
                campo: "apellidos"
            });
        }

        //validar email
        if (typeof email !== "string") {
            return res.status(400).json({
                error: "Escribe tu email",
                campo: "email"
            });
        }

        if (email.trim() === "") {
            return res.status(400).json({
                error: "El email no puede estar vacío",
                campo: "email"
            });
        }

        if (email.trim().length > 150) {
            return res.status(400).json({
                error: "El email no puede tener más de 150 caracteres",
                campo: "email"
            });
        }

        //validar formato del email
        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (formatoEmail.test(email.trim()) === false) {
            return res.status(400).json({
                error: "El email no tiene un formato válido",
                campo: "email"
            });
        }

        //validar telefono
        if (typeof telefono !== "string") {
            return res.status(400).json({
                error: "Escribe tu teléfono",
                campo: "telefono"
            });
        }

        if (telefono.trim() === "") {
            return res.status(400).json({
                error: "El teléfono no puede estar vacío",
                campo: "telefono"
            });
        }

        //comprobar telefono 9 digitos
        const formatoTelefono = /^\d{9}$/;

        if (formatoTelefono.test(telefono.trim()) === false) {
            return res.status(400).json({
                error: "El teléfono debe tener 9 dígitos",
                campo: "telefono"
            });
        }

        //validar la contraseña
        if (typeof password !== "string") {
            return res.status(400).json({
                error: "Escribe tu contraseña",
                campo: "password"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: "La contraseña debe tener al menos 8 caracteres",
                campo: "password"
            });
        }

        if (bcrypt.truncates(password) === true) {
            return res.status(400).json({
                error: "La contraseña es muy larga",
                campo: "password"
            });
        }

        //validar la confirmación de la contraseña
        if (typeof password2 !== "string") {
            return res.status(400).json({
                error: "Repite tu contraseña",
                campo: "password2"
            });
        }

        if (password !== password2) {
            return res.status(400).json({
                error: "Las contraseñas no coinciden",
                campo: "password2"
            });
        }

        //comprobar que acepto la política de privacidad
        if (aceptaPrivacidad !== true) {
            return res.status(400).json({
                error: "Debes aceptar la política de privacidad",
                campo: "aceptaPrivacidad"
            });
        }

        //preparar el email
        const emailLimpio = email.trim().toLowerCase();

        //comprobar que el email no existe
        const resultado = await db.query("SELECT id FROM usuario WHERE email = ?", [emailLimpio]);

        const filas = resultado[0];

        if (filas.length > 0) {
            return res.status(409).json({
                error: "Ya existe una cuenta con este email",
                campo: "email"
            });
        }

        //crear el hash de la contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        //crear un nuevo usuario 
        const resultadoInsertar = await db.query(
            "INSERT INTO usuario (nombre,apellidos, email, telefono, password_hash,rol) VALUES (?, ?, ?, ?, ?, ?)",
            [nombre.trim(), apellidos.trim(), emailLimpio, telefono.trim(), passwordHash, "cliente"]
        );

        //obtener el resultado de la inserción
        const usuarioCreado = resultadoInsertar[0];

        //crear la sesión nueva del usuario
        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({ error: "Cuenta creada. No se pudo iniciar sesión. Prueba a iniciar sesión." });
            }

        //guardar el usuario en la sesión
        req.session.usuario = {
            id: usuarioCreado.insertId,
            nombre: nombre.trim(),
            rol: "cliente"
        };

        //confirmar que la cuenta se creo
        res.status(201).json(req.session.usuario);

    });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ 
                error: "El email ya está en uso",
                campo: "email"});
        }
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    }
});

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

//Ruta 3: POST /api/auth/logout  - cerrar sesión
router.post("/logout", requiereSesion, (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({ error: "Error al cerrar sesión" });
        }

        res.clearCookie("connect.sid", { path: "/" });
        res.status(200).json({ ok: true });
    });
});


module.exports = router;