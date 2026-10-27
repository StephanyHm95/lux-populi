// Componente para el pie de página
const FooterComponent = {
  // Expone funciones para que puedan utilizarse desde la plantilla de Vue.
  methods: {
    // Se registra la función compartida que calcula la ruta correcta
    // al enlace de privacidad desde páginas públicas o del panel.
    enlacePagina
  },
  // Plantilla HTML que Vue renderiza para mostrar el aviso y el enlace.
  template: `
    <footer class="lp-footer">
      <div class="lp-footer__inner">
        <p class="lp-footer__notice">Estimación orientativa, no vinculante.</p>
        <!-- El enlace se calcula según la ubicación de la página actual. -->
        <a class="lp-footer__link" :href="enlacePagina('privacidad')">
          Política de privacidad
        </a>
      </div>
    </footer>
  `
};
