/*
 * Genera enlaces internos de Lux Populi.
 *
 * La aplicación tiene páginas públicas (pages/)
 * y páginas de administración (pages/panel/).
 *
 * Esta función calcula automáticamente la ruta
 * relativa correcta según la página actual.
 *
 * Si cambia la estructura de carpetas, las rutas
 * de la aplicación se actualizan modificando solo
 * este archivo.
 */

function enlacePagina(nombrePagina) {
  const paginas = {
    inicio: "index.html",
    calculadora: "calculadora.html",
    login: "login.html",
    registro: "registro.html",
    miSolicitud: "mi-solicitud.html",
    privacidad: "privacidad.html"
    };
  
  const pagina = paginas[nombrePagina];

  if (!pagina) {
    throw new Error(`No existe una ruta para la página "${nombrePagina}".`);
  }

  const rutaActual = window.location.pathname;
  // Detecta si la página actual está dentro de la carpeta "panel"
  // Debemos subir un nivel para acceder a las páginas públicas desde allí
  const desdePanel = rutaActual.includes("/panel/");

  return `${desdePanel ? "../" : ""}${pagina}`;
}