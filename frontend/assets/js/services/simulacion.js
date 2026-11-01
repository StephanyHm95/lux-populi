/*
 * Cuando esté disponible la ruta 5, sustituir el mock por:
 *
 * async function crearSimulacion(datos) {
 *     const respuesta = await api.post("/simulaciones", datos);
 *     return respuesta.data;
 * }
 */

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
