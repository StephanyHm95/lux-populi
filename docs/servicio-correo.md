# BE 06 · Correo de las visitas

Actualizado el 25/11/2026.

`backend/servicios/email.js` envía al instalador los datos del cliente, la dirección, el horario de visita y el cálculo de la instalación. Las respuestas llegan al correo de la empresa.

## Para usarlo

Pon estos datos en `.env`, sustituyendo los ejemplos por los de tu cuenta de correo:

```dotenv
SMTP_HOST=smtp.ethereal.email
SMTP_PUERTO=587
SMTP_SEGURO=false
SMTP_USUARIO=tu_usuario_de_prueba
SMTP_CONTRASENA=tu_contrasena_de_prueba
EMAIL_EMPRESA=correo_de_tu_cuenta_de_prueba
```

## Qué se probó

El 23/11/2026 se comprobó en este ordenador que el correo lleva los datos correctos y que avisa si la dirección, la configuración o el envío fallan. No se enviaron correos reales. También pasaron las cinco pruebas de cálculo.

El 25/11/2026 se probó también el envío desde la ruta 24, con correo capturado en el ordenador. Se comprobaron los permisos, los fallos de envío y dos peticiones a la vez.

Para una prueba opcional con Ethereal, que permite ver el correo sin enviarlo a nadie:

```powershell
node scripts/probar-correo.js
```

El comando usa datos ficticios y no cambia `.env`. Esta vez no se repitió la prueba con Ethereal.

## Qué falta

La ruta 24 ya llama a este servicio para enviar la solicitud al instalador. El código está en `backend/gestion-pendiente`, pero aún no está unido a `main`. Falta revisarlo, configurar el correo de la web y probarlo todo junto desde las pantallas.
