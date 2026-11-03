/* Sustituir los mocks por las rutas 2, 3, 4 y 1 cuando estén disponibles.

async function iniciarSesionApi(datos) {
    const respuesta = await api.post("/auth/login", datos);
    return respuesta.data;
}

async function obtenerUsuario() {
    const respuesta = await obtenerSesion();
    return respuesta.data;
}

async function cerrarSesionApi() {
    const respuesta = await logout();
    return respuesta.data;
}

async function crearCuentaCliente(datos) {
    const respuesta = await api.post("/auth/registro", datos);
    return respuesta.data;
}

*/

const CLAVE_USUARIO_SESION_MOCK = "lux-populi-usuario-mock";

// Mock ruta 4
// Usar un objeto de usuario aquí para probar el estado con sesión iniciada.
let usuarioSimulado = null; // Visitante
//usuarioSimulado = { id: 4, nombre: "Ana", rol: "cliente" };
//usuarioSimulado = { id: 1, nombre: "Administrador", rol: "admin" };

function guardarUsuarioSimulado(usuario) {
    usuarioSimulado = { ...usuario };
    sessionStorage.setItem(CLAVE_USUARIO_SESION_MOCK, JSON.stringify(usuarioSimulado));
}

function leerUsuarioSimulado() {
    const usuarioGuardado = sessionStorage.getItem(CLAVE_USUARIO_SESION_MOCK);
    return usuarioGuardado ? JSON.parse(usuarioGuardado) : usuarioSimulado;
}

async function obtenerUsuario() {
    const usuario = leerUsuarioSimulado();
    if (!usuario) {
        throw {
            response: {
                status: 401,
                data: { error: "No has iniciado sesión." }
            }
        };
    }
    return { ...usuario };
}

// Mock ruta 2:
// ana@ejemplo.com / Cliente123
// admin@ejemplo.com / Admin123
async function iniciarSesionApi(datos) {
    if (
        !datos
        || typeof datos.email !== "string"
        || typeof datos.password !== "string"
        || !datos.email.trim()
        || !datos.password
    ) {
        throw {
            response: {
                status: 400,
                data: { error: "El email y la contraseña son obligatorios." }
            }
        };
    }

    const email = datos.email.trim().toLowerCase();
    const usuariosMock = [
        {
            email: "ana@ejemplo.com",
            password: "Cliente123",
            usuario: { id: 4, nombre: "Ana", rol: "cliente" }
        },
        {
            email: "admin@ejemplo.com",
            password: "Admin123",
            usuario: { id: 1, nombre: "Administrador", rol: "admin" }
        }
    ];
    const cuenta = usuariosMock.find(
        usuarioMock => usuarioMock.email === email && usuarioMock.password === datos.password
    );

    if (!cuenta) {
        throw {
            response: {
                status: 401,
                data: { error: "Email o contraseña incorrectos." }
            }
        };
    }

    guardarUsuarioSimulado(cuenta.usuario);
    return { ...cuenta.usuario };
}

// Mock ruta 3
async function cerrarSesionApi() {
    usuarioSimulado = null;
    sessionStorage.removeItem(CLAVE_USUARIO_SESION_MOCK);
    return { ok: true };
}

// Mock ruta 1
async function crearCuentaCliente(datos) {
    if (datos.email === "ana@ejemplo.com") {
        throw {
            response: {
                status: 409,
                data: {
                    error: "Ya existe una cuenta con ese email",
                    campo: "email"
                }
            }
        };
    }
    const usuario = {
        id: 4,
        nombre: datos.nombre,
        rol: "cliente"
    };
    guardarUsuarioSimulado(usuario);
    return usuario;
}