// Ruta 5: Crear simulación
async function crearSimulacion(datos) {
    const respuesta = await api.post("/simulaciones", datos);
    return respuesta.data;
}

function guardarSimulacionParaRegistro(resultado, datosFormulario) {
    if (!resultado || !Number.isInteger(resultado.id)) {
        throw new Error("La respuesta de la simulación no tiene un identificador válido.");
    }

    const contexto = {
        resultado,
        tipoTejado: datosFormulario.tipoTejado,
        superficie: Number(datosFormulario.superficie),
        codigoPostal: datosFormulario.codigoPostal
    };

    sessionStorage.setItem(
        `lux-populi-simulacion-${resultado.id}`,
        JSON.stringify(contexto)
    );
}

function obtenerSimulacionParaRegistro(id) {
    const almacenada = sessionStorage.getItem(`lux-populi-simulacion-${id}`);
    if (!almacenada) {
        return null;
    }

    let contexto;
    try {
        contexto = JSON.parse(almacenada);
    } catch {
        throw new Error("No se pudieron leer los datos guardados de la simulación.");
    }

    if (
        !contexto
        || contexto.resultado?.id !== id
        || !["casa", "edificio"].includes(contexto.resultado.tipoInstalacion)
        || !["inclinado", "plano"].includes(contexto.tipoTejado)
        || typeof contexto.superficie !== "number"
        || typeof contexto.codigoPostal !== "string"
    ) {
        throw new Error("Los datos guardados de la simulación no tienen el formato esperado.");
    }

    return {
        ...contexto.resultado,
        tipoTejado: contexto.tipoTejado,
        superficie: contexto.superficie,
        codigoPostal: contexto.codigoPostal
    };
}
 

/* 
// Mock ruta 5
async function crearSimulacion(datos) {
    return {
        id: 15,
        provincia: {
            codigo: "08",
            nombre: "Barcelona"
        },
        panelesFinales: 5,
        potenciaInstalada: 2.25,
        produccionAnual: 3508,
        radiacionAnual: 1962,
        coste: 3925,
        ahorroAnual: 416,
        amortizacion: 9.4,
        produccionMensual: [231, 242, 309, 319, 354, 355, 368, 350, 297, 257, 215, 212]
    };
}
*/