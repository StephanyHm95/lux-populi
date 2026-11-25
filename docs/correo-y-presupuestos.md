# Correo y presupuestos

El correo de las visitas (BE 06) se subió el 23/11/2026 a `backend/gestion-pendiente`, en el commit `d1dc653`, con lo necesario para enviarlo y probarlo. Está explicado en [servicio-correo.md](servicio-correo.md). La descarga y las consultas de las rutas 21 a 23 están descritas en [consultas-y-presupuestos.md](consultas-y-presupuestos.md). Este documento explica también el envío al instalador y la subida del presupuesto, rutas 24 y 25.

## Archivos

| Archivo | Para que sirve |
| --- | --- |
| `backend/servicios/email.js` | Preparar y enviar el correo con los datos de la visita |
| `backend/servicios/presupuestos.js` | Indicar la carpeta privada y comprobar los nombres de los PDF |
| `backend/rutas/solicitudes.js` | Incluye la ruta 21 para descargar el PDF |
| `backend/rutas/gestion.js` | Incluye las rutas 22 a 25 para el administrador |
| `package.json` y `package-lock.json` | Incluyen Nodemailer para el correo y Multer para recibir el PDF |
| `compose.yaml` | Conserva los PDF en un volumen de Docker |

## Configurar el correo

Anade estas variables a tu `.env` con los datos del servidor de correo elegido:

```dotenv
SMTP_HOST=smtp.ethereal.email
SMTP_PUERTO=587
SMTP_SEGURO=false
SMTP_USUARIO=tu_usuario_de_prueba
SMTP_CONTRASENA=tu_contrasena_de_prueba
EMAIL_EMPRESA=correo_de_tu_cuenta_de_prueba
```

Este ejemplo es para [Ethereal](https://nodemailer.com/guides/testing-with-ethereal), un servicio que captura los mensajes de prueba sin entregarlos a destinatarios reales. Hay que sustituir los valores de ejemplo por los de una cuenta de prueba. Para otro proveedor, usa sus datos SMTP. El puerto 465 normalmente usa `SMTP_SEGURO=true`; el 587 usa `false` y puede negociar el cifrado mediante STARTTLS.

La configuracion sigue las opciones de [Nodemailer](https://nodemailer.com/smtp). El remitente y la direccion de respuesta son `EMAIL_EMPRESA`. Las credenciales no se incluyen en las respuestas de la API.

Para hacer una prueba independiente con una cuenta temporal de Ethereal:

```powershell
node scripts/probar-correo.js
```

Este comando usa datos ficticios, muestra un enlace de vista previa y no modifica tu `.env`. Necesita conexion a internet y acceso al SMTP de Ethereal.

Prueba realizada el 01/11/2026: [vista previa del correo ficticio capturado](https://ethereal.email/message/aue.dzHmrk-zkWMNaue.eOQz.3dURSVIAAAAAb1hxcLy-PPNOz.vl7H6IVk). Las credenciales de esa cuenta temporal no se han guardado en el proyecto.

La ruta 24 comprueba que la solicitud esta `solicitada`, envia el correo y solo entonces cambia a `enviada`. Un fallo del servicio de correo devuelve 503 y mantiene el estado anterior. La solicitud se bloquea durante el envio para evitar dos envios simultaneos.

La aceptación del correo por el servidor SMTP no confirma que el destinatario lo haya leído. El envío y el guardado en MySQL son operaciones distintas: si el correo sale pero después falla la base de datos, hay que comprobar lo ocurrido antes de repetirlo.

## Subir y descargar PDF

La ruta 25 recibe `multipart/form-data`, con dos campos:

- `importe`: numero positivo, hasta dos decimales.
- `pdf`: un archivo PDF de hasta 5 MB.

En el frontend se usa `FormData`, como se explica en el contrato. No se pone manualmente la cabecera Content-Type: el navegador anade el separador del formulario.

El servidor comprueba la extension, el tipo de archivo y la cabecera `%PDF-`. Crea un nombre nuevo con `randomUUID`; no utiliza el nombre enviado por el navegador para guardar el archivo. Si falla el guardado de la base de datos, deshace los cambios y elimina el archivo nuevo.

Solo se admite un presupuesto por solicitud y la solicitud debe estar en `enviada`. Al guardarlo pasa a `presupuesto_enviado`; el cliente puede verlo, descargarlo y responder desde su área. Esta subida no envía un correo al cliente.

Los PDF se guardan en `uploads/presupuestos`, fuera de las carpetas publicas e ignorados por Git. La ruta 21 comprueba la sesion y la propiedad antes de descargarlos. Un cliente no puede descargar el PDF de otro. Se puede cambiar la carpeta con `CARPETA_PRESUPUESTOS`, usando siempre una carpeta privada.

Docker usa el volumen `presupuestos` para conservarlos al recrear el contenedor. El volumen no sustituye a una copia de seguridad. Esta configuracion todavia debe comprobarse al desplegar.

## Pruebas

```powershell
npm test
npm run test:backend
node --test tests/consultas.test.js
npm run test:gestion
```

Las pruebas de gestion usan una base de datos temporal, una carpeta temporal para los PDF y un SMTP local que captura los correos en memoria. No envian correos a nadie ni modifican los datos de la base del proyecto.

El 25/11/2026 pasaron las 39 pruebas de cálculo, solicitudes, consultas y gestión sobre el código preparado para subir.

Comprueban el correo aceptado y rechazado, los permisos, los estados, el importe, el tipo de PDF y el límite de tamaño. También comprueban que dos peticiones simultáneas no crean dos presupuestos y que un fallo de guardado no deja un archivo nuevo suelto, incluso si falla la operación de deshacer los cambios.

La prueba de conservación cierra el servidor de prueba y abre un proceso nuevo de Node con la misma base y carpeta temporales. Tras iniciar sesión de nuevo, descarga el PDF ya guardado y compara su contenido. Esto comprueba la conservación local; queda comprobar el volumen de Docker al desplegar.

## Integración

El envío necesita la configuración SMTP y el servicio de correo. La subida necesita Multer y una carpeta privada para guardar los PDF. Las rutas de gestión se protegen con el rol `admin`.

Cuando se unan los cambios a `main`, la ruta 21 completa BE 05 (issue 30), el servicio de correo corresponde a BE 06 (issue 31), y las cuatro rutas del admin completan BE 07 (issue 32). No hay que cerrar la tarea 32 hasta que esten las cuatro rutas.

La integración completa requiere revisar los cambios, unirlos a `main`, configurar el correo del entorno y comprobar el recorrido con las pantallas.
