
const { test, expect } = require('@playwright/test');

test.describe('LuxPopuli - Validaciones de registro', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/registro.html');
    await expect(page.locator('#nombre')).toBeVisible();
  });

  async function rellenarFormulario(page) {
    await page.locator('#nombre').fill('Usuario');
    await page.locator('#apellidos').fill('Prueba E2E');
    await page.locator('#email').fill('pruebas@example.invalid');
    await page.locator('#telefono').fill('600000000');
    await page.locator('#password').fill('Prueba123');
    await page.locator('#password2').fill('Prueba123');
    await page.locator('#aceptaPrivacidad').check();
  }

  async function enviar(page) {
    await page.getByRole('button', {
      name: 'Registrarse',
      exact: true
    }).click();
  }

  // Impide crear usuarios reales durante estas pruebas.
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/registro', async route => {
      await route.abort();
    });
  });

  test('REG-001 - Formulario vacío', async ({ page }) => {
    await enviar(page);

    const campos = [
      'nombre',
      'apellidos',
      'email',
      'telefono',
      'password',
      'aceptaPrivacidad'
    ];

    for (const campo of campos) {
      await expect(page.locator(`#error-${campo}`))
        .toBeVisible();
    }
  });

  const casos = [
    {
      id: 'REG-002',
      nombre: 'Nombre compuesto por espacios',
      campo: 'nombre',
      valor: '   '
    },
    {
      id: 'REG-003',
      nombre: 'Apellidos compuestos por espacios',
      campo: 'apellidos',
      valor: '   '
    },
    {
      id: 'REG-004',
      nombre: 'Email incorrecto',
      campo: 'email',
      valor: 'correo-invalido'
    },
    {
      id: 'REG-005',
      nombre: 'Teléfono de 8 dígitos',
      campo: 'telefono',
      valor: '12345678'
    },
    {
      id: 'REG-006',
      nombre: 'Teléfono con letras',
      campo: 'telefono',
      valor: 'abcdefghi'
    },
    {
      id: 'REG-007',
      nombre: 'Contraseña de 7 caracteres',
      campo: 'password',
      valor: '1234567'
    },
    {
      id: 'REG-008',
      nombre: 'Contraseñas diferentes',
      campo: 'password2',
      valor: 'Diferente123'
    },
    {
      id: 'REG-011',
      nombre: 'Email superior a 150 caracteres',
      campo: 'email',
      valor: 'a'.repeat(145) + '@example.invalid'
    },
    {
      id: 'REG-012',
      nombre: 'Contraseña superior a 72 bytes',
      campo: 'password',
      valor: 'a'.repeat(73)
    }
  ];

  for (const caso of casos) {
    test(`${caso.id} - ${caso.nombre}`, async ({ page }) => {
      await rellenarFormulario(page);

      await page.locator(`#${caso.campo}`).fill(caso.valor);

      if (caso.campo === 'password') {
        await page.locator('#password2').fill(caso.valor);
      }

      await enviar(page);

      await expect(
        page.locator(`#error-${caso.campo}`),
        `El formulario debe rechazar: ${caso.nombre}`
      ).toBeVisible({ timeout: 3000 });

      await expect(page).toHaveURL(/registro\.html$/);
    });
  }

  test('REG-009 - Privacidad no aceptada', async ({ page }) => {
    await rellenarFormulario(page);
    await page.locator('#aceptaPrivacidad').uncheck();

    await enviar(page);

    await expect(
      page.locator('#error-aceptaPrivacidad')
    ).toBeVisible();
  });

  test('REG-010 - Limpiar error al corregir campo', async ({ page }) => {
    await enviar(page);

    await expect(page.locator('#error-email'))
      .toBeVisible();

    await page.locator('#email')
      .fill('pruebas@example.invalid');

    await expect(page.locator('#error-email'))
      .toHaveCount(0);

    await expect(page.locator('#email'))
      .toHaveAttribute('aria-invalid', 'false');
  });

});
