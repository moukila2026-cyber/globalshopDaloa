// Espace de gestion (/admin) : authentification, commandes, catalogue, photos et rapports de vente.
// Les règles sont volontairement simples et vérifiables : un mot de passe unique côté serveur,
// un jeton de session signé, aucune donnée client exposée sans jeton.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { products } from '../shared/products.js';
import { deliverySlots, orderStatuses } from './orders.js';
import { ABIDJAN_TIMEZONE } from './store.js';

export const PHOTO_VIEWS = ['main', 'extra'];
// Deux mégaoctets : suffisant pour une photo produit recompressée, assez bas pour rester sain en serverless.
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Étiquette de promotion calculée automatiquement à partir du prix barré : jamais saisie à la main,
// donc jamais incohérente avec les prix enregistrés. Le signe moins est celui des étiquettes existantes.
export function promotionLabel(price, compareAtPrice) {
  if (!Number.isFinite(price) || !Number.isFinite(compareAtPrice) || compareAtPrice <= price) return '';
  const rate = Math.round((1 - price / compareAtPrice) * 100);
  return rate > 0 ? `−${rate} %` : '';
}

// Les anciennes étiquettes de promotion de `shared/products.js` (« −21 % ») sont recalculées :
// elles ne doivent pas survivre à un changement de prix décidé dans l'espace de gestion.
const PROMOTION_BADGE = /^[−-]\s*\d{1,3}\s*%$/;

function badgeFor(product, price, oldPrice) {
  const label = promotionLabel(price, oldPrice);
  if (label) return label;
  return PROMOTION_BADGE.test(product.badge ?? '') ? '' : product.badge;
}

// Numéro utilisable dans un lien wa.me : indicatif pays, sans « + » ni espaces.
// Un numéro local ivoirien à 10 chiffres (ex. 07 00 00 00 00) reçoit l'indicatif 225.
export function normalizeWhatsappNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^00/, '');
  if (!digits) return '';
  return digits.length === 10 ? `225${digits}` : digits;
}

// URL publique d'une photo stockée en base. Le paramètre `v` sert de cache-busting : une nouvelle
// photo change d'URL et le navigateur ne peut pas servir l'ancienne image.
export function productPhotoUrl(id, view, updatedAt) {
  const stamp = updatedAt ? new Date(updatedAt).getTime() : 0;
  return `/api/products/${encodeURIComponent(id)}/photo/${view}?v=${Number.isFinite(stamp) ? stamp : 0}`;
}

// Fusionne le catalogue de référence avec les réglages, stocks et photos enregistrés en base.
export function mergeCatalog({settings = new Map(), stock = new Map(), photos = new Map(), includeInactive = false} = {}) {
  return products
    .filter(product => includeInactive || (settings.get(product.id)?.active ?? true))
    .map(product => {
      const setting = settings.get(product.id);
      const price = setting?.price ?? product.price;
      const oldPrice = setting ? setting.compareAtPrice : product.oldPrice;
      const photo = photos.get(product.id) ?? {};
      return {
        ...product,
        price,
        oldPrice,
        badge: badgeFor(product, price, oldPrice),
        active: setting?.active ?? true,
        stock: stock.get(product.id) ?? 0,
        image: photo.main ? productPhotoUrl(product.id, 'main', photo.main) : product.image,
        extra: photo.extra ? productPhotoUrl(product.id, 'extra', photo.extra) : product.extra
      };
    });
}

// --- Jeton de session ------------------------------------------------------------------
// Le jeton est signé (HMAC-SHA-256). ADMIN_SECRET sert de clé de signature s'il est fourni ;
// sinon la clé est dérivée de ADMIN_PASSWORD : changer le mot de passe invalide alors les sessions.

function signingKey() {
  const material = process.env.ADMIN_SECRET || `password:${process.env.ADMIN_PASSWORD ?? ''}`;
  return createHash('sha256').update(`globalshop-admin-v1:${material}`).digest();
}

// Comparaison à temps constant : on compare des empreintes de taille fixe.
function sameSecret(candidate, expected) {
  const left = createHash('sha256').update(String(candidate ?? '')).digest();
  const right = createHash('sha256').update(String(expected ?? '')).digest();
  return timingSafeEqual(left, right);
}

export function issueSessionToken(now = Date.now()) {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({exp: expiresAt})).toString('base64url');
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return {token: `${payload}.${signature}`, expiresAt};
}

export function verifySessionToken(token, now = Date.now()) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const {exp} = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(exp) && exp > now;
  } catch {
    return false;
  }
}

// --- Aide aux rapports ------------------------------------------------------------------

// Jour civil d'Abidjan (AAAA-MM-JJ) décalé de `offsetDays`. Calculé sur le fuseau explicite.
export function abidjanDate(offsetDays = 0, now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone: ABIDJAN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'})
    .formatToParts(new Date(now + offsetDays * 86_400_000))
    .map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Liste des jours d'une période, bornée pour éviter les requêtes démesurées.
export function periodDays(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const count = Math.round((end - start) / 86_400_000) + 1;
  if (count > 366) return null;
  return Array.from({length: count}, (_, index) => new Date(start + index * 86_400_000).toISOString().slice(0, 10));
}

// Type réel du fichier, déduit de sa signature : le type annoncé par le client n'est jamais cru.
export function sniffImage(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

const statusSchema = z.object({status: z.enum(orderStatuses)});
const productPatchSchema = z.object({
  price: z.number().int().min(0).max(50_000_000).optional(),
  oldPrice: z.number().int().min(0).max(50_000_000).nullable().optional(),
  active: z.boolean().optional(),
  stock: z.number().int().min(0).max(1_000_000).optional()
}).strict();

export function createAdminRouter({store}) {
  const router = express.Router();
  const byId = new Map(products.map(product => [product.id, product]));

  // Connexion : limitée en débit, et désactivée si ADMIN_PASSWORD n'est pas configuré.
  router.post('/session', rateLimit({windowMs: 15 * 60000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: {error: 'Trop de tentatives. Réessayez dans quelques minutes.'}}), (req, res) => {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) return res.status(503).json({error: 'Espace de gestion non configuré : ADMIN_PASSWORD est absent.'});
    if (!sameSecret(req.body?.password, password)) return res.status(401).json({error: 'Mot de passe incorrect.'});
    res.json(issueSessionToken());
  });

  // Tout le reste de l'espace de gestion exige un jeton valide.
  router.use((req, res, next) => {
    if (!process.env.ADMIN_PASSWORD) return res.status(503).json({error: 'Espace de gestion non configuré : ADMIN_PASSWORD est absent.'});
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!verifySessionToken(token)) return res.status(401).json({error: 'Session expirée ou invalide. Reconnectez-vous.'});
    next();
  });

  router.get('/orders', async (req, res, next) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : null;
      if (status && !orderStatuses.includes(status)) return res.status(400).json({error: 'Statut inconnu.'});
      res.json({orders: await store.listOrders({status})});
    } catch (error) { next(error); }
  });

  router.patch('/orders/:id', async (req, res, next) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Statut de commande invalide.'});
    try {
      const order = await store.setOrderStatus({id: req.params.id, status: parsed.data.status});
      if (!order) return res.status(404).json({error: 'Commande introuvable.'});
      res.json({order});
    } catch (error) {
      // Identifiant qui n'est pas un UUID : la requête SQL échoue, on répond 404 plutôt qu'une 500.
      if (error.code === '22P02') return res.status(404).json({error: 'Commande introuvable.'});
      next(error);
    }
  });

  router.get('/products', async (_req, res, next) => {
    try {
      const [settings, stock, photos] = await Promise.all([store.listProductSettings(), store.listStock(), store.listProductPhotos()]);
      res.json({
        products: mergeCatalog({settings, stock, photos, includeInactive: true}).map(product => ({
          ...product,
          photoUpdatedAt: photos.get(product.id) ?? {}
        })),
        deliverySlots,
        whatsappNumber: normalizeWhatsappNumber(process.env.WHATSAPP_NUMBER)
      });
    } catch (error) { next(error); }
  });

  router.patch('/products/:id', async (req, res, next) => {
    const product = byId.get(req.params.id);
    if (!product) return res.status(404).json({error: 'Produit introuvable.'});
    const parsed = productPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Valeurs de produit invalides.'});
    const {price, oldPrice, active, stock} = parsed.data;
    if (price === undefined && oldPrice === undefined && active === undefined && stock === undefined) {
      return res.status(400).json({error: 'Aucune modification transmise.'});
    }
    try {
      const [settings, inventory] = await Promise.all([store.listProductSettings(), store.listStock()]);
      const current = settings.get(product.id);
      const nextPrice = price ?? current?.price ?? product.price;
      const nextOldPrice = oldPrice === undefined ? (current ? current.compareAtPrice : product.oldPrice) : oldPrice;
      if (nextOldPrice !== null && nextOldPrice !== undefined && nextOldPrice <= nextPrice) {
        return res.status(400).json({error: 'Le prix barré doit être supérieur au prix de vente.'});
      }
      if (price !== undefined || oldPrice !== undefined || active !== undefined) {
        await store.saveProductSettings({id: product.id, price: nextPrice, compareAtPrice: nextOldPrice ?? null, active: active ?? current?.active ?? true});
      }
      if (stock !== undefined) {
        const updated = await store.setStock(product.id, stock);
        if (!updated) throw new Error(`Stock introuvable pour ${product.id}.`);
      }
      const [nextSettings, nextStock, photos] = await Promise.all([store.listProductSettings(), store.listStock(), store.listProductPhotos()]);
      const merged = mergeCatalog({settings: nextSettings, stock: nextStock, photos, includeInactive: true}).find(item => item.id === product.id);
      res.json({product: {...merged, photoUpdatedAt: photos.get(product.id) ?? {}}});
    } catch (error) { next(error); }
  });

  const photoBody = express.raw({type: ['image/jpeg', 'image/png', 'image/webp'], limit: PHOTO_MAX_BYTES});

  router.put('/products/:id/photos/:view', photoBody, async (req, res, next) => {
    const product = byId.get(req.params.id);
    if (!product) return res.status(404).json({error: 'Produit introuvable.'});
    if (!PHOTO_VIEWS.includes(req.params.view)) return res.status(400).json({error: 'Vue photo inconnue.'});
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer?.length) return res.status(415).json({error: 'Photo JPEG, PNG ou WebP requise.'});
    if (buffer.length > PHOTO_MAX_BYTES) return res.status(413).json({error: 'Photo trop volumineuse (2 Mo maximum).'});
    const mime = sniffImage(buffer);
    if (!mime) return res.status(400).json({error: 'Fichier image illisible : JPEG, PNG ou WebP attendu.'});
    try {
      const saved = await store.saveProductPhoto({id: product.id, view: req.params.view, mime, bytes: buffer});
      res.json({url: productPhotoUrl(product.id, req.params.view, saved.updatedAt), view: req.params.view, bytes: buffer.length});
    } catch (error) { next(error); }
  });

  router.delete('/products/:id/photos/:view', async (req, res, next) => {
    if (!PHOTO_VIEWS.includes(req.params.view)) return res.status(400).json({error: 'Vue photo inconnue.'});
    try {
      const removed = await store.deleteProductPhoto({id: req.params.id, view: req.params.view});
      if (!removed) return res.status(404).json({error: 'Aucune photo à supprimer pour cette vue.'});
      res.json({removed});
    } catch (error) { next(error); }
  });

  router.get('/sales', async (req, res, next) => {
    const from = typeof req.query.from === 'string' && req.query.from ? req.query.from : abidjanDate(-29);
    const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : abidjanDate(0);
    if (!DAY.test(from) || !DAY.test(to)) return res.status(400).json({error: 'Dates attendues au format AAAA-MM-JJ.'});
    const days = periodDays(from, to);
    if (!days) return res.status(400).json({error: 'Période invalide (366 jours maximum).'});
    try {
      const rows = await store.salesByPeriod({from, to});
      const byDate = new Map(rows.map(row => [row.date, row]));
      const report = days.map(date => byDate.get(date) ?? {date, orders: 0, total: 0});
      res.json({
        timezone: ABIDJAN_TIMEZONE,
        from,
        to,
        days: report,
        totals: report.reduce((sum, day) => ({orders: sum.orders + day.orders, total: sum.total + day.total}), {orders: 0, total: 0})
      });
    } catch (error) { next(error); }
  });

  return router;
}
