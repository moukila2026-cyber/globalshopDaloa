import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("lightbox reuses the dialog, traps and restores focus, locks scrolling and supports swipe", async () => {
  const app = await read("../src/main.jsx");

  // Visionneuse ouverte depuis le catalogue et la fiche produit, images filtrées.
  assert.match(app, /\[p\.image, p\.extra\]/);
  assert.match(app, /\[selected\.image, selected\.extra\]/);
  assert.match(app, /images\.filter\(Boolean\)/);

  // Le dialogue existant est réutilisé (role dialog, aria-modal, titre relié).
  assert.match(app, /role="dialog"/);
  assert.match(app, /aria-modal="true"/);
  assert.match(app, /aria-labelledby=\{lightbox \? "lightbox-title"/);

  // Fermeture par Échap et par bouton, navigation précédent/suivant au clavier.
  assert.match(app, /e\.key === "Escape"/);
  assert.match(app, /"ArrowLeft"/);
  assert.match(app, /"ArrowRight"/);
  assert.match(app, /close-button lightbox-close/);
  assert.match(app, /aria-label="Fermer la visionneuse"/);
  assert.match(app, /aria-label="Image précédente"/);
  assert.match(app, /aria-label="Image suivante"/);

  // Focus piégé (Tab / Shift+Tab) et restauré sur le déclencheur à la fermeture.
  assert.match(app, /e\.shiftKey/);
  assert.match(app, /lightboxTrigger/);
  assert.match(app, /\.focus\(\)/);

  // Défilement du corps bloqué pendant l'ouverture.
  assert.match(app, /document\.body\.style\.overflow = "hidden"/);

  // Support tactile (swipe), légende et annonce de la vue courante.
  assert.match(app, /onTouchStart=\{handleLightboxTouchStart\}/);
  assert.match(app, /onTouchEnd=\{handleLightboxTouchEnd\}/);
  assert.match(app, /<figcaption>/);
  assert.match(app, /aria-live="polite"/);
});

test("brand logo is configurable, shared by storefront and admin, with fallbacks", async () => {
  const brand = await read("../src/brand.js");
  const app = await read("../src/main.jsx");
  const logoComponent = await read("../src/BrandLogo.jsx");
  const adminApp = await read("../src/admin/AdminApp.jsx");
  const adminCss = await read("../src/admin/admin.css");

  // Emplacement configurable du fichier logo et texte alternatif correct.
  assert.match(brand, /export const BRAND_LOGO_PATH = "\/images\/logo\.(svg|png)";/);
  assert.match(brand, /BRAND_LOGO_ALT = "Logo Global Shop Daloa";/);

  // Composant partagé : une seule implémentation, importée par la vitrine et l'admin.
  assert.match(logoComponent, /export default function BrandLogo/);
  assert.match(logoComponent, /from "\.\/brand\.js"/);
  assert.match(logoComponent, /src=\{BRAND_LOGO_PATH\}/);
  assert.match(logoComponent, /alt=\{BRAND_LOGO_ALT\}/);
  assert.match(logoComponent, /onError=\{\(\) => setUnavailable\(true\)\}/);
  assert.doesNotMatch(app, /function BrandLogo\(/);
  assert.match(app, /import BrandLogo from "\.\/BrandLogo\.jsx";/);

  // En-tête, pied de page et écran de confirmation de commande (vitrine).
  assert.ok(
    (app.match(/<BrandLogo \/>/g) || []).length >= 3,
    "BrandLogo should be used on at least three storefront screens",
  );

  // Repli monogramme côté vitrine, repli « GS » dans l'en-tête admin.
  assert.match(logoComponent, /className="brand-symbol"/);
  assert.match(adminApp, /import BrandLogo from "\.\.\/BrandLogo\.jsx";/);
  assert.match(
    adminApp,
    /<BrandLogo className="admin-logo" fallback=\{<span className="admin-mark">GS<\/span>\} \/>/,
  );
  assert.match(adminCss, /\.admin-logo\s*\{/);

  // Favicon automatique avec repli.
  assert.match(app, /link\[rel="icon"\]/);
  assert.match(app, /favicon\.href = "\/favicon\.svg"/);

  const favicon = await read("../public/favicon.svg");
  assert.match(favicon, /<svg\s/);
});

test("styles keep the palette tokens, visible focus, entrance motion and reduced motion", async () => {
  const css = await read("../src/styles.css");

  // Système de couleurs et d'ombres demandé.
  assert.match(css, /--green:\s*#2b4e40/);
  assert.match(css, /--orange:\s*#b77551/);
  assert.match(css, /--cream:/);
  assert.match(css, /--shadow-soft:/);

  // États focus visibles, animations d'entrée et visionneuse stylée.
  assert.match(css, /:focus-visible/);
  assert.match(css, /@keyframes soft-rise/);
  assert.match(css, /@keyframes lightbox-enter/);
  assert.match(css, /\.lightbox-overlay/);

  // Responsive et respect de prefers-reduced-motion.
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /transition: none !important/);
});

test("catalogue falls back to reference products with unknown stock instead of an empty grid", async () => {
  const app = await read("../src/main.jsx");
  const css = await read("../src/styles.css");

  // Chargement : en cas d'échec de /api/products, les produits de référence sont affichés sans stock confirmé.
  assert.match(app, /referenceProducts\.map\(\(p\) => \(\{ \.\.\.p, stock: null \}\)\)/);
  assert.match(app, /setStockUnavailable\(true\)/);
  assert.match(app, /Stocks indisponibles/);
  assert.doesNotMatch(app, /Le catalogue se fait attendre/);

  // Stock inconnu : libellé dédié, panier non bloqué (limite 10 par ligne).
  assert.match(app, /Stock à confirmer/);
  assert.match(app, /stock-unknown/);
  assert.match(app, /disabled=\{p\.stock === 0\}/);
  assert.doesNotMatch(app, /disabled=\{!p\.stock\}/);
  assert.match(css, /\.product-stock\.stock-unknown/);
  assert.match(css, /\.stock-notice/);
});

test("shipped logo is a clean, self-contained SVG mark with a title and a viewBox", async () => {
  const logo = await read("../public/images/logo.svg");
  assert.match(logo, /^<svg[\s\S]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(logo, /viewBox="0 0 120 120"/);
  assert.match(logo, /<title[^>]*>Logo Global Shop Daloa<\/title>/);
  // Sans script, sans ressource externe ni texte dépendant d'une police installée.
  const withoutNamespace = logo.replace(/xmlns="[^"]*"/g, "");
  assert.doesNotMatch(withoutNamespace, /<script|<foreignObject|<text[\s>]|href=|url\(|https?:\/\//i);
  // Palette de marque.
  assert.match(logo, /#2b4e40/);
  assert.match(logo, /#b77551/);
});

test("buyer order tracking and admin real-time & agent code generator UI are wired", async () => {
  const app = await read("../src/main.jsx");
  const adminApp = await read("../src/admin/AdminApp.jsx");

  // Suivi de commande acheteur (« Suivre ma commande ») dans la boutique.
  assert.match(app, /Suivre ma commande/);
  assert.match(app, /\/api\/orders\/track/);
  assert.match(app, /tracking-result/);

  // Espace admin : ajout de nouveaux produits, générateur de codes agents et suivi en temps réel.
  assert.match(adminApp, /Ajouter un nouveau produit dans le stock/);
  assert.match(adminApp, /Générateur de codes aléatoires pour les agents/);
  assert.match(adminApp, /Zone de suivi en temps réel/);
});

test("hero slideshow rotates every 10s through in-stock product images and admin products panel is read-only for agents", async () => {
  const app = await read("../src/main.jsx");
  const css = await read("../src/styles.css");
  const adminApp = await read("../src/admin/AdminApp.jsx");
  assert.match(app, /heroSlides/);
  assert.match(app, /product\.image, product\.extra/);
  assert.match(app, /product\.stock <= 0/);
  assert.match(app, /10000/);
  assert.match(app, /hero-slide/);
  assert.match(css, /\.hero-slide\.active/);
  assert.match(css, /@keyframes hero-kenburns/);
  assert.match(adminApp, /isAdmin = session\?\.role === "admin"/);
  assert.match(adminApp, /disabled=\{!isAdmin\}/);
  assert.match(adminApp, /par \{order\.updatedBy\}|Dernière action par/);
});

test("agents dashboard text never claims agents can add products to stock or edit stock, prices or photos", async () => {
  const adminApp = await read("../src/admin/AdminApp.jsx");
  // Ancienne phrase trompeuse (les agents ne font que traiter les commandes) : ne doit jamais réapparaître.
  assert.doesNotMatch(adminApp, /permettant d[’']entrer de nouveaux produits/);
  // Ancien rôle par défaut trompeur : remplacé par « Agent commandes & livraison ».
  assert.doesNotMatch(adminApp, /Agent stock & catalogue/);
  assert.match(adminApp, /Agent commandes & livraison/);
  // Phrase correcte présente dans le panneau Agents & Codes.
  assert.match(adminApp, /Aucun agent ne peut ajouter de produits au stock/);
  assert.match(adminApp, /traiter les commandes et de consulter le catalogue en lecture seule/);
});

test("admin cancel button is hidden for delivered orders and the social modal is gone", async () => {
  const adminApp = await read("../src/admin/AdminApp.jsx");
  const app = await read("../src/main.jsx");
  // Une commande livrée ne propose plus « Annuler (stock restitué) ».
  assert.match(adminApp, /order\.status !== "annulee" && order\.status !== "livree"/);
  // L'annulation est proposée pour « Nouvelles » et « En préparation », pas pour « Terminées ».
  assert.match(adminApp, /id: "nouvelle"[\s\S]*?cancel: true,\n  \},/);
  assert.match(adminApp, /id: "en_preparation"[\s\S]*?cancel: true,\n  \},/);
  assert.doesNotMatch(adminApp, /id: "terminees"[\s\S]*?cancel: true/);
  // La modale « social » (Facebook/Instagram « à venir ») n'existe plus.
  assert.doesNotMatch(app, /social: \{/);
  assert.doesNotMatch(app, /seront ajoutés à l’ouverture/);
});
