console.log("Login.js cargado correctamente.");

const app = Vue.createApp({
    data() {
        return {
            // Datos enlazados con los campos del formulario mediante v-model.
            formulario: {
                email: "",
                password: ""
            },
            // Errores por campo y mensaje general para mostrar fallos del acceso.
            errores: {},
            errorGeneral: "",
            // Evita envíos repetidos mientras se procesa la petición.
            enviando: false,
            // Parámetros opcionales para volver al registro tras iniciar sesión.
            simulacionIdRetorno: null,
            codigoPostalRetorno: ""
        };
    },
    computed: {
        // Construye el enlace de retorno al registro si los parámetros son válidos, 
        // o devuelve null si no lo son.
        enlaceRegistroRetorno() {
            if (
                !Number.isInteger(this.simulacionIdRetorno)
                || this.simulacionIdRetorno < 1
                || !validarCodigoPostal(this.codigoPostalRetorno)
            ) {
                return null;
            }

            const parametros = new URLSearchParams({
                simulacion: String(this.simulacionIdRetorno),
                cp: this.codigoPostalRetorno
            });

            return `${enlacePagina("registro")}?${parametros}`;
        }
    },

    // Lee los parámetros de la URL al cargar la página y los almacena en el estado del componente.
    created() {
        const parametros = new URLSearchParams(window.location.search);
        const simulacionId = Number(parametros.get("simulacion"));
        this.simulacionIdRetorno = Number.isInteger(simulacionId) ? simulacionId : null;
        this.codigoPostalRetorno = parametros.get("cp") || "";
    },
    methods: {
        enlacePagina,
        limpiarError(campo) {
            // Limpia los mensajes cuando la persona vuelve a editar el formulario.
            delete this.errores[campo];
            this.errorGeneral = "";
        },

        // Valida el formulario de inicio de sesión antes de enviarlo al servidor.
        // Devuelve true si es válido, false si hay errores.
        validarFormulario() {
            this.errores = {};
            this.errorGeneral = "";

            if (!validarEmail(this.formulario.email)) {
                this.errores.email = "Introduce un email válido.";
            }
            if (!this.formulario.password) {
                this.errores.password = "Introduce tu contraseña.";
            }

            return Object.keys(this.errores).length === 0;
        },

        // Convierte un error recibido durante el inicio de sesión en un mensaje que la página pueda mostrar.
        aplicarErrorApi(error) {
            const mensaje = error.response?.data?.error
                || error.message
                || "No se pudo iniciar sesión. Inténtalo de nuevo.";
            const campo = error.response?.data?.campo;

            if (campo && Object.prototype.hasOwnProperty.call(this.formulario, campo)) {
                this.errores[campo] = mensaje;
            } else {
                this.errorGeneral = mensaje;
            }
        },

        // Envía el formulario de inicio de sesión al servidor y maneja la respuesta.
        async enviarLogin() {
            // Evita enviar el formulario si ya se está enviando o si no es válido.
            if (this.enviando || !this.validarFormulario()) {
                return;
            }

            this.enviando = true;
            try {
                // LLama a la ruta 2 y obtiene el usuario.
                const usuario = await iniciarSesionApi({
                    email: this.formulario.email.trim(),
                    password: this.formulario.password
                });
                // Comprueba que la respuesta del login tiene el formato esperado antes de continuar.
                if (
                    !usuario
                    || !Number.isInteger(usuario.id)
                    || typeof usuario.nombre !== "string"
                    || !["cliente", "admin"].includes(usuario.rol)
                ) {
                    throw new Error("La respuesta de inicio de sesión no tiene el formato esperado.");
                }
                // Redirige al admin a la página de panel de solicitudes.
                if (usuario.rol === "admin") {
                    window.location.assign(enlacePagina("panelSolicitudes"));
                    return;
                }
                // Redirige al cliente a la página de registro si hay una solicitud de visita pendiente, 
                // o a la página de mi solicitud.
                window.location.assign(
                    this.enlaceRegistroRetorno
                        || enlacePagina("miSolicitud")
                );
            } catch (error) {
                this.aplicarErrorApi(error);
            } finally {
                // Vuelve a habilitar el formulario tanto si el acceso funciona como si falla.
                this.enviando = false;
            }
        }
    }
});

// Registra los componentes comunes utilizados en la página de login.
app.component("header-component", HeaderComponent);
app.component("footer-component", FooterComponent);
app.component("chat-component", ChatComponent);
app.mount("#app");
