//Rutas 1-4: Registro, login, logout, quien soy

const express = require("express");
const db = require("../db");
const {requiereSesion, requiereRol} = require("../middleware/sesion");

const router = express.Router();

module.exports = router;