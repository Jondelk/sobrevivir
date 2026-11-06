import { expect, test } from '@playwright/test';
import { createDemo, step } from './helpers';

test('en celular la casilla activa y las acciones van primero; el tablero se abre aparte', async ({ page }) => {
  await createDemo(page);
  const action = page.locator('.mobile-stack .stage').getByRole('button', { name: /Recibir el ingreso/ });
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.board-grid')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver el tablero completo' }).click();
  await expect(page.locator('.board-grid .tile')).toHaveCount(24);
  await step(page); // ingreso: ahora se pueden gestionar cuentas
  // Las tablas de cuentas se desplazan dentro de su caja, no amplían la página
  await page.getByRole('tab', { name: 'Mis cuentas' }).click();
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow2).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Solicitar crédito' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Contratar y recibir/ })).toBeInViewport();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('tab', { name: 'Tablero' }).click();
  await step(page); // girar
  await expect(page.locator('.mobile-stack .stage').getByRole('button', { name: 'Lanzar el dado' })).toBeVisible();
  // Sin desplazamiento horizontal de la página
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
