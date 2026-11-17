console.log("registro.js cargado correctamente.");
const app = Vue.createApp({
    data() {
        return {
            // Identifican la simulación y el código postal recibidos en la URL.
            simulacionId: null,
            codigoPostalSimulacion: "",
            // Comienza como null, después se rellena con los datos de sesión si hay usuario logueado.
            usuario: null,
            // Valores enlazados con los campos del formulario mediante v-model.
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
            franjasCargadas: false,
            errores: {},
            errorGeneral: "",
            cargando: true,
            cargandoFranjas: false,
            enviando: false,
            solicitudCreada: false,
            mostrarFormularioCuentaSinSolicitud: false
        };
    },
    computed: {
        // Derivan el estado de sesión y el acceso al formulario de los datos del usuario.
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
                // Recupera la simulación opcional desde la URL.
                const parametros = new URLSearchParams(window.location.search);
                const simulacionId = Number(parametros.get("simulacion"));
                this.simulacionId = Number.isInteger(simulacionId) ? simulacionId : null;
                this.codigoPostalSimulacion = parametros.get("cp") || "";
                this.formulario.codigoPostal = this.codigoPostalSimulacion;

                // El código postal solo es necesario cuando se inicia una solicitud.
                if (this.tieneSimulacion && !validarCodigoPostal(this.codigoPostalSimulacion)) {
                    this.errorGeneral = "El código postal de la simulación no es válido. Vuelve a realizarla.";
                    return;
                }

                // Un 401 significa que la persona es visitante; otros errores sí se muestran.
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

                if (!this.tieneSimulacion) {
                    return;
                }

                if (this.esAdmin) {
                    this.errorGeneral = "Una cuenta de administrador no puede solicitar una visita.";
                    return;
                }

                // Los huecos se filtran por las dos primeras cifras del código postal.
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
                // Consulta los huecos libres de la provincia de la simulación.
                this.franjas = await obtenerFranjasLibres(this.codigoPostalSimulacion.slice(0, 2));
                if (!Array.isArray(this.franjas)) {
                    throw new Error("La respuesta de huecos disponibles no tiene el formato esperado.");
                }

                this.franjasCargadas = true;

                // Deselecciona el hueco si ya no aparece entre los disponibles.
                if (!this.franjas.some(franja => String(franja.id) === String(this.formulario.franjaId))) {
                    this.formulario.franjaId = "";
                }
            } finally {
                this.cargandoFranjas = false;
            }
        },
        async volverAConsultarFranjas() {
            this.errorGeneral = "";
            try {
                await this.cargarFranjas();
            } catch (error) {
                this.errorGeneral = error.response?.data?.error
                    || error.message
                    || "No se pudieron consultar los huecos. Inténtalo de nuevo.";
            }
        },
        limpiarError(campo) {
            // Quita el error del campo editado y limpia el mensaje general anterior.
            delete this.errores[campo];
            this.errorGeneral = "";
        },
        validarDatosPersonales() {
            // Los datos de cuenta solo se piden a quienes todavía no han iniciado sesión.
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
        validarSoloCuenta() {
            this.errores = {};
            this.errorGeneral = "";
            this.validarDatosPersonales();
            return Object.keys(this.errores).length === 0;
        },
        async registrarCuentaApi() {
            const usuario = await crearCuentaCliente({
                nombre: this.formulario.nombre.trim(),
                apellidos: this.formulario.apellidos.trim(),
                email: this.formulario.email.trim(),
                telefono: this.formulario.telefono.trim(),
                password: this.formulario.password,
                password2: this.formulario.password2,
                aceptaPrivacidad: this.formulario.aceptaPrivacidad
            });

            if (
                !usuario
                || !Number.isInteger(usuario.id)
                || typeof usuario.nombre !== "string"
                || usuario.rol !== "cliente"
            ) {
                throw new Error("La respuesta del registro no tiene el formato esperado.");
            }

            this.usuario = usuario;
            window.dispatchEvent(new CustomEvent("lux-populi:usuario-autenticado", {
                detail: usuario
            }));
        },
        async crearCuentaSinSolicitud() {
            if (this.enviando || this.haySesion || !this.validarSoloCuenta()) {
                return;
            }

            this.enviando = true;
            try {
                await this.registrarCuentaApi();
                const parametros = new URLSearchParams({ registro: "creada" });
                if (this.tieneSimulacion) {
                    parametros.set("simulacion", String(this.simulacionId));
                    parametros.set("cp", this.codigoPostalSimulacion);
                }
                window.location.assign(`${enlacePagina("miSolicitud")}?${parametros}`);
            } catch (error) {
                this.aplicarErrorApi(error);
            } finally {
                this.enviando = false;
            }
        },
        mostrarRegistroSinSolicitud() {
            this.mostrarFormularioCuentaSinSolicitud = true;
        },
        validarDireccion() {
            // Comprueba la dirección y que el código postal corresponda a la provincia simulada.
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
            // La cita y el consentimiento para enviar datos son necesarios en todos los casos.
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

            // Ejecuta las validaciones de cada bloque y permite enviar solo si no hay errores.
            this.validarDatosPersonales();
            this.validarDireccion();
            this.validarSolicitud();
            return Object.keys(this.errores).length === 0;
        },
        aplicarErrorApi(error) {
            // Asocia los errores de campo del backend al formulario; los demás se muestran en general.
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
            // Evita envíos duplicados y no continúa si la validación local falla.
            if (this.enviando || this.solicitudCreada || !this.validarFormulario()) {
                return;
            }

            this.enviando = true;
            try {
                // Los visitantes crean primero su cuenta; la respuesta deja la sesión iniciada.
                if (!this.haySesion) {
                    await this.registrarCuentaApi();
                }

                // Con la sesión disponible, crea la solicitud y navega a mi-solicitud.
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
                // Si el hueco se reservó mientras se completaba el formulario, actualiza la lista.
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
                // Libera el estado de envío tanto si las peticiones funcionan como si fallan.
                this.enviando = false;
            }
        }
    }
});

// Registra los componentes comunes y monta la aplicación de registro.
app.component("header-component", HeaderComponent);
app.component("footer-component", FooterComponent);
app.component("chat-component", ChatComponent);
app.mount("#app");
