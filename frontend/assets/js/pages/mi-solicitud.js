console.log("Mi-solicitud.js cargado correctamente.");
// Estados admitidos por el contrato de la API.
const estadosSolicitud = [
    "solicitada",
    "enviada",
    "presupuesto_enviado",
    "aceptado",
    "rechazado",
    "cancelada"
];

const app = Vue.createApp({
    data() {
        return {
            // Datos cargados de la sesión y de la solicitud del cliente.
            usuario: null,
            solicitud: null,
            registroConfirmado: false,
            simulacionSinSolicitud: null,
            simulacionIdSinSolicitud: null,
            codigoPostalSinSolicitud: "",
            errorSimulacionSinSolicitud: "",
            // Estado del formulario para cambiar la franja de visita.
            franjas: [],
            franjaSeleccionada: "",
            // Estados visuales compartidos por las acciones y la carga inicial.
            errores: {},
            errorGeneral: "",
            mensajeExito: "",
            cargando: true,
            cargandoFranjas: false,
            sinSolicitud: false,
            mostrarModificacion: false,
            accionEnCurso: ""
        };
    },
    computed: {
        // Ajusta las etiquetas de simulación al tipo de instalación.
        esEdificio() {
            return this.simulacionActual?.tipoInstalacion === "edificio";
        },
        simulacionActual() {
            return this.solicitud?.simulacion || this.simulacionSinSolicitud;
        },
        enlaceConsultarHuecos() {
            if (!this.simulacionIdSinSolicitud || !this.codigoPostalSinSolicitud) {
                return enlacePagina("calculadora");
            }

            const parametros = new URLSearchParams({
                simulacion: String(this.simulacionIdSinSolicitud),
                cp: this.codigoPostalSinSolicitud
            });
            return `${enlacePagina("registro")}?${parametros}`;
        },
        // Convierte el estado recibido del servidor en pasos para la línea de seguimiento.
        pasosSeguimiento() {
            if (!this.solicitud || this.solicitud.estado === "cancelada") {
                return [];
            }

            const etiquetas = [
                "Solicitud recibida",
                "Enviada al instalador",
                "Presupuesto enviado",
                this.solicitud.estado === "aceptado"
                    ? "Presupuesto aceptado"
                    : this.solicitud.estado === "rechazado"
                        ? "Presupuesto rechazado"
                        : "Respuesta al presupuesto"
            ];
            const indiceActual = {
                solicitada: 0,
                enviada: 1,
                presupuesto_enviado: 2,
                aceptado: 3,
                rechazado: 3
            }[this.solicitud.estado];

            return etiquetas.map((etiqueta, indice) => ({
                etiqueta,
                actual: indice === indiceActual,
                completado: indice < indiceActual
            }));
        }
    },
    created() {
        // Comprueba permisos y carga la solicitud al montar la página.
        this.inicializar();
    },
    methods: {
        enlacePagina,
        formatearFranja,
        formatearEuros,
        formatearNumero,
        async inicializar() {
            try {
                const parametros = new URLSearchParams(window.location.search);
                this.registroConfirmado = parametros.get("registro") === "creada";
                const simulacionId = Number(parametros.get("simulacion"));
                if (this.registroConfirmado && Number.isInteger(simulacionId) && simulacionId > 0) {
                    this.simulacionIdSinSolicitud = simulacionId;
                    this.codigoPostalSinSolicitud = parametros.get("cp") || "";
                    try {
                        this.simulacionSinSolicitud = obtenerSimulacionParaRegistro(simulacionId);
                        if (!this.simulacionSinSolicitud) {
                            this.errorSimulacionSinSolicitud = "No se pudieron recuperar los datos de esta simulación. Puedes realizar otra desde la calculadora.";
                        }
                    } catch (error) {
                        this.errorSimulacionSinSolicitud = error.message
                            || "No se pudieron recuperar los datos de esta simulación.";
                    }
                }

                this.usuario = await obtenerUsuario();
                if (
                    !this.usuario
                    || !Number.isInteger(this.usuario.id)
                    || typeof this.usuario.nombre !== "string"
                    || !["cliente", "admin"].includes(this.usuario.rol)
                ) {
                    throw new Error("La respuesta de sesión no tiene el formato esperado.");
                }

                if (this.usuario.rol === "admin") {
                    window.location.assign(enlacePagina("panelSolicitudes"));
                    return;
                }

                await this.cargarSolicitud();
            } catch (error) {
                // Sin sesión se inicia el login; los demás errores se muestran en la página.
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                } else {
                    this.errorGeneral = error.response?.data?.error
                        || error.message
                        || "No se pudo preparar tu área privada. Inténtalo de nuevo.";
                }
            } finally {
                this.cargando = false;
            }
        },
        validarSolicitud(solicitud) {
            // Evita renderizar datos incompletos o incompatibles con el contrato API.
            return solicitud
                && Number.isInteger(solicitud.id)
                && estadosSolicitud.includes(solicitud.estado)
                && typeof solicitud.sePuedeModificar === "boolean"
                && typeof solicitud.provincia === "string"
                && solicitud.franja
                && Number.isInteger(solicitud.franja.id)
                && typeof solicitud.franja.fecha === "string"
                && typeof solicitud.franja.horaInicio === "string"
                && typeof solicitud.franja.horaFin === "string"
                && typeof solicitud.direccion === "string"
                && typeof solicitud.municipio === "string"
                && typeof solicitud.codigoPostal === "string"
                && solicitud.simulacion
                && ["casa", "edificio"].includes(solicitud.simulacion.tipoInstalacion)
                && ["inclinado", "plano"].includes(solicitud.simulacion.tipoTejado)
                && (solicitud.presupuesto === null || typeof solicitud.presupuesto === "object");
        },
        async cargarSolicitud() {
            this.errorGeneral = "";
            this.sinSolicitud = false;

            try {
                const solicitud = await obtenerSolicitudMia();
                if (!this.validarSolicitud(solicitud)) {
                    throw new Error("La respuesta de la solicitud no tiene el formato esperado.");
                }
                this.solicitud = solicitud;
            } catch (error) {
                this.solicitud = null;
                // El 404 es un estado esperado cuando el cliente aún no tiene solicitudes.
                if (error.response?.status === 404) {
                    this.sinSolicitud = true;
                } else {
                    this.errorGeneral = error.response?.data?.error
                        || error.message
                        || "No se pudo consultar tu solicitud. Inténtalo de nuevo.";
                }
            }
        },
        async abrirModificacion() {
            this.errorGeneral = "";
            this.errores = {};
            this.mensajeExito = "";
            this.mostrarModificacion = true;
            this.franjaSeleccionada = "";
            // La provincia se deriva del código postal, como requiere la ruta 12.
            await this.cargarFranjas();
        },
        async cargarFranjas() {
            if (!this.solicitud) {
                return;
            }

            this.cargandoFranjas = true;
            try {
                this.franjas = await obtenerFranjasLibres(this.solicitud.codigoPostal.slice(0, 2));
                if (!Array.isArray(this.franjas)) {
                    throw new Error("La respuesta de huecos disponibles no tiene el formato esperado.");
                }
            } catch (error) {
                this.errorGeneral = error.response?.data?.error
                    || error.message
                    || "No se pudieron consultar los huecos. Inténtalo de nuevo.";
            } finally {
                this.cargandoFranjas = false;
            }
        },
        limpiarError(campo) {
            delete this.errores[campo];
            this.errorGeneral = "";
        },
        async obtenerMensajeError(error, mensajeAlternativo) {
            const datos = error.response?.data;
            if (datos instanceof Blob) {
                // Axios recibe también los errores como Blob al descargar el PDF.
                try {
                    const cuerpo = JSON.parse(await datos.text());
                    return cuerpo.error || mensajeAlternativo;
                } catch {
                    return mensajeAlternativo;
                }
            }

            return datos?.error || error.message || mensajeAlternativo;
        },
        async modificarFranja() {
            if (this.accionEnCurso || !this.franjaSeleccionada) {
                if (!this.franjaSeleccionada) {
                    this.errores.franjaId = "Selecciona un hueco disponible.";
                }
                return;
            }

            this.accionEnCurso = "modificar";
            this.errorGeneral = "";
            this.mensajeExito = "";
            try {
                await cambiarFranjaSolicitud(this.solicitud.id, {
                    franjaId: Number(this.franjaSeleccionada)
                });
                this.mostrarModificacion = false;
                this.mensajeExito = "La fecha de tu visita se ha actualizado.";
                await this.cargarSolicitud();
            } catch (error) {
                const mensaje = await this.obtenerMensajeError(
                    error,
                    "No se pudo modificar la fecha de la visita. Inténtalo de nuevo."
                );
                if (error.response?.data?.campo === "franjaId") {
                    this.errores.franjaId = mensaje;
                } else {
                    this.errorGeneral = mensaje;
                }

                // Si el servidor informa que el hueco dejó de estar libre, actualiza las opciones.
                if (error.response?.status === 409 && error.response?.data?.campo === "franjaId") {
                    await this.cargarFranjas();
                }
            } finally {
                this.accionEnCurso = "";
            }
        },
        async cancelarSolicitud() {
            if (
                this.accionEnCurso
                || !this.solicitud
                // La cancelación es irreversible y requiere confirmación explícita.
                || !window.confirm("¿Seguro que quieres cancelar esta solicitud?")
            ) {
                return;
            }

            this.accionEnCurso = "cancelar";
            this.errorGeneral = "";
            this.mensajeExito = "";
            try {
                await cancelarSolicitudApi(this.solicitud.id);
                this.mensajeExito = "Tu solicitud se ha cancelado.";
                await this.cargarSolicitud();
            } catch (error) {
                this.errorGeneral = await this.obtenerMensajeError(
                    error,
                    "No se pudo cancelar la solicitud. Inténtalo de nuevo."
                );
            } finally {
                this.accionEnCurso = "";
            }
        },
        async responderPresupuesto(respuesta) {
            if (this.accionEnCurso || !this.solicitud) {
                return;
            }

            this.accionEnCurso = respuesta;
            this.errorGeneral = "";
            this.mensajeExito = "";
            try {
                await responderPresupuestoApi(this.solicitud.id, { respuesta });
                this.mensajeExito = respuesta === "aceptado"
                    ? "Has aceptado el presupuesto."
                    : "Has rechazado el presupuesto.";
                await this.cargarSolicitud();
            } catch (error) {
                this.errorGeneral = await this.obtenerMensajeError(
                    error,
                    "No se pudo enviar tu respuesta. Inténtalo de nuevo."
                );
            } finally {
                this.accionEnCurso = "";
            }
        },
        async descargarPresupuesto() {
            if (this.accionEnCurso || !this.solicitud) {
                return;
            }

            this.accionEnCurso = "descargar";
            this.errorGeneral = "";
            try {
                const archivo = await descargarPresupuestoApi(this.solicitud.id);
                if (!(archivo instanceof Blob)) {
                    throw new Error("El archivo descargado no tiene el formato esperado.");
                }

                // Crea un enlace temporal para iniciar la descarga y luego libera su URL.
                const url = URL.createObjectURL(archivo);
                const enlace = document.createElement("a");
                enlace.href = url;
                enlace.download = `presupuesto-${this.solicitud.id}.pdf`;
                document.body.appendChild(enlace);
                enlace.click();
                enlace.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (error) {
                this.errorGeneral = await this.obtenerMensajeError(
                    error,
                    "No se pudo descargar el presupuesto. Inténtalo de nuevo."
                );
            } finally {
                this.accionEnCurso = "";
            }
        }
    }
});

app.component("header-component", HeaderComponent);
app.component("footer-component", FooterComponent);
app.component("chat-component", ChatComponent);
app.mount("#app");
