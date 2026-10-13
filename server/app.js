import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  deliverySlots,
  orderSchema,
  orderStatusLabels,
  orderTrackingSchema,
  orderTrackingValidationError,
  orderValidationError,
  priceOrder
} from './orders.js';
import { createAdminRouter, mergeCatalog, normalizeWhatsappNumber, PHOTO_VIEWS } from './admin.js';
import { DatabaseUnavailableError, StockError } from './store.js';

const validProductId = /^[a-zA-Z0-9_-]{1,64}$/;
// Téléversement d'une photo produit : la seule écriture de l'API qui n'est pas du JSON.
// Le chemin et le type sont vérifiés, et le contenu réel est validé dans server/admin.js.
const photoUploadPath = /^\/admin\/products\/[a-zA-Z0-9_-]+\/photos\/(?:main|extra)$/;

const storefrontEventSchema = z.object({
  sessionId: z.string().trim().min(6).max(64),
  type: z.enum(['visit', 'product_view', 'cart_add', 'cart_remove', 'checkout_start', 'search']),
  page: z.string().trim().max(120).optional().default('/'),
  city: z.string().trim().max(40).nullable().optional().default(null),
  cartCount: z.number().int().min(0).max(200).optional().default(0),
  title: z.string().trim().min(2).max(140),
  detail: z.string().trim().max(240).optional().default(''),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({})
}).strict();

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
  app.use('/api', rateLimit({windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false}));
  app.use(express.json({limit: '16kb'}));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const origin = req.get('origin');
      const allowedOrigin = process.env.PUBLIC_ORIGIN;
      if ((origin && (allowedOrigin ? origin !== allowedOrigin : new URL(origin).host !== req.get('host'))) || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({error: 'Origine non autorisée.'});
      const imageUpload = req.method === 'PUT' && photoUploadPath.test(req.path) && /^image\/(?:jpeg|png|webp)$/.test(req.get('content-type') ?? '');
      // Un DELETE sans corps est légitime (la cible est dans l'URL) : il n'y a rien à parser.
      const bodylessDelete = req.method === 'DELETE' && !req.get('content-length') && !req.get('transfer-encoding');
      if (!req.is('application/json') && !imageUpload && !bodylessDelete) return res.status(415).json({error: 'Format JSON requis.'});
    }
    next();
  });
  // Le schéma est vérifié/créé à la première requête de chaque instance (utile en serverless).
  // Une base absente ou injoignable donne une 503 explicite, au lieu d'une erreur 500 silencieuse.
  const withDatabase = (req, res, next) => store.ensureReady().then(() => next(), error => {
    console.error('Database unavailable:', error.message);
    next(error instanceof DatabaseUnavailableError ? error : new DatabaseUnavailableError());
  });

  // Informations publiques du site : numéro WhatsApp de la boutique et créneaux de livraison.
  // Volontairement indépendantes de la base : même si PostgreSQL est indisponible, le lien wa.me
  // et les créneaux du formulaire restent affichés.
  app.get('/api/config', (_req, res) => res.json({
    whatsappNumber: normalizeWhatsappNumber(process.env.WHATSAPP_NUMBER),
    deliverySlots
  }));
  // Catalogue : produits de référence et nouveaux produits fusionnés avec les prix, promotions,
  // stocks et photos enregistrés dans l'espace de gestion. Les produits masqués en sont retirés.
  app.get('/api/products', withDatabase, async (_req, res, next) => {
    try {
      const [settings, stock, photos, customProducts] = await Promise.all([
        store.listProductSettings(),
        store.listStock(),
        store.listProductPhotos(),
        store.listCustomProducts ? store.listCustomProducts() : Promise.resolve([])
      ]);
      res.json(mergeCatalog({settings, stock, photos, customProducts}));
    } catch (error) { next(error); }
  });
  // Photo produit stockée dans PostgreSQL (bytea). Repli sur les fichiers statiques de public/ :
  // `mergeCatalog` ne renvoie cette URL que lorsqu'une photo a réellement été téléversée.
  app.get('/api/products/:id/photo/:view', withDatabase, async (req, res, next) => {
    const {id, view} = req.params;
    if (!validProductId.test(id) || !PHOTO_VIEWS.includes(view)) return res.status(404).json({error: 'Photo introuvable.'});
    try {
      const photo = await store.getProductPhoto({id, view});
      if (!photo) return res.status(404).json({error: 'Aucune photo enregistrée pour cette vue.'});
      res.set('Content-Type', photo.mime);
      // L'URL contient un paramètre de version : un cache court ne peut pas servir une photo remplacée.
      res.set('Cache-Control', 'public, max-age=300');
      res.send(photo.bytes);
    } catch (error) { next(error); }
  });
  // Diagnostic : répond toujours 200 ; `database` indique si PostgreSQL répond (voir README, section diagnostic).
  app.get('/api/health', async (_req, res) => {
    const database = await store.ensureReady().then(() => store.ping()).then(() => 'ok', () => 'unavailable');
    res.json({status: 'ok', database});
  });

  // Suivi de commande acheteur par référence et téléphone (« Suivre ma commande »).
  const trackOrderLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {error: 'Trop de recherches de suivi. Réessayez dans quelques minutes.'}
  });
  const handleTrackOrder = async (req, res, next) => {
    const input = req.method === 'GET'
      ? {reference: req.query.reference, phone: req.query.phone}
      : req.body;
    const result = orderTrackingSchema.safeParse(input);
    if (!result.success) {
      return res.status(400).json({error: orderTrackingValidationError(result.error.issues)});
    }
    try {
      const order = await store.trackOrder(result.data);
      if (!order) {
        return res.status(404).json({error: 'Aucune commande trouvée avec cette référence et ce numéro de téléphone.'});
      }
      if (store.recordEvent) {
        store.recordEvent({
          type: 'order_tracked',
          category: 'commandes',
          actor: order.customer?.name || 'Acheteur',
          title: `Suivi consulté : ${order.reference}`,
          detail: `Statut affiché : ${orderStatusLabels[order.status] ?? order.status}`,
          meta: {reference: order.reference, status: order.status}
        }).catch(() => {});
      }
      res.json({
        order: {
          ...order,
          statusLabel: orderStatusLabels[order.status] ?? order.status
        }
      });
    } catch (error) { next(error); }
  };
  app.get('/api/orders/track', trackOrderLimit, withDatabase, handleTrackOrder);
  app.post('/api/orders/track', trackOrderLimit, withDatabase, handleTrackOrder);

  // Télémétrie temps réel de la boutique (visiteurs en ligne, vues produit, paniers actifs).
  app.post('/api/events', rateLimit({windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false}), withDatabase, async (req, res, next) => {
    const parsed = storefrontEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Événement invalide.'});
    const {sessionId, type, page, city, cartCount, title, detail, meta} = parsed.data;
    try {
      if (store.touchVisitor) {
        await store.touchVisitor({sessionId, page, city, cartCount, lastAction: title});
      }
      if (type !== 'visit' && store.recordEvent) {
        await store.recordEvent({
          type,
          category: 'visiteurs',
          actor: `Visiteur #${sessionId.slice(0, 6)}`,
          title,
          detail,
          meta
        });
      }
      res.status(202).json({ok: true});
    } catch (error) { next(error); }
  });

  app.post('/api/orders', rateLimit({windowMs: 15 * 60000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: {error: 'Trop de tentatives. Réessayez dans quelques minutes.'}}), withDatabase, async (req, res, next) => {
    const result = orderSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({error: orderValidationError(result.error.issues)});
    try {
      const {requestId, customer, items, payment, deliverySlot} = result.data;
      const old = await store.findOrderByRequest(requestId);
      if (old) return res.json({...old, duplicate: true});
      const [settings, stock, photos, customProducts] = await Promise.all([
        store.listProductSettings(),
        store.listStock(),
        store.listProductPhotos(),
        store.listCustomProducts ? store.listCustomProducts() : Promise.resolve([])
      ]);
      const catalog = mergeCatalog({settings, stock, photos, customProducts});
      const pricing = priceOrder(items, catalog);
      const order = await store.placeOrder({requestId, customer, payment, deliverySlot, pricing});
      if (!order.created) return res.json({reference: order.reference, total: order.total, duplicate: true});
      res.status(201).json({reference: order.reference, total: order.total});
    } catch (error) {
      if (error instanceof StockError || error.message === 'Produit introuvable.' || error.message.startsWith('Un produit')) return res.status(409).json({error: error.message});
      next(error);
    }
  });
  app.use('/api/admin', createAdminRouter({store}));
  app.use('/api', (_req, res) => res.status(404).json({error: 'Endpoint introuvable.'}));

  if (frontend) frontend(app);

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return res.status(400).json({error: 'Requête invalide.'});
    if (error instanceof DatabaseUnavailableError) return res.status(503).json({error: error.message});
    console.error('Server error:', error.message);
    res.status(500).json({error: 'Un problème est survenu. Veuillez réessayer.'});
  });
  return app;
}
