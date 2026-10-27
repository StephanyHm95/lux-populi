// Componente reutilizable del asistente de ayuda.
const ChatComponent = {
  // Cada instancia mantiene el chat en memoria; al recargar la página se reinicia.
  data() {
    return {
      abierto: false,
      mensaje: "",
      mensajes: [],
      enviando: false,
      error: ""
    };
  },
  methods: {
    // Valida el mensaje y envía a la API el texto junto con el historial reciente.
    async enviarMensaje() {
      const texto = this.mensaje.trim();
      // Evita enviar mensajes vacíos o duplicar peticiones mientras hay una pendiente.
      if (!texto || this.enviando) {
        return;
      }

      // La API acepta como máximo los diez mensajes anteriores como contexto.
      const historial = this.mensajes.slice(-10);
      // Añade la pregunta inmediatamente y limpia el campo antes de esperar la respuesta.
      this.mensajes.push({ rol: "usuario", texto });
      this.mensaje = "";
      this.error = "";
      this.enviando = true;

      try {
        // Usa la instancia Axios compartida, configurada con la ruta base /api.
        const respuesta = await api.post("/chat", { mensaje: texto, historial });
        if (typeof respuesta.data?.respuesta !== "string") {
          throw new Error("El asistente devolvió una respuesta no válida.");
        }

        this.mensajes.push({
          rol: "asistente",
          texto: respuesta.data.respuesta
        });
      } catch (error) {
        // Prioriza el mensaje del servidor y muestra un mensaje local si no existe.
        this.error = error.response?.data?.error
          || error.message
          || "No se pudo enviar el mensaje. Inténtalo de nuevo.";
      } finally {
        // Restablece el estado tanto si la petición tuvo éxito como si falló.
        this.enviando = false;
      }
    }
  },
  // La plantilla enlaza los datos y eventos de Vue con la interfaz del chat.
  template: `
    <section class="lp-chat" aria-label="Chat de ayuda">
      <!-- Se oculta visualmente sin destruir el contenido ni el historial. -->
      <div
        v-show="abierto"
        id="lp-chat-window"
        class="lp-chat__window"
        role="region"
        aria-label="Asistente de ayuda"
      >
        <div class="lp-chat__header">
          <h2 class="lp-chat__title">Asistente de ayuda</h2>
          <button
            class="lp-chat__close"
            type="button"
            aria-label="Cerrar chat"
            @click="abierto = false"
          >×</button>
        </div>

        <p class="lp-chat__notice">
          Asistente automático. Respuestas orientativas. No escribas datos personales.
        </p>

        <div class="lp-chat__messages" aria-live="polite" aria-relevant="additions">
          <!-- Saludo inicial visible antes de que haya mensajes. -->
          <p v-if="mensajes.length === 0" class="lp-chat__welcome">
            Hola. ¿En qué podemos ayudarte
          </p>
          <p
            v-for="(item, indice) in mensajes"
            :key="indice"
            class="lp-chat__message"
            :class="'lp-chat__message--' + item.rol"
          >
            <strong>{{ item.rol === "usuario" ? "Tú" : "Asistente" }}:</strong>
            {{ item.texto }}
          </p>
          <p v-if="enviando" class="lp-chat__typing" aria-live="polite">
            Escribiendo…
          </p>
        </div>

        <p v-if="error" class="lp-chat__error" role="alert" aria-live="polite">
          {{ error }}
        </p>

        <!-- Envía con Enter desde el formulario sin recargar la página. -->
        <form class="lp-chat__form" @submit.prevent="enviarMensaje">
          <label class="lp-chat__label" for="lp-chat-input">Mensaje</label>
          <textarea
            id="lp-chat-input"
            v-model="mensaje"
            class="lp-chat__input"
            name="mensaje"
            rows="2"
            maxlength="500"
            placeholder="Escribe tu mensaje"
            required
            :disabled="enviando"
          ></textarea>
          <button
            class="lp-chat__send"
            type="submit"
            :disabled="enviando || !mensaje.trim()"
          >
            {{ enviando ? "Enviando…" : "Enviar" }}
          </button>
        </form>
      </div>

      <button
        class="lp-chat__toggle"
        type="button"
        :aria-expanded="abierto"
        aria-controls="lp-chat-window"
        @click="abierto = !abierto"
      >
        {{ abierto ? "Cerrar chat" : "¿Dudas?" }}
      </button>
    </section>
  `
};
