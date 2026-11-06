import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { MemoryStore } from './store/memory';
import { MongoStore } from './store/mongo';
import type { Store } from './store/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const staticDir = path.resolve(here, '../../web/dist');

async function main() {
  let store: Store | null = null;
  let storeError: string | undefined;
  const kind = process.env.SOBREVIVIR_STORE ?? 'mongo';

  if (kind === 'memoria-pruebas') {
    console.warn('⚠️  Almacén en memoria para PRUEBAS: los datos se pierden al reiniciar. No usar en el aula.');
    store = new MemoryStore();
  } else if (process.env.MONGODB_URI) {
    const mongo = new MongoStore(process.env.MONGODB_URI, process.env.MONGODB_DB ?? 'sobrevivir');
    try {
      await mongo.init();
      store = mongo;
      console.log('MongoDB conectado.');
    } catch (e) {
      storeError = `No se pudo conectar con MongoDB (${(e as Error).message}). Revise MONGODB_URI.`;
      console.error(storeError);
    }
  } else {
    storeError =
      'El modo conectado requiere MongoDB. Configure MONGODB_URI en .env y reinicie el servidor. La demostración local funciona sin servidor.';
    console.warn(storeError);
  }
  if (store && store.kind === 'memoria-pruebas') await store.init();

  const { http } = createApp({ store, storeError, staticDir });
  http.listen(PORT, HOST, () => {
    console.log(`Sobrevivir al mes — servidor en http://localhost:${PORT}`);
    if (existsSync(staticDir)) console.log('Sirviendo la aplicación web compilada.');
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
