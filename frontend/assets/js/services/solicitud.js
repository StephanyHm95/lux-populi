/* Sustituir los mocks por las rutas 12 y 16 cuando estén disponibles.

async function obtenerFranjasLibres(provincia) {
    const respuesta = await api.get("/franjas/libres", { params: { provincia } });
    return respuesta.data;
}

async function crearSolicitud(datos) {
    const respuesta = await api.post("/solicitudes", datos);
    return respuesta.data;
}

*/


// Respuestas de ejemplo de las rutas 12 y 16.
const franjasLibresMock = [
    { id: 4, fecha: "2026-11-12", horaInicio: "10:00", horaFin: "12:00", provincia: "08" },
    { id: 5, fecha: "2026-11-14", horaInicio: "16:00", horaFin: "18:00", provincia: "08" }
];

// Mock ruta 12
async function obtenerFranjasLibres(provincia) {
    return franjasLibresMock
        .filter(franja => franja.provincia === provincia)
        .map(({ provincia: codigoProvincia, ...franja }) => ({ ...franja }));
}

// Mock ruta 16
async function crearSolicitud(datos) {
    const indiceFranja = franjasLibresMock.findIndex(franja => franja.id === datos.franjaId);

    if (indiceFranja === -1) {
        throw {
            response: {
                status: 409,
                data: {
                    error: "Ese hueco ya no está libre",
                    campo: "franjaId"
                }
            }
        };
    }

    if (franjasLibresMock[indiceFranja].provincia !== datos.codigoPostal.slice(0, 2)) {
        throw {
            response: {
                status: 400,
                data: {
                    error: "Ese hueco no es de tu provincia",
                    campo: "franjaId"
                }
            }
        };
    }

    franjasLibresMock.splice(indiceFranja, 1);
    return { id: 7, estado: "solicitada" };
}
