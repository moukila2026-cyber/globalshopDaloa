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

test("brand logo is configurable and shown on header, footer and order confirmation", async () => {
  const brand = await read("../src/brand.js");
  const app = await read("../src/main.jsx");

  // Emplacement configurable du fichier logo et texte alternatif correct.
  assert.match(brand, /export const BRAND_LOGO_PATH = "\/images\/logo\.(svg|png)";/);
  assert.match(brand, /BRAND_LOGO_ALT = "Logo Global Shop Daloa";/);

  // En-tête, pied de page et écran de confirmation de commande.
  assert.ok(
    (app.match(/<BrandLogo \/>/g) || []).length >= 3,
    "BrandLogo should be used on at least three screens",
  );

  // Repli monogramme si le fichier est absent, favicon automatique avec repli.
  assert.match(app, /className="brand-symbol"/);
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
