// Consultar la produccion solar de una provincia y guardarla
const db = require('../db');

function datoSolarValido(valor, minimo, maximo) {
    if (!Number.isFinite(valor)) return false;
    if (valor < minimo) return false;
    if (valor > maximo) return false;
    return true;
}

async function obtenerProduccionSolarProvincia(provincia) {
    const url = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc"
        + "?lat=" + provincia.latitud
        + "&lon=" + provincia.longitud
        + "&peakpower=1&loss=14&angle=35&aspect=0&outputformat=json";

    const resultadoMeses = await db.query("SELECT mes, produccion, radiacion FROM produccion_mensual WHERE provincia_id = ? ORDER BY mes",
        [provincia.id]
    );

    const mesesGuardados = resultadoMeses[0];

    if (provincia.produccion_anual !== null &&
        provincia.radiacion_anual !== null &&
        mesesGuardados.length === 12) {
        return {
            produccionAnual: provincia.produccion_anual,
            radiacionAnual: provincia.radiacion_anual,
            meses: mesesGuardados
        };
    }

    let anuales;
    const mesesProduccion = [];
    try {
        const respuesta = await fetch(url, {
            signal: AbortSignal.timeout(15000)
        });

        if (respuesta.ok === false) {
            throw new Error("PVGIS no esta disponible");
        }

        const datos = await respuesta.json();
        anuales = datos.outputs.totals.fixed;
        const meses = datos.outputs.monthly.fixed;

        // No guardamos una respuesta incompleta de la API
        if (!datoSolarValido(anuales.E_y, 0.01, 99999.99)) {
            throw new Error("Produccion anual incorrecta");
        }
        if (!datoSolarValido(anuales["H(i)_y"], 0.01, 99999.99)) {
            throw new Error("Radiacion anual incorrecta");
        }
        if (!Array.isArray(meses)) {
            throw new Error("Faltan meses de produccion");
        }
        if (meses.length !== 12) {
            throw new Error("Faltan meses de produccion");
        }

        for (let i = 0; i < meses.length; i++) {
            const mes = meses[i];
            if (mes.month !== i + 1) {
                throw new Error("Los meses no estan ordenados");
            }
            if (!datoSolarValido(mes.E_m, 0, 9999.99)) {
                throw new Error("Produccion mensual incorrecta");
            }
            if (!datoSolarValido(mes["H(i)_m"], 0, 9999.99)) {
                throw new Error("Radiacion mensual incorrecta");
            }
            mesesProduccion.push({
                mes: mes.month,
                produccion: Number(mes.E_m.toFixed(2)),
                radiacion: Number(mes["H(i)_m"].toFixed(2))
            });
        }
    } catch (error) {
        const errorServicio = new Error("Ahora mismo no podemos calcular la produccion de tu provincia. Intentalo mas tarde");
        errorServicio.status = 503;
        throw errorServicio;
    }

    // Una transaccion guarda todo junto. Si falla un mes, se deshace todo.
    const conexion = await db.getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.query(
            "UPDATE provincia SET produccion_anual = ?, radiacion_anual = ?, fecha_pvgis = NOW() WHERE id = ?",
            [anuales.E_y, anuales["H(i)_y"], provincia.id]
        );
        await conexion.query("DELETE FROM produccion_mensual WHERE provincia_id = ?", [provincia.id]);
        for (const mes of mesesProduccion) {
            await conexion.query(
                "INSERT INTO produccion_mensual (provincia_id, mes, produccion, radiacion) VALUES (?, ?, ?, ?)",
                [provincia.id, mes.mes, mes.produccion, mes.radiacion]
            );
        }
        await conexion.commit();
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }

    return {
        produccionAnual: Number(anuales.E_y.toFixed(2)),
        radiacionAnual: Number(anuales["H(i)_y"].toFixed(2)),
        meses: mesesProduccion
    };
}

module.exports = { obtenerProduccionSolarProvincia };
