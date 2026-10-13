import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {startTestDatabase} from './helpers/postgres.js';

const PASSWORD = 'mot-de-passe-admin-test';
const WHATSAPP = '+225 07 00 00 00 00';
const PORT = '3098';

// Environnement propre : PUBLIC_ORIGIN n'est pas défini (sinon la vérification d'origine
// refuserait les requêtes de test), et les variables d'administration sont explicites.
function childEnv(extra) {
  const env = {...process.env};
  delete env.PUBLIC_ORIGIN;
  return {...env, PORT, ...extra};
}

async function startServer(environment = {}) {
  const database = await startTestDatabase();
  const server = spawn(process.execPath, ['server/index.js'], {env: childEnv({DATABASE_URL: database.url, ...environment}), stdio: ['ignore', 'pipe', 'pipe']});
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Startup timeout')), 60000);
      server.stdout.on('data', data => {
        if (data.toString().includes('listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      server.on('exit', () => {
        clearTimeout(timeout);
        reject(Error('Server exited'));
      });
    });
  } catch (error) {
    await database.stop();
    throw error;
  }
  return {
    base: `http://localhost:${PORT}`,
    stop: async () => {
      server.kill();
      await new Promise(resolve => server.once('exit', resolve));
      await database.stop();
    }
  };
}

function request(base, path, {method = 'GET', token, body, origin, contentType} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !contentType) headers['Content-Type'] = 'application/json';
  if (contentType) headers['Content-Type'] = contentType;
  if (origin) headers.origin = origin;
  return fetch(`${base}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : contentType ? body : JSON.stringify(body)
  });
}

const login = async base => (await (await request(base, '/admin/session', {method: 'POST', body: {password: PASSWORD}})).json()).token;
const catalog = async (base, id) => (await (await fetch(`${base}/api/products`)).json()).find(product => product.id === id);

test('admin session protects client data and stays closed without ADMIN_PASSWORD', async () => {
  const {base, stop} = await startServer({ADMIN_PASSWORD: PASSWORD, WHATSAPP_NUMBER: WHATSAPP});
  try {
    // Configuration publique : numéro WhatsApp normalisé pour wa.me et créneaux de livraison.
    const config = await (await fetch(`${base}/api/config`)).json();
    assert.equal(config.whatsappNumber, '2250700000000');
    assert.equal(config.deliverySlots.length, 3);
    assert.match(config.deliverySlots[0], /^\d{2}:00 – \d{2}:00$/);

    // Sans jeton, les données client (commandes, produits) restent fermées.
    assert.equal((await request(base, '/admin/orders')).status, 401);
    assert.equal((await request(base, '/admin/products')).status, 401);

    // Mauvais mot de passe : refusé sans révéler de jeton.
    const wrong = await request(base, '/admin/session', {method: 'POST', body: {password: 'mauvais-mot-de-passe'}});
    assert.equal(wrong.status, 401);
    assert.equal((await wrong.json()).token, undefined);

    // Écriture depuis une autre origine : refusée avant toute vérification de mot de passe.
    assert.equal((await request(base, '/admin/session', {method: 'POST', body: {password: PASSWORD}, origin: 'https://evil.example'})).status, 403);

    // Bon mot de passe : jeton signé accepté, jeton falsifié refusé.
    const token = await login(base);
    assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal((await request(base, '/admin/orders', {token})).status, 200);
    assert.equal((await request(base, '/admin/orders', {token: `${token}x`})).status, 401);
    assert.equal((await request(base, '/admin/orders', {token: 'faux.jeton'})).status, 401);
  } finally {
    await stop();
  }

  // Sans ADMIN_PASSWORD, l'espace de gestion est explicitement indisponible (jamais ouvert).
  const closed = await startServer({WHATSAPP_NUMBER: WHATSAPP});
  try {
    assert.equal((await request(closed.base, '/admin/session', {method: 'POST', body: {password: PASSWORD}})).status, 503);
    assert.equal((await request(closed.base, '/admin/orders')).status, 503);
    // La boutique et le catalogue public restent pleinement disponibles.
    assert.equal((await fetch(`${closed.base}/api/products`)).status, 200);
  } finally {
    await closed.stop();
  }
});

test('admin prices carry an automatic promotion label and product photos live in PostgreSQL', async () => {
  const {base, stop} = await startServer({ADMIN_PASSWORD: PASSWORD, WHATSAPP_NUMBER: WHATSAPP});
  try {
    const token = await login(base);
    const {products} = await (await request(base, '/admin/products', {token})).json();
    assert.equal(products.length, 8);
    assert.ok(products.every(product => typeof product.stock === 'number' && product.active === true));

    // Prix barré enregistré : l'étiquette de promotion est calculée par le serveur, jamais saisie.
    const patched = await request(base, '/admin/products/casque', {token, method: 'PATCH', body: {price: 9000, oldPrice: 12000, stock: 7}});
    assert.equal(patched.status, 200);
    const {product} = await patched.json();
    assert.equal(product.price, 9000);
    assert.equal(product.badge, '−25 %');
    assert.equal(product.stock, 7);

    // Un prix barré inférieur ou égal au prix de vente est refusé, comme un produit inconnu.
    assert.equal((await request(base, '/admin/products/casque', {token, method: 'PATCH', body: {price: 9000, oldPrice: 9000}})).status, 400);
    assert.equal((await request(base, '/admin/products/inexistant', {token, method: 'PATCH', body: {price: 1000}})).status, 404);

    // Le catalogue public applique le prix, la promotion, le stock et masque les produits retirés.
    const afterPatch = await catalog(base, 'casque');
    assert.deepEqual({price: afterPatch.price, oldPrice: afterPatch.oldPrice, badge: afterPatch.badge, stock: afterPatch.stock}, {price: 9000, oldPrice: 12000, badge: '−25 %', stock: 7});
    assert.equal((await request(base, '/admin/products/montre', {token, method: 'PATCH', body: {active: false}})).status, 200);
    assert.equal(await catalog(base, 'montre'), undefined);

    // Photo produit stockée en PostgreSQL puis servie par l'API, sans fichier sur le disque.
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF-photo-produit-de-test'), Buffer.from([0xff, 0xd9])]);
    const upload = await request(base, '/admin/products/casque/photos/main', {token, method: 'PUT', body: jpeg, contentType: 'image/jpeg'});
    assert.equal(upload.status, 200);
    const {url} = await upload.json();
    assert.match(url, /^\/api\/products\/casque\/photo\/main\?v=\d+$/);
    const served = await fetch(`${base}${url}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/jpeg');
    assert.ok(Buffer.from(await served.arrayBuffer()).equals(jpeg), 'the stored bytes must be returned unchanged');
    const withPhoto = await catalog(base, 'casque');
    assert.equal(withPhoto.image, url);
    assert.equal(withPhoto.extra, '/images/products/casque-extra.jpg');

    // Un contenu qui n'est pas une image est refusé, même annoncé en image/jpeg.
    assert.equal((await request(base, '/admin/products/casque/photos/extra', {token, method: 'PUT', body: Buffer.from('pas une image'), contentType: 'image/jpeg'})).status, 400);
    assert.equal((await request(base, '/admin/products/casque/photos/main', {token, method: 'PUT', body: 'texte', contentType: 'text/plain'})).status, 415);

    // Suppression : le catalogue revient à la photo statique de public/.
    assert.equal((await request(base, '/admin/products/casque/photos/main', {token, method: 'DELETE'})).status, 200);
    assert.equal((await fetch(`${base}${url}`)).status, 404);
    assert.equal((await catalog(base, 'casque')).image, '/images/products/casque.jpg');
  } finally {
    await stop();
  }
});

test('orders keep their delivery slot, move through three columns and cancel restores stock', async () => {
  const {base, stop} = await startServer({ADMIN_PASSWORD: PASSWORD, WHATSAPP_NUMBER: WHATSAPP});
  try {
    const token = await login(base);
    const draft = {
      customer: {name: 'Client Test', phone: '0700000000', city: 'Daloa', address: 'Quartier Commerce'},
      items: [{id: 'casque', quantity: 2}],
      payment: 'cash',
      deliverySlot: '12:00 – 16:00',
      requestId: randomUUID()
    };

    // Créneau hors liste : la commande est refusée.
    assert.equal((await request(base, '/orders', {method: 'POST', body: {...draft, requestId: randomUUID(), deliverySlot: '23:00 – 02:00'}})).status, 400);

    const created = await request(base, '/orders', {method: 'POST', body: draft});
    assert.equal(created.status, 201);
    const {reference, total} = await created.json();

    const {orders} = await (await request(base, '/admin/orders', {token})).json();
    assert.equal(orders.length, 1);
    const [order] = orders;
    assert.equal(order.reference, reference);
    assert.equal(order.status, 'nouvelle');
    assert.equal(order.deliverySlot, '12:00 – 16:00');
    assert.equal(order.total, total);
    assert.equal(order.customer.name, 'Client Test');
    // Date projetée en heure d'Abidjan par le serveur, quel que soit le fuseau de la base.
    assert.match(order.createdAtAbidjan, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    // Colonne 1 → colonne 2 → colonne 3.
    const prepared = await request(base, `/admin/orders/${order.id}`, {token, method: 'PATCH', body: {status: 'en_preparation'}});
    assert.equal(prepared.status, 200);
    assert.equal((await prepared.json()).order.status, 'en_preparation');
    assert.equal((await request(base, `/admin/orders/${order.id}`, {token, method: 'PATCH', body: {status: 'livree'}})).status, 200);
    // Statuts et identifiants invalides restent des erreurs propres.
    assert.equal((await request(base, `/admin/orders/${order.id}`, {token, method: 'PATCH', body: {status: 'expediee'}})).status, 400);
    assert.equal((await request(base, '/admin/orders/11111111-2222-4333-8444-555555555555', {token, method: 'PATCH', body: {status: 'livree'}})).status, 404);
    assert.equal((await request(base, '/admin/orders/pas-un-uuid', {token, method: 'PATCH', body: {status: 'livree'}})).status, 404);
    assert.equal((await request(base, '/admin/orders?status=inconnu', {token})).status, 400);

    // Ventes par période : jours civils d'Abidjan, fuseau annoncé dans la réponse.
    const report = await (await request(base, '/admin/sales', {token})).json();
    assert.equal(report.timezone, 'Africa/Abidjan');
    assert.equal(report.totals.orders, 1);
    assert.equal(report.totals.total, total);
    const today = report.days.at(-1);
    assert.equal(today.orders, 1);
    assert.equal(today.total, total);
    assert.equal(today.date, order.createdAtAbidjan.slice(0, 10));
    // Période explicite et période invalide.
    const explicit = await (await request(base, `/admin/sales?from=${today.date}&to=${today.date}`, {token})).json();
    assert.deepEqual(explicit.days, [today]);
    assert.equal((await request(base, '/admin/sales?from=2026-13-40&to=2026-01-01', {token})).status, 400);

    // Annulation : le stock réservé est restitué et la commande sort du chiffre d'affaires.
    const before = (await catalog(base, 'lampe')).stock;
    const second = await (await request(base, '/orders', {method: 'POST', body: {...draft, requestId: randomUUID(), items: [{id: 'lampe', quantity: 2}]}})).json();
    assert.equal((await catalog(base, 'lampe')).stock, before - 2);
    const latest = (await (await request(base, '/admin/orders', {token})).json()).orders.find(item => item.reference === second.reference);
    assert.equal(latest.status, 'nouvelle');
    const cancelled = await request(base, `/admin/orders/${latest.id}`, {token, method: 'PATCH', body: {status: 'annulee'}});
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).order.previousStatus, 'nouvelle');
    assert.equal((await catalog(base, 'lampe')).stock, before);
    const afterCancel = await (await request(base, '/admin/sales', {token})).json();
    assert.equal(afterCancel.totals.orders, 1);
    assert.equal(afterCancel.totals.total, total);
    // Les commandes annulées restent visibles dans la colonne « Terminées ».
    assert.equal((await request(base, '/admin/orders?status=annulee', {token})).status, 200);
    assert.equal((await (await request(base, '/admin/orders?status=annulee', {token})).json()).orders.length, 1);
  } finally {
    await stop();
  }
});
