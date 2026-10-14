# Global Shop Daloa

Boutique React/Vite en français avec API Express et PostgreSQL (Neon), déployable sur Vercel. Sans Supabase.

## Démarrer en local

Node.js **22.12+**. Une base PostgreSQL est requise : utilisez une branche Neon de développement ou un PostgreSQL local.

```sh
npm ci
export DATABASE_URL='postgres://USER:PASSWORD@HOTE/globalshop?sslmode=require'
npm run dev
```

Accès : http://localhost:3000. Serveur lié à `0.0.0.0`, API et frontend sur la même origine. Au démarrage, le schéma est créé s'il n'existe pas et le stock initial est inséré (sans écraser les stocks existants). Pour un PostgreSQL local sans TLS : `postgres://postgres:postgres@localhost:5432/gs` (TLS désactivé uniquement pour `localhost`).

```sh
npm test          # 24 tests (API, espace de gestion, import SQLite, interface) ; PostgreSQL éphémère automatique (ou TEST_DATABASE_URL)
npm run build     # génère dist/
npm start         # production locale, sert dist/ (DATABASE_URL requis)
```

Pour disposer de l'espace de gestion en local, définir aussi `ADMIN_PASSWORD` (et éventuellement `WHATSAPP_NUMBER`), puis ouvrir http://localhost:3000/admin.

## Fonctionnalités

- Quatre collections, recherche, filtres catégories/promotions/favoris et tri.
- Fiches produits et visionneuse plein écran (lightbox) sur chaque image du catalogue et des fiches : précédent/suivant (clavier, boutons, swipe tactile), fermeture par Échap, focus piégé et restauré, légende, animations réduites selon la préférence système.
- Panier et favoris locaux persistants, frais de livraison calculés.
- Livraison Daloa/Bouaké, formulaire et confirmation de commande sans compte, avec **créneau de livraison** au choix (heures d'Abidjan : `08:00 – 12:00`, `12:00 – 16:00`, `16:00 – 19:00`), enregistré avec la commande.
- Paiement en espèces à la livraison, enregistrement PostgreSQL et référence de commande.
- **Lien WhatsApp (wa.me)** après la commande : le récapitulatif (référence, articles, adresse, créneau, montant) est prérempli vers le numéro de la boutique. C'est le client qui envoie le message : **aucun envoi automatique** n'a lieu depuis le site.
- **Espace de gestion `/admin`** : commandes en trois colonnes, produits (prix, prix barré, stock, visibilité), promotions à étiquette automatique, photos produit stockées dans PostgreSQL et ventes par période en heure d'Abidjan. Voir la section dédiée.
- Inventaire transactionnel, anti-doublons par clé idempotente, recalcul serveur des prix, restitution du stock à l'annulation d'une commande.
- Responsive, navigation clavier des dialogues, réduction des animations, polices auto-hébergées.

## Images et identité visuelle

- Les images du catalogue restent locales et sont référencées dans `shared/products.js`; l’image de repli est `public/images/products/produit-indisponible.svg`. Les huit produits affichent désormais **deux photos** (`<id>.jpg` et `<id>-extra.jpg`) servies depuis `public/images/products/` : JPEG 5:6 (800 × 960), qualité 84, fond blanc studio, sujet recadré et centré sans déformation. Les anciennes illustrations SVG du catalogue ont été supprimées, et le script `scripts/generate-product-illustrations.mjs` avec elles.
- Les photos sont (re)générées par `npm run photos:build` (`scripts/build-product-photos.mjs`) à partir des originaux déposés dans `sources/` (dossier non versionné).
- Sources des photos : toutes proviennent de Pexels, sous [licence Pexels](https://www.pexels.com/license/) (usage commercial autorisé, attribution non obligatoire). Le tableau complet fichier → photo → photographe → licence est dans `public/images/README.md`. Ce sont des visuels de référence non contractuels, pas la preuve que l’article exact est en stock.
- Prix repères consultés le 9 octobre 2026 : casque à `12 900 FCFA`, comparable aux offres [Djokstore](https://djokstore.ci/collections/casques) et [Jumia](https://www.jumia.ci/mlp-casque-bluetooth/) ; sac à `9 200 FCFA`, dans la fourchette des [sacs bandoulière listés sur Jumia Côte d’Ivoire](https://www.jumia.ci/sacs-main-portefeuilles-sacs-bandouliere/). Les offres sont variables et les modèles ne sont pas identifiés par les photos : ces prix ne sont pas des devis fournisseur.
- Les quantités de départ (18 casques, 12 sacs) sont des stocks de démonstration. Le catalogue lit le stock courant en base PostgreSQL; l’initialisation insère les valeurs de `shared/products.js` uniquement pour les références absentes et n’écrase jamais un stock déjà enregistré. Confirmer ces quantités dans Neon avant la vente.
- Le hero et la section histoire utilisent l’image locale préexistante `public/images/hero.png`. Vérifier sa provenance et son autorisation commerciale avant ouverture.
- Logo : `public/images/logo.svg` est présent. C’est un monogramme « GS » proposé aux couleurs de la marque (vert `#2b4e40`, crème, orange `#b77551`), dessiné à partir des tracés de la police Cormorant Garamond ; ce n’est pas encore le logo officiel du client. Pour le remplacer, déposer le fichier officiel au même nom (ou un `logo.png` et changer `BRAND_LOGO_PATH` dans `src/brand.js`). Le logo s’affiche en haut à gauche de l’en-tête (collant, taille réduite sur mobile), dans le pied de page, dans la confirmation de commande et dans le favicon ; le texte alternatif est « Logo Global Shop Daloa ». Détails et provenance dans `public/images/README.md`.
- Les photos restent servies depuis l’origine du site ; `img-src 'self'` dans `server/app.js` n’est pas assoupli.
- Une photo peut aussi être **remplacée depuis `/admin`** : elle est alors stockée dans PostgreSQL (`product_photos`) et servie par `/api/products/<id>/photo/<main|extra>`. Les fichiers de `public/images/products/` restent le repli : supprimer la photo téléversée y revient immédiatement, sans redéploiement.

## Architecture

| Élément                                   | Fichier                                                 |
| ----------------------------------------- | ------------------------------------------------------- |
| Application Express (API + protections)   | `server/app.js`                                         |
| Stockage PostgreSQL, schéma, transactions | `server/store.js`                                       |
| Logique de commande et validation Zod     | `server/orders.js`                                      |
| Espace de gestion : authentification, commandes, catalogue, photos, ventes | `server/admin.js` (`/api/admin/*`) |
| Interface d'administration (chargée à la demande sur `/admin`) | `src/admin/AdminApp.jsx`, `src/admin/admin.css` |
| Serveur local / production Node           | `server/index.js`                                       |
| Fonction serverless Vercel                | `api/index.js` (routes `/api/*` via `vercel.json`)      |
| Import ponctuel depuis l'ancien SQLite    | `scripts/import-sqlite.js` (`npm run db:import-sqlite`) |
| Génération des photos produit (5:6, 800×960) | `scripts/build-product-photos.mjs` (`npm run photos:build`, sources dans `sources/`) |

Le frontend est compilé dans `dist/` et servi en statique. Sur Vercel, les routes non-API renvoient vers `index.html` (SPA).

## Espace de gestion `/admin`

Ouvrir `https://<domaine>/admin`. Aucune donnée client n'est accessible sans mot de passe ni code agent.

### Rôles : administrateur et agents

- **Administrateur principal** : connexion avec `ADMIN_PASSWORD`. Accès complet : commandes, catalogue (produits, prix, stocks, photos, nouveaux produits), ventes par période, et génération ou révocation des codes agents (onglet « Agents & Codes »).
- **Agents** : connexion avec un code personnel `AGT-XXXX-XXXX`, généré par l'administrateur et révocable à tout moment. Ils gèrent les commandes (confirmation, préparation, livraison, annulation) et consultent le catalogue en lecture seule : ils ne peuvent ni modifier les stocks, les prix ni les photos, ni créer de produit. Un code révoqué est refusé dès la requête suivante, même si une session est ouverte.

### Accès et variables

| Variable | Rôle |
| --- | --- |
| `ADMIN_PASSWORD` | **Obligatoire pour utiliser `/admin`.** Mot de passe unique de l'équipe. Sans elle, l'API d'administration répond 503 et l'espace reste fermé. |
| `WHATSAPP_NUMBER` | **Nécessaire pour les liens wa.me.** Numéro au format international (`+2250700000000`) ou local ivoirien à 10 chiffres (`07 00 00 00 00`) ; il est normalisé en `225…`. Sans lui, aucun lien WhatsApp n'est affiché. |
| `ADMIN_SECRET` | Facultatif. Clé de signature des sessions. Si elle est absente, la clé est dérivée de `ADMIN_PASSWORD` (changer le mot de passe déconnecte alors toutes les sessions). La définir séparément permet de changer le mot de passe sans déconnecter l'équipe. |

Connexion : le mot de passe est envoyé en POST sur `/api/admin/session` (limité à 8 tentatives / 15 min), comparé à `ADMIN_PASSWORD` en temps constant, puis un jeton de session signé (HMAC-SHA-256, 12 heures) est conservé dans `sessionStorage` de l'onglet. Toutes les routes `/api/admin/*` exigent ce jeton (`Authorization: Bearer`). La boutique publique n'expose ni commandes ni coordonnées.

### Commandes, en trois colonnes

**Nouvelles** (à confirmer par téléphone) → **En préparation** → **Terminées** (livrées ou annulées). Chaque carte affiche la référence, la date et l'heure d'Abidjan, le client (téléphone cliquable), l'adresse, le créneau de livraison, le détail des articles et le montant à encaisser. Actions : avancer le statut, annuler (**le stock réservé est alors restitué dans la même transaction**), ouvrir WhatsApp ou appeler, copier le récapitulatif. La liste se rafraîchit automatiquement toutes les minutes.

**Annulation** : le bouton « Annuler (stock restitué) » n'est proposé que dans la colonne « Terminées », et il n'est pas affiché pour une commande **livrée**. Le serveur refuse aussi l'annulation d'une commande livrée (réponse 409) : la marchandise a été remise au client, son stock n'est donc pas restitué. L'annulation d'une commande en attente ou en préparation reste possible par l'API (`PATCH /api/admin/orders/:id`) ; son stock réservé est alors restitué dans la même transaction. Aucun bouton d'annulation n'est proposé pour ces commandes dans l'interface à ce stade.

### Produits, promotions et photos

- Prix de vente, prix barré, stock et visibilité (« Visible sur le site ») sont modifiables produit par produit. Un produit masqué disparaît du catalogue public sans être supprimé.
- **Étiquette de promotion automatique** : dès qu'un prix barré supérieur au prix de vente est enregistré, le badge (`−25 %`) est calculé par le serveur — jamais saisi à la main, donc jamais incohérent. Un prix barré inférieur ou égal au prix de vente est refusé. Retirer le prix barré supprime l'étiquette automatique.
- **Photos en PostgreSQL** : téléverser une photo (JPEG, PNG ou WebP, 2 Mo maximum) la stocke dans la table `product_photos` (`bytea`) et remplace l'image du catalogue ; la vue principale et la vue secondaire sont gérées séparément. Le type réel du fichier est vérifié à partir de sa signature (le type annoncé par le navigateur n'est pas cru). L'image est servie par `/api/products/<id>/photo/<main|extra>?v=<version>`, ce qui invalide le cache dès qu'elle change. « Retirer la photo » revient au fichier statique de `public/images/products/`. Aucun fichier n'est écrit sur le disque : rien à nettoyer entre deux déploiements.

### Ventes par période, en heure d'Abidjan

Le rapport agrège les commandes par **jour civil d'Abidjan** (`Africa/Abidjan`, GMT toute l'année) directement en SQL : les totaux restent justes même si la base ou le serveur tourne en UTC. Périodes prêtes à l'emploi (7 jours, 30 jours, mois en cours) ou dates personnalisées (366 jours maximum). **Les commandes annulées sont exclues du chiffre d'affaires** mais restent visibles dans la colonne « Terminées ».

### WhatsApp : un lien, pas un envoi

Le numéro `WHATSAPP_NUMBER` construit un lien `https://wa.me/…` avec le message prérempli (référence, montant, créneau, adresse, articles) côté boutique comme côté client. **Aucun message n'est envoyé automatiquement** : WhatsApp s'ouvre avec le texte prêt, et c'est l'utilisateur qui appuie sur « Envoyer ». Le site ne détient donc aucun identifiant d'API WhatsApp et n'a pas besoin de la validation Meta.

### Migration du schéma

La migration est **strictement additive et idempotente**, exécutée au premier démarrage comme avant : `ALTER TABLE orders ADD COLUMN IF NOT EXISTS status …`, `delivery_slot`, puis `CREATE TABLE IF NOT EXISTS product_settings` et `product_photos`. Aucune table ni colonne existante n'est supprimée ou renommée, aucune donnée n'est réécrite : les commandes déjà enregistrées reçoivent le statut `nouvelle` et un créneau à confirmer. La contrainte de statut est vérifiée par Zod côté API plutôt que par une contrainte SQL, pour rester ajoutable sans verrou ni réécriture de table.

### Limites connues

- **L'administrateur principal est un compte unique** (un seul `ADMIN_PASSWORD` partagé). Les agents ont, eux, des codes individuels et révocables. Le journal des événements enregistre l'auteur de chaque action, mais il n'existe pas encore de journal d'audit formel ni de comptes administrateurs nominatifs : à ajouter avant de confier l'administration à plusieurs personnes.
- **Le test visuel sur téléphone reste à faire** : l'espace de gestion a été vérifié par les tests automatisés et sur ordinateur, mais son affichage sur un vrai écran de téléphone (colonnes empilées, téléversement d'une photo depuis l'appareil photo) doit encore être contrôlé.
- Un mot de passe trop court reste la principale faiblesse : la limitation de débit freine les tentatives mais ne remplace pas un mot de passe long.
- La limitation de débit est en mémoire, donc par instance serverless (comme pour le reste de l'API).

## Déploiement sur Vercel avec Neon

1. **Créer la base Neon** : projet Neon dans la région la plus proche, puis copier la chaîne de connexion **pooled** (hôte contenant `-pooler`, avec `sslmode=require`). Ne jamais la committer.
2. **Importer le dépôt sur Vercel** : _Add New → Project_, puis sélectionner `moukila2026-cyber/globalshopDaloa`. Le fichier `vercel.json` fixe le build (`npm run build`), la sortie (`dist`) et les réécritures. Vite est détecté automatiquement.
3. **Variables d'environnement** (Project Settings → Environment Variables, environnement _Production_) :
   - `DATABASE_URL` : chaîne Neon pooled (obligatoire).
   - `PUBLIC_ORIGIN` : origine HTTPS exacte, par exemple `https://globalshop.example`, sans slash final. Obligatoire pour que les POST soient acceptés depuis le domaine public.
   - `PG_POOL_MAX` : optionnel, `5` par défaut.
   - `ADMIN_PASSWORD` : mot de passe de l'espace de gestion `/admin` (sans lui, `/admin` répond 503 et reste fermé).
   - `WHATSAPP_NUMBER` : numéro de la boutique pour les liens wa.me (facultatif, mais sans lui aucun lien WhatsApp n'apparaît).
   - `ADMIN_SECRET` : facultatif, clé de signature des sessions d'administration (voir la section `/admin`).
   - `NODE_ENV=production` est défini automatiquement par Vercel, ainsi que `VERCEL=1` (proxy de confiance activé automatiquement).
4. **Déployer**, puis vérifier : `https://<domaine>/api/health` doit renvoyer `{"status":"ok","database":"ok"}`, et `https://<domaine>/api/products` doit renvoyer la liste avec les stocks (la première requête crée le schéma). Voir le tableau de diagnostic ci-dessous.
5. **Domaine** : ajouter le domaine personnalisé dans Vercel, mettre `PUBLIC_ORIGIN` sur cette URL exacte, puis redéployer.
6. **Test de commande** : passer une commande de test, vérifier la ligne dans la table `orders` (Neon SQL Editor), puis supprimer les données de test.

Variante en ligne de commande : `vercel env add DATABASE_URL production`, puis `vercel --prod`.

### Diagnostic : catalogue vide ou « Stocks indisponibles »

`/api/health` répond toujours en 200 et indique l'état de la base dans `database`. C'est le premier point à contrôler.

| Constat | Cause probable | Action |
| --- | --- | --- |
| `/api/health` → `{"status":"ok","database":"unavailable"}` et `/api/products` → 503 « Base de données non configurée… » | `DATABASE_URL` absente dans Vercel | Ajouter `DATABASE_URL` (Neon pooled, `sslmode=require`) dans Settings → Environment Variables, puis redéployer |
| `/api/products` → 503 « Base de données indisponible… » alors que `DATABASE_URL` est définie | Base Neon en veille, mauvais mot de passe ou hôte incorrect | Vérifier la chaîne dans Neon, relancer la base, redéployer |
| Bandeau « Stocks indisponibles » et libellés « Stock à confirmer » sur le site | `/api/products` ne répond pas : le site affiche le catalogue de référence (`shared/products.js`) | Corriger l'API selon les lignes ci-dessus ; « Réessayer » recharge les stocks |
| Commande refusée avec une erreur 409 | Stock insuffisant ou produit épuisé | Comportement normal : vérifier la table `stock` |
| `/admin` affiche « Espace de gestion non configuré » (503) | `ADMIN_PASSWORD` absente dans Vercel | Ajouter `ADMIN_PASSWORD` (et éventuellement `WHATSAPP_NUMBER`, `ADMIN_SECRET`), puis redéployer |
| `/admin` affiche « Session expirée ou invalide » | Jeton de plus de 12 heures, ou `ADMIN_SECRET`/`ADMIN_PASSWORD` modifié | Se reconnecter ; définir `ADMIN_SECRET` pour que les sessions survivent à un changement de mot de passe |
| Aucun bouton WhatsApp après une commande | `WHATSAPP_NUMBER` absente ou mal saisie | Renseigner le numéro au format international (`+225…`) puis redéployer |

La chaîne `DATABASE_URL` n'est jamais renvoyée par l'API ni affichée sur le site ; ne pas la copier dans les tickets ou les captures d'écran.

### Migration des commandes SQLite existantes

Si l'ancienne version (SQLite) a déjà reçu des commandes réelles :

1. Mettre la boutique en maintenance ou arrêter l'ancien service pour figer le fichier `data/shop.sqlite`.
2. Sur une machine disposant de Node 22.13+ et de la base SQLite :
   ```sh
   npm ci
   SQLITE_PATH=/chemin/vers/shop.sqlite DATABASE_URL='postgres://…?sslmode=require' npm run db:import-sqlite
   ```
3. Le script crée le schéma, copie le stock (valeurs SQLite) et les commandes (identifiants, références et horodatages UTC conservés). Il est **refusé** si la base PostgreSQL contient déjà des commandes, pour ne jamais écraser un stock en production.
4. Vérifier le nombre de commandes importées, puis déployer.

Sans commande réelle dans SQLite, cette étape est inutile : la base est initialisée automatiquement.

## Données et sécurité

Les commandes sont stockées dans PostgreSQL (table `orders`, payload JSONB, contrainte UNIQUE sur `request_id` pour l'idempotence, colonnes `status` et `delivery_slot`). Le stock est dans la table `stock` avec `CHECK (quantity >= 0)`. Les réglages du catalogue modifiables depuis `/admin` sont dans `product_settings` (prix, prix barré, visibilité) et les photos téléversées dans `product_photos` (`bytea`). La réservation de stock et la création de commande se font dans une seule transaction ; les lignes sont verrouillées dans un ordre fixe pour éviter les interblocages. Les requêtes utilisent des paramètres SQL et Zod pour la validation. L'API ne publie jamais les coordonnées ou commandes (`GET /api/orders` renvoie 404).

Protections conservées : Helmet, CSP et HSTS en production, `frame-ancestors 'self'`, `img-src 'self'` (images locales uniquement, y compris les photos servies depuis PostgreSQL), limitation de débit (100 req/min sur `/api`, 15 commandes / 15 min), limite du corps JSON à 16 Ko, vérification d'origine et de `Sec-Fetch-Site` sur les écritures, exigence `application/json`, recalcul serveur des prix, `Cache-Control: no-store` sur l'API. Pas d'identifiants Supabase, pas de données bancaires ni de suivi publicitaire.

L'espace de gestion suit les mêmes règles : écritures `application/json` (seule exception, le téléversement d'une photo, limité à 2 Mo et validé par signature de fichier), vérification d'origine, `no-store`, jeton de session signé exigé sur chaque route, comparaison du mot de passe en temps constant, 8 tentatives de connexion par tranche de 15 minutes. Les coordonnées des clients ne sont jamais exposées sans jeton : `GET /api/orders` continue de répondre 404. Les photos produit sont publiques par nature (elles s'affichent sur le site) ; aucune donnée personnelle n'y transite.

Points spécifiques à PostgreSQL et Vercel :

- **TLS** : la connexion à Neon utilise TLS avec vérification du certificat. TLS est désactivé uniquement pour `localhost` et `127.0.0.1`.
- **Limitation de débit** : elle est en mémoire, donc **par instance** serverless. Elle freine les abus simples mais n'est pas globale. Pour une protection stricte, activer les règles de limitation de débit de Vercel Firewall sur `/api/orders`.
- **Secrets** : `DATABASE_URL` n'est lue que par le code serveur, jamais exposée au navigateur. Faire tourner le mot de passe Neon si la chaîne a été partagée.
- **Sauvegardes** : Neon conserve un historique (restauration point-in-time selon le plan). Vérifier la rétention de votre plan et exporter périodiquement (`pg_dump` ou export Neon) pour les obligations comptables.
- **Connexions** : `PG_POOL_MAX` est volontairement bas ; utiliser l'URL pooled Neon pour absorber les pics de fonctions serverless.
- **Trust proxy** : activé automatiquement sur Vercel (`VERCEL=1`), ou via `TRUST_PROXY=1` derrière un proxy unique de confiance. Ne pas l'activer sans proxy.
- Le fichier `.env` n'est pas chargé automatiquement : configurer les variables dans Vercel ou dans le gestionnaire du serveur (voir `.env.example`).
- Sur un serveur Node classique (hors Vercel), utiliser HTTPS via un reverse proxy, `PUBLIC_ORIGIN` exacte et `TRUST_PROXY=1` uniquement si le proxy est de confiance. La production interdit l'intégration dans des iframes ; la prévisualisation de développement l'autorise.
- Droit à l'effacement et conservation : prévoir la suppression ou l'export des commandes d'un client (requête SQL sur `orders.payload->'customer'`) et une durée de conservation.

## Avant toute ouverture commerciale

Cette version est une démonstration fonctionnelle, pas une boutique déjà opérationnelle :

1. Confirmer ou remplacer les produits, caractéristiques, stocks, prix et images dans `shared/products.js`. Les seize photos du catalogue sont des visuels Pexels de référence : les remplacer par celles des vrais produits vendus (mêmes noms `<id>.jpg` / `<id>-extra.jpg`, format 5:6, fond neutre) et mettre à jour le tableau de licences de `public/images/README.md`. Les stocks de démonstration de 18 et 12 doivent être remplacés ou validés dans PostgreSQL avant la vente. Vérifier aussi la provenance commerciale de `public/images/hero.png`.
2. Remplacer le monogramme proposé (`public/images/logo.svg`) par le logo officiel, ou ajuster `BRAND_LOGO_PATH` dans `src/brand.js` pour un PNG haute résolution. Contrôler le rendu dans l’en-tête, le pied de page, l’écran de confirmation de commande et le favicon.
3. Remplacer les avis de démonstration par des avis authentiques ; aucune mention « achat vérifié » n'est utilisée.
4. Renseigner identité légale, contacts, CGV, délais/retours, responsable de traitement et durée de conservation dans les contenus d'information de `src/main.jsx`.
5. Organiser le traitement des commandes : un espace de gestion authentifié existe désormais sur `/admin` (commandes, produits, photos, ventes). Les rôles agents (codes individuels et révocables) existent déjà. Avant de confier l'administration à plusieurs personnes, ajouter des comptes administrateurs nominatifs et un journal d'audit, et définir un `ADMIN_PASSWORD` long. Aucun SMS ni e-mail n'est envoyé automatiquement : la confirmation et le suivi restent manuels (téléphone ou lien wa.me).
6. Connecter un prestataire agréé pour Wave/Orange/MTN si souhaité : les paiements Mobile Money ne sont pas simulés. Prévoir webhooks signés et vérification serveur.
7. Configurer sauvegardes Neon, supervision (logs Vercel, alertes sur `/api/health`) et processus de confirmation/livraison. Les stocks sont réservés immédiatement ; une gestion d'annulation/restitution doit être ajoutée pour l'exploitation.

Le stock initial est inséré uniquement lors du premier lancement (ligne absente). Modifier `shared/products.js` ne réinitialise pas les stocks déjà enregistrés. Ne supprimer la base (ou une branche Neon) qu'en développement si aucune commande réelle n'y figure.
