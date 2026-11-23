const nodemailer = require("nodemailer");

function emailValido(email) {
    if (typeof email !== "string") return false;
    if (email.length > 150) return false;
    return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email);
}

async function enviarSolicitud(solicitud, emailInstalador) {
    try {
        const host = process.env.SMTP_HOST;
        const puerto = Number(process.env.SMTP_PUERTO);
        const emailEmpresa = process.env.EMAIL_EMPRESA;

        if (!host) throw new Error("Falta el servidor SMTP");
        if (!Number.isInteger(puerto)) throw new Error("Puerto SMTP incorrecto");
        if (puerto < 1) throw new Error("Puerto SMTP incorrecto");
        if (puerto > 65535) throw new Error("Puerto SMTP incorrecto");
        if (!emailValido(emailEmpresa)) throw new Error("Falta el email de la empresa");
        if (!emailValido(emailInstalador)) throw new Error("Email del instalador incorrecto");

        // El puerto 465 usa una conexion cifrada desde el principio
        let seguro = puerto === 465;
        if (process.env.SMTP_SEGURO === "true") seguro = true;
        if (process.env.SMTP_SEGURO === "false") seguro = false;
        const opciones = {
            host: host,
            port: puerto,
            secure: seguro,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        };
        if (process.env.SMTP_USUARIO) {
            if (!process.env.SMTP_CONTRASENA) throw new Error("Falta la contrasena SMTP");
            opciones.auth = {
                user: process.env.SMTP_USUARIO,
                pass: process.env.SMTP_CONTRASENA
            };
        } else if (process.env.SMTP_CONTRASENA) {
            throw new Error("Falta el usuario SMTP");
        }

        const cliente = solicitud.cliente;
        const franja = solicitud.franja;
        const texto = [
            "Solicitud de visita " + solicitud.id,
            "",
            "Cliente: " + cliente.nombre + " " + cliente.apellidos,
            "Email: " + cliente.email,
            "Telefono: " + cliente.telefono,
            "Direccion: " + solicitud.direccion,
            "Municipio: " + solicitud.municipio,
            "Codigo postal: " + solicitud.codigoPostal,
            "Provincia: " + solicitud.provincia,
            "Visita: " + franja.fecha + " de " + franja.horaInicio + " a " + franja.horaFin,
            "Instalacion: " + solicitud.simulacion.tipoInstalacion,
            "Paneles estimados: " + solicitud.simulacion.panelesFinales,
            "Potencia estimada: " + solicitud.simulacion.potenciaInstalada + " kWp",
            "",
            "Envia el presupuesto a la empresa: " + emailEmpresa
        ].join("\n");

        const transporte = nodemailer.createTransport(opciones);
        const resultado = await transporte.sendMail({
            from: { name: "Lux Populi", address: emailEmpresa },
            to: { address: emailInstalador },
            replyTo: { address: emailEmpresa },
            subject: "Solicitud de visita " + solicitud.id + " - " + solicitud.provincia,
            text: texto
        });
        if (!Array.isArray(resultado.accepted)) throw new Error("El servidor no ha aceptado el correo");
        if (resultado.accepted.length !== 1) throw new Error("El servidor no ha aceptado el correo");
        return resultado;
    } catch (error) {
        const errorServicio = new Error("No se ha podido enviar el email. Intentalo de nuevo");
        errorServicio.status = 503;
        throw errorServicio;
    }
}

module.exports = { enviarSolicitud, emailValido };
