// Espace de gestion (/admin) : authentification (Admin + Agents par code unique), commandes,
// catalogue (produits de référence et nouveaux produits), photos, rapports de vente et suivi en temps réel.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { products } from '../shared/products.js';
import { deliverySlots, orderStatuses } from './orders.js';
import { ABIDJAN_TIMEZONE } from './store.js';

export const PHOTO_VIEWS = ['main', 'extra'];
// Deux mégaoctets : suffisant pour une photo produit recompressée, assez bas pour rester sain en serverless.
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const AGENT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Génère un code d'accès aléatoire unique pour un agent (format AGT-XXXX-XXXX).
// Vérifie l'ensemble `existingCodes` fourni en plus de la contrainte UNIQUE PostgreSQL :
// deux agents ne peuvent jamais recevoir le même code.
export function generateAgentCode(existingCodes = new Set()) {
  const known = existingCodes instanceof Set ? existingCodes : new Set(existingCodes);
  for (let attempt = 0; attempt < 100; attempt++) {
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += AGENT_CODE_ALPHABET[randomInt(0, AGENT_CODE_ALPHABET.length)];
      part2 += AGENT_CODE_ALPHABET[randomInt(0, AGENT_CODE_ALPHABET.length)];
    }
    const code = `AGT-${part1}-${part2}`;
    if (!known.has(code)) return code;
  }
  throw new Error('Impossible de générer un code agent unique.');
}

// Transforme le nom d'un nouveau produit en identifiant URL lisible et unique.
export function slugifyProductId(name, takenIds = new Set()) {
  const base = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'produit';
  if (!takenIds.has(base)) return base;
  let suffix = 2;
  while (takenIds.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

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
  return PROMOTION_BADGE.test(product.badge ?? '') ? '' : (product.badge ?? '');
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

// Fusionne le catalogue de référence et les nouveaux produits créés en base avec les réglages,
// stocks et photos enregistrés dans PostgreSQL.
export function mergeCatalog({settings = new Map(), stock = new Map(), photos = new Map(), customProducts = [], includeInactive = false} = {}) {
  const referenceIds = new Set(products.map(p => p.id));
  const extraProducts = Array.isArray(customProducts)
    ? customProducts.filter(p => p && !referenceIds.has(p.id))
    : [];
  const allProducts = [...products, ...extraProducts];

  return allProducts
    .filter(product => {
      const active = settings.has(product.id) ? settings.get(product.id).active : (product.active ?? true);
      return includeInactive || active;
    })
    .map(product => {
      const setting = settings.get(product.id);
      const price = setting?.price ?? product.price;
      const oldPrice = setting ? setting.compareAtPrice : (product.oldPrice ?? null);
      const active = setting ? setting.active : (product.active ?? true);
      const photo = photos.get(product.id) ?? {};
      const mainImage = photo.main ? productPhotoUrl(product.id, 'main', photo.main) : (product.image || '/images/products/produit-indisponible.svg');
      const extraImage = photo.extra
        ? productPhotoUrl(product.id, 'extra', photo.extra)
        : (product.custom && photo.main ? mainImage : (product.extra || mainImage));
      return {
        ...product,
        price,
        oldPrice,
        badge: badgeFor(product, price, oldPrice),
        active,
        stock: stock.get(product.id) ?? product.stock ?? 0,
        image: mainImage,
        extra: extraImage
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

export function issueSessionToken(now = Date.now(), {role = 'admin', actor = 'Admin', agentId = null} = {}) {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({exp: expiresAt, role, actor, agentId})).toString('base64url');
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  return {token: `${payload}.${signature}`, expiresAt, role, actor, agentId};
}

export function parseSessionToken(token, now = Date.now()) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', signingKey()).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isFinite(data?.exp) || data.exp <= now) return null;
    return {
      exp: data.exp,
      role: data.role === 'agent' ? 'agent' : 'admin',
      actor: typeof data.actor === 'string' && data.actor ? data.actor : 'Admin',
      agentId: data.agentId ?? null
    };
  } catch {
    return null;
  }
}

export function verifySessionToken(token, now = Date.now()) {
  return Boolean(parseSessionToken(token, now));
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

const specsInputSchema = z.union([
  z.array(z.string().trim().min(1).max(160)).max(12),
  z.string().max(1000).transform(text =>
    text
      .split(/\r?\n|•|;/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 12)
  )
]);

const statusSchema = z.object({status: z.enum(orderStatuses)});

const productCreateSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(48).optional(),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(50).default('Mode'),
  price: z.number().int().min(0).max(50_000_000),
  oldPrice: z.number().int().min(0).max(50_000_000).nullable().optional().transform(v => v ?? null),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  color: z.string().trim().min(1).max(80).default('Standard'),
  badge: z.string().trim().max(30).default('NOUVEAU'),
  description: z.string().trim().max(1000).default(''),
  specs: specsInputSchema.optional().default([]),
  review: z.string().trim().max(400).optional().default('Sélection Global Shop Daloa.'),
  active: z.boolean().optional().default(true)
}).strict();

const productPatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().min(2).max(50).optional(),
  color: z.string().trim().min(1).max(80).optional(),
  badge: z.string().trim().max(30).optional(),
  description: z.string().trim().max(1000).optional(),
  specs: specsInputSchema.optional(),
  review: z.string().trim().max(400).optional(),
  price: z.number().int().min(0).max(50_000_000).optional(),
  oldPrice: z.number().int().min(0).max(50_000_000).nullable().optional(),
  active: z.boolean().optional(),
  stock: z.number().int().min(0).max(1_000_000).optional()
}).strict();

const agentCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  roleLabel: z.string().trim().min(2).max(80).optional().default('Agent commandes & livraison')
}).strict();

export function createAdminRouter({store}) {
  const router = express.Router();
  // Seul l'administrateur principal écrit le catalogue (produits, prix, stocks, photos) et gère les codes agents.
  // Les agents (role === 'agent') consultent le catalogue et gèrent les commandes, en lecture/écriture commandes uniquement.
  const requireAdmin = (req, res, next) => {
    if (req.adminSession?.role !== 'admin') {
      return res.status(403).json({error: 'Seul l’administrateur principal peut modifier les produits, les prix, les stocks et les photos.'});
    }
    return next();
  };
  const byReferenceId = new Map(products.map(product => [product.id, product]));

  async function loadFullCatalog() {
    const [settings, stock, photos, customProducts] = await Promise.all([
      store.listProductSettings(),
      store.listStock(),
      store.listProductPhotos(),
      store.listCustomProducts ? store.listCustomProducts() : Promise.resolve([])
    ]);
    return {settings, stock, photos, customProducts};
  }

  async function findAnyProduct(id) {
    if (byReferenceId.has(id)) return {product: byReferenceId.get(id), isCustom: false};
    if (!store.listCustomProducts) return null;
    const customList = await store.listCustomProducts();
    const custom = customList.find(item => item.id === id);
    return custom ? {product: custom, isCustom: true} : null;
  }

  // Connexion : accepte soit le mot de passe principal ADMIN_PASSWORD (rôle 'admin'),
  // soit un code d'accès agent unique généré par l'admin (rôle 'agent').
  router.post('/session', rateLimit({windowMs: 15 * 60000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false, message: {error: 'Trop de tentatives. Réessayez dans quelques minutes.'}}), async (req, res, next) => {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) return res.status(503).json({error: 'Espace de gestion non configuré : ADMIN_PASSWORD est absent.'});

    const candidatePassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const candidateAgentCode = typeof req.body?.agentCode === 'string' ? req.body.agentCode.trim() : '';

    if (candidatePassword && sameSecret(candidatePassword, password)) {
      const session = issueSessionToken(Date.now(), {role: 'admin', actor: 'Admin'});
      if (store.recordEvent) {
        store.ensureReady()
          .then(() => store.recordEvent({
            type: 'auth_login',
            category: 'equipe',
            actor: 'Admin',
            title: 'Connexion Administrateur',
            detail: 'Accès complet au tableau de bord et au générateur de codes agents'
          }))
          .catch(() => {});
      }
      return res.json(session);
    }

    // Connexion par code agent unique (ex. AGT-XXXX-XXXX), saisi dans le champ code agent ou mot de passe.
    const codeToTry = candidateAgentCode || candidatePassword;
    if (codeToTry && /^AGT-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(codeToTry) && store.findAgentByCode) {
      try {
        await store.ensureReady();
        const agent = await store.findAgentByCode(codeToTry);
        if (agent && agent.active) {
          const session = issueSessionToken(Date.now(), {
            role: 'agent',
            actor: agent.name,
            agentId: agent.id
          });
          if (store.recordEvent) {
            store.recordEvent({
              type: 'auth_login',
              category: 'equipe',
              actor: agent.name,
              title: `Connexion Agent : ${agent.name}`,
              detail: `${agent.roleLabel} · Code ${agent.code.slice(0, 8)}…`
            }).catch(() => {});
          }
          return res.json({...session, roleLabel: agent.roleLabel});
        }
      } catch (error) {
        return next(error);
      }
    }

    return res.status(401).json({error: 'Mot de passe ou code agent incorrect.'});
  });

  // Tout le reste de l'espace de gestion exige un jeton valide (Admin ou Agent actif).
  router.use(async (req, res, next) => {
    if (!process.env.ADMIN_PASSWORD) return res.status(503).json({error: 'Espace de gestion non configuré : ADMIN_PASSWORD est absent.'});
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const session = parseSessionToken(token);
    if (!session) return res.status(401).json({error: 'Session expirée ou invalide. Reconnectez-vous.'});
    if (session.role === 'agent' && session.agentId && store.getAgentById) {
      try {
        await store.ensureReady();
        const agent = await store.getAgentById(session.agentId);
        if (!agent || !agent.active) {
          return res.status(401).json({error: 'Ce code agent a été révoqué par l’administrateur.'});
        }
      } catch (error) {
        return next(error);
      }
    }
    req.adminSession = session;
    next();
  });

  router.get('/me', (req, res) => {
    res.json({
      role: req.adminSession.role,
      actor: req.adminSession.actor,
      agentId: req.adminSession.agentId
    });
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
      const order = await store.setOrderStatus({
        id: req.params.id,
        status: parsed.data.status,
        actor: req.adminSession?.actor ?? 'Admin'
      });
      if (!order) return res.status(404).json({error: 'Commande introuvable.'});
      res.json({order});
    } catch (error) {
      // Identifiant qui n'est pas un UUID : la requête SQL échoue, on répond 404 plutôt qu'une 500.
      if (error.code === '22P02') return res.status(404).json({error: 'Commande introuvable.'});
      next(error);
    }
  });

  router.get('/products', async (req, res, next) => {
    try {
      const {settings, stock, photos, customProducts} = await loadFullCatalog();
      res.json({
        products: mergeCatalog({settings, stock, photos, customProducts, includeInactive: true}).map(product => ({
          ...product,
          photoUpdatedAt: photos.get(product.id) ?? {}
        })),
        deliverySlots,
        whatsappNumber: normalizeWhatsappNumber(process.env.WHATSAPP_NUMBER),
        session: {
          role: req.adminSession.role,
          actor: req.adminSession.actor
        }
      });
    } catch (error) { next(error); }
  });

  // Ajout d'un nouveau produit dans le stock (réservé à l'Admin ; les agents consultent le catalogue en lecture seule).
  router.post('/products', requireAdmin, async (req, res, next) => {
    const parsed = productCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'Informations du nouveau produit invalides. Vérifiez le nom, la catégorie, le prix et le stock.'});
    }
    const data = parsed.data;
    if (data.oldPrice !== null && data.oldPrice <= data.price) {
      return res.status(400).json({error: 'Le prix barré doit être supérieur au prix de vente.'});
    }
    try {
      const {customProducts} = await loadFullCatalog();
      const takenIds = new Set([
        ...products.map(p => p.id),
        ...customProducts.map(p => p.id)
      ]);
      if (data.id && takenIds.has(data.id)) {
        return res.status(409).json({error: 'Un produit avec cet identifiant existe déjà.'});
      }
      const id = data.id || slugifyProductId(data.name, takenIds);
      await store.createCustomProduct({
        id,
        name: data.name,
        category: data.category,
        price: data.price,
        compareAtPrice: data.oldPrice,
        stock: data.stock,
        color: data.color,
        badge: data.badge,
        description: data.description || `${data.name} — sélection Global Shop Daloa.`,
        specs: data.specs,
        review: data.review,
        active: data.active,
        createdBy: req.adminSession?.actor ?? 'Admin'
      });
      const nextCatalog = await loadFullCatalog();
      const merged = mergeCatalog({...nextCatalog, includeInactive: true}).find(item => item.id === id);
      res.status(201).json({product: {...merged, photoUpdatedAt: nextCatalog.photos.get(id) ?? {}}});
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({error: 'Un produit avec cet identifiant existe déjà.'});
      next(error);
    }
  });

  router.patch('/products/:id', requireAdmin, async (req, res, next) => {
    const parsed = productPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Valeurs de produit invalides.'});
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({error: 'Aucune modification transmise.'});
    }
    try {
      const found = await findAnyProduct(req.params.id);
      if (!found) return res.status(404).json({error: 'Produit introuvable.'});
      const {product, isCustom} = found;

      const [settings] = await Promise.all([store.listProductSettings(), store.listStock()]);
      const current = settings.get(product.id);
      const nextPrice = patch.price ?? current?.price ?? product.price;
      const nextOldPrice = patch.oldPrice === undefined ? (current ? current.compareAtPrice : product.oldPrice) : patch.oldPrice;
      if (nextOldPrice !== null && nextOldPrice !== undefined && nextOldPrice <= nextPrice) {
        return res.status(400).json({error: 'Le prix barré doit être supérieur au prix de vente.'});
      }
      const nextActive = patch.active ?? current?.active ?? product.active ?? true;

      if (isCustom && store.updateCustomProduct) {
        await store.updateCustomProduct({
          id: product.id,
          name: patch.name,
          category: patch.category,
          color: patch.color,
          badge: patch.badge,
          description: patch.description,
          specs: patch.specs,
          review: patch.review,
          price: nextPrice,
          compareAtPrice: nextOldPrice ?? null,
          active: nextActive
        });
      }

      if (patch.price !== undefined || patch.oldPrice !== undefined || patch.active !== undefined) {
        await store.saveProductSettings({id: product.id, price: nextPrice, compareAtPrice: nextOldPrice ?? null, active: nextActive});
      }
      if (patch.stock !== undefined) {
        const updated = await store.setStock(product.id, patch.stock);
        if (!updated) throw new Error(`Stock introuvable pour ${product.id}.`);
      }

      const nextCatalog = await loadFullCatalog();
      const merged = mergeCatalog({...nextCatalog, includeInactive: true}).find(item => item.id === product.id);

      if (store.recordEvent && merged) {
        store.recordEvent({
          type: 'product_updated',
          category: 'stock',
          actor: req.adminSession?.actor ?? 'Admin',
          title: `Mise à jour produit : ${merged.name}`,
          detail: `Prix : ${merged.price} FCFA · Stock : ${merged.stock} · ${merged.active ? 'Visible' : 'Masqué'}`,
          meta: {productId: merged.id, price: merged.price, stock: merged.stock, active: merged.active}
        }).catch(() => {});
      }

      res.json({product: {...merged, photoUpdatedAt: nextCatalog.photos.get(product.id) ?? {}}});
    } catch (error) { next(error); }
  });

  router.delete('/products/:id', requireAdmin, async (req, res, next) => {
    if (req.adminSession?.role !== 'admin') {
      return res.status(403).json({error: 'Seul l’administrateur principal peut supprimer un produit.'});
    }
    try {
      const found = await findAnyProduct(req.params.id);
      if (!found) return res.status(404).json({error: 'Produit introuvable.'});
      if (!found.isCustom) {
        return res.status(400).json({error: 'Les produits de référence ne peuvent pas être supprimés ; décochez « Visible sur le site » pour les masquer.'});
      }
      const removed = await store.deleteCustomProduct(req.params.id);
      if (!removed) return res.status(404).json({error: 'Produit introuvable.'});
      if (store.recordEvent) {
        store.recordEvent({
          type: 'product_deleted',
          category: 'stock',
          actor: req.adminSession.actor,
          title: `Produit retiré : ${removed.name}`,
          detail: `Identifiant : ${removed.id}`,
          meta: {productId: removed.id}
        }).catch(() => {});
      }
      res.json({removed});
    } catch (error) { next(error); }
  });

  const photoBody = express.raw({type: ['image/jpeg', 'image/png', 'image/webp'], limit: PHOTO_MAX_BYTES});

  router.put('/products/:id/photos/:view', requireAdmin, photoBody, async (req, res, next) => {
    if (!PHOTO_VIEWS.includes(req.params.view)) return res.status(400).json({error: 'Vue photo inconnue.'});
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer?.length) return res.status(415).json({error: 'Photo JPEG, PNG ou WebP requise.'});
    if (buffer.length > PHOTO_MAX_BYTES) return res.status(413).json({error: 'Photo trop volumineuse (2 Mo maximum).'});
    const mime = sniffImage(buffer);
    if (!mime) return res.status(400).json({error: 'Fichier image illisible : JPEG, PNG ou WebP attendu.'});
    try {
      const found = await findAnyProduct(req.params.id);
      if (!found) return res.status(404).json({error: 'Produit introuvable.'});
      const {product} = found;
      const saved = await store.saveProductPhoto({id: product.id, view: req.params.view, mime, bytes: buffer});
      if (store.recordEvent) {
        store.recordEvent({
          type: 'product_photo',
          category: 'stock',
          actor: req.adminSession?.actor ?? 'Admin',
          title: `Photo ${req.params.view} enregistrée : ${product.name}`,
          detail: `${Math.round(buffer.length / 1024)} Ko (${mime})`,
          meta: {productId: product.id, view: req.params.view}
        }).catch(() => {});
      }
      res.json({url: productPhotoUrl(product.id, req.params.view, saved.updatedAt), view: req.params.view, bytes: buffer.length});
    } catch (error) { next(error); }
  });

  router.delete('/products/:id/photos/:view', requireAdmin, async (req, res, next) => {
    if (!PHOTO_VIEWS.includes(req.params.view)) return res.status(400).json({error: 'Vue photo inconnue.'});
    try {
      const removed = await store.deleteProductPhoto({id: req.params.id, view: req.params.view});
      if (!removed) return res.status(404).json({error: 'Aucune photo à supprimer pour cette vue.'});
      res.json({removed});
    } catch (error) { next(error); }
  });

  // --- Gestion des agents et générateur de codes uniques (réservé à l'Admin principal) ---

  router.get('/agents', async (req, res, next) => {
    if (req.adminSession?.role !== 'admin') {
      return res.status(403).json({error: 'Seul l’administrateur principal peut consulter et générer les codes agents.'});
    }
    try {
      const agents = store.listAgents ? await store.listAgents() : [];
      res.json({agents});
    } catch (error) { next(error); }
  });

  router.post('/agents', async (req, res, next) => {
    if (req.adminSession?.role !== 'admin') {
      return res.status(403).json({error: 'Seul l’administrateur principal peut générer des codes agents.'});
    }
    const parsed = agentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'Indiquez le nom de l’agent (au moins 2 caractères).'});
    }
    try {
      const agent = await store.createAgent({
        name: parsed.data.name,
        roleLabel: parsed.data.roleLabel,
        generateCode: generateAgentCode,
        actor: req.adminSession.actor
      });
      res.status(201).json({agent});
    } catch (error) { next(error); }
  });

  router.delete('/agents/:id', async (req, res, next) => {
    if (req.adminSession?.role !== 'admin') {
      return res.status(403).json({error: 'Seul l’administrateur principal peut révoquer un code agent.'});
    }
    try {
      const removed = await store.revokeAgent(req.params.id, req.adminSession.actor);
      if (!removed) return res.status(404).json({error: 'Agent introuvable.'});
      res.json({removed});
    } catch (error) {
      if (error.code === '22P02') return res.status(404).json({error: 'Agent introuvable.'});
      next(error);
    }
  });

  // --- Zone de suivi en temps réel de l'activité e-commerce ---

  router.get('/realtime', async (req, res, next) => {
    try {
      const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : null;
      const sinceId = typeof req.query.sinceId === 'string' && /^\d+$/.test(req.query.sinceId) ? Number(req.query.sinceId) : null;
      const limit = typeof req.query.limit === 'string' && /^\d+$/.test(req.query.limit) ? Number(req.query.limit) : 60;

      const [overview, catalogData, agents] = await Promise.all([
        store.getRealtimeOverview
          ? store.getRealtimeOverview({limit, category, sinceId})
          : Promise.resolve({timezone: ABIDJAN_TIMEZONE, serverTimeAbidjan: '', visitors: {online: 0, activeCarts: 0, sessions: []}, orders: {}, events: []}),
        loadFullCatalog(),
        store.listAgents ? store.listAgents() : Promise.resolve([])
      ]);

      const merged = mergeCatalog({...catalogData, includeInactive: true});
      const outOfStock = merged.filter(p => p.active && p.stock === 0);
      const lowStock = merged.filter(p => p.active && p.stock > 0 && p.stock <= 5);

      res.json({
        ...overview,
        stock: {
          totalProducts: merged.length,
          customProductsCount: catalogData.customProducts.length,
          activeProducts: merged.filter(p => p.active).length,
          outOfStockCount: outOfStock.length,
          lowStockCount: lowStock.length,
          alerts: [
            ...outOfStock.map(p => ({id: p.id, name: p.name, category: p.category, stock: p.stock, level: 'rupture'})),
            ...lowStock.map(p => ({id: p.id, name: p.name, category: p.category, stock: p.stock, level: 'faible'}))
          ]
        },
        agents: {
          activeCount: agents.filter(a => a.active).length
        }
      });
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
