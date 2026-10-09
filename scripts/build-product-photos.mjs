#!/usr/bin/env node
/**
 * Génère les photos du catalogue au format 5:6 (800 × 960, JPEG qualité 84, fond blanc studio).
 *
 * Utilisation :
 *   1. déposer les fichiers source dans `sources/` (dossier non versionné) en les nommant
 *      `<id>.jpg` pour la vue principale et `<id>-extra.jpg` pour la seconde vue ;
 *   2. `npm run photos:build`.
 *
 * Le tableau « fichier local → photo Pexels → licence » qui documente chaque source est
 * dans `public/images/README.md`.
 *
 * Traitement appliqué à chaque source : rotation selon l’EXIF, rognage du fond uni
 * (`trim`), puis mise à l’échelle « contain » sans déformation et centrage sur un fond
 * blanc. Le script refuse de continuer si un fichier source est absent ou si la photo
 * obtenue semble vide (couverture de pixels trop faible) : l’image de repli du catalogue
 * ne doit jamais être déclenchée par une photo manquante.
 */
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { products } from "../shared/products.js";

const WIDTH = 800;
const HEIGHT = 960;
const QUALITY = 84;
/** Marge blanche minimale conservée autour du sujet (en pixels du canvas final). */
const MARGIN = 40;
/** Couverture minimale de pixels non blancs attendue dans une photo produit. */
const MIN_INK_COVERAGE = 0.08;

const root = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(root, "sources");
const targetDir = path.join(root, "public", "images", "products");

async function findSource(id) {
  let entries = [];
  try {
    entries = await readdir(sourceDir);
  } catch {
    return null;
  }
  return (
    entries
      .filter((name) => path.parse(name).name === id)
      .map((name) => path.join(sourceDir, name))
      .sort()[0] || null
  );
}

/** Part des pixels dont au moins un canal s’écarte du blanc (détecte les photos vides). */
async function inkCoverage(buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  let ink = 0;
  for (let i = 0; i < data.length; i += channels) {
    if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) ink++;
  }
  return ink / (info.width * info.height);
}

async function buildPhoto(id, sourcePath) {
  const source = await sharp(sourcePath).metadata();
  const rotated = sharp(sourcePath).rotate();

  // 1. rogner le fond uni de la photo source (studio blanc, fond sombre homogène…).
  const trimmed = await rotated
    .clone()
    .trim({ threshold: 12 })
    .toBuffer({ resolveWithObject: true });

  // Garde-fou : si le rognage retire plus de 60 % d’une dimension, la source n’a pas de
  // fond uni détectable — on conserve la photo entière.
  const shrinkWidth = trimmed.info.width / source.width;
  const shrinkHeight = trimmed.info.height / source.height;
  const keepTrim = shrinkWidth > 0.4 && shrinkHeight > 0.4;
  const working = keepTrim ? trimmed.data : await rotated.clone().toBuffer();

  // 2. mise à l’échelle « contain » puis centrage sur le canvas blanc 5:6.
  const innerWidth = WIDTH - MARGIN * 2;
  const innerHeight = HEIGHT - MARGIN * 2;
  const resized = await sharp(working)
    .resize(innerWidth, innerHeight, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .toBuffer({ resolveWithObject: true });
  const padX = Math.max(0, Math.round((WIDTH - resized.info.width) / 2));
  const padY = Math.max(0, Math.round((HEIGHT - resized.info.height) / 2));

  const output = await sharp(resized.data)
    .extend({
      top: padY,
      bottom: HEIGHT - resized.info.height - padY,
      left: padX,
      right: WIDTH - resized.info.width - padX,
      background: "#ffffff",
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();

  return { output, source, trimmed: keepTrim, coverage: await inkCoverage(output) };
}

const missing = [];
const suspicious = [];
const report = [];

await mkdir(targetDir, { recursive: true });

for (const product of products) {
  for (const view of ["main", "extra"]) {
    const id = view === "extra" ? `${product.id}-extra` : product.id;
    const sourcePath = await findSource(id);
    if (!sourcePath) {
      missing.push(`sources/${id}.jpg`);
      continue;
    }
    const { output, source, trimmed, coverage } = await buildPhoto(id, sourcePath);
    const target = path.join(targetDir, `${id}.jpg`);
    await writeFile(target, output);
    report.push(
      [
        id.padEnd(16),
        `${String(source.width).padStart(4)}×${String(source.height).padEnd(4)}`,
        trimmed ? "trim" : "keep",
        `${String(Math.round(output.length / 1024)).padStart(3)} ko`,
        `couverture ${(coverage * 100).toFixed(1)} %`,
      ].join("  "),
    );
    if (coverage < MIN_INK_COVERAGE) {
      suspicious.push(`${id} (${(coverage * 100).toFixed(1)} % de pixels non blancs)`);
    }
  }
}

console.log(report.join("\n"));

if (missing.length) {
  console.error(
    `\nSources introuvables :\n  - ${missing.join("\n  - ")}\n` +
      "Déposer les photos d’origine dans `sources/` puis relancer `npm run photos:build`.",
  );
}
if (suspicious.length) {
  console.error(
    `\n photos quasi vides détectées :\n  - ${suspicious.join("\n  - ")}\n` +
      "Vérifier la source : le catalogue afficherait une carte blanche.",
  );
}
if (missing.length || suspicious.length) process.exitCode = 1;
