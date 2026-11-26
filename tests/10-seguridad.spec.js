
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

test.describe('LuxPopuli - Seguridad y permisos', () => {

  async function registrar(request) {
    const datos = {
      nombre: 'Usuario',
      apellidos: 'Prueba Seguridad',
      email: `${randomUUID()}@example.invalid`,
      telefono: '600000000',
      password: 'Prueba2026!',
      password2: 'Prueba2026!',
      aceptaPrivacidad: true
    };

    const respuesta = await request.post(
      '/api/auth/registro',
      { data: datos }
    );

    expect(respuesta.status()).toBe(201);

    return datos;
  }

  const rutas = [
    ['GET', '/api/parametros'],
    ['PUT', '/api/parametros'],
    ['GET', '/api/conceptos'],
    ['POST', '/api/conceptos'],
    ['PUT', '/api/conceptos/0'],
    ['DELETE', '/api/conceptos/0']
  ];

  for (const [indice, [metodo, ruta]] of rutas.entries()) {

    const id = String(indice + 1).padStart(3, '0');

    test(`SEG-${id} - ${metodo} ${ruta} sin sesión`, async ({ request }) => {

      const respuesta = await request.fetch(ruta, {
        method: metodo
      });

      expect(respuesta.status()).toBe(401);
    });
  }

  for (const [indice, [metodo, ruta]] of rutas.entries()) {

    const id = String(indice + 7).padStart(3, '0');

    test(`SEG-${id} - ${metodo} ${ruta} como cliente`, async ({ request }) => {

      await registrar(request);

      const respuesta = await request.fetch(ruta, {
        method: metodo
      });

      expect(respuesta.status()).toBe(403);
    });
  }

  test('SEG-013 - Regeneración de sesión al iniciar sesión', async ({ request }) => {

    const usuario = await registrar(request);

    const estadoAnterior = await request.storageState();

    const cookieAnterior = estadoAnterior.cookies.find(
      cookie => cookie.name === 'connect.sid'
    );

    expect(cookieAnterior).toBeDefined();

    const respuesta = await request.post('/api/auth/login', {
      data: {
        email: usuario.email,
        password: usuario.password
      }
    });

    expect(respuesta.status()).toBe(200);

    const estadoPosterior = await request.storageState();

    const cookiePosterior = estadoPosterior.cookies.find(
      cookie => cookie.name === 'connect.sid'
    );

    expect(cookiePosterior).toBeDefined();

    expect(
      cookiePosterior.value !== cookieAnterior.value,
      'El identificador de sesión debe regenerarse al iniciar sesión'
    ).toBe(true);
  });

  test('SEG-014 - Cookie de sesión HttpOnly', async ({ request }) => {

    await registrar(request);

    const estado = await request.storageState();

    const cookie = estado.cookies.find(
      elemento => elemento.name === 'connect.sid'
    );

    expect(cookie).toBeDefined();
    expect(cookie.httpOnly).toBe(true);
  });

  test('SEG-015 - Cookie protegida frente a CSRF mediante SameSite', async ({ request }) => {

    await registrar(request);

    const estado = await request.storageState();

    const cookie = estado.cookies.find(
      elemento => elemento.name === 'connect.sid'
    );

    expect(cookie).toBeDefined();

    expect(
      ['Lax', 'Strict'].includes(cookie.sameSite)
    ).toBe(true);
  });

});

