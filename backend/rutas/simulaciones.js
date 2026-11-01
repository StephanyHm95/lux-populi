// Ruta 5: calculadora
const express = require("express");
const db = require("../db");
const { obtenerProduccionSolarProvincia } = require("../servicios/pvgis");
const { calcularInstalacion } = require("../calculo");

const router = express.Router();

// Los decimales de entrada tienen que caber en las columnas de la base de datos
function numeroValido(valor, minimo) {
    if (typeof valor !== "number") return false;
    if (!Number.isFinite(valor)) return false;
    if (valor < minimo) return false;
    if (valor > 999999.99) return false;
    return true;
}

function codigoPostalValido(codigo) {
    if (typeof codigo !== "string") return false;
    return /^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$/.test(codigo);
}

function viviendasValidas(numero) {
    if (!Number.isInteger(numero)) return false;
    if (numero < 2) return false;
    if (numero > 2147483647) return false;
    return true;
}

router.post("/", async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: "Faltan los datos de la simulacion" });
        }
        if (Array.isArray(req.body)) {
            return res.status(400).json({ error: "Faltan los datos de la simulacion" });
        }
        const entrada = req.body;
        if (!codigoPostalValido(entrada.codigoPostal)) {
            return res.status(400).json({ error: "Introduce un codigo postal valido de Espana", campo: "codigoPostal" });
        }
        if (entrada.tipoInstalacion !== "casa" && entrada.tipoInstalacion !== "edificio") {
            return res.status(400).json({ error: "Elige casa o edificio", campo: "tipoInstalacion" });
        }
        if (entrada.tipoTejado !== "inclinado" && entrada.tipoTejado !== "plano") {
            return res.status(400).json({ error: "Elige el tipo de tejado", campo: "tipoTejado" });
        }
        if (!numeroValido(entrada.superficie, 0.01)) {
            return res.status(400).json({ error: "Introduce una superficie entre 0,01 y 999999,99", campo: "superficie" });
        }

        // Dejamos a null los campos que no correspondan al tipo elegido
        const datos = {
            codigoPostal: entrada.codigoPostal,
            tipoInstalacion: entrada.tipoInstalacion,
            tipoTejado: entrada.tipoTejado,
            superficie: entrada.superficie,
            consumoMensual: null,
            numViviendas: null,
            consumoVivienda: null,
            incluirZonasComunes: false,
            consumoZonasComunes: null
        };
        if (datos.tipoInstalacion === "casa") {
            if (!numeroValido(entrada.consumoMensual, 0.01)) {
                return res.status(400).json({ error: "Introduce un consumo mensual valido", campo: "consumoMensual" });
            }
            datos.consumoMensual = entrada.consumoMensual;
        } else {
            if (!viviendasValidas(entrada.numViviendas)) {
                return res.status(400).json({ error: "Introduce un numero de viviendas entero, de 2 en adelante", campo: "numViviendas" });
            }
            if (!numeroValido(entrada.consumoVivienda, 0.01)) {
                return res.status(400).json({ error: "Introduce un consumo por vivienda valido", campo: "consumoVivienda" });
            }
            if (typeof entrada.incluirZonasComunes !== "boolean") {
                return res.status(400).json({ error: "Indica si incluyes las zonas comunes", campo: "incluirZonasComunes" });
            }
            datos.numViviendas = entrada.numViviendas;
            datos.consumoVivienda = entrada.consumoVivienda;
            datos.incluirZonasComunes = entrada.incluirZonasComunes;
            if (datos.incluirZonasComunes) {
                if (!numeroValido(entrada.consumoZonasComunes, 0)) {
                    return res.status(400).json({ error: "Introduce un consumo de zonas comunes de 0 o mas", campo: "consumoZonasComunes" });
                }
                datos.consumoZonasComunes = entrada.consumoZonasComunes;
            }
        }

        const resultadoProvincia = await db.query("SELECT * FROM provincia WHERE codigo = ?", [datos.codigoPostal.slice(0, 2)]);
        if (resultadoProvincia[0].length === 0) {
            return res.status(400).json({ error: "No existe esa provincia", campo: "codigoPostal" });
        }
        const provincia = resultadoProvincia[0][0];
        const resultadoParametros = await db.query("SELECT clave, valor FROM parametro");
        const parametros = {};
        for (const fila of resultadoParametros[0]) {
            parametros[fila.clave] = fila.valor;
        }
        for (const clave of ["precio_kwp", "potencia_panel", "precio_luz", "precio_compensacion"]) {
            if (!Number.isFinite(parametros[clave])) {
                throw new Error("Faltan parametros para el calculo");
            }
            if (parametros[clave] <= 0) {
                throw new Error("Faltan parametros para el calculo");
            }
        }
        const resultadoConceptos = await db.query("SELECT precio, aplica_a, solo_plana FROM concepto");
        const produccion = await obtenerProduccionSolarProvincia(provincia);
        const calculo = calcularInstalacion(datos, parametros, resultadoConceptos[0], produccion);

        // Rechazamos resultados que no caben en la base de datos
        let cabeEnLaBaseDeDatos = true;
        if (calculo.potenciaInstalada > 9999.99) cabeEnLaBaseDeDatos = false;
        if (calculo.coste > 99999999) cabeEnLaBaseDeDatos = false;
        if (calculo.ahorroAnual > 99999999) cabeEnLaBaseDeDatos = false;
        if (!Number.isFinite(calculo.amortizacion)) cabeEnLaBaseDeDatos = false;
        if (calculo.amortizacion > 9999.9) cabeEnLaBaseDeDatos = false;
        if (!cabeEnLaBaseDeDatos) {
            return res.status(400).json({ error: "Los datos superan el tamano permitido para una simulacion" });
        }

        const resultadoInsertar = await db.query(
            `INSERT INTO simulacion (provincia_id, tipo_instalacion, codigo_postal, tipo_tejado, superficie,
                consumo_mensual, num_viviendas, consumo_vivienda, incluir_zonas_comunes, consumo_zonas_comunes,
                produccion_usada, paneles_finales, potencia_instalada, tejado_limita, coste, ahorro_anual,
                amortizacion, coste_por_vivienda, ahorro_por_vivienda)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [provincia.id, datos.tipoInstalacion, datos.codigoPostal, datos.tipoTejado, datos.superficie,
                datos.consumoMensual, datos.numViviendas, datos.consumoVivienda, datos.incluirZonasComunes,
                datos.consumoZonasComunes, produccion.produccionAnual, calculo.panelesFinales,
                calculo.potenciaInstalada, calculo.tejadoLimita, calculo.coste, calculo.ahorroAnual,
                calculo.amortizacion, calculo.costePorVivienda, calculo.ahorroPorVivienda]
        );
        calculo.id = resultadoInsertar[0].insertId;
        calculo.tipoInstalacion = datos.tipoInstalacion;
        calculo.provincia = { id: provincia.id, codigo: provincia.codigo, nombre: provincia.nombre };
        res.status(201).json(calculo);
    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({ error: error.message, campo: error.campo });
        }
        if (error.status === 503) {
            return res.status(503).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: "Error del servidor" });
    }
});

module.exports = router;
