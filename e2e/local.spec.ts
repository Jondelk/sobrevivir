import { expect, test } from '@playwright/test';
import { cash, createDemo, openAccounts, openBoard, parseMoney, phase, step, stepUntil } from './helpers';

test.describe('Demostración local', () => {
  test('crear una demostración con dos familias', async ({ page }) => {
    await createDemo(page, [1, 6]);
    await expect(page.getByRole('heading', { name: /Familia 1/ })).toBeVisible();
    await expect(page.getByText('Demostración local · guardada en este navegador')).toBeVisible();
    await page.getByRole('button', { name: /Familia 6/ }).click();
    await expect(page.getByRole('heading', { name: /Hogar con carga de salud/ })).toBeVisible();
    await expect(page.getByText('Abuela enferma')).toBeVisible();
    // 24 casillas, sin números visibles
    const tiles = page.locator('.board-grid .tile');
    await expect(tiles).toHaveCount(24);
    await expect(page.locator('.board-grid .tile-label').filter({ hasText: /^\d+$/ })).toHaveCount(0);
  });

  test('completar un turno', async ({ page }) => {
    await createDemo(page);
    await step(page); // ingreso
    expect(await cash(page)).toBe(4_000_000);
    await expect(page.getByText('Turno 1', { exact: true })).toBeVisible();
    await stepUntil(page, async () => (await phase(page)) === 'Gestión de cuentas' || (await phase(page)) === 'Cierre mensual');
    if ((await phase(page)) === 'Gestión de cuentas') {
      await page.getByLabel(/Nota del turno/).fill('Conversamos sobre el arriendo');
      await step(page);
      await expect(page.getByText('Turno 2', { exact: true })).toBeVisible();
      await expect(page.getByTestId('phase')).toHaveText('Girar la ruleta');
    }
  });

  test('comprar y rechazar una compra', async ({ page }) => {
    await createDemo(page);
    await step(page);
    let bought = false;
    let passed = false;
    for (let i = 0; i < 400 && !(bought && passed); i++) {
      const p = await phase(page);
      const pass = page.locator('.stage').getByRole('button', { name: 'No comprar' });
      if (p === 'Resolver la casilla') {
        await expect(page.locator('[data-testid="card-flip"]:not([data-state="frente"])')).toHaveCount(0, { timeout: 5000 });
      }
      if (p === 'Resolver la casilla' && (await pass.isVisible())) {
        const before = await cash(page);
        const buy = page.locator('.stage').getByRole('button', { name: /^Comprar:/ });
        const offers = page.locator('.stage .offer');
        const affordable = page.locator('.stage .offer:not(.offer-short)');
        let price = 0;
        let canBuy = false;
        if ((await offers.count()) > 0) {
          if ((await affordable.count()) > 0) {
            await affordable.first().click();
            price = parseMoney(await affordable.first().locator('.offer-price').innerText());
            canBuy = true;
          }
        } else {
          // Tarjeta de tentación: el precio está en el frente de la tarjeta
          price = parseMoney(await page.getByTestId('card-value').innerText());
          canBuy = await buy.isEnabled();
        }
        if (!bought && canBuy) {
          await buy.click();
          await expect(page.getByText(/Compraron/)).toBeVisible();
          expect(await cash(page)).toBe(before - price);
          bought = true;
          await page.locator('.stage').getByRole('button', { name: /Continuar a la gestión/ }).click();
        } else {
          await pass.click();
          await expect(page.getByTestId('phase')).toHaveText('Gestión de cuentas');
          expect(await cash(page)).toBe(before);
          passed = true;
        }
        continue;
      }
      await step(page);
    }
    expect(bought && passed).toBe(true);
    await openAccounts(page);
    await expect(page.getByRole('cell', { name: /Compra:/ })).toBeVisible();
  });

  test('reservar y pagar desde la reserva', async ({ page }) => {
    await createDemo(page);
    await step(page);
    await openAccounts(page);
    await page.getByRole('button', { name: 'Reservar para Arriendo del mes 1' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reservar dinero' });
    await expect(dialog.getByLabel('Importe a reservar')).toHaveValue('$1.500.000');
    await dialog.getByRole('button', { name: 'Reservar' }).click();
    await expect(dialog).toBeHidden();
    const summary = page.locator('.accounts .summary').first();
    await expect(summary.getByText('$4.000.000')).toBeVisible(); // el efectivo no cambia
    await expect(summary).toContainText('$2.500.000'); // disponible
    await page.getByRole('button', { name: 'Pagar Arriendo del mes 1' }).click();
    const pay = page.getByRole('dialog', { name: 'Pagar una obligación' });
    await expect(pay.getByRole('radio', { name: /Reserva «Arriendo»/ })).toBeChecked();
    await pay.getByRole('button', { name: 'Pagar' }).click();
    await expect(pay).toBeHidden();
    await expect(page.locator('.accounts .summary-main dd').first()).toHaveText('$2.500.000');
    await expect(page.getByText('No hay dinero reservado.')).toBeVisible();
  });

  test('contratar un crédito y abonarlo', async ({ page }) => {
    await createDemo(page);
    await step(page);
    await openAccounts(page);
    await page.getByRole('button', { name: 'Solicitar crédito' }).click();
    const dialog = page.getByRole('dialog', { name: 'Solicitar crédito' });
    await dialog.getByRole('radio', { name: /Préstamo pequeño/ }).check();
    await expect(dialog.locator('.confirm-box')).toContainText('$300.000');
    await expect(dialog.locator('.confirm-box')).toContainText('$350.000');
    await dialog.getByRole('button', { name: /Contratar y recibir \$300\.000/ }).click();
    await expect(page.locator('.accounts .summary-main dd').first()).toHaveText('$4.300.000');
    await page.locator('.contract').getByRole('button', { name: 'Abonar' }).click();
    const abono = page.getByRole('dialog', { name: /Abonar a/ });
    await abono.getByLabel('Importe del abono').fill('320000');
    await expect(abono.getByText(/Se aplicará \$300\.000 a capital y \$20\.000 al costo/)).toBeVisible();
    await abono.getByRole('button', { name: 'Abonar' }).click();
    await expect(abono).toBeHidden();
    await expect(page.locator('.contract')).toContainText('Costo pendiente$30.000');
    await expect(page.locator('.accounts .summary-main dd').first()).toHaveText('$3.980.000');
  });

  test('cerrar un mes y recuperar la partida al recargar', async ({ page }) => {
    await createDemo(page);
    await step(page);
    await stepUntil(page, async () => (await phase(page)) === 'Movimiento');
    const die = await page.locator('.die svg').getAttribute('aria-label');
    const turn = await page.locator('.status-line .chip').nth(1).innerText();
    await page.reload();
    await expect(page.getByTestId('phase')).toHaveText('Movimiento');
    expect(await page.locator('.die svg').getAttribute('aria-label')).toBe(die);
    expect(await page.locator('.status-line .chip').nth(1).innerText()).toBe(turn);
    await expect(page.locator('.stage').getByRole('button', { name: 'Lanzar el dado' })).toHaveCount(0);

    await stepUntil(page, async () => (await phase(page)) === 'Cierre mensual');
    await expect(page.getByRole('heading', { name: 'Cierre del mes 1' })).toBeVisible();
    await expect(page.getByText('Comprobación del saldo')).toBeVisible();
    await page.getByLabel(/Qué aprendieron este mes/).fill('Nos faltó planear el transporte.');
    await page.reload(); // la tarjeta / fase se conserva
    await expect(page.getByRole('heading', { name: 'Cierre del mes 1' })).toBeVisible();
    await page.getByRole('button', { name: /Confirmar el cierre e iniciar el mes 2/ }).click();
    await expect(page.getByTestId('phase')).toHaveText('Inicio de mes');
    await expect(page.locator('.chip-month')).toHaveText('Mes 2 de 3');
  });

  test('completar el juego de tres meses', async ({ page }) => {
    await createDemo(page);
    await stepUntil(page, async () => (await phase(page)) === 'Finalizado', 1500);
    await expect(page.getByRole('heading', { name: '¿Cómo terminó el trimestre?' })).toBeVisible();
    await expect(page.getByText(/Si todas las familias comenzaron con el mismo ingreso/)).toBeVisible();
    await expect(page.locator('.final')).not.toContainText(/ranking|mejor familia|ganaron|perdieron/i);
    // Sin cuarto ingreso: exactamente tres ingresos en el registro
    await openAccounts(page);
    await expect(page.locator('.accounts td', { hasText: 'Ingreso mensual' })).toHaveCount(3);
    await page.getByRole('tab', { name: 'Reflexión final' }).click();
    await page.getByLabel(/Si todas las familias/).fill('Por los imprevistos y por cómo decidimos.');
    await page.getByRole('button', { name: 'Guardar respuestas' }).click();
    await expect(page.getByText('Respuestas guardadas.')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar movimientos (CSV)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    // No se puede seguir jugando
    await openBoard(page);
    await expect(page.locator('.stage').getByRole('button', { name: /Girar|Lanzar/ })).toHaveCount(0);
  });
});
