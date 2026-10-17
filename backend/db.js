//backend/db.js conexión a la base de datos MariaDB

const mysql = require('mysql2/promise');

const db=mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PUERTO),
    user: process.env.DB_USER,
    password: process.env.DB_CONTRASENA,
    database: process.env.DB_NOMBRE,
    decimalNumbers: true,
});

module.exports = db;