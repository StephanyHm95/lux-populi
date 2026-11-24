# Consultar solicitudes y descargar el presupuesto

- Ruta 21: el cliente descarga el PDF de su solicitud. El administrador también puede descargarlo.
- Ruta 22: el administrador ve las solicitudes y puede filtrar por estado o provincia.
- Ruta 23: el administrador consulta los datos de una solicitud y las acciones permitidas por su estado.

Los PDF se leen de `uploads/presupuestos`, fuera de la carpeta pública. Se puede cambiar esa ubicación con `CARPETA_PRESUPUESTOS`. El servidor comprueba el permiso antes de enviar el archivo. Si no hay presupuesto o el archivo no existe, devuelve 404.

El filtro de provincia usa el código de dos cifras, por ejemplo `08`. Sin filtros se muestran todas las solicitudes.

## Pruebas

Desde la carpeta del proyecto:

```sh
node --test tests/consultas.test.js
```

Las pruebas usan MySQL local y las variables del `.env`. Crean una base y una carpeta temporales y las eliminan al terminar. Comprueban los permisos, los filtros, los datos del detalle y la descarga del PDF. No necesitan enviar correos ni subir archivos desde el panel.

Estas rutas permiten consultar y descargar. El envío al instalador y la subida del presupuesto se incorporan por separado.
