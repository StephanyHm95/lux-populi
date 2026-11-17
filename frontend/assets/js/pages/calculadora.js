console.log("Calculadora.js cargado correctamente.");
// Etiquetas del eje horizontal del gráfico, en orden de enero a diciembre.
const mesesProduccion = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Crea la aplicación Vue y define el estado y las acciones de la calculadora.
const app = Vue.createApp({
    data() {
        return {
            // Las variables de Vue se mantienen actualizadas automáticamente con los campos HTML mediante v-model.
            formulario: {
                codigoPostal: "",
                tipoInstalacion: "",
                tipoTejado: "",
                superficie: "",
                consumoMensual: 290,

                numViviendas: "",
                consumoVivienda: 290,
                incluirZonasComunes: false,
                consumoZonasComunes: ""
            },
            resultado: null,
            graficoProduccion: null,
            errores: {},
            cargando: false,
            errorCalculo: ""
        };
    },
    computed: {
        // Indican qué campos específicos mostrar según el tipo de instalación seleccionado.
        esCasa() {
            return this.formulario.tipoInstalacion === "casa";
        },
        esEdificio() {
            return this.formulario.tipoInstalacion === "edificio";
        },
        // Construye el enlace para pasar la simulación y cp a la página de registro.
        enlaceRegistro() {
            if (!this.resultado) {
                return "#";
            }

            const parametros = new URLSearchParams({
                simulacion: String(this.resultado.id),
                cp: this.formulario.codigoPostal
            });

            return `${enlacePagina("registro")}?${parametros}`;
        },
        // Descripción del gráfico para las tecnologías de asistencia que se actualiza con los datos de la simulación.
        etiquetaGraficoProduccion() {
            if (!this.resultado?.produccionMensual) {
                return "Gráfico de barras con la producción solar estimada de enero a diciembre";
            }

            const datosMensuales = this.resultado.produccionMensual
                .map((valor, indice) => `${mesesProduccion[indice]}: ${formatearNumero(valor)} kWh`)
                .join(", ");

            return `Producción solar mensual estimada en ${this.resultado.provincia.nombre}: ${datosMensuales}.`;
        }
    },
    watch: {
        resultado() {
            // Actualiza el gráfico cada vez que cambia el resultado de la simulación.
            // Espera a que Vue renderice el canvas antes de buscarlo en el DOM.
            this.$nextTick(() => this.dibujarGraficoProduccion());
        }
    },
    methods: {
        formatearNumero,
        formatearEuros,
        // Elimina el error de un campo cuando el usuario vuelve a editarlo.
        limpiarError(campo) {
            delete this.errores[campo];
        },
        // Dibuja el gráfico de barras en el elemento <canvas>.
        dibujarGraficoProduccion() {
            if (this.graficoProduccion) {
                this.graficoProduccion.destroy();
                this.graficoProduccion = null;
            }

            const canvas = document.getElementById("grafico-produccion");
            if (!canvas || !this.resultado) {
                return;
            }

            // Chart.js gestiona su propia instancia, markRaw evita que Vue la convierta en reactiva.
            this.graficoProduccion = Vue.markRaw(new Chart(canvas, {
                type: "bar",
                data: {
                    labels: mesesProduccion,
                    datasets: [{
                        label: "Producción solar",
                        data: this.resultado.produccionMensual,
                        backgroundColor: "#23704f",
                        borderColor: "#185b3e",
                        borderWidth: 1,
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2,
                    plugins: {
                        title: {
                            display: true,
                            text: "Producción solar estimada por mes"
                        },
                        tooltip: {
                            callbacks: {
                                label: contexto => `${formatearNumero(contexto.parsed.y)} kWh`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: "Mes"
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "Producción (kWh)"
                            },
                            ticks: {
                                callback: valor => formatearNumero(valor)
                            }
                        }
                    }
                }
            }));
        },
        async calcular() {
            // Descarta los resultados y errores anteriores antes de validar una nueva consulta.
            this.resultado = null;
            this.errorCalculo = "";
            this.errores = {};

            // Comprueba en el navegador los datos requeridos para evitar una petición inválida.
            if (!validarCodigoPostal(this.formulario.codigoPostal)) {
                this.errores.codigoPostal = "Introduce un código postal válido de España.";
                return;
            }

            if (!validarNumeroPositivo(this.formulario.superficie)) {
                this.errores.superficie = "Introduce una superficie mayor que 0.";
            }

            if (this.esCasa && !validarNumeroPositivo(this.formulario.consumoMensual)) {
                this.errores.consumoMensual = "Introduce un consumo mayor que 0.";
            }

            if (this.esEdificio) {
                if (!validarEnteroMinimo(this.formulario.numViviendas, 2)) {
                    this.errores.numViviendas = "Introduce al menos 2 viviendas.";
                }
                if (!validarNumeroPositivo(this.formulario.consumoVivienda)) {
                    this.errores.consumoVivienda = "Introduce un consumo mayor que 0.";
                }
            }

            if (Object.keys(this.errores).length > 0) {
                return;
            }

            // Muestra el estado de carga mientras el servidor calcula la simulación.
            this.cargando = true;

            try {
                // Espera la respuesta del servicio, que devuelve los resultados de la simulación.
                this.resultado = await crearSimulacion(this.formulario);
                try {
                    guardarSimulacionParaRegistro(this.resultado, this.formulario);
                } catch (error) {
                    this.errorCalculo = `La simulación se calculó, pero no se pudo guardar para mostrarla en tu área privada. ${error.message}`;
                }
            } catch (error) {
                // Prioriza el mensaje del backend y usa alternativas si no está disponible.
                this.errorCalculo = error.response?.data?.error
                    || error.message
                    || "No se pudo calcular la estimación. Inténtalo de nuevo.";
            } finally {
                // Restablece el estado aunque la petición termine con un error.
                this.cargando = false;
            }
        }
    }
});

// Registra los componentes comunes utilizados también en otras páginas.
app.component(
    "header-component",
    HeaderComponent
);

app.component(
    "footer-component",
    FooterComponent
);

app.component(
    "chat-component",
    ChatComponent
);

// Monta la calculadora en el elemento raíz definido en el HTML.
app.mount("#app");