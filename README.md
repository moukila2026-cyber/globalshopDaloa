# Global Shop Daloa

Boutique React/Vite en français avec API Express et SQLite, sans Supabase.

## Démarrer

Node.js **22.13+** (module intégré `node:sqlite`).

```sh
npm ci
npm run dev
```

Accès : http://localhost:3000. Serveur lié à `0.0.0.0`, API et frontend sur la même origine.

```sh
npm test
npm run build
npm start
```

## Fonctionnalités

- Quatre collections, recherche, filtres catégories/promotions/favoris et tri.
- Fiches produits, galeries, caractéristiques et avis illustratifs.
- Panier et favoris locaux persistants, frais de livraison calculés.
- Livraison Daloa/Bouaké, formulaire et confirmation de commande sans compte.
- Paiement en espèces à la livraison, enregistrement SQLite et référence de commande.
- Inventaire transactionnel, anti-doublons par clé idempotente, recalcul serveur des prix.
- Responsive, navigation clavier des dialogues, réduction des animations, polices auto-hébergées.

## Données et sécurité

La base est dans `data/shop.sqlite` par défaut, exclue de Git, permissions `0600`. Les requêtes utilisent des paramètres SQL et Zod pour la validation. L'API ne publie jamais les coordonnées ou commandes. Helmet, CSP en production, limitation de débit, limite du corps JSON et vérification d'origine protègent les endpoints. Pas d'identifiants Supabase, pas de données bancaires ni de suivi publicitaire.

SQLite convient à une boutique mono-instance sur un serveur avec volume persistant. Ne pas installer la base sur un filesystem éphémère/serverless ni un volume partagé réseau. Pour plusieurs instances, migrer vers PostgreSQL privé et adapter le stockage. Le module SQLite intégré est encore marqué expérimental par Node 22.

Configurer les variables d'environnement via le gestionnaire du serveur (le fichier `.env` n'est pas chargé automatiquement). Voir `.env.example`. Utiliser HTTPS via un reverse proxy, `PUBLIC_ORIGIN` exacte et `TRUST_PROXY=1` uniquement si un proxy de confiance est présent. La production interdit l’intégration dans des iframes ; la prévisualisation de développement l’autorise.

Sauvegarder SQLite avec son mécanisme de sauvegarde ou après arrêt du service : ne pas copier seulement le fichier principal pendant les écritures en mode WAL. Chiffrer le disque/les sauvegardes, limiter les accès au serveur et prévoir suppression/export des données clients. Ne pas exposer le répertoire `data`. Le frontend de production est servi depuis `dist`, jamais depuis la racine.

## Avant toute ouverture commerciale

Cette version est une démonstration fonctionnelle, pas une boutique déjà opérationnelle :

1. Confirmer/remplacer les produits, caractéristiques, stocks, prix et images dans `shared/products.js`. Les images Unsplash sont externes ; l’image de couverture locale est générée et sert de repli. Vérifier licences et correspondance réelle des photos.
2. Remplacer les avis de démonstration par des avis authentiques ; aucune mention « achat vérifié » n’est utilisée.
3. Renseigner identité légale, contacts, CGV, délais/retours, responsable de traitement et durée de conservation dans les contenus d’information de `src/main.jsx`.
4. Organiser le traitement des commandes : les commandes sont enregistrées mais aucun SMS/e-mail n'est envoyé et aucune interface d'administration n'est fournie. L'opérateur doit accéder aux commandes depuis le serveur de manière sécurisée. Ajouter une administration authentifiée avec rôles avant de déléguer cette gestion.
5. Connecter un prestataire agréé pour Wave/Orange/MTN si souhaité : les paiements Mobile Money ne sont pas simulés. Prévoir webhooks signés et vérification serveur.
6. Configurer hébergement persistant, HTTPS, sauvegardes, supervision et processus de confirmation/livraison. Les stocks sont réservés immédiatement ; une gestion d'annulation/restitution doit être ajoutée pour l'exploitation.

Le stock initial est inséré uniquement lors du premier lancement. Modifier `products.js` ne réinitialise pas les stocks déjà enregistrés. Ne supprimer la base qu'en développement si aucune commande réelle n'y figure.
