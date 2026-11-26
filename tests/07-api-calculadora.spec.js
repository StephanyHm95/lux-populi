
const { test, expect } = require('@playwright/test');

test.describe('LuxPopuli - API de calculadora', () => {

  const casa = {
    codigoPostal: '08201',
    tipoInstalacion: 'casa',
    tipoTejado: 'inclinado',
    superficie: 25,
    consumoMensual: 290
  };

  const edificio = {
    codigoPostal: '08201',
    tipoInstalacion: 'edificio',
    tipoTejado: 'plano',
    superficie: 150,
    numViviendas: 10,
    consumoVivienda: 290,
    incluirZonasComunes: true,
    consumoZonasComunes: 300
  };

  const casos = [
    ['APC-001', 'Código postal numérico',
      casa, 'codigoPostal', 8201],

    ['APC-002', 'Código postal inexistente',
      casa, 'codigoPostal', '53001'],

    ['APC-003', 'Código postal con letras',
      casa, 'codigoPostal', '08abc'],

    ['APC-004', 'Tipo de instalación incorrecto',
      casa, 'tipoInstalacion', 'otro'],

    ['APC-005', 'Tipo de tejado incorrecto',
      casa, 'tipoTejado', 'otro'],

    ['APC-006', 'Superficie enviada como texto',
      casa, 'superficie', '25'],

    ['APC-007', 'Superficie negativa',
      casa, 'superficie', -1],

    ['APC-008', 'Superficie igual a cero',
      casa, 'superficie', 0],

    ['APC-009', 'Superficie superior al máximo',
      casa, 'superficie', 1000000],

    ['APC-010', 'Superficie inferior al mínimo',
      casa, 'superficie', 0.001],

    ['APC-011', 'Consumo igual a cero',
      casa, 'consumoMensual', 0],

    ['APC-012', 'Consumo negativo',
      casa, 'consumoMensual', -100],

    ['APC-013', 'Consumo superior al máximo',
      casa, 'consumoMensual', 1000000],

    ['APC-014', 'Consumo enviado como texto',
      casa, 'consumoMensual', '290'],

    ['APC-015', 'Consumo nulo',
      casa, 'consumoMensual', null],

    ['APC-016', 'Edificio con una vivienda',
      edificio, 'numViviendas', 1],

    ['APC-017', 'Número de viviendas decimal',
      edificio, 'numViviendas', 2.5],

    ['APC-018', 'Número de viviendas superior al máximo',
      edificio, 'numViviendas', 2147483648],

    ['APC-019', 'Número de viviendas como texto',
      edificio, 'numViviendas', '10'],

    ['APC-020', 'Consumo por vivienda negativo',
      edificio, 'consumoVivienda', -100],

    ['APC-021', 'Consumo por vivienda igual a cero',
      edificio, 'consumoVivienda', 0],

    ['APC-022', 'Consumo por vivienda superior al máximo',
      edificio, 'consumoVivienda', 1000000],

    ['APC-023', 'Zonas comunes como texto',
      edificio, 'incluirZonasComunes', 'true'],

    ['APC-024', 'Consumo de zonas comunes negativo',
      edificio, 'consumoZonasComunes', -1],

    ['APC-025', 'Consumo de zonas comunes superior al máximo',
      edificio, 'consumoZonasComunes', 1000000],

    ['APC-026', 'Consumo de zonas comunes nulo',
      edificio, 'consumoZonasComunes', null],

    ['APC-027', 'Consumo de zonas comunes como texto',
      edificio, 'consumoZonasComunes', '300']
  ];

  for (const [id, descripcion, base, campo, valor] of casos) {

    test(`${id} - ${descripcion}`, async ({ request }) => {

      const datos = {
        ...base,
        [campo]: valor
      };

      const respuesta = await request.post(
        '/api/simulaciones',
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

  test('APC-028 - Objeto vacío', async ({ request }) => {

    const respuesta = await request.post(
      '/api/simulaciones',
      { data: {} }
    );

    expect(respuesta.status()).toBe(400);
  });

  test('APC-029 - Array en lugar de objeto', async ({ request }) => {

    const respuesta = await request.post(
      '/api/simulaciones',
      { data: [] }
    );

    expect(respuesta.status()).toBe(400);
  });

  test('APC-030 - Petición sin datos', async ({ request }) => {

    const respuesta = await request.post(
      '/api/simulaciones'
    );

    expect(respuesta.status()).toBe(400);
  });

  test('APC-031 - Superficie obligatoria omitida', async ({ request }) => {

    const datos = { ...casa };

    delete datos.superficie;

    const respuesta = await request.post(
      '/api/simulaciones',
      { data: datos }
    );

    expect(respuesta.status()).toBe(400);

    const cuerpo = await respuesta.json();

    expect(cuerpo.campo).toBe('superficie');
  });

  test('APC-032 - Consumo obligatorio omitido', async ({ request }) => {

    const datos = { ...casa };

    delete datos.consumoMensual;

    const respuesta = await request.post(
      '/api/simulaciones',
      { data: datos }
    );

    expect(respuesta.status()).toBe(400);

    const cuerpo = await respuesta.json();

    expect(cuerpo.campo).toBe('consumoMensual');
  });

});
