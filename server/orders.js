import { z } from 'zod';
import { products, shippingFee } from '../shared/products.js';
export const orderSchema = z.object({
  customer: z.object({name: z.string().trim().min(2).max(100), phone: z.string().regex(/^(?:\+225)?[0-9]{10}$/), city: z.enum(['Daloa', 'Bouaké']), address: z.string().trim().min(8).max(300), note: z.string().trim().max(500).default('')}),
  items: z.array(z.object({id: z.string().max(40), quantity: z.number().int().min(1).max(10)})).min(1).max(20),
  payment: z.literal('cash'),
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
