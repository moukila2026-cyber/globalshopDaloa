import { z } from 'zod';
import { products, shippingFee } from '../shared/products.js';

// Créneaux de livraison proposés au client. La Côte d'Ivoire reste à GMT toute l'année :
// les libellés sont donc les heures locales d'Abidjan, sans changement d'heure à gérer.
export const deliverySlots = ['08:00 – 12:00', '12:00 – 16:00', '16:00 – 19:00'];

// Cycle de vie d'une commande. Les commandes annulées restituent leur stock (voir server/store.js).
export const orderStatuses = ['nouvelle', 'en_preparation', 'livree', 'annulee'];

export const orderStatusLabels = {
  nouvelle: 'Nouvelle',
  en_preparation: 'En préparation',
  livree: 'Livrée',
  annulee: 'Annulée'
};

// Formes courantes d'un numéro ivoirien : 0700000000, +2250700000000, 2250700000000 ou
// 002250700000000, avec espaces, points, tirets ou parenthèses. On normalise avant de valider
// pour ne pas refuser une commande simplement parce que l'indicatif est écrit autrement.
export function normalizeIvorianPhone(value) {
  if (typeof value !== 'string') return value;
  const compact = value.trim().replace(/[\s.()/\\-]/g, '');
  if (compact.startsWith('00225')) return `+225${compact.slice(5)}`;
  if (/^225[0-9]{10}$/.test(compact)) return `+${compact}`;
  return compact;
}

const phoneSchema = z.string()
  .transform(normalizeIvorianPhone)
  .pipe(z.string().regex(/^(?:\+225)?[0-9]{10}$/));

// Message d'erreur ciblé : le message générique précédent ne disait pas au client quel champ
// corriger. On ne renvoie que le nom du champ et la règle, jamais la valeur saisie.
export function orderValidationError(issues = []) {
  const messages = [];
  const add = (message) => {
    if (!messages.includes(message)) messages.push(message);
  };
  for (const issue of issues) {
    const [root, field] = issue.path ?? [];
    if (root === 'customer' && field === 'name') add('Nom : saisissez au moins 2 caractères.');
    else if (root === 'customer' && field === 'phone') add('Téléphone : saisissez un numéro ivoirien à 10 chiffres, avec 225 ou +225 facultatif (ex. 07 00 00 00 00).');
    else if (root === 'customer' && field === 'city') add('Ville : choisissez Daloa ou Bouaké.');
    else if (root === 'customer' && field === 'address') add('Adresse : précisez au moins 8 caractères (quartier, rue et repère).');
    else if (root === 'customer' && field === 'note') add('Précision pour le livreur : 500 caractères maximum.');
    else if (root === 'customer') add('Coordonnées : vérifiez le nom, le téléphone, la ville et l’adresse.');
    else if (root === 'items') add('Panier : vérifiez les produits et les quantités (1 à 10 par produit).');
    else if (root === 'deliverySlot') add('Créneau de livraison : choisissez un des créneaux proposés.');
    else if (root === 'payment') add('Paiement : seul le paiement en espèces à la livraison est proposé.');
    else add('Commande invalide : rechargez la page, puis réessayez.');
  }
  return messages.length ? messages.join(' ') : 'Vérifiez vos coordonnées et les produits de votre panier.';
}

export const orderSchema = z.object({
  customer: z.object({name: z.string().trim().min(2).max(100), phone: phoneSchema, city: z.enum(['Daloa', 'Bouaké']), address: z.string().trim().min(8).max(300), note: z.string().trim().max(500).default('')}),
  items: z.array(z.object({id: z.string().max(40), quantity: z.number().int().min(1).max(10)})).min(1).max(20),
  payment: z.literal('cash'),
  // Créneau souhaité : facultatif pour rester compatible avec un client plus ancien,
  // qui laisse alors l'équipe confirmer le créneau par téléphone.
  deliverySlot: z.enum(deliverySlots).nullable().optional().transform(value => value ?? null),
  requestId: z.string().uuid()
}).strict();
export function priceOrder(items) {
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Un produit ne peut apparaître qu’une fois.');
  const lines = items.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) throw new Error('Produit introuvable.');
    return {id: product.id, name: product.name, quantity: item.quantity, unitPrice: product.price};
  });
  const subtotal = lines.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  const delivery = shippingFee(subtotal);
  return {lines, subtotal, delivery, total: subtotal + delivery};
}
