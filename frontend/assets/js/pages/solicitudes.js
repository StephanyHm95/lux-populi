console.log("Solicitudes.js cargado correctamente.");

const estadosSolicitudAdmin = [
    "solicitada",
    "enviada",
    "presupuesto_enviado",
    "aceptado",
    "rechazado",
    "cancelada"
];
const accionesSolicitudAdmin = ["enviar", "cancelar", "subir_presupuesto"];
const tamanoMaximoPdf = 5 * 1024 * 1024;

const app = Vue.createApp({
    data() {
        return {
            usuario: null,
            cargando: true,
            cargandoLista: false,
            idCargaLista: 0,
            cargandoDetalle: false,
            errorGeneral: "",
            mensajeExito: "",
            estados: estadosSolicitudAdmin,
            provincias: [],
            solicitudes: [],
            filtros: {
                estado: "todos",
                provincia: ""
            },
            detalle: null,
            formulario: {
                emailInstalador: "",
                importe: "",
                pdf: null
            },
            errores: {},
            accionEnCurso: ""
        };
    },
    computed: {
        datosSimulacion() {
            if (!this.detalle) {
                return [];
            }

            const simulacion = this.detalle.simulacion;
            const campos = [
                ["Tipo de instalación", this.etiquetaTipo(simulacion.tipoInstalacion)],
                ["Código postal", simulacion.codigoPostal],
                ["Tipo de tejado", simulacion.tipoTejado === "inclinado" ? "Inclinado" : "Plano"],
                ["Superficie", this.formatearMedida(simulacion.superficie, "m²")],
                ["Consumo mensual", this.formatearMedida(simulacion.consumoMensual, "kWh/mes")],
                ["Número de viviendas", simulacion.numViviendas],
                ["Consumo por vivienda", this.formatearMedida(simulacion.consumoVivienda, "kWh/mes")],
                ["Incluye zonas comunes", simulacion.incluirZonasComunes],
                ["Consumo de zonas comunes", this.formatearMedida(simulacion.consumoZonasComunes, "kWh/mes")],
                ["Paneles", simulacion.panelesFinales],
                ["Potencia instalada", this.formatearMedida(simulacion.potenciaInstalada, "kWp")],
                ["El tejado limita la instalación", simulacion.tejadoLimita],
                ["Coste estimado", this.formatearValor(simulacion.coste, "euros")],
                ["Ahorro anual", this.formatearValor(simulacion.ahorroAnual, "euros")],
                ["Amortización", this.formatearMedida(simulacion.amortizacion, "años")],
                ["Coste por vivienda", this.formatearValor(simulacion.costePorVivienda, "euros")],
                ["Ahorro por vivienda", this.formatearValor(simulacion.ahorroPorVivienda, "euros")]
            ];

            return campos.map(([nombre, valor]) => ({
                nombre,
                valor: valor === null || valor === undefined ? "No aplica" : valor
            }));
        }
    },
    created() {
        this.inicializar();
    },
    methods: {
        enlacePagina,
        formatearEuros,
        formatearNumero,
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
        etiquetaTipo(tipo) {
            return tipo === "edificio" ? "Edificio" : "Casa";
        },
        formatearMedida(valor, unidad) {
            return valor === null || valor === undefined
                ? null
                : `${formatearNumero(valor)} ${unidad}`;
        },
        formatearValor(valor, tipo) {
            if (valor === null || valor === undefined) {
                return null;
            }
            return tipo === "euros" ? formatearEuros(valor) : formatearNumero(valor);
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
                    api.get("/provincias").then(respuesta => respuesta.data),
                    this.cargarSolicitudes()
                ]);
                if (!Array.isArray(provincias)) {
                    throw new Error("La lista de provincias no tiene el formato esperado.");
                }
                this.provincias = provincias;
            } catch (error) {
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                } else {
                    this.errorGeneral = error.response?.data?.error
                        || error.message
                        || "No se pudo preparar el panel de solicitudes. Inténtalo de nuevo.";
                }
            } finally {
                this.cargando = false;
            }
        },
        async cargarSolicitudes(cerrarDetalle = false) {
            const idCarga = ++this.idCargaLista;
            if (cerrarDetalle) {
                this.detalle = null;
                this.limpiarFormularioAccion();
            }
            this.errorGeneral = "";
            this.mensajeExito = "";
            this.cargandoLista = true;

            try {
                const solicitudes = await obtenerSolicitudesGestion(this.filtros);
                if (idCarga !== this.idCargaLista) {
                    return;
                }
                if (
                    !Array.isArray(solicitudes)
                    || solicitudes.some(solicitud => (
                        !Number.isInteger(solicitud.id)
                        || typeof solicitud.cliente !== "string"
                        || typeof solicitud.municipio !== "string"
                        || typeof solicitud.provincia !== "string"
                        || !["casa", "edificio"].includes(solicitud.tipoInstalacion)
                        || typeof solicitud.fecha !== "string"
                        || typeof solicitud.horaInicio !== "string"
                        || typeof solicitud.horaFin !== "string"
                        || !estadosSolicitudAdmin.includes(solicitud.estado)
                    ))
                ) {
                    throw new Error("La respuesta de solicitudes no tiene el formato esperado.");
                }
                this.solicitudes = solicitudes;
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
                    || "No se pudieron cargar las solicitudes. Inténtalo de nuevo.";
            } finally {
                if (idCarga === this.idCargaLista) {
                    this.cargandoLista = false;
                }
            }
        },
        aplicarFiltros() {
            return this.cargarSolicitudes(true);
        },
        actualizarFiltro(campo, evento) {
            if (campo === "estado") {
                this.filtros.estado = evento.target.value;
            } else if (campo === "provincia") {
                this.filtros.provincia = evento.target.value;
            }
            return this.aplicarFiltros();
        },
        limpiarFormularioAccion() {
            this.formulario = {
                emailInstalador: "",
                importe: "",
                pdf: null
            };
            this.errores = {};
        },
        async verSolicitud(id) {
            this.detalle = null;
            this.limpiarFormularioAccion();
            this.errorGeneral = "";
            this.mensajeExito = "";
            this.cargandoDetalle = true;

            try {
                const detalle = await obtenerDetalleSolicitudGestion(id);
                if (
                    !detalle
                    || !Number.isInteger(detalle.id)
                    || !estadosSolicitudAdmin.includes(detalle.estado)
                    || !Array.isArray(detalle.accionesPermitidas)
                    || detalle.accionesPermitidas.some(accion => !accionesSolicitudAdmin.includes(accion))
                    || !detalle.cliente
                    || typeof detalle.cliente.nombre !== "string"
                    || typeof detalle.cliente.apellidos !== "string"
                    || typeof detalle.cliente.email !== "string"
                    || typeof detalle.cliente.telefono !== "string"
                    || typeof detalle.direccion !== "string"
                    || typeof detalle.municipio !== "string"
                    || typeof detalle.provincia !== "string"
                    || !detalle.franja
                    || !detalle.simulacion
                    || (detalle.presupuesto !== null && typeof detalle.presupuesto !== "object")
                ) {
                    throw new Error("El detalle de solicitud no tiene el formato esperado.");
                }
                this.detalle = detalle;
            } catch (error) {
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                } else {
                    this.errorGeneral = error.response?.data?.error
                        || error.message
                        || "No se pudo consultar el detalle. Inténtalo de nuevo.";
                }
            } finally {
                this.cargandoDetalle = false;
            }
        },
        limpiarError(campo) {
            delete this.errores[campo];
            this.errorGeneral = "";
        },
        aplicarErrorApi(error, mensajeAlternativo) {
            const mensaje = error.response?.data?.error
                || error.message
                || mensajeAlternativo;
            const campo = error.response?.data?.campo;

            if (campo && Object.prototype.hasOwnProperty.call(this.formulario, campo)) {
                this.errores[campo] = mensaje;
            } else {
                this.errorGeneral = mensaje;
            }
        },
        async actualizarTrasAccion(mensaje) {
            const solicitudId = this.detalle?.id;
            if (solicitudId) {
                await this.verSolicitud(solicitudId);
            }
            await this.cargarSolicitudes();
            this.mensajeExito = mensaje;
        },
        async enviarAlInstalador() {
            if (this.accionEnCurso || !this.detalle) {
                return;
            }

            const email = this.formulario.emailInstalador.trim();
            this.errores = {};
            if (!validarEmail(email) || email.length > 150) {
                this.errores.emailInstalador = "Introduce un email válido de hasta 150 caracteres.";
                return;
            }

            this.errorGeneral = "";
            this.accionEnCurso = "enviar";
            try {
                const respuesta = await enviarSolicitudAlInstalador(this.detalle.id, {
                    emailInstalador: email
                });
                if (!respuesta || respuesta.estado !== "enviada") {
                    throw new Error("La respuesta de envío no tiene el formato esperado.");
                }
                await this.actualizarTrasAccion("La solicitud se ha enviado al instalador.");
            } catch (error) {
                this.aplicarErrorApi(error, "No se ha podido enviar el email. Inténtalo de nuevo.");
            } finally {
                this.accionEnCurso = "";
            }
        },
        seleccionarPdf(evento) {
            this.formulario.pdf = evento.target.files[0] || null;
            this.limpiarError("pdf");
            if (!this.formulario.pdf) {
                return;
            }

            if (!this.esArchivoPdf(this.formulario.pdf)) {
                this.errores.pdf = "Selecciona un archivo PDF.";
            } else if (this.formulario.pdf.size > tamanoMaximoPdf) {
                this.errores.pdf = "El archivo no puede superar los 5 MB.";
            }
        },
        esArchivoPdf(archivo) {
            const extensionPdf = archivo.name.toLowerCase().endsWith(".pdf");
            return archivo.type === "application/pdf" || (!archivo.type && extensionPdf);
        },
        async subirPresupuesto() {
            if (this.accionEnCurso || !this.detalle) {
                return;
            }

            this.errores = {};
            const importe = Number(this.formulario.importe);
            if (!Number.isFinite(importe) || importe <= 0) {
                this.errores.importe = "Introduce un importe mayor que 0.";
            }
            if (!this.formulario.pdf) {
                this.errores.pdf = "Selecciona el PDF del presupuesto.";
            } else if (
                !this.esArchivoPdf(this.formulario.pdf)
                || this.formulario.pdf.size > tamanoMaximoPdf
            ) {
                this.errores.pdf = this.formulario.pdf.size > tamanoMaximoPdf
                    ? "El archivo no puede superar los 5 MB."
                    : "Selecciona un archivo PDF.";
            }
            if (Object.keys(this.errores).length > 0) {
                return;
            }

            const datos = new FormData();
            datos.append("importe", this.formulario.importe);
            datos.append("pdf", this.formulario.pdf);
            this.errorGeneral = "";
            this.accionEnCurso = "presupuesto";

            try {
                const respuesta = await subirPresupuestoSolicitud(this.detalle.id, datos);
                if (!respuesta || respuesta.estado !== "presupuesto_enviado") {
                    throw new Error("La respuesta de subida del presupuesto no tiene el formato esperado.");
                }
                this.limpiarFormularioAccion();
                if (this.$refs.pdfInput) {
                    this.$refs.pdfInput.value = "";
                }
                await this.actualizarTrasAccion("El presupuesto se ha subido correctamente.");
            } catch (error) {
                this.aplicarErrorApi(error, "No se pudo subir el presupuesto. Inténtalo de nuevo.");
            } finally {
                this.accionEnCurso = "";
            }
        },
        async cancelarSolicitud() {
            if (
                this.accionEnCurso
                || !this.detalle
                || !window.confirm("¿Seguro que quieres cancelar esta solicitud?")
            ) {
                return;
            }

            this.errorGeneral = "";
            this.accionEnCurso = "cancelar";
            try {
                await cancelarSolicitudApi(this.detalle.id);
                await this.actualizarTrasAccion("La solicitud se ha cancelado.");
            } catch (error) {
                this.aplicarErrorApi(error, "No se pudo cancelar la solicitud. Inténtalo de nuevo.");
            } finally {
                this.accionEnCurso = "";
            }
        },
        async obtenerMensajeError(error, mensajeAlternativo) {
            const datos = error.response?.data;
            if (datos instanceof Blob) {
                try {
                    const cuerpo = JSON.parse(await datos.text());
                    return cuerpo.error || mensajeAlternativo;
                } catch {
                    return mensajeAlternativo;
                }
            }
            return datos?.error || error.message || mensajeAlternativo;
        },
        async descargarPresupuesto() {
            if (this.accionEnCurso || !this.detalle) {
                return;
            }

            this.errorGeneral = "";
            this.accionEnCurso = "descargar";
            try {
                const archivo = await descargarPresupuestoApi(this.detalle.id);
                if (!(archivo instanceof Blob)) {
                    throw new Error("El archivo descargado no tiene el formato esperado.");
                }

                const url = URL.createObjectURL(archivo);
                const enlace = document.createElement("a");
                enlace.href = url;
                enlace.download = `presupuesto-${this.detalle.id}.pdf`;
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
