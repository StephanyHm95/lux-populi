console.log("registro.js cargado correctamente.");
const app = Vue.createApp({
    data() {
        return {
            simulacionId: null,
            codigoPostalSimulacion: "",
            usuario: null,
            formulario: {
                nombre: "",
                apellidos: "",
                email: "",
                telefono: "",
                password: "",
                password2: "",
                direccion: "",
                municipio: "",
                codigoPostal: "",
                franjaId: "",
                aceptaPrivacidad: false,
                aceptaEnvioDatos: false
            },
            franjas: [],
            errores: {},
            errorGeneral: "",
            cargando: true,
            cargandoFranjas: false,
            enviando: false,
            solicitudCreada: false
        };
    },
    computed: {
        haySesion() {
            return !!this.usuario;
        },
        esAdmin() {
            return this.usuario?.rol === "admin";
        },
        tieneSimulacion() {
            return Number.isInteger(this.simulacionId) && this.simulacionId > 0;
        },
        enlaceLogin() {
            if (!this.tieneSimulacion) {
                return enlacePagina("login");
            }

            const parametros = new URLSearchParams({
                simulacion: String(this.simulacionId),
                cp: this.codigoPostalSimulacion
            });

            return `${enlacePagina("login")}?${parametros}`;
        }
    },
    created() {
        this.inicializar();
    },
    methods: {
        enlacePagina,
        formatearFranja,
        async inicializar() {
            try {
                const parametros = new URLSearchParams(window.location.search);
                const simulacionId = Number(parametros.get("simulacion"));
                this.simulacionId = Number.isInteger(simulacionId) ? simulacionId : null;
                this.codigoPostalSimulacion = parametros.get("cp") || "";
                this.formulario.codigoPostal = this.codigoPostalSimulacion;

                if (!this.tieneSimulacion) {
                    return;
                }

                if (!validarCodigoPostal(this.codigoPostalSimulacion)) {
                    this.errorGeneral = "El código postal de la simulación no es válido. Vuelve a realizarla.";
                    return;
                }

                try {
                    this.usuario = await obtenerUsuario();
                } catch (error) {
                    if (error.response?.status !== 401) {
                        throw error;
                    }
                }

                if (
                    this.usuario
                    && (
                        !Number.isInteger(this.usuario.id)
                        || typeof this.usuario.nombre !== "string"
                        || !["cliente", "admin"].includes(this.usuario.rol)
                    )
                ) {
                    throw new Error("La respuesta de sesión no tiene el formato esperado.");
                }

                if (this.esAdmin) {
                    this.errorGeneral = "Una cuenta de administrador no puede solicitar una visita.";
                    return;
                }

                await this.cargarFranjas();
            } catch (error) {
                this.errorGeneral = error.response?.data?.error
                    || error.message
                    || "No se pudo preparar la solicitud. Inténtalo de nuevo.";
            } finally {
                this.cargando = false;
            }
        },
        async cargarFranjas() {
            this.cargandoFranjas = true;
            try {
                this.franjas = await obtenerFranjasLibres(this.codigoPostalSimulacion.slice(0, 2));
                if (!Array.isArray(this.franjas)) {
                    throw new Error("La respuesta de huecos disponibles no tiene el formato esperado.");
                }

                if (!this.franjas.some(franja => String(franja.id) === String(this.formulario.franjaId))) {
                    this.formulario.franjaId = "";
                }
            } finally {
                this.cargandoFranjas = false;
            }
        },
        limpiarError(campo) {
            delete this.errores[campo];
            this.errorGeneral = "";
        },
        validarDatosPersonales() {
            if (!this.haySesion) {
                const { formulario } = this;

                if (!validarTexto(formulario.nombre, 100)) {
                    this.errores.nombre = "Introduce tu nombre (máximo 100 caracteres).";
                }
                if (!validarTexto(formulario.apellidos, 150)) {
                    this.errores.apellidos = "Introduce tus apellidos (máximo 150 caracteres).";
                }
                if (!validarEmail(formulario.email)) {
                    this.errores.email = "Introduce un email válido.";
                }
                if (!validarTelefono(formulario.telefono)) {
                    this.errores.telefono = "Introduce un teléfono de 9 cifras.";
                }
                if (!validarPassword(formulario.password)) {
                    this.errores.password = "La contraseña debe tener al menos 8 caracteres.";
                }
                if (!validarPasswordsCoinciden(formulario.password, formulario.password2)) {
                    this.errores.password2 = "Las contraseñas no coinciden.";
                }
                if (!formulario.aceptaPrivacidad) {
                    this.errores.aceptaPrivacidad = "Debes aceptar la política de privacidad.";
                }
            }
        },
        validarDireccion() {
            const { formulario } = this;
            const codigoPostal = formulario.codigoPostal.trim();

            if (!validarTexto(formulario.direccion, 200)) {
                this.errores.direccion = "Introduce una dirección de hasta 200 caracteres.";
            }
            if (!validarTexto(formulario.municipio, 100)) {
                this.errores.municipio = "Introduce un municipio de hasta 100 caracteres.";
            }
            if (!validarCodigoPostal(codigoPostal)) {
                this.errores.codigoPostal = "Introduce un código postal válido de España.";
            } else if (codigoPostal.slice(0, 2) !== this.codigoPostalSimulacion.slice(0, 2)) {
                this.errores.codigoPostal = "El código postal debe ser de la misma provincia que la simulación.";
            }
        },
        validarSolicitud() {
            if (!this.formulario.franjaId) {
                this.errores.franjaId = "Selecciona un hueco disponible.";
            }

            if (!this.formulario.aceptaEnvioDatos) {
                this.errores.aceptaEnvioDatos = "Debes aceptar el envío de tus datos al instalador.";
            }
        },
        validarFormulario() {
            this.errores = {};
            this.errorGeneral = "";

            this.validarDatosPersonales();
            this.validarDireccion();
            this.validarSolicitud();
            return Object.keys(this.errores).length === 0;
        },
        aplicarErrorApi(error) {
            const mensaje = error.response?.data?.error
                || error.message
                || "No se pudo completar la solicitud. Inténtalo de nuevo.";
            const campo = error.response?.data?.campo;

            if (campo && Object.prototype.hasOwnProperty.call(this.formulario, campo)) {
                this.errores[campo] = mensaje;
            } else {
                this.errorGeneral = mensaje;
            }
        },
        async enviarSolicitud() {
            if (this.enviando || this.solicitudCreada || !this.validarFormulario()) {
                return;
            }

            this.enviando = true;
            try {
                if (!this.haySesion) {
                    const respuestaRegistro = await crearCuentaCliente({
                        nombre: this.formulario.nombre.trim(),
                        apellidos: this.formulario.apellidos.trim(),
                        email: this.formulario.email.trim(),
                        telefono: this.formulario.telefono.trim(),
                        password: this.formulario.password,
                        password2: this.formulario.password2,
                        aceptaPrivacidad: this.formulario.aceptaPrivacidad
                    });
                    this.usuario = respuestaRegistro;
                }

                await crearSolicitud({
                    simulacionId: this.simulacionId,
                    franjaId: Number(this.formulario.franjaId),
                    direccion: this.formulario.direccion.trim(),
                    municipio: this.formulario.municipio.trim(),
                    codigoPostal: this.formulario.codigoPostal.trim(),
                    aceptaEnvioDatos: this.formulario.aceptaEnvioDatos
                });

                this.solicitudCreada = true;
                window.location.assign(enlacePagina("miSolicitud"));
            } catch (error) {
                this.aplicarErrorApi(error);
                if (
                    error.response?.status === 409
                    && error.response?.data?.campo === "franjaId"
                ) {
                    try {
                        await this.cargarFranjas();
                    } catch (errorFranjas) {
                        this.errorGeneral = errorFranjas.response?.data?.error
                            || "El hueco ya no está libre y no se pudo actualizar la lista. Inténtalo de nuevo.";
                    }
                }
            } finally {
                this.enviando = false;
            }
        }
    }
});

app.component("header-component", HeaderComponent);
app.component("footer-component", FooterComponent);
app.component("chat-component", ChatComponent);
app.mount("#app");
