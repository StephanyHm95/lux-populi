const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularInstalacion } = require("../backend/calculo");

const parametros = { precio_kwp: 1300, potencia_panel: 0.45, precio_luz: 0.19, precio_compensacion: 0.08 };
const conceptos = [
    { precio: 1000, aplica_a: "ambos", solo_plana: 0 },
    { precio: 1000, aplica_a: "ambos", solo_plana: 1 }
];
const produccion = {
    produccionAnual: 1559.25,
    radiacionAnual: 1961.85,
    meses: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, produccion: 100, radiacion: 120 }))
};
const casa = { tipoInstalacion: "casa", tipoTejado: "inclinado", superficie: 25, consumoMensual: 290 };

test("casa de Barcelona: conserva decimales hasta el resultado final", () => {
    const resultado = calcularInstalacion(casa, parametros, conceptos, produccion);
    assert.equal(resultado.panelesFinales, 5);
    assert.equal(resultado.potenciaInstalada, 2.25);
    assert.equal(resultado.produccionAnual, 3508);
    assert.equal(resultado.coste, 3925);
    assert.equal(resultado.ahorroAnual, 416);
    assert.equal(resultado.amortizacion, 9.4);
    assert.equal(resultado.radiacionAnual, 1962);
    assert.deepEqual(resultado.produccionMensual, Array(12).fill(225));
    assert.equal(resultado.tejadoLimita, false);
    assert.equal(resultado.costePorVivienda, null);
});

test("edificio del ejemplo: limita el tejado y reparte por vivienda", () => {
    const edificio = {
        tipoInstalacion: "edificio", tipoTejado: "plano", superficie: 150,
        numViviendas: 10, consumoVivienda: 290, incluirZonasComunes: true, consumoZonasComunes: 300
    };
    const resultado = calcularInstalacion(edificio, parametros, conceptos, { ...produccion, produccionAnual: 1570 });
    assert.equal(resultado.panelesFinales, 26);
    assert.equal(resultado.potenciaInstalada, 11.7);
    assert.equal(resultado.coste, 17210);
    assert.equal(resultado.ahorroAnual, 2278);
    assert.equal(resultado.amortizacion, 7.6);
    assert.equal(resultado.costePorVivienda, 1721);
    assert.equal(resultado.ahorroPorVivienda, 228);
    assert.equal(resultado.tejadoLimita, true);
});

test("el ahorro y los excedentes no superan la factura pendiente", () => {
    const resultado = calcularInstalacion({ ...casa, consumoMensual: 1 }, parametros, conceptos, produccion);
    assert.equal(resultado.panelesFinales, 1);
    assert.equal(resultado.ahorroAnual, 2);
    assert.equal(resultado.amortizacion, Number((1585 / (12 * 0.19)).toFixed(1)));
});

test("aplica los conceptos solo al tipo de instalacion y cubierta correspondientes", () => {
    const extras = [
        { precio: 10, aplica_a: "casa", solo_plana: 0 },
        { precio: 30, aplica_a: "edificio", solo_plana: 0 },
        { precio: 50, aplica_a: "ambos", solo_plana: 1 }
    ];
    assert.equal(calcularInstalacion(casa, parametros, extras, produccion).coste, 2935);
    assert.equal(calcularInstalacion({ ...casa, tipoTejado: "plano", superficie: 100 }, parametros, extras, produccion).coste, 2985);
});

test("rechaza un tejado donde no cabe ni un panel", () => {
    assert.throws(
        () => calcularInstalacion({ ...casa, superficie: 1 }, parametros, conceptos, produccion),
        error => error.status === 400 && error.campo === "superficie"
    );
});
