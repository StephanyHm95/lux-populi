# Calculadora y solicitudes

## Lo que ya funciona

| Ruta | Para que sirve |
| --- | --- |
| 5 · POST /api/simulaciones | Calcular el ahorro de una casa o edificio y guardar el resultado |
| 16 · POST /api/solicitudes | Pedir una visita y reservar un hueco de la misma provincia |
| 17 · GET /api/solicitudes/mia | Consultar la solicitud mas reciente del cliente |
| 18 · PUT /api/solicitudes/:id/franja | Cambiar el hueco de una solicitud propia |
| 19 · PUT /api/solicitudes/:id/cancelar | Cancelar la solicitud y liberar el hueco |
| 20 · PUT /api/solicitudes/:id/respuesta | Aceptar o rechazar un presupuesto |
| 21 · GET /api/solicitudes/:id/presupuesto | Descargar el PDF propio o consultarlo como admin |
| 22 · GET /api/gestion/solicitudes | Listar las solicitudes y filtrar por provincia o estado |
| 23 · GET /api/gestion/solicitudes/:id | Consultar el detalle y las acciones permitidas |
| 24 · POST /api/gestion/solicitudes/:id/enviar | Enviar los datos de la visita al instalador |
| 25 · POST /api/gestion/solicitudes/:id/presupuesto | Subir el PDF y dejar el presupuesto disponible para el cliente |

La ruta 5 es publica. Las rutas de solicitudes necesitan la sesion del cliente.
El administrador tambien puede usar la ruta 19, segun los estados del contrato.
El frontend recibe los nombres y los formatos del contrato definitivo.

## Que hace cada archivo

- `backend/servicios/pvgis.js`: busca los 12 meses guardados. Si faltan datos, los pide a PVGIS. Comprueba la respuesta y guarda el total anual y los meses juntos. Si ya estaban guardados, funciona sin llamar a la API.
- `backend/calculo.js`: hace las cuentas de casa y edificio con los precios de la base de datos. Tiene en cuenta el espacio del tejado, los conceptos aplicables y el limite de compensacion. Redondea al final.
- `backend/rutas/simulaciones.js`: comprueba el formulario, busca la provincia por el codigo postal, llama a los archivos anteriores y guarda la simulacion.
- `backend/rutas/solicitudes.js`: comprueba quien ha iniciado sesion, a quien pertenece la solicitud y si su estado permite el cambio.

Una transaccion es un grupo de cambios que se guardan juntos. Por ejemplo, reservar el hueco y crear la solicitud. Si falla algo, `rollback` deshace ese grupo; `commit` confirma que ha ido bien. `finally` devuelve la conexion al terminar.

`FOR UPDATE` hace que una segunda peticion espere mientras se modifica esa fila. Junto con la comprobacion de `ocupada`, evita que dos clientes reserven el mismo hueco o que un cliente cree dos solicitudes activas a la vez.

## Ejemplo de la calculadora

POST `/api/simulaciones`, con JSON:

```json
{
  "codigoPostal": "08201",
  "tipoInstalacion": "casa",
  "tipoTejado": "inclinado",
  "superficie": 25,
  "consumoMensual": 290
}
```

Devuelve 201 con el id de la simulacion, provincia, paneles, potencia, produccion anual y mensual, coste, ahorro y amortizacion. Los datos de PVGIS se piden para 1 kWp, perdidas del 14 %, inclinacion de 35 grados y orientacion sur, segun la [documentacion oficial de PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en).

Para un edificio se envian `numViviendas`, `consumoVivienda` e `incluirZonasComunes`. Si esta ultima es true, tambien `consumoZonasComunes`. Los datos que no corresponden al tipo elegido se guardan a null.

## Reglas de las solicitudes

- Una solicitud activa por cliente: solicitada, enviada o presupuesto_enviado.
- Cada simulacion solo puede usarse en una solicitud, aunque luego se cancele.
- El hueco y la direccion deben ser de la provincia de la simulacion.
- El cliente solo cambia o cancela si esta solicitada y faltan mas de dos horas.
- El admin puede cancelar si esta solicitada o enviada.
- Se acepta o rechaza solo si hay un presupuesto pendiente y la solicitud pertenece al cliente.

## Pruebas

`npm test` comprueba el calculo de casa y edificio con ejemplos conocidos.

`npm run test:backend` comprueba las rutas con MySQL local y las variables del `.env`. Necesita permiso para crear una base de datos de pruebas. Crea una base temporal con el prefijo `luxpopuli_pruebas_` y la elimina al terminar; no modifica los datos de la base del proyecto. Prueba sesiones, campos incorrectos, permisos, estados, reservas simultaneas y fallos de PVGIS. Usa respuestas de prueba de PVGIS para poder repetirse sin internet.

Para comprobar tambien la llamada real a PVGIS, en PowerShell:

```powershell
$env:PRUEBA_PVGIS_REAL = "1"
npm run test:backend
Remove-Item Env:PRUEBA_PVGIS_REAL
```

## Correo y presupuestos

El correo de las visitas (BE 06) se subió el 23/11/2026 a `backend/gestion-pendiente`, en el commit `d1dc653`. Falta revisarlo y unirlo a `main`. Lo hecho y lo probado está en [servicio-correo.md](servicio-correo.md).

Las rutas 21 a 23 se subieron el 24/11/2026 en el commit `f5bbde8`. Este cambio añade las rutas 24 y 25, sus pruebas y el guardado de los PDF al reiniciar la web. Los pasos para configurarlas y probarlas están en [correo-y-presupuestos.md](correo-y-presupuestos.md).

Queda revisar y unir estos cambios a `main`, configurar el correo de la web, conectar las pantallas que aún usan datos de ejemplo y comprobar que todo funciona junto.
