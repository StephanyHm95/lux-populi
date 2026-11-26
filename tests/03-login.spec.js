
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

test.describe('LuxPopuli - Inicio de sesión', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/login.html');
    await expect(page.locator('#email')).toBeVisible();
  });

  async function enviar(page) {
    await page.getByRole('button', {
      name: 'Iniciar sesión',
      exact: true
    }).click();
  }

  test('LOG-001 - Formulario vacío', async ({ page }) => {
    await enviar(page);

    await expect(page.locator('#error-email')).toBeVisible();
    await expect(page.locator('#error-password')).toBeVisible();
  });

  test('LOG-002 - Email incorrecto', async ({ page }) => {
    await page.locator('#email').fill('correo-invalido');
    await page.locator('#password').fill('Prueba123');

    await enviar(page);

    await expect(page.locator('#error-email')).toBeVisible();
  });

  test('LOG-003 - Contraseña vacía', async ({ page }) => {
    await page.locator('#email').fill('pruebas@example.invalid');

    await enviar(page);

    await expect(page.locator('#error-password')).toBeVisible();
  });

  test('LOG-004 - Usuario inexistente', async ({ page }) => {
    await page.locator('#email')
      .fill(`${randomUUID()}@example.invalid`);

    await page.locator('#password').fill('Prueba123');

    const respuestaPendiente = page.waitForResponse(
      respuesta =>
        respuesta.url().endsWith('/api/auth/login') &&
        respuesta.request().method() === 'POST'
    );

    await enviar(page);

    const respuesta = await respuestaPendiente;

    expect(respuesta.status()).toBe(401);

    await expect(
      page.getByText('Email o contraseña incorrectos', {
        exact: true
      })
    ).toBeVisible();

    await expect(page).toHaveURL(/login\.html$/);
  });

  test('LOG-005 - Corrección del email', async ({ page }) => {
    await enviar(page);

    await expect(page.locator('#error-email')).toBeVisible();

    await page.locator('#email').fill('pruebas@example.invalid');

    await expect(page.locator('#error-email')).toHaveCount(0);

    await expect(page.locator('#email'))
      .toHaveAttribute('aria-invalid', 'false');
  });

  test('LOG-006 - Corrección de contraseña', async ({ page }) => {
    await enviar(page);

    await expect(page.locator('#error-password')).toBeVisible();

    await page.locator('#password').fill('Prueba123');

    await expect(page.locator('#error-password')).toHaveCount(0);

    await expect(page.locator('#password'))
      .toHaveAttribute('aria-invalid', 'false');
  });

  test('LOG-007 - Acceso a API sin sesión', async ({ request }) => {
    const respuesta = await request.get('/api/auth/yo');

    expect(respuesta.status()).toBe(401);
  });

  test('LOG-008 - Enlace de creación de cuenta', async ({ page }) => {
    await page.getByRole('link', {
      name: 'Crea una cuenta',
      exact: true
    }).click();

    await expect(page).toHaveURL(/registro\.html$/);
    await expect(page.locator('#nombre')).toBeVisible();
  });

  test('LOG-009 - Tipos de datos incorrectos', async ({ request }) => {
    const respuesta = await request.post('/api/auth/login', {
      data: {
        email: { valor: 'pruebas@example.invalid' },
        password: 12345678
      }
    });

    expect(
      respuesta.status(),
      'El servidor debe rechazar datos de tipos incorrectos'
    ).toBe(400);
  });

});

