console.log("Datos-presupuesto.js cargado correctamente.");

const camposParametros = [
    "precioKwp",
    "potenciaPanel",
    "precioLuz",
    "precioCompensacion"
];
const tiposConcepto = ["casa", "edificio", "ambos"];

function crearFormularioConceptoVacio() {
    return {
        nombre: "",
        precio: "",
        aplicaA: "ambos",
        soloPlana: false
    };
}

const app = Vue.createApp({
    data() {
        return {
            usuario: null,
            cargando: true,
            cargandoParametros: false,
            parametrosCargados: false,
            cargandoConceptos: true,
            conceptosCargados: false,
            guardandoParametros: false,
            guardandoConcepto: false,
            eliminandoConceptoId: null,
            errorGeneral: "",
            errorParametrosCarga: "",
            errorConceptosCarga: "",
            mensajeExito: "",
            parametros: {
                precioKwp: "",
                potenciaPanel: "",
                precioLuz: "",
                precioCompensacion: ""
            },
            erroresParametros: {},
            conceptos: [],
            mostrarFormularioConcepto: false,
            conceptoEditandoId: null,
            formularioConcepto: crearFormularioConceptoVacio(),
            erroresConcepto: {}
        };
    },
    computed: {
        conceptoEnCurso() {
            return this.eliminandoConceptoId
                || (this.guardandoConcepto ? "guardando" : null);
        }
    },
    created() {
        this.inicializar();
    },
    methods: {
        enlacePagina,
        formatearEuros,
        etiquetaAplicaA(aplicaA) {
            return {
                casa: "Casa",
                edificio: "Edificio",
                ambos: "Ambos"
            }[aplicaA] || aplicaA;
        },
        validarRespuestaParametros(datos) {
            return datos !== null
                && typeof datos === "object"
                && camposParametros.every(campo => (
                    typeof datos[campo] === "number"
                    && Number.isFinite(datos[campo])
                    && datos[campo] > 0
                ));
        },
        validarRespuestaConceptos(conceptos) {
            return Array.isArray(conceptos)
                && conceptos.every(concepto => (
                    concepto
                    && Number.isInteger(concepto.id)
                    && concepto.id > 0
                    && typeof concepto.nombre === "string"
                    && typeof concepto.precio === "number"
                    && Number.isFinite(concepto.precio)
                    && concepto.precio >= 0
                    && tiposConcepto.includes(concepto.aplicaA)
                    && typeof concepto.soloPlana === "boolean"
                ));
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

                await Promise.all([
                    this.cargarParametros(),
                    this.cargarConceptos()
                ]);
            } catch (error) {
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                } else {
                    this.errorGeneral = error.response?.data?.error
                        || error.message
                        || "No se pudieron cargar los datos del presupuesto. Inténtalo de nuevo.";
                }
            } finally {
                this.cargando = false;
                this.cargandoConceptos = false;
            }
        },
        async cargarParametros() {
            this.errorParametrosCarga = "";
            this.cargandoParametros = true;
            try {
                const parametros = await obtenerParametrosPresupuesto();
                if (!this.validarRespuestaParametros(parametros)) {
                    throw new Error("La respuesta de parámetros no tiene el formato esperado.");
                }
                this.parametros = { ...parametros };
                this.parametrosCargados = true;
            } catch (error) {
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                } else {
                    this.errorParametrosCarga = error.response?.data?.error
                        || error.message
                        || "No se pudieron cargar los parámetros.";
                }
            } finally {
                this.cargandoParametros = false;
            }
        },
        async cargarConceptos() {
            this.cargandoConceptos = true;
            this.errorConceptosCarga = "";
            try {
                const conceptos = await obtenerConceptosPresupuesto();
                if (!this.validarRespuestaConceptos(conceptos)) {
                    throw new Error("La respuesta de conceptos no tiene el formato esperado.");
                }
                this.conceptos = conceptos;
                this.conceptosCargados = true;
            } catch (error) {
                if (error.response?.status === 401) {
                    window.location.assign(enlacePagina("login"));
                } else {
                    this.errorConceptosCarga = error.response?.data?.error
                        || error.message
                        || "No se pudieron cargar los conceptos.";
                }
            } finally {
                this.cargandoConceptos = false;
            }
        },
        limpiarErrorParametro(campo) {
            delete this.erroresParametros[campo];
            this.errorGeneral = "";
        },
        limpiarErrorConcepto(campo) {
            delete this.erroresConcepto[campo];
            this.errorGeneral = "";
        },
        aplicarErrorApi(error, erroresFormulario, mensajeAlternativo) {
            const mensaje = error.response?.data?.error
                || error.message
                || mensajeAlternativo;
            const campo = error.response?.data?.campo;

            if (campo && Object.prototype.hasOwnProperty.call(erroresFormulario, campo)) {
                erroresFormulario[campo] = mensaje;
            } else {
                this.errorGeneral = mensaje;
            }
        },
        validarParametros() {
            this.erroresParametros = {};
            for (const campo of camposParametros) {
                const valor = Number(this.parametros[campo]);
                if (
                    this.parametros[campo] === ""
                    || !Number.isFinite(valor)
                    || valor <= 0
                ) {
                    this.erroresParametros[campo] = "Introduce un número mayor que 0.";
                }
            }
            return Object.keys(this.erroresParametros).length === 0;
        },
        async guardarParametros() {
            if (this.guardandoParametros || !this.validarParametros()) {
                return;
            }

            const datos = Object.fromEntries(
                camposParametros.map(campo => [campo, Number(this.parametros[campo])])
            );
            this.errorGeneral = "";
            this.mensajeExito = "";
            this.guardandoParametros = true;
            try {
                const respuesta = await guardarParametrosPresupuesto(datos);
                if (!this.validarRespuestaParametros(respuesta)) {
                    throw new Error("La respuesta al guardar los parámetros no tiene el formato esperado.");
                }
                this.parametros = { ...respuesta };
                this.mensajeExito = "Los parámetros se han guardado correctamente.";
            } catch (error) {
                this.aplicarErrorApi(error, this.erroresParametros, "No se pudieron guardar los parámetros.");
            } finally {
                this.guardandoParametros = false;
            }
        },
        iniciarAltaConcepto() {
            this.conceptoEditandoId = null;
            this.formularioConcepto = crearFormularioConceptoVacio();
            this.erroresConcepto = {};
            this.errorGeneral = "";
            this.mensajeExito = "";
            this.mostrarFormularioConcepto = true;
        },
        iniciarEdicionConcepto(concepto) {
            this.conceptoEditandoId = concepto.id;
            this.formularioConcepto = {
                nombre: concepto.nombre,
                precio: concepto.precio,
                aplicaA: concepto.aplicaA,
                soloPlana: concepto.soloPlana
            };
            this.erroresConcepto = {};
            this.errorGeneral = "";
            this.mensajeExito = "";
            this.mostrarFormularioConcepto = true;
        },
        cancelarEdicionConcepto() {
            this.mostrarFormularioConcepto = false;
            this.conceptoEditandoId = null;
            this.formularioConcepto = crearFormularioConceptoVacio();
            this.erroresConcepto = {};
        },
        validarConcepto() {
            this.erroresConcepto = {};
            const { nombre, precio, aplicaA, soloPlana } = this.formularioConcepto;

            if (!validarTexto(nombre, 100)) {
                this.erroresConcepto.nombre = "El nombre es obligatorio y no puede superar 100 caracteres.";
            }
            if (
                precio === ""
                || !Number.isFinite(Number(precio))
                || Number(precio) < 0
            ) {
                this.erroresConcepto.precio = "Introduce un precio de 0 o más.";
            }
            if (!tiposConcepto.includes(aplicaA)) {
                this.erroresConcepto.aplicaA = "Selecciona casa, edificio o ambos.";
            }
            if (typeof soloPlana !== "boolean") {
                this.erroresConcepto.soloPlana = "Indica si el concepto se aplica solo a cubierta plana.";
            }
            return Object.keys(this.erroresConcepto).length === 0;
        },
        validarConceptoRespuesta(concepto, idEsperado) {
            return concepto
                && Number.isInteger(concepto.id)
                && concepto.id > 0
                && (idEsperado === null || concepto.id === idEsperado)
                && typeof concepto.nombre === "string"
                && typeof concepto.precio === "number"
                && Number.isFinite(concepto.precio)
                && tiposConcepto.includes(concepto.aplicaA)
                && typeof concepto.soloPlana === "boolean";
        },
        async guardarConcepto() {
            if (this.guardandoConcepto || !this.validarConcepto()) {
                return;
            }

            const datos = {
                nombre: this.formularioConcepto.nombre.trim(),
                precio: Number(this.formularioConcepto.precio),
                aplicaA: this.formularioConcepto.aplicaA,
                soloPlana: this.formularioConcepto.soloPlana
            };
            const id = this.conceptoEditandoId;
            this.errorGeneral = "";
            this.mensajeExito = "";
            this.guardandoConcepto = true;
            try {
                const concepto = id === null
                    ? await crearConceptoPresupuesto(datos)
                    : await actualizarConceptoPresupuesto(id, datos);
                if (!this.validarConceptoRespuesta(concepto, id)) {
                    throw new Error("La respuesta al guardar el concepto no tiene el formato esperado.");
                }

                if (id === null) {
                    this.conceptos.push(concepto);
                    this.mensajeExito = "El concepto se ha añadido correctamente.";
                } else {
                    const indice = this.conceptos.findIndex(item => item.id === id);
                    if (indice === -1) {
                        throw new Error("No se encontró el concepto actualizado en la lista.");
                    }
                    this.conceptos.splice(indice, 1, concepto);
                    this.mensajeExito = "El concepto se ha actualizado correctamente.";
                }
                this.cancelarEdicionConcepto();
            } catch (error) {
                this.aplicarErrorApi(error, this.erroresConcepto, "No se pudo guardar el concepto.");
            } finally {
                this.guardandoConcepto = false;
            }
        },
        async eliminarConcepto(concepto) {
            if (
                this.conceptoEnCurso
                || !window.confirm(`¿Seguro que quieres eliminar el concepto «${concepto.nombre}»?`)
            ) {
                return;
            }

            this.errorGeneral = "";
            this.mensajeExito = "";
            this.eliminandoConceptoId = concepto.id;
            try {
                const respuesta = await eliminarConceptoPresupuesto(concepto.id);
                if (!respuesta || respuesta.ok !== true) {
                    throw new Error("La respuesta al eliminar el concepto no tiene el formato esperado.");
                }
                this.conceptos = this.conceptos.filter(item => item.id !== concepto.id);
                if (this.conceptoEditandoId === concepto.id) {
                    this.cancelarEdicionConcepto();
                }
                this.mensajeExito = "El concepto se ha eliminado correctamente.";
            } catch (error) {
                this.errorGeneral = error.response?.data?.error
                    || error.message
                    || "No se pudo eliminar el concepto.";
            } finally {
                this.eliminandoConceptoId = null;
            }
        }
    }
});

app.component("header-component", HeaderComponent);
app.component("footer-component", FooterComponent);
app.component("chat-component", ChatComponent);
app.mount("#app");
