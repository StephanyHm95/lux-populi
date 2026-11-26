
const { test, expect } = require('@playwright/test');

test.describe('LuxPopuli - Resultados calculadora', () => {

  test.setTimeout(60000);

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

  async function simular(request, datos = casa) {
    const respuesta = await request.post(
      '/api/simulaciones',
      { data: datos }
    );

    expect(
      respuesta.status(),
      `Respuesta del servidor: ${await respuesta.text()}`
    ).toBe(201);

    return await respuesta.json();
  }

  async function rellenar(page, datos = casa) {
    await page.goto('/pages/calculadora.html');

    await page.locator('#codigoPostal')
      .fill(datos.codigoPostal);

    await page.locator(
      datos.tipoInstalacion === 'casa'
        ? '#tipoInstalacionCasa'
        : '#tipoInstalacionEdificio'
    ).check();

    await page.locator('#tipoTejado')
      .selectOption(datos.tipoTejado);

    await page.locator('#superficie')
      .fill(String(datos.superficie));

    if (datos.tipoInstalacion === 'casa') {
      await page.locator('#consumoMensual')
        .fill(String(datos.consumoMensual));
    } else {
      await page.locator('#numViviendas')
        .fill(String(datos.numViviendas));

      await page.locator('#consumoVivienda')
        .fill(String(datos.consumoVivienda));

      if (datos.incluirZonasComunes) {
        await page.locator('#incluirZonasComunes')
          .check();

        await page.locator('#consumoZonasComunes')
          .fill(String(datos.consumoZonasComunes));
      }
    }
  }

  async function calcular(page) {
    const pendiente = page.waitForResponse(
      r => r.url().endsWith('/api/simulaciones') &&
           r.request().method() === 'POST'
    );

    await page.getByRole('button', {
      name: 'Calcular',
      exact: true
    }).click();

    return await pendiente;
  }

  async function calcularCorrectamente(page) {
    const respuesta = await calcular(page);

    expect(respuesta.status()).toBe(201);

    await expect(page.locator('#resultados'))
      .toBeVisible();

    return await respuesta.json();
  }

  function validarResultado(resultado) {
    expect(Number.isInteger(resultado.id)).toBe(true);
    expect(resultado.id).toBeGreaterThan(0);

    expect(Number.isInteger(
      resultado.panelesFinales
    )).toBe(true);

    expect(resultado.panelesFinales).toBeGreaterThan(0);

    for (const campo of [
      'potenciaInstalada',
      'produccionAnual',
      'radiacionAnual',
      'coste',
      'ahorroAnual',
      'amortizacion'
    ]) {
      expect(Number.isFinite(resultado[campo])).toBe(true);
      expect(resultado[campo]).toBeGreaterThan(0);
    }

    expect(resultado.produccionMensual).toHaveLength(12);

    for (const mes of resultado.produccionMensual) {
      expect(Number.isFinite(mes)).toBe(true);
      expect(mes).toBeGreaterThanOrEqual(0);
    }

    expect(resultado.provincia.codigo).toBe('08');
  }

  test('RES-001 - Simulación de vivienda', async ({ request }) => {
    const resultado = await simular(request);

    validarResultado(resultado);

    expect(resultado.tipoInstalacion).toBe('casa');
    expect(resultado.costePorVivienda).toBeNull();
    expect(resultado.ahorroPorVivienda).toBeNull();
  });

  test('RES-002 - Simulación de edificio', async ({ request }) => {
    const resultado = await simular(request, edificio);

    validarResultado(resultado);

    expect(resultado.tipoInstalacion).toBe('edificio');
    expect(resultado.costePorVivienda).toBeGreaterThan(0);
    expect(resultado.ahorroPorVivienda).toBeGreaterThan(0);
  });

  test('RES-003 - Edificio sin zonas comunes', async ({ request }) => {
    const resultado = await simular(request, {
      ...edificio,
      incluirZonasComunes: false
    });

    validarResultado(resultado);
  });

  test('RES-004 - Zonas comunes con consumo cero', async ({ request }) => {
    const resultado = await simular(request, {
      ...edificio,
      consumoZonasComunes: 0
    });

    const sinComunes = await simular(request, {
      ...edificio,
      incluirZonasComunes: false
    });

    expect(resultado.coste).toBe(sinComunes.coste);
    expect(resultado.ahorroAnual).toBe(sinComunes.ahorroAnual);
    expect(resultado.panelesFinales).toBe(sinComunes.panelesFinales);
  });

  test('RES-005 - Superficie insuficiente', async ({ request }) => {
    const respuesta = await request.post(
      '/api/simulaciones',
      { data: { ...casa, superficie: 1 } }
    );

    expect(respuesta.status()).toBe(400);

    const cuerpo = await respuesta.json();

    expect(cuerpo.campo).toBe('superficie');
  });

  test('RES-006 - Coherencia de amortización', async ({ request }) => {
    const resultado = await simular(request);

    const amortizacionEsperada =
      resultado.coste / resultado.ahorroAnual;

    expect(
      Math.abs(
        resultado.amortizacion - amortizacionEsperada
      )
    ).toBeLessThanOrEqual(0.1);
  });

  test('RES-007 - Reparto económico por vivienda', async ({ request }) => {
    const resultado = await simular(request, edificio);

    expect(
      Math.abs(
        resultado.costePorVivienda -
        resultado.coste / edificio.numViviendas
      )
    ).toBeLessThanOrEqual(1);

    expect(
      Math.abs(
        resultado.ahorroPorVivienda -
        resultado.ahorroAnual / edificio.numViviendas
      )
    ).toBeLessThanOrEqual(1);
  });

  test('RES-008 - Limitación por superficie', async ({ request }) => {
    const resultado = await simular(request, {
      ...casa,
      superficie: 5,
      consumoMensual: 1000
    });

    expect(resultado.tejadoLimita).toBe(true);
    expect(resultado.panelesFinales).toBeGreaterThan(0);
  });

  test('RES-009 - Consistencia entre simulaciones', async ({ request }) => {
    const primera = await simular(request);
    const segunda = await simular(request);

    delete primera.id;
    delete segunda.id;

    expect(primera).toEqual(segunda);
  });

  test('RES-010 - Identificadores únicos', async ({ request }) => {
    const primera = await simular(request);
    const segunda = await simular(request);

    expect(primera.id).not.toBe(segunda.id);
  });

  test('RES-011 - Simulación desde navegador', async ({ page }) => {
    await rellenar(page);

    const resultado = await calcularCorrectamente(page);

    validarResultado(resultado);

    await expect(page.locator('#resultados'))
      .toContainText('Barcelona');

    await expect(page.locator('#resultados'))
      .toContainText('Estimación orientativa');
  });

  test('RES-012 - Gráfica mensual', async ({ page }) => {
    await rellenar(page);

    const resultado = await calcularCorrectamente(page);

    await expect(page.locator('#grafico-produccion'))
      .toBeVisible();

    await expect.poll(async () => {
      return await page.evaluate(() => {
        const grafico = window.Chart?.getChart(
          'grafico-produccion'
        );

        return grafico
          ? Array.from(grafico.data.datasets[0].data)
          : null;
      });
    }).toEqual(resultado.produccionMensual);
  });

  test('RES-013 - Resultados de edificio', async ({ page }) => {
    await rellenar(page, edificio);

    await calcularCorrectamente(page);

    await expect(page.locator('#resultados-edificio'))
      .toBeVisible();

    await expect(page.locator('#resultados-edificio'))
      .toContainText('Coste estimado por vivienda');

    await expect(page.locator('#resultados-edificio'))
      .toContainText('Ahorro anual por vivienda');
  });

  test('RES-014 - Enlace al formulario de solicitud', async ({ page }) => {
    await rellenar(page);

    const resultado = await calcularCorrectamente(page);

    await page.getByRole('link', {
      name: 'Quiero que un instalador me visite'
    }).click();

    await expect(page).toHaveURL(/registro\.html\?/);

    const url = new URL(page.url());

    expect(url.searchParams.get('simulacion'))
      .toBe(String(resultado.id));

    expect(url.searchParams.get('cp'))
      .toBe(casa.codigoPostal);
  });

  test('RES-015 - Cambio de código postal tras calcular', async ({ page }) => {
    await rellenar(page);

    await calcularCorrectamente(page);

    await page.locator('#codigoPostal').fill('46001');

    const enlace = page.getByRole('link', {
      name: 'Quiero que un instalador me visite'
    });

    // Es válido invalidar el resultado anterior
    // o conservar el código postal original.

    if (!(await enlace.isVisible())) {
      return;
    }

    const href = await enlace.getAttribute('href');

    const url = new URL(href, page.url());

    expect(
      url.searchParams.get('cp'),
      'El enlace debe conservar el CP de la simulación'
    ).toBe(casa.codigoPostal);
  });

  test('RES-016 - Error asociado a un campo', async ({ page }) => {
    await rellenar(page, {
      ...casa,
      superficie: 1
    });

    const respuesta = await calcular(page);

    expect(respuesta.status()).toBe(400);

    const cuerpo = await respuesta.json();

    expect(cuerpo.campo).toBe('superficie');

    await expect(
      page.locator('#error-superficie')
    ).toBeVisible({ timeout: 3000 });
  });

  test('RES-017 - Recuperación tras error del servicio', async ({ page }) => {
    await rellenar(page);

    const patron = '**/api/simulaciones';

    await page.route(patron, async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Servicio temporalmente no disponible'
        })
      });
    });

    const respuesta = await calcular(page);

    expect(respuesta.status()).toBe(503);

    await expect(
      page.locator('.lp-calculator__error')
    ).toContainText('Servicio temporalmente no disponible');

    await expect(page.locator('#resultados'))
      .toHaveCount(0);

    await expect(page.getByRole('button', {
      name: 'Calcular',
      exact: true
    })).toBeEnabled();

    await page.unroute(patron);

    await calcularCorrectamente(page);

    await expect(
      page.locator('.lp-calculator__error')
    ).toHaveCount(0);
  });

});
