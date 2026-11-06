import { expect, test, type Page } from '@playwright/test';
import { createDemo, phase, step } from './helpers';

const CARD_TILE = /Avanzan hasta (Imprevisto|Oportunidad|Compra Opcional|Tentación de Gasto)\./;

/** Avanza hasta tener la ficha lista para moverse hacia una casilla de tarjeta. */
async function untilCardMove(page: Page) {
  for (let i = 0; i < 300; i++) {
    const p = await phase(page);
    if (p === 'Movimiento' && CARD_TILE.test(await page.locator('.stage .result-line').innerText())) return;
    if (p === 'Cierre mensual') {
      await page.getByRole('button', { name: /Confirmar el cierre/ }).click();
      continue;
    }
    await step(page);
  }
  throw new Error('No se llegó a una casilla de tarjeta');
}

test('la tarjeta se levanta: reverso, frente y sin cambiar al recargar', async ({ page }) => {
  await createDemo(page);
  await untilCardMove(page);
  await page.locator('.stage').getByRole('button', { name: 'Mover la ficha' }).click();
  const flip = page.getByTestId('card-flip');
  await expect(flip).toHaveAttribute('data-state', 'reverso');
  await expect(flip.locator('.flip-back-instruction')).toHaveText(/Toma una tarjeta|Compra o pasa/);
  await expect(flip).toHaveAttribute('data-state', 'frente', { timeout: 4000 });
  const name = await page.getByTestId('card-name').innerText();
  const value = await page.getByTestId('card-value').innerText();
  expect(value).toMatch(/^[−+]?\$\d{1,3}(\.\d{3})*$/);
  await expect(flip.locator('.card-sub')).toHaveText(/Decisión voluntaria|Situación inesperada|Ingreso o beneficio favorable/);
  // el foco pasa a la primera acción de la tarjeta
  await expect(flip.locator('.flip-front button').first()).toBeFocused();

  await page.reload();
  await expect(page.getByTestId('card-flip')).toHaveAttribute('data-state', 'frente');
  await expect(page.getByTestId('card-name')).toHaveText(name);
  await expect(page.getByTestId('card-value')).toHaveText(value);
});

test('con «reducir movimiento» la tarjeta aparece directamente de frente', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await createDemo(page);
  await untilCardMove(page);
  await page.locator('.stage').getByRole('button', { name: 'Mover la ficha' }).click();
  const flip = page.getByTestId('card-flip');
  await expect(flip).toHaveAttribute('data-state', 'frente');
  const states = await flip.evaluate((el) => el.getAttribute('data-state'));
  expect(states).toBe('frente');
  await expect(page.getByTestId('card-name')).not.toBeEmpty();
});

test('la pestaña de reglas explica las tres categorías', async ({ page }) => {
  await createDemo(page);
  await page.getByRole('tab', { name: 'Reglas' }).click();
  await page.getByText('Tentaciones, imprevistos y oportunidades').click();
  const table = page.locator('table', { hasText: '¿La familia decide?' });
  await expect(table.getByRole('row', { name: /Tentación de gasto.*Aparece una compra opcional.*Sí, compra o pasa/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Imprevisto.*Ocurre un evento inesperado.*Decide cómo afrontarlo/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Oportunidad.*Recibe un beneficio económico.*Aplica el beneficio de la tarjeta/ })).toBeVisible();
});
