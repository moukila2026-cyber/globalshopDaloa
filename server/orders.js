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

export const orderSchema = z.object({
  customer: z.object({name: z.string().trim().min(2).max(100), phone: z.string().regex(/^(?:\+225)?[0-9]{10}$/), city: z.enum(['Daloa', 'Bouaké']), address: z.string().trim().min(8).max(300), note: z.string().trim().max(500).default('')}),
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
