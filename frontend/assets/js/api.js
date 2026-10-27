// Instancia Axios compartida para las peticiones a la API del backend.
const api = axios.create({
    // Prefijo común: las rutas se escriben a partir de /api.
    baseURL: "/api",
    // Incluye las cookies de sesión en las solicitudes al servidor.
    withCredentials: true
});

// Obtiene los datos del usuario de la sesión actual.
async function obtenerSesion() {
    return await api.get("/auth/yo");
}

// Solicita al backend cerrar la sesión actual.
async function logout() {
    return await api.post("/auth/logout");
}
