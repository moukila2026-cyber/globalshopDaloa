// Import ponctuel : copie le stock et les commandes d'une ancienne base SQLite (data/shop.sqlite) vers PostgreSQL.
// Usage : SQLITE_PATH=/chemin/shop.sqlite DATABASE_URL=postgres://... node scripts/import-sqlite.js
// Nécessite Node.js 22.13+ (module node:sqlite). Ne pas exécuter pendant que l'ancienne version reçoit des commandes.
import { DatabaseSync } from 'node:sqlite';
import { createPool, initializeDatabase } from '../server/store.js';

const sqlitePath = process.env.SQLITE_PATH;
if (!sqlitePath) throw new Error('SQLITE_PATH est requis.');
const source = new DatabaseSync(sqlitePath, {readOnly: true});
const stock = source.prepare('SELECT id, quantity FROM stock').all();
const orders = source.prepare('SELECT id, request_id, reference, payload, total, created_at FROM orders ORDER BY created_at').all();
source.close();

const pool = createPool();
const client = await pool.connect();
try {
  await initializeDatabase(pool);
  // Protection : un second import écraserait le stock actuel avec les valeurs de l'ancienne base.
  const existing = await client.query('SELECT count(*)::int AS n FROM orders');
  if (existing.rows[0].n > 0) throw new Error('La base PostgreSQL contient déjà des commandes : import annulé.');
  await client.query('BEGIN');
  // Le stock de l'ancienne base fait foi : il remplace les valeurs initiales insérées par initializeDatabase().
  for (const row of stock) {
    await client.query('INSERT INTO stock (id, quantity) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET quantity = EXCLUDED.quantity', [row.id, row.quantity]);
  }
  let imported = 0;
  for (const order of orders) {
    // created_at SQLite = 'YYYY-MM-DD HH:MM:SS' en UTC.
    const createdAt = new Date(`${order.created_at.replace(' ', 'T')}Z`);
    const result = await client.query(
      'INSERT INTO orders (id, request_id, reference, payload, total, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING',
      [order.id, order.request_id, order.reference, order.payload, order.total, createdAt]
    );
    imported += result.rowCount;
  }
  await client.query('COMMIT');
  console.log(`Import terminé : ${stock.length} lignes de stock, ${imported} commande(s) importée(s) sur ${orders.length}.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
