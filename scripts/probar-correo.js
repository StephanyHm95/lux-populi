// Prueba opcional con Ethereal. Solo usa datos ficticios y no modifica el .env.
const nodemailer = require("nodemailer");
const { enviarSolicitud } = require("../backend/servicios/email");

async function probarCorreo() {
    const cuenta = await nodemailer.createTestAccount();
    process.env.SMTP_HOST = cuenta.smtp.host;
    process.env.SMTP_PUERTO = String(cuenta.smtp.port);
    process.env.SMTP_SEGURO = String(cuenta.smtp.secure);
    process.env.SMTP_USUARIO = cuenta.user;
    process.env.SMTP_CONTRASENA = cuenta.pass;
    process.env.EMAIL_EMPRESA = cuenta.user;

    const solicitud = {
        id: 1,
        cliente: { nombre: "Prueba", apellidos: "Local", email: "cliente@example.test", telefono: "600000001" },
        direccion: "Calle de prueba 1", municipio: "Sabadell", codigoPostal: "08201", provincia: "Barcelona",
        franja: { fecha: "2026-11-12", horaInicio: "10:00", horaFin: "12:00" },
        simulacion: { tipoInstalacion: "casa", panelesFinales: 5, potenciaInstalada: 2.25 }
    };
    const resultado = await enviarSolicitud(solicitud, "instalador@example.test");
    console.log("Correo ficticio capturado por Ethereal. No se entrega a un destinatario real.");
    console.log("Vista previa: " + nodemailer.getTestMessageUrl(resultado));
}

probarCorreo().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
