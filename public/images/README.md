# Images locales Global Shop Daloa

Le catalogue charge ses images depuis ce dossier : pas de requête navigateur vers un hébergeur d’images. La politique CSP de production reste limitée à `img-src 'self'`.

## Photos de référence intégrées

| Fichier local | Source Pexels | Photographe |
| --- | --- | --- |
| `products/casque.png` | [Photo 747438 — casque sans fil blanc](https://www.pexels.com/photo/white-wireless-headphones-747438/) | PublicDomainPNG.com |
| `products/casque-extra.jpg` | [Photo 3394666 — casque blanc](https://www.pexels.com/photo/white-cordless-headphone-3394666/) | Sound On |
| `products/sac.jpg` | [Photo 27046147 — sacs en cuir en studio](https://www.pexels.com/photo/leather-bags-in-a-studio-27046147/) | José Martin Segura Benites |
| `products/sac-extra.jpg` | [Photo 23223851 — sac beige à poignées noires](https://www.pexels.com/photo/gray-bag-with-handles-23223851/) | Muneeb Malhotra |

Les pages des quatre photos indiquent une licence gratuite Pexels. Consulter les [conditions Pexels](https://www.pexels.com/license/) avant une mise en vente commerciale. Les images servent uniquement de références visuelles ; elles ne prouvent ni le modèle exact, ni la marque, ni la matière ou la disponibilité des articles. Elles ne doivent pas être présentées comme un endossement des photographes ou de Pexels.

## Illustrations et repli

Les illustrations SVG originales sont conservées dans `products/` et générées avec `node scripts/generate-product-illustrations.mjs`. Le catalogue en utilise pour les produits sans photo locale. `products/produit-indisponible.svg` est le repli chargé si un fichier image manque.

## Prix et quantités de démonstration

Les prix repères du casque (`12 900 FCFA`) et du sac (`9 200 FCFA`) sont comparés à des offres locales observées en ligne le 9 octobre 2026 ; ils ne sont pas des devis pour les modèles illustrés. Les quantités initiales (`18` casques, `12` sacs) sont des valeurs de démonstration, pas un inventaire vérifié par les photos. Le stock courant est lu dans PostgreSQL et n’est pas réinitialisé lorsque `shared/products.js` change. Confirmer le stock, les références et le prix final avant d’accepter des commandes.

## Logo officiel à fournir

Déposer le logo SVG officiel ici sous le nom **`logo.svg`**. Le chemin est configurable dans `src/brand.js` (`BRAND_LOGO_PATH`). Pour un PNG haute résolution, déposer le fichier dans ce dossier puis remplacer la constante par `/images/logo.png`. Le composant de marque met automatiquement à jour le favicon lorsque l’image existe ; sinon il conserve son monogramme de repli et `public/favicon.svg`.
