
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

test.describe('LuxPopuli - Solicitudes y permisos', () => {

  async function registrar(request) {
    const respuesta = await request.post('/api/auth/registro', {
      data: {
        nombre: 'Usuario',
        apellidos: 'Prueba E2E',
        email: `${randomUUID()}@example.invalid`,
        telefono: '600000000',
        password: 'Prueba2026!',
        password2: 'Prueba2026!',
        aceptaPrivacidad: true
      }
    });

    expect(respuesta.status()).toBe(201);
  }

  const solicitud = {
    simulacionId: 1,
    franjaId: 1,
    direccion: 'Calle de prueba 1',
    municipio: 'Sabadell',
    codigoPostal: '08201',
    aceptaEnvioDatos: true
  };

  const casos = [
    ['SOL-001', 'Simulación igual a cero',
      'simulacionId', 0],

    ['SOL-002', 'Simulación negativa',
      'simulacionId', -1],

    ['SOL-003', 'Simulación decimal',
      'simulacionId', 1.5],

    ['SOL-004', 'Simulación como texto',
      'simulacionId', '1'],

    ['SOL-005', 'Simulación fuera de rango',
      'simulacionId', 2147483648],

    ['SOL-006', 'Franja igual a cero',
      'franjaId', 0],

    ['SOL-007', 'Franja negativa',
      'franjaId', -1],

    ['SOL-008', 'Franja decimal',
      'franjaId', 1.5],

    ['SOL-009', 'Franja como texto',
      'franjaId', '1'],

    ['SOL-010', 'Dirección vacía',
      'direccion', ''],

    ['SOL-011', 'Dirección con espacios',
      'direccion', '   '],

    ['SOL-012', 'Dirección demasiado larga',
      'direccion', 'a'.repeat(201)],

    ['SOL-013', 'Dirección numérica',
      'direccion', 12345],

    ['SOL-014', 'Municipio vacío',
      'municipio', ''],

    ['SOL-015', 'Municipio demasiado largo',
      'municipio', 'a'.repeat(101)],

    ['SOL-016', 'Municipio numérico',
      'municipio', 12345],

    ['SOL-017', 'Código postal incorrecto',
      'codigoPostal', '53001'],

    ['SOL-018', 'Código postal numérico',
      'codigoPostal', 8201],

    ['SOL-019', 'Código postal con letras',
      'codigoPostal', '08abc'],

    ['SOL-020', 'Consentimiento rechazado',
      'aceptaEnvioDatos', false],

    ['SOL-021', 'Consentimiento como texto',
      'aceptaEnvioDatos', 'true'],

    ['SOL-022', 'Consentimiento nulo',
      'aceptaEnvioDatos', null]
  ];

  for (const [id, descripcion, campo, valor] of casos) {

    test(`${id} - ${descripcion}`, async ({ request }) => {

      await registrar(request);

      const respuesta = await request.post('/api/solicitudes', {
        data: {
          ...solicitud,
          [campo]: valor
        }
      });

      expect(respuesta.status()).toBe(400);

      const cuerpo = await respuesta.json();

      expect(cuerpo.campo).toBe(campo);
      expect(typeof cuerpo.error).toBe('string');
    });
  }

  test('SOL-023 - Crear solicitud sin sesión', async ({ request }) => {
    const respuesta = await request.post('/api/solicitudes', {
      data: solicitud
    });

    expect(respuesta.status()).toBe(401);
  });

  test('SOL-024 - Consultar solicitud sin sesión', async ({ request }) => {
    const respuesta = await request.get('/api/solicitudes/mia');

    expect(respuesta.status()).toBe(401);
  });

  test('SOL-025 - Cambiar visita sin sesión', async ({ request }) => {
    const respuesta = await request.put('/api/solicitudes/0/franja', {
      data: { franjaId: 0 }
    });

    expect(respuesta.status()).toBe(401);
  });

  test('SOL-026 - Cancelar visita sin sesión', async ({ request }) => {
    const respuesta = await request.put('/api/solicitudes/0/cancelar');

    expect(respuesta.status()).toBe(401);
  });

  test('SOL-027 - Responder presupuesto sin sesión', async ({ request }) => {
    const respuesta = await request.put('/api/solicitudes/0/respuesta', {
      data: { respuesta: 'aceptado' }
    });

    expect(respuesta.status()).toBe(401);
  });

  test('SOL-028 - Consultar calendario sin sesión', async ({ request }) => {
    const respuesta = await request.get('/api/franjas');

    expect(respuesta.status()).toBe(401);
  });

  test('SOL-029 - Consultar calendario como cliente', async ({ request }) => {
    await registrar(request);

    const respuesta = await request.get('/api/franjas');

    expect(respuesta.status()).toBe(403);
  });

  test('SOL-030 - Crear franja como cliente', async ({ request }) => {
    await registrar(request);

    const respuesta = await request.post('/api/franjas', {
      data: {}
    });

    expect(respuesta.status()).toBe(403);
  });

  test('SOL-031 - Eliminar franja como cliente', async ({ request }) => {
    await registrar(request);

    const respuesta = await request.delete('/api/franjas/0');

    expect(respuesta.status()).toBe(403);
  });

  test('SOL-032 - Consultar franjas públicas', async ({ request }) => {
    const respuesta = await request.get(
      '/api/franjas/libres?provincia=08'
    );

    expect(respuesta.status()).toBe(200);
    expect(Array.isArray(await respuesta.json())).toBe(true);
  });

  test('SOL-033 - Provincia omitida', async ({ request }) => {
    const respuesta = await request.get('/api/franjas/libres');

    expect(respuesta.status()).toBe(400);
  });

  const provinciasInvalidas = [
    ['SOL-034', 'Provincia inexistente', '53'],
    ['SOL-035', 'Provincia alfabética', 'abc'],
    ['SOL-036', 'Provincia igual a cero', '00'],
    ['SOL-037', 'Provincia con longitud incorrecta', '008']
  ];

  for (const [id, descripcion, provincia] of provinciasInvalidas) {

    test(`${id} - ${descripcion}`, async ({ request }) => {

      const respuesta = await request.get('/api/franjas/libres', {
        params: { provincia }
      });

      expect(
        respuesta.status(),
        'El servidor debe rechazar provincias inválidas'
      ).toBe(400);
    });
  }

  test('SOL-038 - Cancelación con ID inválido', async ({ request }) => {
    await registrar(request);

    const respuesta = await request.put('/api/solicitudes/0/cancelar');

    expect(respuesta.status()).toBe(404);
  });

  test('SOL-039 - Respuesta de presupuesto inválida', async ({ request }) => {
    await registrar(request);

    const respuesta = await request.put('/api/solicitudes/1/respuesta', {
      data: { respuesta: 'incorrecta' }
    });

    expect(respuesta.status()).toBe(400);

    const cuerpo = await respuesta.json();

    expect(cuerpo.campo).toBe('respuesta');
  });

});
