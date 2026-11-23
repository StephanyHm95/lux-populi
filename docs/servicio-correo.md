# BE 06 · Servicio de correo

Avance revisado el 23/11/2026.

`backend/servicios/email.js` prepara el correo de una solicitud de visita y lo envia al instalador mediante Nodemailer. Incluye los datos del cliente, la direccion, la franja y una estimacion de la instalacion. El remitente y la direccion de respuesta son `EMAIL_EMPRESA`.

## Configuracion

El entorno debe proporcionar estas variables; las credenciales reales se guardan fuera de Git:

```dotenv
SMTP_HOST=smtp.ethereal.email
SMTP_PUERTO=587
SMTP_SEGURO=false
SMTP_USUARIO=tu_usuario_de_prueba
SMTP_CONTRASENA=tu_contrasena_de_prueba
EMAIL_EMPRESA=correo_de_tu_cuenta_de_prueba
```

El puerto 465 activa la conexion cifrada desde el principio por defecto. `SMTP_SEGURO` permite indicar `true` o `false` de forma explicita. Si se proporciona un usuario SMTP, tambien hace falta su contrasena.

`enviarSolicitud(solicitud, emailInstalador)` devuelve el resultado del envio cuando el servidor SMTP acepta un destinatario. Los errores de configuracion o de envio producen un error con `status: 503`, sin incluir las credenciales en el mensaje. `emailValido` comprueba el formato y el limite de 150 caracteres.

## Comprobaciones del avance

El 23/11/2026 se comprobo el servicio con un SMTP local que captura los mensajes en memoria: aceptacion del correo, contenido de la visita y de la empresa, rechazo de destinatarios incorrectos, rechazo SMTP y configuracion ausente. No se enviaron correos externos en esa comprobacion.

`scripts/probar-correo.js` permite una prueba opcional con una cuenta temporal de Ethereal y datos ficticios:

```powershell
node scripts/probar-correo.js
```

El script muestra un enlace de vista previa y no modifica el archivo `.env`. Esta revision no ha ejecutado una nueva prueba con Ethereal.

## Pendiente de integrar

Este avance incorpora el servicio, su dependencia y el script de prueba. La ruta 24 del administrador y el cambio de estado de la solicitud se incorporaran por separado con BE 07. Tambien quedan pendientes la configuracion SMTP del despliegue y la comprobacion del flujo completo desde el frontend.
