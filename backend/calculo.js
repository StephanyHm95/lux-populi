// Calculo orientativo para una casa o un edificio, segun lo acordado en el proyecto
const DENSIDAD_INCLINADO = 0.150;
const DENSIDAD_PLANO = 0.080;
const AUTOCONSUMO_CASA = 0.35;
const AUTOCONSUMO_EDIFICIO = 0.40;

function calcularInstalacion(datos, parametros, conceptos, produccion) {
    let consumoAnual;
    let porcentajeAutoconsumo;

    if (datos.tipoInstalacion === "casa") {
        consumoAnual = datos.consumoMensual * 12;
        porcentajeAutoconsumo = AUTOCONSUMO_CASA;
    } else {
        consumoAnual = datos.numViviendas * datos.consumoVivienda * 12;
        if (datos.incluirZonasComunes === true) {
            consumoAnual += datos.consumoZonasComunes * 12;
        }
        porcentajeAutoconsumo = AUTOCONSUMO_EDIFICIO;
    }

    let densidad = DENSIDAD_INCLINADO;
    if (datos.tipoTejado === "plano") {
        densidad = DENSIDAD_PLANO;
    }

    const potenciaNecesaria = consumoAnual / produccion.produccionAnual;
    const panelesNecesarios = Math.ceil(potenciaNecesaria / parametros.potencia_panel);
    const panelesQueCaben = Math.floor(datos.superficie * densidad / parametros.potencia_panel);
    const panelesFinales = Math.min(panelesNecesarios, panelesQueCaben);

    if (panelesFinales < 1) {
        const error = new Error("La superficie no es suficiente para instalar paneles");
        error.status = 400;
        error.campo = "superficie";
        throw error;
    }

    const potenciaInstalada = panelesFinales * parametros.potencia_panel;
    const produccionAnual = potenciaInstalada * produccion.produccionAnual;
    const autoconsumo = Math.min(produccionAnual * porcentajeAutoconsumo, consumoAnual);
    const excedentes = produccionAnual - autoconsumo;
    const ahorroAutoconsumo = autoconsumo * parametros.precio_luz;
    const costeLuzRestante = (consumoAnual - autoconsumo) * parametros.precio_luz;
    const compensacion = Math.min(excedentes * parametros.precio_compensacion, costeLuzRestante);
    const ahorroAnual = ahorroAutoconsumo + compensacion;

    let coste = potenciaInstalada * parametros.precio_kwp;
    for (const concepto of conceptos) {
        if (concepto.aplica_a !== "ambos" && concepto.aplica_a !== datos.tipoInstalacion) {
            continue;
        }
        if (concepto.solo_plana && datos.tipoTejado !== "plano") {
            continue;
        }
        coste += concepto.precio;
    }

    let costePorVivienda = null;
    let ahorroPorVivienda = null;
    if (datos.tipoInstalacion === "edificio") {
        costePorVivienda = Math.round(coste / datos.numViviendas);
        ahorroPorVivienda = Math.round(ahorroAnual / datos.numViviendas);
    }

    const produccionMensual = [];
    for (const mes of produccion.meses) {
        produccionMensual.push(Math.round(mes.produccion * potenciaInstalada));
    }

    // Redondeamos al final, sin cambiar los valores usados en las cuentas
    return {
        panelesFinales: panelesFinales,
        potenciaInstalada: Number(potenciaInstalada.toFixed(2)),
        tejadoLimita: panelesQueCaben < panelesNecesarios,
        produccionAnual: Math.round(produccionAnual),
        produccionMensual: produccionMensual,
        radiacionAnual: Math.round(produccion.radiacionAnual),
        coste: Math.round(coste),
        ahorroAnual: Math.round(ahorroAnual),
        amortizacion: Number((coste / ahorroAnual).toFixed(1)),
        costePorVivienda: costePorVivienda,
        ahorroPorVivienda: ahorroPorVivienda
    };
}

module.exports = { calcularInstalacion };
