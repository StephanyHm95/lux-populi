
const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

test.describe('LuxPopuli - Validaciones API de autenticación', () => {

  function datosValidos() {
    return {
      nombre: 'Usuario',
      apellidos: 'Prueba E2E',
      email: `${randomUUID()}@example.invalid`,
      telefono: '600000000',
      password: 'Prueba123',
      password2: 'Prueba123',
      aceptaPrivacidad: true
    };
  }

  const casos = [
    ['API-001', 'Nombre vacío',
      'nombre', ''],

    ['API-002', 'Nombre de 101 caracteres',
      'nombre', 'a'.repeat(101)],

    ['API-003', 'Apellidos vacíos',
      'apellidos', ''],

    ['API-004', 'Apellidos de 151 caracteres',
      'apellidos', 'a'.repeat(151)],

    ['API-005', 'Email inválido',
      'email', 'correo-invalido'],

    ['API-006', 'Email superior a 150 caracteres',
      'email', 'a'.repeat(145) + '@example.invalid'],

    ['API-007', 'Teléfono de 8 dígitos',
      'telefono', '12345678'],

    ['API-008', 'Teléfono con letras',
      'telefono', 'abcdefghi'],

    ['API-009', 'Contraseña de 7 caracteres',
      'password', '1234567'],

    ['API-010', 'Contraseña de 73 bytes',
      'password', 'a'.repeat(73)],

    ['API-011', 'Contraseña multibyte superior a 72 bytes',
      'password', 'á'.repeat(37)],

    ['API-012', 'Contraseñas diferentes',
      'password2', 'OtraPassword123'],

    ['API-013', 'Privacidad no aceptada',
      'aceptaPrivacidad', false],

    ['API-014', 'Consentimiento enviado como texto',
      'aceptaPrivacidad', 'true'],

    ['API-015', 'Nombre enviado como número',
      'nombre', 12345]
  ];

  for (const [id, descripcion, campo, valor] of casos) {

    test(`${id} - ${descripcion}`, async ({ request }) => {

      const datos = datosValidos();
      datos[campo] = valor;

      if (campo === 'password') {
        datos.password2 = valor;
      }

      const respuesta = await request.post(
        '/api/auth/registro',
        { data: datos }
      );

      expect(
        respuesta.status(),
        `Estado HTTP incorrecto para ${campo}`
      ).toBe(400);

      const cuerpo = await respuesta.json();

      expect(cuerpo.campo).toBe(campo);
      expect(typeof cuerpo.error).toBe('string');
      expect(cuerpo.error.length).toBeGreaterThan(0);

    });
  }

  test('API-016 - Logout sin sesión', async ({ request }) => {

    const respuesta = await request.post('/api/auth/logout');

    expect(respuesta.status()).toBe(401);

  });

  test('API-017 - Ruta inexistente', async ({ request }) => {

    const respuesta = await request.get(
      '/api/ruta-inexistente-pruebas'
    );

    expect(respuesta.status()).toBe(404);

  });

});

