import { defineConfig, devices } from '@playwright/test';

const PORT = 3199;

/**
 * Pruebas de recorridos críticos en navegador. El servidor se inicia con el
 * almacén en memoria PARA PRUEBAS (SOBREVIVIR_STORE=memoria-pruebas) porque el
 * entorno de CI puede no tener MongoDB. La lógica de sincronización, permisos y
 * validación es la misma que con MongoDB; solo cambia dónde se guardan los datos.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    viewport: { width: 1440, height: 950 },
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 950 } }, testIgnore: /movil/ },
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: /movil/ },
  ],
  webServer: {
    command: `npm run build && SOBREVIVIR_STORE=memoria-pruebas PORT=${PORT} npx tsx apps/server/src/index.ts`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
