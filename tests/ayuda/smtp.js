// Servidor de correo solo para pruebas. Guarda el mensaje en memoria y no lo envia a nadie.
const net = require("node:net");

async function crearServidorCorreo() {
    const mensajes = [];
    const estado = { rechazar: false };
    const conexiones = new Set();
    const servidor = net.createServer(socket => {
        conexiones.add(socket);
        socket.on("close", () => conexiones.delete(socket));
        socket.on("error", () => {});
        socket.setEncoding("utf8");
        socket.write("220 localhost ESMTP pruebas\r\n");
        let buffer = "", enDatos = false, destinatario = "", contenido = [];
        socket.on("data", trozo => {
            buffer += trozo;
            let posicion;
            while ((posicion = buffer.indexOf("\r\n")) !== -1) {
                const linea = buffer.slice(0, posicion);
                buffer = buffer.slice(posicion + 2);
                if (enDatos) {
                    if (linea === ".") {
                        mensajes.push({ destinatario, texto: contenido.join("\r\n") });
                        contenido = [];
                        enDatos = false;
                        socket.write("250 2.0.0 Mensaje guardado para la prueba\r\n");
                    } else {
                        contenido.push(linea.replace(/^\.\./, "."));
                    }
                    continue;
                }
                const comando = linea.toUpperCase();
                if (comando.startsWith("EHLO") || comando.startsWith("HELO")) {
                    socket.write("250-localhost\r\n250 8BITMIME\r\n");
                } else if (comando.startsWith("MAIL FROM:")) {
                    destinatario = "";
                    socket.write("250 2.1.0 Remitente correcto\r\n");
                } else if (comando.startsWith("RCPT TO:")) {
                    if (estado.rechazar) socket.write("550 5.1.1 Destinatario rechazado en la prueba\r\n");
                    else {
                        destinatario = linea;
                        socket.write("250 2.1.5 Destinatario correcto\r\n");
                    }
                } else if (comando === "DATA") {
                    enDatos = true;
                    socket.write("354 Termina el mensaje con un punto\r\n");
                } else if (comando === "QUIT") {
                    socket.end("221 Adios\r\n");
                } else {
                    socket.write("250 Correcto\r\n");
                }
            }
        });
    });
    await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
    return {
        mensajes, estado, puerto: servidor.address().port,
        cerrar: async () => {
            for (const socket of conexiones) socket.destroy();
            await new Promise(resolve => servidor.close(resolve));
        }
    };
}

module.exports = { crearServidorCorreo };
