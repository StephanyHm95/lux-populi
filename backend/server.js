// Arranca y enchufa las rutas
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const db = require("./db");

const app = express();

//Entender el JSON de las peticiones
app.use(express.json());

//cookies sesion
app.use(session({
    secret: process.env.SESION_SECRETO,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 } // cookie de 8 horas
}));

//Frontend de Rosalia
app.use(express.static(path.join(__dirname, "public")));

//rutas de la api
app.use("/api/auth", require("./rutas/auth"));
app.use("/api/parametros", require("./rutas/parametros"));
app.use("/api/simulaciones", require("./rutas/simulaciones"));
app.use("/api/conceptos", require("./rutas/conceptos"));
app.use("/api/franjas", require("./rutas/franjas"));
app.use("/api/solicitudes", require("./rutas/solicitudes"));
app.use("/api/gestion", require("./rutas/gestion"));
app.use("/api/chat", require("./rutas/chat"));
app.use("/api/provincias", require("./rutas/provincias"));

//ruta api que no existe
app.use("/api", (req, res) => {
    res.status(404).json({ error: "Esta ruta no existe" });
});

//encender el servidor y comprobar la base de datos
const puerto = Number(process.env.PUERTO) || 3000;
app.listen(puerto, () => {
    console.log(`Servidor en http://localhost:${puerto}`);
    db.query("SELECT 1") 
    .then(() => console.log("Base de datos conectada"))
    .catch(err => console.error("Error al conectar con la base de datos:", err.message));
});
