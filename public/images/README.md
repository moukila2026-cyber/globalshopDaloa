# Images locales Global Shop Daloa

Le catalogue charge ses images depuis ce dossier : pas de requête navigateur vers un hébergeur d’images. La politique CSP de production reste limitée à `img-src 'self'`.

Les huit produits utilisent désormais **deux photos locales** (vue principale `<id>.jpg`, seconde vue `<id>-extra.jpg`) au format JPEG 5:6 (800 × 960), qualité 84, sur fond blanc studio.

## Photos de référence intégrées

Toutes les photos proviennent de Pexels et sont utilisées sous [licence Pexels](https://www.pexels.com/license/) (usage commercial autorisé, attribution non obligatoire).

| Fichier local | Photo Pexels | Photographe | Licence |
| --- | --- | --- | --- |
| `products/casque.jpg` | [3394650 — casque sans fil blanc, vue de dessus](https://www.pexels.com/photo/white-wireless-headphones-3394650/) | Sound On | [Pexels](https://www.pexels.com/license/) |
| `products/casque-extra.jpg` | [3394652 — casque blanc circum-auriculaire](https://www.pexels.com/photo/white-headphones-3394652/) | Sound On | [Pexels](https://www.pexels.com/license/) |
| `products/sac.jpg` | [27046147 — sacs en cuir en studio](https://www.pexels.com/photo/leather-bags-in-a-studio-27046147/) | José Martin Segura Benites | [Pexels](https://www.pexels.com/license/) |
| `products/sac-extra.jpg` | [23223851 — sac beige à poignées noires](https://www.pexels.com/photo/gray-bag-with-handles-23223851/) | Muneeb Malhotra | [Pexels](https://www.pexels.com/license/) |
| `products/baskets.jpg` | [23491456 — chaussure de sport blanche](https://www.pexels.com/photo/product-shot-of-a-sports-shoe-23491456/) | Pranay Patel | [Pexels](https://www.pexels.com/license/) |
| `products/baskets-extra.jpg` | [10726876 — baskets blanches classiques](https://www.pexels.com/photo/white-nike-air-force-1-shoes-10726876/) | Alex B. | [Pexels](https://www.pexels.com/license/) |
| `products/serum.jpg` | [6914587 — pipette au-dessus d’un flacon ambre](https://www.pexels.com/photo/medicine-dropper-with-liquid-and-brown-glass-bottle-6914587/) | Eva Bronzini | [Pexels](https://www.pexels.com/license/) |
| `products/serum-extra.jpg` | [8148744 — flacon compte-gouttes tenu à la main](https://www.pexels.com/photo/a-person-holding-a-glass-bottle-8148744/) | Vie Studio | [Pexels](https://www.pexels.com/license/) |
| `products/lampe.jpg` | [5968800 — lampe de chevet allumée](https://www.pexels.com/photo/black-lamp-beside-a-bed-5968800/) | LZ Jian | [Pexels](https://www.pexels.com/license/) |
| `products/lampe-extra.jpg` | [545012 — lampe de table blanche et cuivre](https://www.pexels.com/photo/white-bedspread-beside-nightstand-with-white-and-copper-table-lamp-545012/) | Burst | [Pexels](https://www.pexels.com/license/) |
| `products/montre.jpg` | [13007642 — montre connectée, bracelet blanc](https://www.pexels.com/photo/a-close-up-shot-of-a-smartwatch-13007642/) | pratik prasad | [Pexels](https://www.pexels.com/license/) |
| `products/montre-extra.jpg` | [9584702 — montre connectée blanche](https://www.pexels.com/photo/silver-aluminum-case-apple-watch-with-white-sport-band-9584702/) | Adrian Regeci | [Pexels](https://www.pexels.com/license/) |
| `products/vase.jpg` | [7354630 — vases en céramique et feuillages](https://www.pexels.com/photo/photo-of-plants-with-different-color-of-vases-7354630/) | Daria Liudnaya | [Pexels](https://www.pexels.com/license/) |
| `products/vase-extra.jpg` | [5978654 — vase en céramique et fleurs séchées](https://www.pexels.com/photo/empty-picture-frame-next-to-ceramic-vase-5978654/) | Kaboompics (Karola G) | [Pexels](https://www.pexels.com/license/) |
| `products/lunettes.jpg` | [13982238 — lunettes de soleil à verres bleus](https://www.pexels.com/photo/a-pair-of-sunglasses-13982238/) | Berkan Can | [Pexels](https://www.pexels.com/license/) |
| `products/lunettes-extra.jpg` | [1499477 — lunettes de soleil et lunettes de vue à plat](https://www.pexels.com/photo/two-eyewear-on-white-surface-1499477/) | Diana ✨ | [Pexels](https://www.pexels.com/license/) |

Notes de provenance :

- La photo `serum.jpg` prévue (Pexels `6914588`) n’a pas pu être téléchargée depuis l’environnement de travail ; la photo retenue (`6914587`) provient de la même série du même photographe (Eva Bronzini) et reste sous licence Pexels. À remplacer par `6914588` ou par une photo du vrai produit si besoin.
- Consulter les [conditions Pexels](https://www.pexels.com/license/) avant une mise en vente commerciale. Les images servent uniquement de références visuelles ; elles ne prouvent ni le modèle exact, ni la marque, ni la matière ou la disponibilité des articles. Elles ne doivent pas être présentées comme un endossement des photographes ou de Pexels.

## Refabriquer les photos

`npm run photos:build` (script `scripts/build-product-photos.mjs`) dépose les photos d’origine dans `sources/` (dossier non versionné, nommées `<id>.jpg` / `<id>-extra.jpg`), rogne leur fond uni, les redimensionne en « contain » sans déformation sur un canvas blanc 800 × 960 et les enregistre dans `products/` en JPEG qualité 84. Le script échoue si une source manque ou si une photo générée paraît vide.

## Repli

`products/produit-indisponible.svg` est le repli chargé par le composant `Photo` si un fichier image manque. Les anciennes illustrations SVG du catalogue ont été supprimées : le catalogue n’affiche plus que des photos.

## Prix et quantités de démonstration

Les prix repères du casque (`12 900 FCFA`) et du sac (`9 200 FCFA`) sont comparés à des offres locales observées en ligne le 9 octobre 2026 ; ils ne sont pas des devis pour les modèles illustrés. Les quantités initiales (`18` casques, `12` sacs) sont des valeurs de démonstration, pas un inventaire vérifié par les photos. Le stock courant est lu dans PostgreSQL et n’est pas réinitialisé lorsque `shared/products.js` change. Confirmer le stock, les références et le prix final avant d’accepter des commandes.

## Remplacer par les photos des vrais produits

Déposer les nouvelles photos aux mêmes noms (`<id>.jpg` / `<id>-extra.jpg`, format 5:6, fond neutre) — directement dans `products/`, ou dans `sources/` puis `npm run photos:build` pour garder le cadrage homogène — puis mettre à jour le tableau ci-dessus (fichier → source → licence).

## Logo officiel à fournir

Déposer le logo SVG officiel ici sous le nom **`logo.svg`**. Le chemin est configurable dans `src/brand.js` (`BRAND_LOGO_PATH`). Pour un PNG haute résolution, déposer le fichier dans ce dossier puis remplacer la constante par `/images/logo.png`. Le composant de marque met automatiquement à jour le favicon lorsque l’image existe ; sinon il conserve son monogramme de repli et `public/favicon.svg`.

## Hero

`hero.png` (hero d’accueil et section histoire) est un visuel préexistant dont la provenance n’est pas documentée. Confirmer qu’il s’agit d’un visuel fourni par le client, sinon le remplacer par une photo libre de droits et compléter ce fichier.
