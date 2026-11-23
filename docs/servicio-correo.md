# BE 06 · Correo de las visitas

Actualizado el 23/11/2026.

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

Para una prueba opcional con Ethereal, que permite ver el correo sin enviarlo a nadie:

```powershell
node scripts/probar-correo.js
```

El comando usa datos ficticios y no cambia `.env`. Esta vez no se repitió la prueba con Ethereal.

## Qué falta

El correo está subido en `backend/gestion-pendiente`, pero aún no está unido a `main`. Falta revisarlo, conectarlo al panel del administrador mediante la ruta 24 (BE 07), configurar el correo de la web y probarlo todo junto.
