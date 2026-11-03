console.log("Index.js cargado correctamente.");
// Crea la aplicación Vue de la página de inicio.
const app = Vue.createApp({
    data() {
        // La página no necesita estado reactivo propio por ahora.
        return {};
    },
    methods: {
        // Permite reutilizar la función de navegación definida en routes.js.
        enlacePagina
    }
});

// Registra los componentes compartidos que usa la página.
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

// Conecta la aplicación Vue con el elemento raíz del HTML.
app.mount("#app");