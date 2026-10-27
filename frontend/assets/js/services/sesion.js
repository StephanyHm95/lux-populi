/* 
 * Cuando esté lista la ruta 4, sustituir el mock por:
 *   async function obtenerUsuario() {
 *      const respuesta = await obtenerSesion();
 *      return respuesta.data;
 *   }
 */
async function obtenerUsuario() {

    // Visitante
    throw {
        response: {
            status: 401
        }
    };

    // Cliente
    /*  
    return {
        id: 4,
        nombre: "Ana",
        rol: "cliente"
    };
     */

    // Admin
    /* 
    return {
        id: 1,
        nombre: "Administrador",
        rol: "admin"
    }; 
    */
    
}

/* 
 * Cuando esté lista la ruta 3, sustituir el mock por:
 *   async function cerrarSesionApi() {
 *      const respuesta = await logout();
 *      return respuesta.data;
 *   }
 */
async function cerrarSesionApi() {
    return {
        ok: true
    };

}