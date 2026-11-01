/* Sustituir los mocks por las rutas 3, 4 y 1 cuando estén disponibles.

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

// Mock ruta 4
// Usar un objeto de usuario aquí para probar el estado con sesión iniciada.
const usuarioSimulado = null; // Visitante
//const usuarioSimulado = {id: 4, nombre: "Ana", rol: "cliente"}; // 
//const usuarioSimulado = {id: 1, nombre: "Administrador", rol: "admin"}; // Administrador

async function obtenerUsuario() {
    if (!usuarioSimulado) {
        throw {
            response: {
                status: 401,
                data: { error: "No has iniciado sesión." }
            }
        };
    }
    return { ...usuarioSimulado };
}

// Mock ruta 3
async function cerrarSesionApi() {
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
    return {
        id: 4,
        nombre: datos.nombre,
        rol: "cliente"
    };
}