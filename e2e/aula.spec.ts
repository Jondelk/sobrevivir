import { expect, test } from '@playwright/test';

/**
 * Sesión de aula con tres dispositivos simulados (contextos de navegador aislados):
 * facilitador, familia y estación. Usa el servidor real con Socket.IO; el almacén
 * es el de memoria para pruebas.
 */
test('aprobar una operación en modo conectado', async ({ browser }) => {
  const fac = await browser.newContext();
  const facPage = await fac.newPage();
  await facPage.goto('/#/sala/crear');
  await facPage.getByRole('button', { name: 'Crear sala' }).click();
  await expect(facPage.getByRole('heading', { name: 'Panel del facilitador' })).toBeVisible();
  const created = await facPage.evaluate(() => JSON.parse(localStorage.getItem('sobrevivir:salas-creadas')!)[0]);
  const code: string = created.code;
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Familia 1 en su propio dispositivo, entrando por enlace privado
  const famCtx = await browser.newContext();
  const fam = await famCtx.newPage();
  await fam.goto(`/#/acceso/${code}/${created.keys.familias.f1}`);
  await expect(fam.getByRole('button', { name: 'Guardar y comenzar' })).toBeVisible();
  await expect(fam.getByText('Conectado')).toBeVisible();
  await fam.getByLabel('Nombre de Madre ama de casa').fill('Rosa');
  await fam.getByRole('button', { name: 'Guardar y comenzar' }).click();
  await fam.locator('.stage').getByRole('button', { name: /Recibir el ingreso/ }).click();
  await expect(fam.locator('.summary-main dd').first()).toHaveText('$4.000.000');

  // Estación Supermercado en otro dispositivo, entrando con código + clave
  const stCtx = await browser.newContext();
  const st = await stCtx.newPage();
  await st.goto('/#/unirse');
  await st.getByLabel('Código de la sala').fill(code);
  await st.getByLabel('Clave de acceso').fill(created.keys.estaciones.supermercado);
  await st.getByRole('button', { name: 'Entrar' }).click();
  await expect(st.getByRole('heading', { name: 'Estación Supermercado' })).toBeVisible();

  // El código público solo no da acceso
  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto(`/#/sala/${code}/facilitador`);
  await expect(anon.getByText(/no tiene acceso a la sala/)).toBeVisible();

  // La familia solicita pagar alimentación: no se cobra hasta validar
  await fam.getByRole('tab', { name: 'Mis cuentas' }).click();
  await fam.getByRole('button', { name: 'Pagar Alimentación del mes 1' }).click();
  await fam.getByRole('dialog').getByRole('button', { name: 'Enviar a validación' }).click();
  await expect(fam.getByTestId('phase')).toHaveText('Esperando validación');
  await expect(fam.locator('.summary-main dd').first()).toHaveText('$4.000.000');

  // La estación la recibe en tiempo real y la valida
  await expect(st.getByRole('cell', { name: /Alimentación/ })).toBeVisible();
  await expect(st.getByRole('cell', { name: 'Familia 1' })).toBeVisible();
  await st.getByRole('button', { name: 'Validar y aplicar' }).click();
  await expect(st.getByText('No hay solicitudes pendientes.')).toBeVisible();

  // La familia ve el resultado sin recargar
  await expect(fam.getByTestId('phase')).toHaveText('Girar la ruleta');
  await expect(fam.locator('.summary-main dd').first()).toHaveText('$3.100.000');

  // El facilitador ve el progreso, la conexión y el registro de la familia
  await facPage.getByRole('tab', { name: 'Progreso' }).click();
  const row = facPage.getByRole('row', { name: /Familia 1/ });
  await expect(row).toContainText('En línea');
  await expect(row).toContainText('Girar la ruleta');
  await facPage.getByRole('tab', { name: 'Registro y observación' }).click();
  await expect(facPage.getByText('Pago: Alimentación (mes 1)')).toBeVisible();
  await expect(facPage.getByRole('cell', { name: 'Estación Supermercado' })).toBeVisible();

  // Pausa: la familia queda en solo lectura
  await facPage.getByRole('button', { name: 'Pausar la sesión' }).click();
  await expect(fam.getByText(/El facilitador pausó la sesión/)).toBeVisible();
  await facPage.getByRole('button', { name: 'Reanudar la sesión' }).click();
  await expect(fam.getByText(/El facilitador pausó la sesión/)).toBeHidden();

  // Reconectar: al recargar se recupera la instantánea del servidor
  await fam.reload();
  await expect(fam.locator('.summary-main dd').first()).toHaveText('$3.100.000');

  await Promise.all([fac.close(), famCtx.close(), stCtx.close(), anonCtx.close()]);
});
