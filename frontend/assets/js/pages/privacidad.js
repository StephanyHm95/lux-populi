console.log("Privacidad.js cargado correctamente.");
// Instanciar Vue
const app = Vue.createApp({
    data() {
        return {};
    },
    methods: {
        volverAtras() {
            const referrer = document.referrer;
            if (referrer && new URL(referrer).origin === window.location.origin) {
                window.history.back();
                return;
            }

            window.location.assign(enlacePagina("inicio"));
        }
    }
});

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

app.mount("#app");