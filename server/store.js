import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { products } from '../shared/products.js';
// Fuseau de référence de la boutique : la Côte d'Ivoire est à GMT (UTC+0) toute l'année.
// Tous les rapports de vente et l'affichage des commandes sont calculés dans ce fuseau explicite,
// afin de rester justes même si le serveur (ou Neon) tourne en UTC.
export const ABIDJAN_TIMEZONE = 'Africa/Abidjan';

// Schéma PostgreSQL (Neon ou autre). Idempotent : sûr à exécuter à chaque démarrage à froid.
// Migration strictement additive : aucune table, colonne ou donnée existante n'est supprimée.
export const schemaSql = `
CREATE TABLE IF NOT EXISTS stock (
  id text PRIMARY KEY,
  quantity integer NOT NULL CHECK (quantity >= 0)
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  reference text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  total integer NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nouvelle';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot text;
CREATE TABLE IF NOT EXISTS product_settings (
  id text PRIMARY KEY,
  price integer NOT NULL CHECK (price >= 0),
  compare_at_price integer CHECK (compare_at_price IS NULL OR compare_at_price > price),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_photos (
  product_id text NOT NULL,
  view text NOT NULL CHECK (view IN ('main', 'extra')),
  mime text NOT NULL,
  bytes bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, view)
);`;

// Verrou consultatif de session : évite que plusieurs instances serverless créent le schéma en même temps.
const SCHEMA_LOCK_KEY = 727001;

export class StockError extends Error {}

// Base absente ou injoignable : l'API répond 503 avec ce message (jamais de 500 muet).
export class DatabaseUnavailableError extends Error {
  constructor(message = 'Base de données indisponible. Réessayez dans quelques instants.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL est requis (chaîne de connexion PostgreSQL / Neon).');
  let host = '';
  try { host = new URL(connectionString).hostname; } catch { throw new Error('DATABASE_URL invalide.'); }
  const local = LOCAL_HOSTS.test(host);
  const pool = new pg.Pool({
    connectionString,
    // Neon : garder un pool réduit par instance serverless ; l'URL « -pooler » est recommandée.
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // TLS obligatoire hors développement local (Neon exige SSL).
    ssl: local ? false : {rejectUnauthorized: true}
  });
  // Une erreur sur un client inactif ne doit pas faire tomber le processus.
  pool.on('error', error => console.error('PostgreSQL pool error:', error.message));
  return pool;
}

export async function initializeDatabase(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [SCHEMA_LOCK_KEY]);
    await client.query(schemaSql);
    // Stock initial inséré uniquement si absent : les stocks déjà enregistrés ne sont jamais écrasés.
    for (const product of products) {
      await client.query('INSERT INTO stock (id, quantity) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [product.id, product.stock]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Colonnes de commande projetées pour l'espace de gestion : la date est convertie en heure d'Abidjan
// côté SQL, ainsi l'affichage reste juste quel que soit le fuseau de la base ou du serveur.
const ORDER_COLUMNS = `id, reference, status, delivery_slot, total, payload, created_at,
  to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS created_at_abidjan`;

const orderRow = row => ({
  id: row.id,
  reference: row.reference,
  status: row.status,
  deliverySlot: row.delivery_slot,
  total: row.total,
  createdAt: row.created_at.toISOString(),
  createdAtAbidjan: row.created_at_abidjan,
  customer: row.payload?.customer ?? null,
  lines: row.payload?.lines ?? []
});

const productSettingRow = row => ({
  id: row.id,
  price: row.price,
  compareAtPrice: row.compare_at_price,
  active: row.active,
  updatedAt: row.updated_at
});

export function createStore(pool) {
  let ready = null;

  // Initialisation mémorisée par instance ; en cas d'échec, la prochaine requête réessaie.
  function ensureReady() {
    ready ??= initializeDatabase(pool).catch(error => {
      ready = null;
      throw error;
    });
    return ready;
  }

  const store = {
    pool,
    ensureReady,

    async ping() {
      await pool.query('SELECT 1');
    },

    async listStock() {
      const {rows} = await pool.query('SELECT id, quantity FROM stock');
      return new Map(rows.map(row => [row.id, row.quantity]));
    },

    async findOrderByRequest(requestId) {
      const {rows} = await pool.query('SELECT reference, total FROM orders WHERE request_id = $1', [requestId]);
      return rows[0] ?? null;
    },

    // Crée la commande et réserve le stock dans une seule transaction.
    // Retourne {reference, total, created}. Idempotence assurée par la contrainte UNIQUE sur request_id.
    async placeOrder({requestId, customer, deliverySlot = null, payment, pricing}) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Verrouillage dans un ordre déterministe pour éviter les interblocages entre commandes concurrentes.
        const lines = [...pricing.lines].sort((a, b) => a.id.localeCompare(b.id));
        for (const line of lines) {
          const result = await client.query(
            'UPDATE stock SET quantity = quantity - $1 WHERE id = $2 AND quantity >= $1',
            [line.quantity, line.id]
          );
          if (result.rowCount !== 1) throw new StockError(`Stock insuffisant pour ${line.name}.`);
        }
        const id = randomUUID();
        const reference = `GS-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`;
        await client.query(
          // Le créneau est enregistré en colonne (requêtable pour l'organisation des tournées)
          // et rappelé dans la charge utile, qui reste la copie fidèle de la commande reçue.
          'INSERT INTO orders (id, request_id, reference, payload, total, delivery_slot) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, requestId, reference, JSON.stringify({customer, payment, deliverySlot, ...pricing}), pricing.total, deliverySlot]
        );
        await client.query('COMMIT');
        return {reference, total: pricing.total, created: true};
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        // Requête concurrente avec le même requestId : la transaction gagnante a déjà créé la commande.
        if (error.code === '23505' && error.constraint === 'orders_request_id_key') {
          const existing = await store.findOrderByRequest(requestId);
          if (existing) return {...existing, created: false};
        }
        throw error;
      } finally {
        client.release();
      }
    },

    // --- Espace de gestion (/admin) : catalogue, promotions, photos, commandes, ventes ---

    // Réglages catalogue (prix, prix barré, visibilité). Absence de ligne = valeurs de référence.
    async listProductSettings() {
      const {rows} = await pool.query('SELECT id, price, compare_at_price, active, updated_at FROM product_settings');
      return new Map(rows.map(row => [row.id, productSettingRow(row)]));
    },

    async saveProductSettings({id, price, compareAtPrice = null, active = true}) {
      const {rows} = await pool.query(
        `INSERT INTO product_settings (id, price, compare_at_price, active, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, compare_at_price = EXCLUDED.compare_at_price,
           active = EXCLUDED.active, updated_at = now()
         RETURNING id, price, compare_at_price, active, updated_at`,
        [id, price, compareAtPrice, active]
      );
      return productSettingRow(rows[0]);
    },

    // Photos produit stockées dans PostgreSQL : on ne renvoie ici que les dates, pas les octets.
    async listProductPhotos() {
      const {rows} = await pool.query('SELECT product_id, view, updated_at FROM product_photos');
      const photos = new Map();
      for (const row of rows) {
        photos.set(row.product_id, {...(photos.get(row.product_id) ?? {}), [row.view]: row.updated_at});
      }
      return photos;
    },

    async getProductPhoto({id, view}) {
      const {rows} = await pool.query('SELECT mime, bytes, updated_at FROM product_photos WHERE product_id = $1 AND view = $2', [id, view]);
      return rows[0] ?? null;
    },

    async saveProductPhoto({id, view, mime, bytes}) {
      const {rows} = await pool.query(
        `INSERT INTO product_photos (product_id, view, mime, bytes, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (product_id, view) DO UPDATE SET mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, updated_at = now()
         RETURNING updated_at`,
        [id, view, mime, bytes]
      );
      return {updatedAt: rows[0].updated_at};
    },

    async deleteProductPhoto({id, view}) {
      const result = await pool.query('DELETE FROM product_photos WHERE product_id = $1 AND view = $2', [id, view]);
      return result.rowCount;
    },

    async setStock(id, quantity) {
      const {rows} = await pool.query('UPDATE stock SET quantity = $2 WHERE id = $1 RETURNING id, quantity', [id, quantity]);
      return rows[0] ?? null;
    },

    async listOrders({status = null, limit = 200} = {}) {
      const {rows} = await pool.query(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT $2`,
        [status, limit]
      );
      return rows.map(orderRow);
    },

    // Change le statut d'une commande. Une annulation restitue le stock réservé,
    // dans la même transaction, pour ne jamais perdre ni dupliquer des quantités.
    async setOrderStatus({id, status}) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const {rows} = await client.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 FOR UPDATE`, [id]);
        const current = rows[0];
        if (!current) {
          await client.query('ROLLBACK');
          return null;
        }
        const previous = current.status;
        if (status === 'annulee' && previous !== 'annulee') {
          for (const line of [...(current.payload?.lines ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
            await client.query('UPDATE stock SET quantity = quantity + $2 WHERE id = $1', [line.id, line.quantity]);
          }
        }
        const updated = await client.query(`UPDATE orders SET status = $2 WHERE id = $1 RETURNING ${ORDER_COLUMNS}`, [id, status]);
        await client.query('COMMIT');
        return {...orderRow(updated.rows[0]), previousStatus: previous};
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

    // Ventes agrégées par jour civil d'Abidjan (les commandes annulées sont exclues du chiffre d'affaires).
    async salesByPeriod({from, to}) {
      const {rows} = await pool.query(
        `SELECT to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD') AS day,
                count(*)::int AS orders,
                coalesce(sum(total), 0)::int AS total
         FROM orders
         WHERE status <> 'annulee'
           AND created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}' >= $1::date
           AND created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}' < ($2::date + 1)
         GROUP BY 1
         ORDER BY 1`,
        [from, to]
      );
      return rows.map(row => ({date: row.day, orders: row.orders, total: row.total}));
    },

    close() {
      return pool.end();
    }
  };
  return store;
}
