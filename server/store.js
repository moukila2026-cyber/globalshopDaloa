import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { products } from '../shared/products.js';
import { canonicalIvorianPhone, orderStatusLabels } from './orders.js';
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
);
CREATE TABLE IF NOT EXISTS custom_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  compare_at_price integer CHECK (compare_at_price IS NULL OR compare_at_price > price),
  badge text NOT NULL DEFAULT 'NOUVEAU',
  color text NOT NULL DEFAULT 'Standard',
  description text NOT NULL DEFAULT '',
  specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  review text NOT NULL DEFAULT 'Sélection Global Shop Daloa.',
  rating numeric(2,1) NOT NULL DEFAULT 4.8,
  reviews integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'Admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_agents (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  role_label text NOT NULL DEFAULT 'Agent stock & catalogue',
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE TABLE IF NOT EXISTS store_events (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'boutique',
  actor text NOT NULL DEFAULT 'Visiteur',
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS visitor_heartbeats (
  session_id text PRIMARY KEY,
  page text NOT NULL DEFAULT '/',
  city text,
  cart_count integer NOT NULL DEFAULT 0,
  last_action text NOT NULL DEFAULT 'Navigation boutique',
  updated_at timestamptz NOT NULL DEFAULT now()
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

const customProductRow = row => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: row.price,
  oldPrice: row.compare_at_price,
  badge: row.badge,
  color: row.color,
  description: row.description,
  specs: Array.isArray(row.specs) && row.specs.length ? row.specs : ['Disponible chez Global Shop Daloa', 'Paiement à la livraison à Daloa et Bouaké'],
  review: row.review || 'Sélection Global Shop Daloa.',
  rating: Number(row.rating) || 4.8,
  reviews: Number(row.reviews) || 1,
  active: row.active,
  createdBy: row.created_by,
  createdAt: row.created_at?.toISOString?.() ?? null,
  updatedAt: row.updated_at?.toISOString?.() ?? null,
  custom: true,
  image: '/images/products/produit-indisponible.svg',
  extra: '/images/products/produit-indisponible.svg'
});

const agentRow = row => ({
  id: row.id,
  name: row.name,
  roleLabel: row.role_label,
  code: row.code,
  active: row.active,
  createdAt: row.created_at?.toISOString?.() ?? null,
  createdAtAbidjan: row.created_at_abidjan,
  lastUsedAt: row.last_used_at?.toISOString?.() ?? null,
  lastUsedAtAbidjan: row.last_used_at_abidjan ?? null
});

const eventRow = row => ({
  id: Number(row.id),
  type: row.type,
  category: row.category,
  actor: row.actor,
  title: row.title,
  detail: row.detail,
  meta: row.meta ?? {},
  createdAt: row.created_at?.toISOString?.() ?? null,
  createdAtAbidjan: row.created_at_abidjan
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

    // Suivi de commande côté acheteur : exige à la fois la référence exacte et le numéro de téléphone
    // utilisé lors de la commande (comparés sous forme canonique à 10 chiffres).
    async trackOrder({reference, phone}) {
      const {rows} = await pool.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE UPPER(reference) = UPPER($1)`, [reference]);
      const row = rows[0];
      if (!row) return null;
      const expectedPhone = canonicalIvorianPhone(row.payload?.customer?.phone ?? '');
      const candidatePhone = canonicalIvorianPhone(phone ?? '');
      if (!expectedPhone || expectedPhone !== candidatePhone) return null;
      return {
        reference: row.reference,
        status: row.status,
        statusLabel: orderStatusLabels[row.status] ?? row.status,
        deliverySlot: row.delivery_slot,
        total: row.total,
        subtotal: row.payload?.subtotal ?? row.total,
        delivery: row.payload?.delivery ?? 0,
        createdAt: row.created_at.toISOString(),
        createdAtAbidjan: row.created_at_abidjan,
        customer: {
          name: row.payload?.customer?.name ?? 'Client',
          city: row.payload?.customer?.city ?? ''
        },
        lines: (row.payload?.lines ?? []).map(line => ({
          id: line.id,
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice
        }))
      };
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
        await client.query(
          `INSERT INTO store_events (type, category, actor, title, detail, meta)
           VALUES ('order_created', 'commandes', $1, $2, $3, $4)`,
          [
            customer.name,
            `Nouvelle commande ${reference}`,
            `${pricing.lines.reduce((n, l) => n + l.quantity, 0)} article(s) · ${customer.city} · ${pricing.total} FCFA`,
            JSON.stringify({reference, total: pricing.total, city: customer.city, deliverySlot})
          ]
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

    // --- Espace de gestion (/admin) : catalogue, nouveaux produits, promotions, photos, commandes, ventes, agents, temps réel ---

    async listCustomProducts() {
      const {rows} = await pool.query(
        `SELECT id, name, category, price, compare_at_price, badge, color, description, specs, review,
                rating, reviews, active, created_by, created_at, updated_at
         FROM custom_products
         ORDER BY created_at DESC`
      );
      return rows.map(customProductRow);
    },

    async createCustomProduct({
      id,
      name,
      category,
      price,
      compareAtPrice = null,
      stock = 0,
      badge = 'NOUVEAU',
      color = 'Standard',
      description = '',
      specs = [],
      review = 'Sélection Global Shop Daloa.',
      rating = 4.8,
      reviews = 1,
      active = true,
      createdBy = 'Admin'
    }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const normalizedSpecs = Array.isArray(specs) && specs.length
          ? specs
          : ['Disponible chez Global Shop Daloa', 'Paiement à la livraison à Daloa et Bouaké'];
        const {rows} = await client.query(
          `INSERT INTO custom_products (
             id, name, category, price, compare_at_price, badge, color, description, specs,
             review, rating, reviews, active, created_by, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, now(), now())
           RETURNING id, name, category, price, compare_at_price, badge, color, description, specs,
                     review, rating, reviews, active, created_by, created_at, updated_at`,
          [id, name, category, price, compareAtPrice, badge, color, description, JSON.stringify(normalizedSpecs), review || 'Sélection Global Shop Daloa.', rating, reviews, active, createdBy]
        );
        await client.query(
          `INSERT INTO stock (id, quantity) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET quantity = EXCLUDED.quantity`,
          [id, stock]
        );
        await client.query(
          `INSERT INTO product_settings (id, price, compare_at_price, active, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, compare_at_price = EXCLUDED.compare_at_price,
             active = EXCLUDED.active, updated_at = now()`,
          [id, price, compareAtPrice, active]
        );
        await client.query(
          `INSERT INTO store_events (type, category, actor, title, detail, meta)
           VALUES ('product_created', 'stock', $1, $2, $3, $4)`,
          [
            createdBy,
            `Nouveau produit : ${name}`,
            `${category} · ${price} FCFA · Stock initial : ${stock}`,
            JSON.stringify({productId: id, name, category, price, stock})
          ]
        );
        await client.query('COMMIT');
        return customProductRow(rows[0]);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

    async updateCustomProduct({id, name, category, price, compareAtPrice, badge, color, description, specs, review, active}) {
      const {rows: existingRows} = await pool.query('SELECT * FROM custom_products WHERE id = $1', [id]);
      const current = existingRows[0];
      if (!current) return null;
      const nextPrice = price ?? current.price;
      const nextCompareAt = compareAtPrice === undefined ? current.compare_at_price : compareAtPrice;
      const nextSpecs = specs !== undefined
        ? (Array.isArray(specs) && specs.length ? specs : ['Disponible chez Global Shop Daloa'])
        : current.specs;
      const {rows} = await pool.query(
        `UPDATE custom_products
         SET name = $2,
             category = $3,
             price = $4,
             compare_at_price = $5,
             badge = $6,
             color = $7,
             description = $8,
             specs = $9::jsonb,
             review = $10,
             active = $11,
             updated_at = now()
         WHERE id = $1
         RETURNING id, name, category, price, compare_at_price, badge, color, description, specs,
                   review, rating, reviews, active, created_by, created_at, updated_at`,
        [
          id,
          name ?? current.name,
          category ?? current.category,
          nextPrice,
          nextCompareAt,
          badge ?? current.badge,
          color ?? current.color,
          description ?? current.description,
          JSON.stringify(nextSpecs),
          review ?? current.review,
          active ?? current.active
        ]
      );
      return customProductRow(rows[0]);
    },

    async deleteCustomProduct(id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const removed = await client.query('DELETE FROM custom_products WHERE id = $1 RETURNING id, name', [id]);
        if (removed.rowCount === 0) {
          await client.query('ROLLBACK');
          return null;
        }
        await client.query('DELETE FROM product_settings WHERE id = $1', [id]);
        await client.query('DELETE FROM product_photos WHERE product_id = $1', [id]);
        await client.query('DELETE FROM stock WHERE id = $1', [id]);
        await client.query('COMMIT');
        return removed.rows[0];
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

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
      const {rows} = await pool.query(
        `INSERT INTO stock (id, quantity) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET quantity = EXCLUDED.quantity
         RETURNING id, quantity`,
        [id, quantity]
      );
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
    async setOrderStatus({id, status, actor = 'Admin'}) {
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
        await client.query(
          `INSERT INTO store_events (type, category, actor, title, detail, meta)
           VALUES ('order_status', 'commandes', $1, $2, $3, $4)`,
          [
            actor,
            `Commande ${current.reference} → ${orderStatusLabels[status] ?? status}`,
            status === 'annulee' && previous !== 'annulee'
              ? `Ancien statut : ${orderStatusLabels[previous] ?? previous} · Stock restitué`
              : `Ancien statut : ${orderStatusLabels[previous] ?? previous}`,
            JSON.stringify({orderId: id, reference: current.reference, previousStatus: previous, status})
          ]
        );
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

    // --- Agents & codes d'accès uniques ---

    async listAgents() {
      const {rows} = await pool.query(
        `SELECT id, name, role_label, code, active, created_at, last_used_at,
                to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS created_at_abidjan,
                to_char(last_used_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS last_used_at_abidjan
         FROM admin_agents
         ORDER BY created_at DESC`
      );
      return rows.map(agentRow);
    },

    async createAgent({name, roleLabel = 'Agent stock & catalogue', generateCode, actor = 'Admin'}) {
      const {rows: existing} = await pool.query('SELECT code FROM admin_agents');
      const taken = new Set(existing.map(row => row.code));
      for (let attempt = 0; attempt < 15; attempt++) {
        const code = generateCode(taken);
        taken.add(code);
        const id = randomUUID();
        const {rows} = await pool.query(
          `INSERT INTO admin_agents (id, name, role_label, code, active, created_at)
           VALUES ($1, $2, $3, $4, true, now())
           ON CONFLICT (code) DO NOTHING
           RETURNING id, name, role_label, code, active, created_at, last_used_at,
                     to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS created_at_abidjan`,
          [id, name, roleLabel, code]
        );
        if (rows[0]) {
          await store.recordEvent({
            type: 'agent_created',
            category: 'equipe',
            actor,
            title: `Code agent généré pour ${name}`,
            detail: `${roleLabel} · Code unique attribué`,
            meta: {agentId: id, name, roleLabel}
          }).catch(() => {});
          return agentRow(rows[0]);
        }
      }
      throw new Error('Impossible de générer un code agent unique.');
    },

    async findAgentByCode(code) {
      const normalized = String(code ?? '').trim().toUpperCase();
      if (!normalized) return null;
      const {rows} = await pool.query(
        `UPDATE admin_agents
         SET last_used_at = now()
         WHERE UPPER(code) = $1 AND active = true
         RETURNING id, name, role_label, code, active, created_at, last_used_at,
                   to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS created_at_abidjan,
                   to_char(last_used_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS last_used_at_abidjan`,
        [normalized]
      );
      return rows[0] ? agentRow(rows[0]) : null;
    },

    async getAgentById(id) {
      const {rows} = await pool.query(
        `SELECT id, name, role_label, code, active, created_at, last_used_at,
                to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS created_at_abidjan,
                to_char(last_used_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI') AS last_used_at_abidjan
         FROM admin_agents
         WHERE id = $1`,
        [id]
      );
      return rows[0] ? agentRow(rows[0]) : null;
    },

    async revokeAgent(id, actor = 'Admin') {
      const {rows} = await pool.query(
        `DELETE FROM admin_agents WHERE id = $1 RETURNING id, name, code`,
        [id]
      );
      if (rows[0]) {
        await store.recordEvent({
          type: 'agent_revoked',
          category: 'equipe',
          actor,
          title: `Code agent révoqué : ${rows[0].name}`,
          detail: 'L’agent ne peut plus se connecter avec ce code.',
          meta: {agentId: id, name: rows[0].name}
        }).catch(() => {});
      }
      return rows[0] ?? null;
    },

    // --- Suivi en temps réel (événements & visiteurs actifs) ---

    async recordEvent({type, category = 'boutique', actor = 'Visiteur', title, detail = '', meta = {}}) {
      const {rows} = await pool.query(
        `INSERT INTO store_events (type, category, actor, title, detail, meta, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
         RETURNING id, type, category, actor, title, detail, meta, created_at,
                   to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at_abidjan`,
        [type, category, actor, title, detail, JSON.stringify(meta ?? {})]
      );
      return eventRow(rows[0]);
    },

    async touchVisitor({sessionId, page = '/', city = null, cartCount = 0, lastAction = 'Navigation boutique'}) {
      await pool.query(
        `INSERT INTO visitor_heartbeats (session_id, page, city, cart_count, last_action, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (session_id) DO UPDATE
         SET page = EXCLUDED.page,
             city = COALESCE(EXCLUDED.city, visitor_heartbeats.city),
             cart_count = EXCLUDED.cart_count,
             last_action = EXCLUDED.last_action,
             updated_at = now()`,
        [sessionId, page, city, cartCount, lastAction]
      );
    },

    async getRealtimeOverview({limit = 60, category = null, sinceId = null} = {}) {
      const [eventsResult, visitorsResult, ordersSummaryResult, clockResult] = await Promise.all([
        pool.query(
          `SELECT id, type, category, actor, title, detail, meta, created_at,
                  to_char(created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at_abidjan
           FROM store_events
           WHERE ($1::text IS NULL OR category = $1)
             AND ($2::bigint IS NULL OR id > $2)
           ORDER BY id DESC
           LIMIT $3`,
          [category, sinceId, Math.min(Math.max(Number(limit) || 60, 1), 200)]
        ),
        pool.query(
          `SELECT session_id, page, city, cart_count, last_action, updated_at,
                  to_char(updated_at AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'HH24:MI:SS') AS updated_at_abidjan
           FROM visitor_heartbeats
           WHERE updated_at >= now() - interval '5 minutes'
           ORDER BY updated_at DESC
           LIMIT 50`
        ),
        pool.query(
          `SELECT
             count(*) FILTER (WHERE status = 'nouvelle')::int AS pending_orders,
             count(*) FILTER (WHERE status = 'en_preparation')::int AS preparing_orders,
             count(*) FILTER (WHERE status = 'livree')::int AS delivered_orders,
             count(*) FILTER (WHERE status = 'annulee')::int AS cancelled_orders,
             count(*) FILTER (
               WHERE status <> 'annulee'
                 AND (created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}')::date = (now() AT TIME ZONE '${ABIDJAN_TIMEZONE}')::date
             )::int AS today_orders,
             coalesce(sum(total) FILTER (
               WHERE status <> 'annulee'
                 AND (created_at AT TIME ZONE '${ABIDJAN_TIMEZONE}')::date = (now() AT TIME ZONE '${ABIDJAN_TIMEZONE}')::date
             ), 0)::int AS today_revenue
           FROM orders`
        ),
        pool.query(`SELECT to_char(now() AT TIME ZONE '${ABIDJAN_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI:SS') AS now_abidjan`)
      ]);

      const orderStats = ordersSummaryResult.rows[0] ?? {};
      const activeVisitors = visitorsResult.rows.map(row => ({
        sessionId: row.session_id.slice(0, 8),
        page: row.page,
        city: row.city,
        cartCount: row.cart_count,
        lastAction: row.last_action,
        updatedAtAbidjan: row.updated_at_abidjan
      }));

      return {
        timezone: ABIDJAN_TIMEZONE,
        serverTimeAbidjan: clockResult.rows[0]?.now_abidjan ?? '',
        visitors: {
          online: activeVisitors.length,
          activeCarts: activeVisitors.filter(v => v.cartCount > 0).length,
          sessions: activeVisitors
        },
        orders: {
          pending: orderStats.pending_orders ?? 0,
          preparing: orderStats.preparing_orders ?? 0,
          delivered: orderStats.delivered_orders ?? 0,
          cancelled: orderStats.cancelled_orders ?? 0,
          todayOrders: orderStats.today_orders ?? 0,
          todayRevenue: orderStats.today_revenue ?? 0
        },
        events: eventsResult.rows.map(eventRow)
      };
    },

    close() {
      return pool.end();
    }
  };
  return store;
}
