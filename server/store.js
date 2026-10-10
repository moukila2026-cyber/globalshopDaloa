import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { products } from '../shared/products.js';

// Schéma PostgreSQL (Neon ou autre). Idempotent : sûr à exécuter à chaque démarrage à froid.
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
    async placeOrder({requestId, customer, payment, pricing}) {
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
          'INSERT INTO orders (id, request_id, reference, payload, total) VALUES ($1, $2, $3, $4, $5)',
          [id, requestId, reference, JSON.stringify({customer, payment, ...pricing}), pricing.total]
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

    close() {
      return pool.end();
    }
  };
  return store;
}
