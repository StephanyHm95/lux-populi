/*
 * Este archivo reúne funciones para dar formato a los valores que se muestran
 * en la interfaz
 */
function formatearEuros(valor) {
    return `${formatearNumero(valor)} €`;
}

function formatearNumero(valor) {
    return new Intl.NumberFormat("es-ES", {
        useGrouping: "always",
        maximumFractionDigits: 20
    }).format(valor);
}

function formatearFranja(franja) {
    const [anio, mes, dia] = franja.fecha.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia, 12)
        .toLocaleDateString("es-ES", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit"
        })
        .replace(",", "");

    return `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)} · ${franja.horaInicio}–${franja.horaFin}`;
}
