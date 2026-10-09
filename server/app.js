import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { products } from '../shared/products.js';
import { orderSchema, priceOrder } from './orders.js';
import { StockError } from './store.js';

// Construit l'application Express de l'API. Utilisée par le serveur local/Node (server/index.js)
// et par la fonction serverless Vercel (api/index.js). Les protections sont identiques dans les deux cas.
export function createApp({store, production = false, frontend} = {}) {
  if (!store) throw new Error('createApp: store requis.');
  const app = express();
  app.disable('x-powered-by');
  // Vercel et les proxys de confiance placent l'IP réelle dans X-Forwarded-For.
  if (process.env.TRUST_PROXY === '1' || process.env.VERCEL === '1') app.set('trust proxy', 1);
  app.use(helmet({contentSecurityPolicy: production ? {directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'"], fontSrc: ["'self'"],
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
  // Le schéma est vérifié/créé à la première requête de chaque instance (utile en serverless).
  const withDatabase = (req, res, next) => store.ensureReady().then(() => next(), next);

  app.get('/api/products', withDatabase, async (_req, res, next) => {
    try {
      const inventory = await store.listStock();
      res.json(products.map(p => ({...p, stock: inventory.get(p.id) ?? 0})));
    } catch (error) { next(error); }
  });
  app.get('/api/health', (_req, res) => res.json({status: 'ok'}));
  app.post('/api/orders', rateLimit({windowMs: 15 * 60000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: {error: 'Trop de tentatives. Réessayez dans quelques minutes.'}}), withDatabase, async (req, res, next) => {
    const result = orderSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({error: 'Vérifiez vos coordonnées et les produits de votre panier.'});
    try {
      const {requestId, customer, items, payment} = result.data;
      const old = await store.findOrderByRequest(requestId);
      if (old) return res.json({...old, duplicate: true});
      const pricing = priceOrder(items);
      const order = await store.placeOrder({requestId, customer, payment, pricing});
      if (!order.created) return res.json({reference: order.reference, total: order.total, duplicate: true});
      res.status(201).json({reference: order.reference, total: order.total});
    } catch (error) {
      if (error instanceof StockError || error.message === 'Produit introuvable.' || error.message.startsWith('Un produit')) return res.status(409).json({error: error.message});
      next(error);
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({error: 'Endpoint introuvable.'}));

  if (frontend) frontend(app);

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return res.status(400).json({error: 'Requête invalide.'});
    console.error('Server error:', error.message);
    res.status(500).json({error: 'Un problème est survenu. Veuillez réessayer.'});
  });
  return app;
}
