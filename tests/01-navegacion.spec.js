
const { test, expect } = require('@playwright/test');

test.describe('LuxPopuli - Navegación pública', () => {

  test('NAV-001 - Redirección desde la raíz', async ({ page }) => {
    const response = await page.goto('/');

    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/pages\/index\.html$/);
  });

  const paginas = [
    { id: 'NAV-002', nombre: 'Inicio', ruta: '/pages/index.html' },
    { id: 'NAV-003', nombre: 'Calculadora', ruta: '/pages/calculadora.html' },
    { id: 'NAV-004', nombre: 'Login', ruta: '/pages/login.html' },
    { id: 'NAV-005', nombre: 'Registro', ruta: '/pages/registro.html' },
    { id: 'NAV-006', nombre: 'Privacidad', ruta: '/pages/privacidad.html' }
  ];

  for (const pagina of paginas) {

    test(`${pagina.id} - Carga de ${pagina.nombre}`, async ({ page }) => {
      const errores = [];

      page.on('pageerror', error => {
        errores.push(error.message);
      });

      const response = await page.goto(pagina.ruta);

      expect(response.status()).toBe(200);

      await expect(page.locator('#app')).toBeVisible();
      await page.waitForLoadState('load');

      expect(errores, 'Errores JavaScript durante la carga').toEqual([]);
    });

  }

});
