import test from 'node:test';
import assert from 'node:assert/strict';

// Charge la fonction serverless Vercel (api/index.js) avec une variable d'environnement donnée.
async function startServerlessApi(t, databaseUrl) {
  const saved = process.env.DATABASE_URL;
  if (databaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = databaseUrl;
  t.after(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  });
  // Le store est créé à la première requête : le module doit se charger même sans DATABASE_URL.
  const {default: app} = await import(`../api/index.js?case=${encodeURIComponent(String(databaseUrl))}`);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return `http://127.0.0.1:${server.address().port}/api`;
}

test('serverless API without DATABASE_URL: health stays 200 and products explain the 503', async t => {
  const api = await startServerlessApi(t, undefined);

  const health = await fetch(`${api}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {status: 'ok', database: 'unavailable'});

  const products = await fetch(`${api}/products`);
  assert.equal(products.status, 503);
  assert.match((await products.json()).error, /^Base de données non configurée/);
});

test('serverless API with an unreachable database answers 503 without leaking the connection string', async t => {
  const secret = 'postgres://gs_user:tres-secret@127.0.0.1:1/gs_db';
  const api = await startServerlessApi(t, secret);

  const health = await fetch(`${api}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {status: 'ok', database: 'unavailable'});

  const products = await fetch(`${api}/products`);
  const body = await products.text();
  assert.equal(products.status, 503);
  assert.match(body, /Base de données indisponible/);
  assert.doesNotMatch(body, /tres-secret|gs_user|127\.0\.0\.1:1/);
});
