/*
 * Este archivo reúne funciones para validar los datos introducidos
 * en los formularios antes de enviarlos al servidor.
 */

// Validación de código postal: número de 5 cifras, 
// y las dos primeras cifras entre 01 y 52.
function validarCodigoPostal(cp) {
    if (typeof cp !== "string" || !/^\d{5}$/.test(cp)) {
        return false;
    }

    const codigoProvincia = Number(cp.slice(0, 2));
    return codigoProvincia >= 1 && codigoProvincia <= 52;
}

// Validación de email: debe contener texto antes y después de @ y después del punto,
//  sin espacios.
function validarEmail(email) {
    return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Validación de teléfono: debe ser un número de 9 cifras, sin espacios.
function validarTelefono(telefono) {
    return typeof telefono === "string" && /^\d{9}$/.test(telefono.trim());
}

// Validación de contraseña: debe tener al menos 8 caracteres.
function validarPassword(password) {
    return typeof password === "string" && password.length >= 8;
}

function validarPasswordsCoinciden(password, password2) {
    return typeof password === "string"
        && typeof password2 === "string"
        && password === password2;
}

function validarTexto(texto, longitudMaxima) {
    if (
        typeof texto !== "string"
        || !Number.isInteger(longitudMaxima)
        || longitudMaxima < 1
    ) {
        return false;
    }

    const textoRecortado = texto.trim();

    return textoRecortado.length > 0
        && textoRecortado.length <= longitudMaxima;
}

function validarNumeroPositivo(valor) {
    if (typeof valor !== "number" && typeof valor !== "string") {
        return false;
    }

    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0;
}

function validarEnteroMinimo(valor, minimo) {
    if (
        (typeof valor !== "number" && typeof valor !== "string")
        || (typeof valor === "string" && valor.trim() === "")
        || !Number.isInteger(minimo)
    ) {
        return false;
    }

    const numero = Number(valor);

    return Number.isFinite(numero)
        && Number.isInteger(numero)
        && numero >= minimo;
}