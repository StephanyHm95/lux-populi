console.log("Privacidad.js cargado correctamente.");
// Instanciar Vue
const app = Vue.createApp({
    data() {
        return {};
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