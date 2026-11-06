import { expect, type Page } from '@playwright/test';

export const parseMoney = (s: string) => Number(s.replace(/[^\d−-]/g, '').replace('−', '-'));

export async function phase(page: Page) {
  return (await page.getByTestId('phase').innerText()).trim();
}

export async function cash(page: Page) {
  return parseMoney(await page.locator('.summary-main dd').first().innerText());
}

export async function createDemo(page: Page, families: number[] = [1]) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: /Crear demostración/ }).click();
  for (const f of families) {
    if (f !== 1) await page.getByRole('checkbox', { name: new RegExp(`Familia ${f}`) }).check();
  }
  if (!families.includes(1)) await page.getByRole('checkbox', { name: /Familia 1/ }).uncheck();
  await page.getByRole('button', { name: /Continuar con/ }).click();
  await page.getByRole('button', { name: 'Comenzar la demostración' }).click();
  await expect(page.getByTestId('game')).toBeVisible();
}

const stage = (page: Page) => page.locator('.stage');

/** Avanza un paso del turno según la fase visible, resolviendo la casilla sin comprar. */
export async function step(page: Page) {
  const p = await phase(page);
  const s = stage(page);
  switch (p) {
    case 'Inicio de mes':
      await s.getByRole('button', { name: /Recibir el ingreso/ }).click();
      break;
    case 'Girar la ruleta':
      await s.getByRole('button', { name: 'Girar la ruleta' }).click();
      break;
    case 'Lanzar el dado':
      await s.getByRole('button', { name: 'Lanzar el dado' }).click();
      break;
    case 'Movimiento':
      await s.getByRole('button', { name: 'Mover la ficha' }).click();
      break;
    case 'Resolver la casilla': {
      const receive = s.getByRole('button', { name: /^Recibir \$/ });
      const pass = s.getByRole('button', { name: 'No comprar' });
      if (await receive.isVisible()) await receive.click();
      else if (await pass.isVisible()) await pass.click();
      else await s.getByRole('button', { name: /continuar/i }).first().click();
      break;
    }
    case 'Gestión de cuentas':
      await s.getByRole('button', { name: 'Finalizar el turno' }).click();
      break;
    case 'Cierre mensual':
      await page.getByRole('button', { name: /Confirmar el cierre/ }).click();
      break;
    default:
      throw new Error(`Fase inesperada: ${p}`);
  }
  await page.waitForTimeout(30);
}

export async function stepUntil(page: Page, done: () => Promise<boolean>, max = 400) {
  for (let i = 0; i < max; i++) {
    if (await done()) return;
    await step(page);
  }
  throw new Error('No se alcanzó la condición esperada');
}

export async function openAccounts(page: Page) {
  await page.getByRole('tab', { name: 'Mis cuentas' }).click();
}
export async function openBoard(page: Page) {
  await page.getByRole('tab', { name: 'Tablero' }).click();
}
