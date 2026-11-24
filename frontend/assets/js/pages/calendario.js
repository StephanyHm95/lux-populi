console.log("Calendario.js cargado correctamente.");

const estadosCalendario = [
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
            usuario: null,
            cargando: true,
            cargandoLista: false,
            idCargaLista: 0,
            mostrarFormularioNuevoHueco: false,
            enviando: false,
            eliminandoId: null,
            errorGeneral: "",
            mensajeExito: "",
            errores: {},
            provincias: [],
            franjas: [],
            filtros: {
                ver: "proximas",
                provincia: ""
            },
            formulario: {
                provincia: "",
                fecha: "",
                horaInicio: "",
                horaFin: ""
            }
        };
    },
    computed: {
        fechaMinima() {
            const hoy = new Date();
            const mes = String(hoy.getMonth() + 1).padStart(2, "0");
            const dia = String(hoy.getDate()).padStart(2, "0");
            return `${hoy.getFullYear()}-${mes}-${dia}`;
        }
    },
    created() {
        this.inicializar();
    },
    methods: {
        enlacePagina,
        formatearFranja,
        etiquetaEstado(estado) {
            return {
                solicitada: "Solicitada",
                enviada: "Enviada",
                presupuesto_enviado: "Presupuesto enviado",
                aceptado: "Aceptado",
                rechazado: "Rechazado",
                cancelada: "Cancelada"
            }[estado] || estado;
        },
        async inicializar() {
            try {
                this.usuario = await obtenerUsuario();
                if (
                    !this.usuario
                    || !Number.isInteger(this.usuario.id)
                    || typeof this.usuario.nombre !== "string"
                    || !["cliente", "admin"].includes(this.usuario.rol)
                ) {
                    throw new Error("La respuesta de sesión no tiene el formato esperado.");
                }

                if (this.usuario.rol !== "admin") {
                    window.location.assign(
                        this.usuario.rol === "cliente"
                            ? enlacePagina("miSolicitud")
                            : enlacePagina("login")
                    );
                    return;
                }

                const [provincias] = await Promise.all([
                    obtenerProvinciasApi(),
                    this.cargarFranjas()
                ]);
                if (
                    !Array.isArray(provincias)
                    || provincias.length !== 52
                    || provincias.some(provincia => (
                        typeof provincia.codigo !== "string"
                        || typeof provincia.nombre !== "string"
                    ))
                ) {
                    throw new Error("La respuesta de provincias no contiene las 52 provincias esperadas.");
                }
                this.provincias = provincias;
            } catch (error) {
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                } else {
                    this.errorGeneral = error.response?.data?.error
                        || error.message
                        || "No se pudo preparar el calendario. Inténtalo de nuevo.";
                }
            } finally {
                this.cargando = false;
            }
        },
        async cargarFranjas() {
            const idCarga = ++this.idCargaLista;
            this.errorGeneral = "";
            this.cargandoLista = true;
            try {
                const franjas = await obtenerFranjasCalendario(this.filtros);
                if (idCarga !== this.idCargaLista) {
                    return;
                }
                if (
                    !Array.isArray(franjas)
                    || franjas.some(franja => (
                        !Number.isInteger(franja.id)
                        || typeof franja.fecha !== "string"
                        || typeof franja.horaInicio !== "string"
                        || typeof franja.horaFin !== "string"
                        || typeof franja.ocupada !== "boolean"
                        || typeof franja.provincia !== "string"
                        || (
                            franja.solicitud !== null
                            && (
                                !franja.solicitud
                                || !Number.isInteger(franja.solicitud.id)
                                || typeof franja.solicitud.cliente !== "string"
                                || typeof franja.solicitud.municipio !== "string"
                                || !estadosCalendario.includes(franja.solicitud.estado)
                            )
                        )
                    ))
                ) {
                    throw new Error("La respuesta del calendario no tiene el formato esperado.");
                }
                this.franjas = franjas;
            } catch (error) {
                if (idCarga !== this.idCargaLista) {
                    return;
                }
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                    return;
                }
                this.errorGeneral = error.response?.data?.error
                    || error.message
                    || "No se pudieron cargar los huecos. Inténtalo de nuevo.";
            } finally {
                if (idCarga === this.idCargaLista) {
                    this.cargandoLista = false;
                }
            }
        },
        aplicarFiltros() {
            this.mensajeExito = "";
            return this.cargarFranjas();
        },
        actualizarFiltro(campo, evento) {
            if (campo === "ver") {
                this.filtros.ver = evento.target.value;
            } else if (campo === "provincia") {
                this.filtros.provincia = evento.target.value;
            }
            return this.aplicarFiltros();
        },
        iniciarNuevoHueco() {
            this.formulario = {
                provincia: "",
                fecha: "",
                horaInicio: "",
                horaFin: ""
            };
            this.errores = {};
            this.errorGeneral = "";
            this.mensajeExito = "";
            this.mostrarFormularioNuevoHueco = true;
            this.$nextTick(() => this.$refs.provinciaHueco?.focus());
        },
        cancelarNuevoHueco() {
            this.mostrarFormularioNuevoHueco = false;
            this.formulario = {
                provincia: "",
                fecha: "",
                horaInicio: "",
                horaFin: ""
            };
            this.errores = {};
            this.$nextTick(() => this.$refs.botonCrearHueco?.focus());
        },
        limpiarError(campo) {
            delete this.errores[campo];
            this.errorGeneral = "";
        },
        validarFormulario() {
            this.errores = {};
            this.errorGeneral = "";
            const ahora = new Date();
            const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

            if (!this.provincias.some(provincia => provincia.codigo === this.formulario.provincia)) {
                this.errores.provincia = "Selecciona una provincia.";
            }

            const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(this.formulario.fecha);
            if (!fechaValida) {
                this.errores.fecha = "Introduce una fecha válida.";
            } else {
                const [anio, mes, dia] = this.formulario.fecha.split("-").map(Number);
                const fechaCalendario = new Date(anio, mes - 1, dia);
                if (
                    fechaCalendario.getFullYear() !== anio
                    || fechaCalendario.getMonth() !== mes - 1
                    || fechaCalendario.getDate() !== dia
                    || fechaCalendario < hoy
                ) {
                    this.errores.fecha = "Elige una fecha futura o de hoy.";
                }
            }

            const formatoHora = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
            if (!formatoHora.test(this.formulario.horaInicio)) {
                this.errores.horaInicio = "Introduce una hora de inicio válida.";
            } else if (fechaValida) {
                const [anio, mes, dia] = this.formulario.fecha.split("-").map(Number);
                const [hora, minuto] = this.formulario.horaInicio.split(":").map(Number);
                if (new Date(anio, mes - 1, dia, hora, minuto) <= ahora) {
                    this.errores.fecha = "El hueco tiene que empezar en el futuro.";
                }
            }
            if (!formatoHora.test(this.formulario.horaFin)) {
                this.errores.horaFin = "Introduce una hora de fin válida.";
            } else if (
                formatoHora.test(this.formulario.horaInicio)
                && this.formulario.horaFin <= this.formulario.horaInicio
            ) {
                this.errores.horaFin = "La hora de fin tiene que ser posterior a la de inicio.";
            }

            return Object.keys(this.errores).length === 0;
        },
        aplicarErrorApi(error) {
            const mensaje = error.response?.data?.error
                || error.message
                || "No se pudo crear el hueco. Inténtalo de nuevo.";
            const campo = error.response?.data?.campo;

            if (campo && Object.prototype.hasOwnProperty.call(this.formulario, campo)) {
                this.errores[campo] = mensaje;
            } else {
                this.errorGeneral = mensaje;
            }
        },
        async crearFranja() {
            if (this.enviando || !this.validarFormulario()) {
                return;
            }

            this.enviando = true;
            try {
                const datos = {
                    provincia: this.formulario.provincia,
                    fecha: this.formulario.fecha,
                    horaInicio: this.formulario.horaInicio,
                    horaFin: this.formulario.horaFin
                };
                const franja = await crearFranjaApi(datos);
                if (
                    !franja
                    || !Number.isInteger(franja.id)
                    || franja.fecha !== datos.fecha
                    || franja.horaInicio !== datos.horaInicio
                    || franja.horaFin !== datos.horaFin
                    || franja.ocupada !== false
                ) {
                    throw new Error("La respuesta al crear el hueco no tiene el formato esperado.");
                }

                this.formulario = {
                    provincia: "",
                    fecha: "",
                    horaInicio: "",
                    horaFin: ""
                };
                this.filtros.provincia = datos.provincia;
                this.filtros.ver = "proximas";
                await this.cargarFranjas();
                this.mensajeExito = "El hueco se ha creado correctamente.";
                this.mostrarFormularioNuevoHueco = false;
                await this.$nextTick();
                this.$refs.botonCrearHueco?.focus();
            } catch (error) {
                this.aplicarErrorApi(error);
            } finally {
                this.enviando = false;
            }
        },
        async eliminarFranja(franja) {
            if (
                this.eliminandoId !== null
                || franja.ocupada
                || franja.solicitud
                || !window.confirm(`¿Seguro que quieres eliminar el hueco del ${formatearFranja(franja)}?`)
            ) {
                return;
            }

            this.errorGeneral = "";
            this.mensajeExito = "";
            this.eliminandoId = franja.id;
            try {
                await eliminarFranjaApi(franja.id);
                await this.cargarFranjas();
                this.mensajeExito = "El hueco se ha eliminado correctamente.";
            } catch (error) {
                this.errorGeneral = error.response?.data?.error
                    || error.message
                    || "No se pudo eliminar el hueco. Inténtalo de nuevo.";
            } finally {
                this.eliminandoId = null;
            }
        }
    }
});

app.component("header-component", HeaderComponent);
app.component("footer-component", FooterComponent);
app.component("chat-component", ChatComponent);
app.mount("#app");
