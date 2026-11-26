
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

test.describe('LuxPopuli - Autenticación real', () => {

  function generarUsuario() {
    return {
      nombre: 'Usuario',
      apellidos: 'Prueba E2E',
      email: `${randomUUID()}@example.invalid`,
      telefono: '600000000',
      password: 'Prueba2026!',
      password2: 'Prueba2026!',
      aceptaPrivacidad: true
    };
  }

  async function registrar(request, cambios = {}) {
    const usuario = {
      ...generarUsuario(),
      ...cambios
    };

    const respuesta = await request.post(
      '/api/auth/registro',
      { data: usuario }
    );

    expect(respuesta.status()).toBe(201);

    return usuario;
  }

  test('AUTH-001 - Registro desde el navegador', async ({ page }) => {
    const usuario = generarUsuario();

    await page.goto('/pages/registro.html');

    for (const campo of [
      'nombre', 'apellidos', 'email',
      'telefono', 'password', 'password2'
    ]) {
      await page.locator(`#${campo}`).fill(usuario[campo]);
    }

    await page.locator('#aceptaPrivacidad').check();

    const pendiente = page.waitForResponse(
      r => r.url().endsWith('/api/auth/registro') &&
           r.request().method() === 'POST'
    );

    await page.getByRole('button', {
      name: 'Registrarse',
      exact: true
    }).click();

    const respuesta = await pendiente;

    expect(respuesta.status()).toBe(201);

    await expect(page).toHaveURL(
      /mi-solicitud\.html\?registro=creada/
    );
  });

  test('AUTH-002 - Sesión automática tras registro', async ({ request }) => {
    const usuario = await registrar(request);

    const respuesta = await request.get('/api/auth/yo');

    expect(respuesta.status()).toBe(200);

    const cuerpo = await respuesta.json();

    expect(cuerpo.nombre).toBe(usuario.nombre);
    expect(cuerpo.rol).toBe('cliente');
  });

  test('AUTH-003 - Email duplicado', async ({ request }) => {
    const usuario = await registrar(request);

    const respuesta = await request.post(
      '/api/auth/registro',
      { data: usuario }
    );

    expect(respuesta.status()).toBe(409);
  });

  test('AUTH-004 - Cierre de sesión', async ({ request }) => {
    await registrar(request);

    const respuesta = await request.post('/api/auth/logout');

    expect(respuesta.status()).toBe(200);

    const sesion = await request.get('/api/auth/yo');

    expect(sesion.status()).toBe(401);
  });

  test('AUTH-005 - Login correcto desde navegador', async ({ page, request }) => {
    const usuario = await registrar(request);

    await page.goto('/pages/login.html');

    await page.locator('#email').fill(usuario.email);
    await page.locator('#password').fill(usuario.password);

    const pendiente = page.waitForResponse(
      r => r.url().endsWith('/api/auth/login') &&
           r.request().method() === 'POST'
    );

    await page.getByRole('button', {
      name: 'Iniciar sesión',
      exact: true
    }).click();

    const respuesta = await pendiente;

    expect(respuesta.status()).toBe(200);

    await expect(page).toHaveURL(/mi-solicitud\.html$/);
  });

  test('AUTH-006 - Contraseña incorrecta', async ({ request }) => {
    const usuario = await registrar(request);

    await request.post('/api/auth/logout');

    const respuesta = await request.post('/api/auth/login', {
      data: {
        email: usuario.email,
        password: 'Incorrecta123'
      }
    });

    expect(respuesta.status()).toBe(401);

    const sesion = await request.get('/api/auth/yo');

    expect(sesion.status()).toBe(401);
  });

  test('AUTH-007 - Persistencia al recargar', async ({ page }) => {
    await registrar(page.request);

    await page.goto('/pages/mi-solicitud.html');

    await page.reload();

    const respuesta = await page.request.get('/api/auth/yo');

    expect(respuesta.status()).toBe(200);

    await expect(page).toHaveURL(/mi-solicitud\.html$/);
  });

  test('AUTH-008 - Intento de registro como administrador', async ({ request }) => {
    await registrar(request, {
      rol: 'admin'
    });

    const respuesta = await request.get('/api/auth/yo');

    expect(respuesta.status()).toBe(200);

    const cuerpo = await respuesta.json();

    expect(cuerpo.rol).toBe('cliente');
  });

  test('AUTH-009 - Invalidación de cookie tras logout', async ({ page, playwright }) => {
    await registrar(page.request);

    const cookies = await page.context().cookies();

    const cookie = cookies.find(
      c => c.name === 'connect.sid'
    );

    expect(cookie).toBeDefined();

    const logout = await page.request.post('/api/auth/logout');

    expect(logout.status()).toBe(200);

    const contexto = await playwright.request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        Cookie: `${cookie.name}=${cookie.value}`
      }
    });

    try {
      const respuesta = await contexto.get('/api/auth/yo');

      expect(respuesta.status()).toBe(401);
    } finally {
      await contexto.dispose();
    }
  });

});
