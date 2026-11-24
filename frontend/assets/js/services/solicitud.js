// Ruta 6: Consultar los parámetros económicos de la calculadora.
async function obtenerParametrosPresupuesto() {
    const respuesta = await api.get("/parametros");
    return respuesta.data;
}

// Ruta 7: Guardar los parámetros económicos de la calculadora.
async function guardarParametrosPresupuesto(datos) {
    const respuesta = await api.put("/parametros", datos);
    return respuesta.data;
}

// Ruta 8: Consultar los conceptos que se aplican al presupuesto.
async function obtenerConceptosPresupuesto() {
    const respuesta = await api.get("/conceptos");
    return respuesta.data;
}

// Ruta 9: Crear un concepto de presupuesto.
async function crearConceptoPresupuesto(datos) {
    const respuesta = await api.post("/conceptos", datos);
    return respuesta.data;
}

// Ruta 10: Modificar un concepto de presupuesto.
async function actualizarConceptoPresupuesto(id, datos) {
    const respuesta = await api.put(`/conceptos/${id}`, datos);
    return respuesta.data;
}

// Ruta 11: Eliminar un concepto de presupuesto.
async function eliminarConceptoPresupuesto(id) {
    const respuesta = await api.delete(`/conceptos/${id}`);
    return respuesta.data;
}

// Ruta 12: Obtener franjas libres
async function obtenerFranjasLibres(provincia) {
    const respuesta = await api.get("/franjas/libres", { params: { provincia } });
    return respuesta.data;
}

// Ruta 13: Listar los huecos del calendario con sus filtros.
async function obtenerFranjasCalendario(filtros) {
    const params = { ver: filtros.ver };
    if (filtros.provincia) {
        params.provincia = filtros.provincia;
    }

    const respuesta = await api.get("/franjas", { params });
    return respuesta.data;
}

// Ruta 14: Crear un hueco de visita.
async function crearFranjaApi(datos) {
    const respuesta = await api.post("/franjas", datos);
    return respuesta.data;
}

// Ruta 15: Eliminar un hueco que nunca haya tenido una solicitud.
async function eliminarFranjaApi(id) {
    const respuesta = await api.delete(`/franjas/${id}`);
    return respuesta.data;
}

// Ruta 16: Crear solicitud
async function crearSolicitud(datos) {
    const respuesta = await api.post("/solicitudes", datos);
    return respuesta.data;
}

// Ruta 17: Consultar la solicitud más reciente del cliente.
async function obtenerSolicitudMia() {
    const respuesta = await api.get("/solicitudes/mia");
    return respuesta.data;
}

// Ruta 18: Cambiar la franja de una solicitud propia.
async function cambiarFranjaSolicitud(id, datos) {
    const respuesta = await api.put(`/solicitudes/${id}/franja`, datos);
    return respuesta.data;
}

// Ruta 19: Cancelar una solicitud propia.
async function cancelarSolicitudApi(id) {
    const respuesta = await api.put(`/solicitudes/${id}/cancelar`);
    return respuesta.data;
}

// Ruta 20: Aceptar o rechazar el presupuesto.
async function responderPresupuestoApi(id, datos) {
    const respuesta = await api.put(`/solicitudes/${id}/respuesta`, datos);
    return respuesta.data;
}

// Ruta 21: Descargar presupuesto en PDF
async function descargarPresupuestoApi(id) {
    const respuesta = await api.get(`/solicitudes/${id}/presupuesto`, {
        responseType: "blob"
    });
    return respuesta.data;
}
/*
// Ruta 22: Listar solicitudes del panel con sus filtros.
async function obtenerSolicitudesGestion(filtros) {
    const params = { estado: filtros.estado };
    if (filtros.provincia) {
        params.provincia = filtros.provincia;
    }

    const respuesta = await api.get("/gestion/solicitudes", { params });
    return respuesta.data;
}
*/

/* 
// Ruta 23: Consultar el detalle administrativo de una solicitud.
async function obtenerDetalleSolicitudGestion(id) {
    const respuesta = await api.get(`/gestion/solicitudes/${id}`);
    return respuesta.data;
} 
*/

// Ruta 24: Enviar la solicitud al instalador por correo.
async function enviarSolicitudAlInstalador(id, datos) {
    const respuesta = await api.post(`/gestion/solicitudes/${id}/enviar`, datos);
    return respuesta.data;
}

// Ruta 25: Subir el presupuesto como multipart/form-data.
async function subirPresupuestoSolicitud(id, datos) {
    const respuesta = await api.post(`/gestion/solicitudes/${id}/presupuesto`, datos);
    return respuesta.data;
}


// Ruta 27: Consultar las provincias para los selectores del panel.
async function obtenerProvinciasApi() {
    const respuesta = await api.get("/provincias");
    return respuesta.data;
}



/* 
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
 */


// Mock ruta 22: respuestas de ejemplo para el listado del panel.
const solicitudesGestionMock = [
    {
        id: 7,
        cliente: "Ana López",
        municipio: "Sabadell",
        provincia: "Barcelona",
        codigoProvincia: "08",
        tipoInstalacion: "casa",
        fecha: "2026-11-12",
        horaInicio: "10:00",
        horaFin: "12:00",
        estado: "solicitada"
    },
    {
        id: 8,
        cliente: "Carlos Martín",
        municipio: "Dos Hermanas",
        provincia: "Sevilla",
        codigoProvincia: "41",
        tipoInstalacion: "edificio",
        fecha: "2026-11-14",
        horaInicio: "16:00",
        horaFin: "18:00",
        estado: "enviada"
    },
    {
        id: 9,
        cliente: "Lucía Gómez",
        municipio: "Alcobendas",
        provincia: "Madrid",
        codigoProvincia: "28",
        tipoInstalacion: "casa",
        fecha: "2026-11-19",
        horaInicio: "10:00",
        horaFin: "12:00",
        estado: "presupuesto_enviado"
    },
    {
        id: 10,
        cliente: "Javier Ruiz",
        municipio: "Valencia",
        provincia: "Valencia",
        codigoProvincia: "46",
        tipoInstalacion: "edificio",
        fecha: "2026-11-21",
        horaInicio: "09:00",
        horaFin: "11:00",
        estado: "aceptado"
    }
];

async function obtenerSolicitudesGestion(filtros) {
    const estado = filtros.estado || "todos";
    const provincia = filtros.provincia || "";

    let solicitudes = solicitudesGestionMock.filter(solicitud => (
        (estado === "todos" || solicitud.estado === estado)
        && (!provincia || solicitud.codigoProvincia === provincia)
    ));

    solicitudes = solicitudes.map(solicitud => {
        const copia = { ...solicitud };
        delete copia.codigoProvincia;
        return copia;
    });

    return solicitudes.sort((primera, segunda) =>
        `${primera.fecha} ${primera.horaInicio}`
            .localeCompare(`${segunda.fecha} ${segunda.horaInicio}`)
    );
}

// Mock ruta 23: detalle administrativo de las solicitudes del listado.
const detallesSolicitudGestionMock = {
    7: {
        id: 7,
        estado: "solicitada",
        fechaSolicitud: "2026-11-05 18:42",
        fechaEstado: "2026-11-05 18:42",
        accionesPermitidas: ["enviar", "cancelar"],
        cliente: {
            nombre: "Ana",
            apellidos: "López",
            email: "ana.lopez@ejemplo.com",
            telefono: "600000001"
        },
        direccion: "C/ Mayor 10",
        municipio: "Sabadell",
        codigoPostal: "08201",
        provincia: "Barcelona",
        emailInstalador: null,
        franja: {
            fecha: "2026-11-12",
            horaInicio: "10:00",
            horaFin: "12:00"
        },
        simulacion: {
            tipoInstalacion: "casa",
            codigoPostal: "08201",
            tipoTejado: "inclinado",
            superficie: 25,
            consumoMensual: 290,
            numViviendas: null,
            consumoVivienda: null,
            incluirZonasComunes: false,
            consumoZonasComunes: null,
            panelesFinales: 5,
            potenciaInstalada: 2.25,
            tejadoLimita: false,
            coste: 3925,
            ahorroAnual: 416,
            amortizacion: 9.4,
            costePorVivienda: null,
            ahorroPorVivienda: null
        },
        presupuesto: null
    },
    8: {
        id: 8,
        estado: "enviada",
        fechaSolicitud: "2026-11-06 09:15",
        fechaEstado: "2026-11-06 10:00",
        accionesPermitidas: ["cancelar", "subir_presupuesto"],
        cliente: {
            nombre: "Carlos",
            apellidos: "Martín",
            email: "carlos.martin@ejemplo.com",
            telefono: "600000002"
        },
        direccion: "Av. de España 24",
        municipio: "Dos Hermanas",
        codigoPostal: "41701",
        provincia: "Sevilla",
        emailInstalador: "visitas@solvalles.es",
        franja: {
            fecha: "2026-11-14",
            horaInicio: "16:00",
            horaFin: "18:00"
        },
        simulacion: {
            tipoInstalacion: "edificio",
            codigoPostal: "41701",
            tipoTejado: "plano",
            superficie: 120,
            consumoMensual: null,
            numViviendas: 8,
            consumoVivienda: 290,
            incluirZonasComunes: true,
            consumoZonasComunes: 500,
            panelesFinales: 32,
            potenciaInstalada: 14.4,
            tejadoLimita: false,
            coste: 18720,
            ahorroAnual: 2140,
            amortizacion: 8.7,
            costePorVivienda: 2340,
            ahorroPorVivienda: 267.5
        },
        presupuesto: null
    },
    9: {
        id: 9,
        estado: "presupuesto_enviado",
        fechaSolicitud: "2026-11-07 11:20",
        fechaEstado: "2026-11-15 12:00",
        accionesPermitidas: [],
        cliente: {
            nombre: "Lucía",
            apellidos: "Gómez",
            email: "lucia.gomez@ejemplo.com",
            telefono: "600000003"
        },
        direccion: "C/ de la Constitución 18",
        municipio: "Alcobendas",
        codigoPostal: "28100",
        provincia: "Madrid",
        emailInstalador: "instalaciones@solvalles.es",
        franja: {
            fecha: "2026-11-19",
            horaInicio: "10:00",
            horaFin: "12:00"
        },
        simulacion: {
            tipoInstalacion: "casa",
            codigoPostal: "28100",
            tipoTejado: "plano",
            superficie: 30,
            consumoMensual: 320,
            numViviendas: null,
            consumoVivienda: null,
            incluirZonasComunes: false,
            consumoZonasComunes: null,
            panelesFinales: 6,
            potenciaInstalada: 2.7,
            tejadoLimita: false,
            coste: 4680,
            ahorroAnual: 452,
            amortizacion: 10.4,
            costePorVivienda: null,
            ahorroPorVivienda: null
        },
        presupuesto: {
            importe: 4900,
            fechaEnvio: "2026-11-15 12:00",
            fechaRespuesta: null
        }
    },
    10: {
        id: 10,
        estado: "aceptado",
        fechaSolicitud: "2026-11-08 14:30",
        fechaEstado: "2026-11-20 09:10",
        accionesPermitidas: [],
        cliente: {
            nombre: "Javier",
            apellidos: "Ruiz",
            email: "javier.ruiz@ejemplo.com",
            telefono: "600000004"
        },
        direccion: "C/ de Colón 42",
        municipio: "Valencia",
        codigoPostal: "46004",
        provincia: "Valencia",
        emailInstalador: "visitas@solvalles.es",
        franja: {
            fecha: "2026-11-21",
            horaInicio: "09:00",
            horaFin: "11:00"
        },
        simulacion: {
            tipoInstalacion: "edificio",
            codigoPostal: "46004",
            tipoTejado: "inclinado",
            superficie: 90,
            consumoMensual: null,
            numViviendas: 4,
            consumoVivienda: 290,
            incluirZonasComunes: false,
            consumoZonasComunes: null,
            panelesFinales: 20,
            potenciaInstalada: 9,
            tejadoLimita: true,
            coste: 11700,
            ahorroAnual: 1280,
            amortizacion: 9.1,
            costePorVivienda: 2925,
            ahorroPorVivienda: 320
        },
        presupuesto: {
            importe: 12400,
            fechaEnvio: "2026-11-17 16:30",
            fechaRespuesta: "2026-11-20 09:10"
        }
    }
};

async function obtenerDetalleSolicitudGestion(id) {
    const detalle = detallesSolicitudGestionMock[Number(id)];
    if (!detalle) {
        throw {
            response: {
                status: 404,
                data: { error: "La solicitud no existe" }
            }
        };
    }

    return JSON.parse(JSON.stringify(detalle));
}