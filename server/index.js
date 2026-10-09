import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
import { createPool, createStore } from './store.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';

const store = createStore(createPool());
// Démarrage explicite : une base injoignable ou mal configurée échoue immédiatement.
await store.ensureReady();

// En développement, Vite est chargé avant la création de l'app pour être monté avant le gestionnaire d'erreurs.
const vite = production ? null : await (await import('vite')).createServer({server: {middlewareMode: true, allowedHosts: true}, appType: 'spa'});

const app = createApp({
  store,
  production,
  frontend: app => {
    if (production) {
      app.use(express.static(resolve(root, 'dist')));
      app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
    } else {
      app.use(vite.middlewares);
    }
  }
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => console.log(`Global Shop Daloa listening on port ${port}`));

async function shutdown() {
  server.close();
  await vite?.close().catch(() => {});
  await store.close().catch(() => {});
  process.exit(0);
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
