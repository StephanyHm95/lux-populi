
const { test, expect } = require('@playwright/test');

test.describe('LuxPopuli - Validaciones calculadora', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/calculadora.html');

    await expect(
      page.locator('#calculadora-form')
    ).toBeVisible();

    // Evitar simulaciones reales en este bloque.
    await page.route('**/api/simulaciones', async route => {
      if (route.request().method() === 'POST') {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  });

  async function rellenarCasa(page) {
    await page.locator('#codigoPostal').fill('08201');
    await page.locator('#tipoInstalacionCasa').check();
    await page.locator('#tipoTejado').selectOption('inclinado');
    await page.locator('#superficie').fill('25');
    await page.locator('#consumoMensual').fill('290');
  }

  async function rellenarEdificio(page) {
    await page.locator('#codigoPostal').fill('08201');
    await page.locator('#tipoInstalacionEdificio').check();
    await page.locator('#tipoTejado').selectOption('plano');
    await page.locator('#superficie').fill('150');
    await page.locator('#numViviendas').fill('10');
    await page.locator('#consumoVivienda').fill('290');
  }

  async function calcular(page) {
    await page.getByRole('button', {
      name: 'Calcular',
      exact: true
    }).click();
  }

  async function comprobarInvalido(page, campo) {
    const valido = await page.locator(`#${campo}`)
      .evaluate(elemento => elemento.validity.valid);

    expect(
      valido,
      `El campo ${campo} debe ser inválido`
    ).toBe(false);
  }

  test('CAL-001 - Formulario vacío', async ({ page }) => {
    await calcular(page);

    await comprobarInvalido(page, 'codigoPostal');
    await comprobarInvalido(page, 'tipoInstalacionCasa');
    await comprobarInvalido(page, 'tipoTejado');
    await comprobarInvalido(page, 'superficie');

    await expect(page.locator('#resultados')).toHaveCount(0);
  });

  const casosNativos = [
    ['CAL-002', 'Código postal de cuatro cifras',
      'codigoPostal', '8201'],

    ['CAL-003', 'Código postal con letras',
      'codigoPostal', '08abc'],

    ['CAL-006', 'Superficie negativa',
      'superficie', '-10'],

    ['CAL-007', 'Superficie igual a cero',
      'superficie', '0'],

    ['CAL-008', 'Consumo negativo',
      'consumoMensual', '-100'],

    ['CAL-009', 'Consumo igual a cero',
      'consumoMensual', '0']
  ];

  for (const [id, descripcion, campo, valor] of casosNativos) {
    test(`${id} - ${descripcion}`, async ({ page }) => {
      await rellenarCasa(page);

      await page.locator(`#${campo}`).fill(valor);

      await calcular(page);

      await comprobarInvalido(page, campo);

      await expect(page.locator('#resultados')).toHaveCount(0);
    });
  }

  for (const [id, cp] of [
    ['CAL-004', '00000'],
    ['CAL-005', '53001']
  ]) {
    test(`${id} - Código postal ${cp}`, async ({ page }) => {
      await rellenarCasa(page);

      await page.locator('#codigoPostal').fill(cp);

      await calcular(page);

      await expect(
        page.locator('#codigoPostal-error')
      ).toBeVisible();

      await expect(page.locator('#resultados')).toHaveCount(0);
    });
  }

  test('CAL-010 - Mostrar campos de vivienda', async ({ page }) => {
    await page.locator('#tipoInstalacionCasa').check();

    await expect(page.locator('#datos-vivienda')).toBeVisible();
    await expect(page.locator('#datos-edificio')).toBeHidden();
  });

  test('CAL-011 - Mostrar campos de edificio', async ({ page }) => {
    await page.locator('#tipoInstalacionEdificio').check();

    await expect(page.locator('#datos-edificio')).toBeVisible();
    await expect(page.locator('#datos-vivienda')).toBeHidden();
  });

  test('CAL-012 - Edificio con una vivienda', async ({ page }) => {
    await rellenarEdificio(page);

    await page.locator('#numViviendas').fill('1');

    await calcular(page);

    await comprobarInvalido(page, 'numViviendas');
  });

  test('CAL-013 - Número de viviendas decimal', async ({ page }) => {
    await rellenarEdificio(page);

    await page.locator('#numViviendas').fill('2.5');

    await calcular(page);

    await comprobarInvalido(page, 'numViviendas');
  });

  test('CAL-014 - Mostrar y ocultar zonas comunes', async ({ page }) => {
    await rellenarEdificio(page);

    await expect(
      page.locator('#consumoZonasComunes')
    ).toHaveCount(0);

    await page.locator('#incluirZonasComunes').check();

    await expect(
      page.locator('#consumoZonasComunes')
    ).toBeVisible();

    await page.locator('#incluirZonasComunes').uncheck();

    await expect(
      page.locator('#consumoZonasComunes')
    ).toHaveCount(0);
  });

  test('CAL-015 - Consumo negativo en zonas comunes', async ({ page }) => {
    await rellenarEdificio(page);

    await page.locator('#incluirZonasComunes').check();
    await page.locator('#consumoZonasComunes').fill('-100');

    await calcular(page);

    await comprobarInvalido(page, 'consumoZonasComunes');
  });

  const casosLimite = [
    ['CAL-016', 'Superficie superior al máximo',
      'superficie', '1000000', 'casa'],

    ['CAL-017', 'Consumo superior al máximo',
      'consumoMensual', '1000000', 'casa'],

    ['CAL-018', 'Número de viviendas superior al máximo',
      'numViviendas', '2147483648', 'edificio']
  ];

  for (const [id, descripcion, campo, valor, tipo] of casosLimite) {
    test(`${id} - ${descripcion}`, async ({ page }) => {

      if (tipo === 'casa') {
        await rellenarCasa(page);
      } else {
        await rellenarEdificio(page);
      }

      await page.locator(`#${campo}`).fill(valor);

      let peticiones = 0;

      page.on('request', peticion => {
        if (
          peticion.url().endsWith('/api/simulaciones') &&
          peticion.method() === 'POST'
        ) {
          peticiones++;
        }
      });

      await calcular(page);

      await expect(
        page.getByRole('button', {
          name: 'Calcular',
          exact: true
        })
      ).toBeEnabled();

      const valido = await page.locator(`#${campo}`)
        .evaluate(elemento => elemento.validity.valid);

      const errorVisible = await page
        .locator(`#error-${campo}`)
        .isVisible();

      expect(
        !valido || errorVisible,
        'El frontend debe rechazar el valor fuera de rango'
      ).toBe(true);

      expect(peticiones).toBe(0);
    });
  }

});
