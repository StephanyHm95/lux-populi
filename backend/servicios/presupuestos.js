// Los PDF se guardan fuera de la carpeta publica
const path = require("path");

let carpetaPresupuestos = path.resolve(__dirname, "../../uploads/presupuestos");
if (process.env.CARPETA_PRESUPUESTOS) {
    carpetaPresupuestos = path.resolve(process.env.CARPETA_PRESUPUESTOS);
}

function rutaPresupuesto(nombre) {
    if (typeof nombre !== "string") return null;
    if (nombre.length === 0) return null;
    if (nombre.length > 255) return null;
    if (path.basename(nombre) !== nombre) return null;
    if (path.extname(nombre).toLowerCase() !== ".pdf") return null;
    if (nombre.includes("\\")) return null;
    if (nombre.includes("\0")) return null;
    return path.join(carpetaPresupuestos, nombre);
}

module.exports = { carpetaPresupuestos, rutaPresupuesto };
