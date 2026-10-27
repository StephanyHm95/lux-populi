// Componente para el encabezado de la aplicación
const HeaderComponent = {
  // Estado reactivo que controla la sesión y la interacción con el menú.
  data() {
    return {
      usuario: null,
      cargando: true,
      errorSesion: "",
      menuAbierto: false,
      saliendo: false
    };
  },
  // Valores derivados del usuario autenticado, simplifica la plantilla.
  computed: {
    esCliente() {
      return this.usuario?.rol === "cliente";
    },
    esAdmin() {
      return this.usuario?.rol === "admin";
    },
    saludo() {
      return this.usuario ? `Hola, ${this.usuario.nombre}` : "";
    }
  },
  // Comprueba la sesión al crear la cabecera para mostrar la navegación adecuada.
  created() {
    this.cargarUsuario();
  },
  methods: {
    // Hace disponible la función compartida de rutas en la plantilla.
    enlacePagina,

    // Consulta quién inició sesión y valida la estructura de la respuesta.
    async cargarUsuario() {
      try {
        const usuario = await obtenerUsuario();
        // Validar que la respuesta tenga el formato esperado
        if (
          !usuario // Validar que el objeto usuario exista
          || !Number.isInteger(usuario.id) // Validar que el ID sea un número entero
          || typeof usuario.nombre !== "string" // Validar que el nombre sea una cadena de texto
          || !["cliente", "admin"].includes(usuario.rol) // Validar que el rol sea uno de los valores permitidos
        ) {
          throw new Error("La respuesta de sesión no tiene el formato esperado.");
        }

        this.usuario = usuario;

      } catch (error) {
        // Un 401 significa que no hay sesión: se mostrará el menú de visitante.
        if (error.response?.status !== 401) {
          this.errorSesion = error.response?.data?.error
            || error.message
            || "No se pudo comprobar la sesión.";
        }
      } finally {
        // Permite mostrar la navegación cuando termina la comprobación.
        this.cargando = false;
      }
    },
    // Cierra la sesión y actualiza la cabecera sin recargar la página.
    async cerrarSesion() {
      this.saliendo = true;
      this.errorSesion = "";

      try {
        const respuesta = await cerrarSesionApi();
        if (!respuesta.ok) {
          throw new Error("No se pudo cerrar la sesión.");
        }

        this.usuario = null;
        this.menuAbierto = false;
      } catch (error) {
        this.errorSesion = error.response?.data?.error
          || "No se pudo cerrar la sesión. Inténtalo de nuevo.";
      } finally {
        this.saliendo = false;
      }
    }
  },
  // Renderiza navegación distinta según el estado de sesión y el rol.
  template: `
    <header class="lp-header">
      <div class="lp-header__inner">
        <a class="lp-header__brand" :href="enlacePagina('inicio')" aria-label="Lux Populi, inicio">
          <span class="lp-header__brand-mark" aria-hidden="true">LP</span>
          <span class="lp-header__brand-name">Lux <strong>Populi</strong></span>
        </a>

        <button
          class="lp-header__toggle"
          type="button"
          :aria-expanded="menuAbierto"
          aria-controls="lp-header-navigation"
          :aria-label="menuAbierto ? 'Cerrar menú' : 'Abrir menú'"
          @click="menuAbierto = !menuAbierto"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav
          id="lp-header-navigation"
          class="lp-header__navigation"
          :class="{ 'lp-header__navigation--open': menuAbierto }"
          aria-label="Navegación principal"
        >
          <!-- No muestra enlaces hasta conocer el resultado de la sesión. -->
          <template v-if="!cargando && !errorSesion">
            <!-- Visitantes pueden acceder a las páginas públicas y al login. -->
            <template v-if="!usuario">
              <a class="lp-header__link" :href="enlacePagina('inicio')" @click="menuAbierto = false">
                Inicio
              </a>
              <a class="lp-header__link" :href="enlacePagina('calculadora')" @click="menuAbierto = false">
                Calculadora
              </a>
              <a class="lp-header__link" :href="enlacePagina('login')" @click="menuAbierto = false">
                Iniciar sesión
              </a>
            </template>

            <!-- Clientes y administradores ven su saludo y la opción de salir. -->
            <template v-else-if="esCliente || esAdmin">
              <span class="lp-header__account">{{ saludo }}</span>
              <button
                class="lp-header__button lp-header__button--secondary"
                type="button"
                :disabled="saliendo"
                @click="cerrarSesion"
              >
                {{ saliendo ? "Saliendo…" : "Salir" }}
              </button>
            </template>
          </template>

          <p v-if="errorSesion" class="lp-header__error" role="alert" aria-live="polite">
            {{ errorSesion }}
          </p>
        </nav>
      </div>
    </header>
  `
};
