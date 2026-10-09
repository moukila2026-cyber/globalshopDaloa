import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from '../shared/products.js';
import { orderSchema, priceOrder } from './orders.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';
const databasePath = process.env.DATABASE_PATH || resolve(root, 'data/shop.sqlite');
mkdirSync(dirname(databasePath), {recursive: true, mode: 0o700});
const db = new DatabaseSync(databasePath);
chmodSync(databasePath, 0o600);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS stock (id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity >= 0));
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, reference TEXT UNIQUE NOT NULL, payload TEXT NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
const initialize = db.prepare('INSERT OR IGNORE INTO stock (id, quantity) VALUES (?, ?)');
for (const p of products) initialize.run(p.id, p.stock);
const app = express();
app.disable('x-powered-by');
// Enable only when your deployment has a single trusted reverse proxy.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(helmet({contentSecurityPolicy: production ? {directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'https://images.unsplash.com', 'data:'], fontSrc: ["'self'"],
  connectSrc: ["'self'"], frameAncestors: ["'self'"], upgradeInsecureRequests: []
}} : false, crossOriginEmbedderPolicy: false, frameguard: production ? {action: 'sameorigin'} : false, strictTransportSecurity: production}));
app.use('/api', rateLimit({windowMs: 60000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false}));
app.use(express.json({limit: '16kb'}));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.get('origin');
    const allowedOrigin = process.env.PUBLIC_ORIGIN;
    if ((origin && (allowedOrigin ? origin !== allowedOrigin : new URL(origin).host !== req.get('host'))) || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({error: 'Origine non autorisée.'});
    if (!req.is('application/json')) return res.status(415).json({error: 'Format JSON requis.'});
  }
  next();
});
app.get('/api/products', (_req, res) => {
  const inventory = new Map(db.prepare('SELECT * FROM stock').all().map(p => [p.id, p.quantity]));
  res.json(products.map(p => ({...p, stock: inventory.get(p.id) ?? 0})));
});
app.get('/api/health', (_req, res) => res.json({status:'ok'}));
app.post('/api/orders', rateLimit({windowMs: 15 * 60000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: {error:'Trop de tentatives. Réessayez dans quelques minutes.'}}), (req, res, next) => {
  const result = orderSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({error: 'Vérifiez vos coordonnées et les produits de votre panier.'});
  try {
    const {requestId, customer, items, payment} = result.data;
    const old = db.prepare('SELECT reference, total FROM orders WHERE request_id = ?').get(requestId);
    if (old) return res.json({...old, duplicate: true});
    const pricing = priceOrder(items);
    db.exec('BEGIN IMMEDIATE');
    try {
      const decrement = db.prepare('UPDATE stock SET quantity = quantity - ? WHERE id = ? AND quantity >= ?');
      for (const line of pricing.lines) {
        const result = decrement.run(line.quantity, line.id, line.quantity);
        if (!result.changes) throw new Error(`Stock insuffisant pour ${line.name}.`);
      }
      const id = randomUUID();
      const reference = `GS-${new Date().getFullYear()}-${id.slice(0,8).toUpperCase()}`;
      db.prepare('INSERT INTO orders (id, request_id, reference, payload, total) VALUES (?, ?, ?, ?, ?)').run(id, requestId, reference, JSON.stringify({customer, payment, ...pricing}), pricing.total);
      db.exec('COMMIT');
      res.status(201).json({reference, total: pricing.total});
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } catch (error) {
    if (error.message.startsWith('Stock insuffisant') || error.message === 'Produit introuvable.' || error.message.startsWith('Un produit')) return res.status(409).json({error: error.message});
    next(error);
  }
});
app.use('/api', (_req, res) => res.status(404).json({error:'Endpoint introuvable.'}));
if (production) {
  app.use(express.static(resolve(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
} else {
  const {createServer} = await import('vite');
  const vite = await createServer({server:{middlewareMode:true, allowedHosts:true}, appType:'spa'});
  app.use(vite.middlewares);
}
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return res.status(400).json({error:'Requête invalide.'});
  console.error('Server error:', error.message);
  res.status(500).json({error:'Un problème est survenu. Veuillez réessayer.'});
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Global Shop Daloa listening on port ${port}`));
