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
npm test          # tests API + import SQLite ; PostgreSQL éphémère automatique (ou TEST_DATABASE_URL)
npm run build     # génère dist/
npm start         # production locale, sert dist/ (DATABASE_URL requis)
```

## Fonctionnalités

- Quatre collections, recherche, filtres catégories/promotions/favoris et tri.
- Fiches produits, galeries, caractéristiques et avis illustratifs.
- Panier et favoris locaux persistants, frais de livraison calculés.
- Livraison Daloa/Bouaké, formulaire et confirmation de commande sans compte.
- Paiement en espèces à la livraison, enregistrement PostgreSQL et référence de commande.
- Inventaire transactionnel, anti-doublons par clé idempotente, recalcul serveur des prix.
- Responsive, navigation clavier des dialogues, réduction des animations, polices auto-hébergées.

## Architecture

| Élément | Fichier |
| --- | --- |
| Application Express (API + protections) | `server/app.js` |
| Stockage PostgreSQL, schéma, transactions | `server/store.js` |
| Logique de commande et validation Zod | `server/orders.js` |
| Serveur local / production Node | `server/index.js` |
| Fonction serverless Vercel | `api/index.js` (routes `/api/*` via `vercel.json`) |
| Import ponctuel depuis l'ancien SQLite | `scripts/import-sqlite.js` (`npm run db:import-sqlite`) |

Le frontend est compilé dans `dist/` et servi en statique. Sur Vercel, les routes non-API renvoient vers `index.html` (SPA).

## Déploiement sur Vercel avec Neon

1. **Créer la base Neon** : projet Neon dans la région la plus proche, puis copier la chaîne de connexion **pooled** (hôte contenant `-pooler`, avec `sslmode=require`). Ne jamais la committer.
2. **Importer le dépôt sur Vercel** : *Add New → Project*, puis sélectionner `moukila2026-cyber/globalshopDaloa`. Le fichier `vercel.json` fixe le build (`npm run build`), la sortie (`dist`) et les réécritures. Vite est détecté automatiquement.
3. **Variables d'environnement** (Project Settings → Environment Variables, environnement *Production*) :
   - `DATABASE_URL` : chaîne Neon pooled (obligatoire).
   - `PUBLIC_ORIGIN` : origine HTTPS exacte, par exemple `https://globalshop.example`, sans slash final. Obligatoire pour que les POST soient acceptés depuis le domaine public.
   - `PG_POOL_MAX` : optionnel, `5` par défaut.
   - `NODE_ENV=production` est défini automatiquement par Vercel, ainsi que `VERCEL=1` (proxy de confiance activé automatiquement).
4. **Déployer**, puis vérifier : `https://<domaine>/api/health` doit renvoyer `{"status":"ok"}`, et `https://<domaine>/api/products` doit renvoyer la liste avec les stocks (la première requête crée le schéma).
5. **Domaine** : ajouter le domaine personnalisé dans Vercel, mettre `PUBLIC_ORIGIN` sur cette URL exacte, puis redéployer.
6. **Test de commande** : passer une commande de test, vérifier la ligne dans la table `orders` (Neon SQL Editor), puis supprimer les données de test.

Variante en ligne de commande : `vercel env add DATABASE_URL production`, puis `vercel --prod`.

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

Les commandes sont stockées dans PostgreSQL (table `orders`, payload JSONB, contrainte UNIQUE sur `request_id` pour l'idempotence). Le stock est dans la table `stock` avec `CHECK (quantity >= 0)`. La réservation de stock et la création de commande se font dans une seule transaction ; les lignes sont verrouillées dans un ordre fixe pour éviter les interblocages. Les requêtes utilisent des paramètres SQL et Zod pour la validation. L'API ne publie jamais les coordonnées ou commandes (`GET /api/orders` renvoie 404).

Protections conservées à l'identique : Helmet, CSP et HSTS en production, `frame-ancestors 'self'`, limitation de débit (100 req/min sur `/api`, 15 commandes / 15 min), limite du corps JSON à 16 Ko, vérification d'origine et de `Sec-Fetch-Site` sur les écritures, exigence `application/json`, recalcul serveur des prix, `Cache-Control: no-store` sur l'API. Pas d'identifiants Supabase, pas de données bancaires ni de suivi publicitaire.

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

1. Confirmer ou remplacer les produits, caractéristiques, stocks, prix et images dans `shared/products.js`. Les images Unsplash sont externes ; l'image de couverture locale est générée et sert de repli. Vérifier licences et correspondance réelle des photos.
2. Remplacer les avis de démonstration par des avis authentiques ; aucune mention « achat vérifié » n'est utilisée.
3. Renseigner identité légale, contacts, CGV, délais/retours, responsable de traitement et durée de conservation dans les contenus d'information de `src/main.jsx`.
4. Organiser le traitement des commandes : les commandes sont enregistrées mais aucun SMS/e-mail n'est envoyé et aucune interface d'administration n'est fournie. L'opérateur doit accéder aux commandes de manière sécurisée (SQL Neon avec accès restreint). Ajouter une administration authentifiée avec rôles avant de déléguer cette gestion.
5. Connecter un prestataire agréé pour Wave/Orange/MTN si souhaité : les paiements Mobile Money ne sont pas simulés. Prévoir webhooks signés et vérification serveur.
6. Configurer sauvegardes Neon, supervision (logs Vercel, alertes sur `/api/health`) et processus de confirmation/livraison. Les stocks sont réservés immédiatement ; une gestion d'annulation/restitution doit être ajoutée pour l'exploitation.

Le stock initial est inséré uniquement lors du premier lancement (ligne absente). Modifier `shared/products.js` ne réinitialise pas les stocks déjà enregistrés. Ne supprimer la base (ou une branche Neon) qu'en développement si aucune commande réelle n'y figure.
