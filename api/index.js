// Fonction serverless Vercel : toute la route /api/* est réécrite vers ce fichier (voir vercel.json).
// La même application Express que le serveur local ; le frontend est servi statiquement par Vercel depuis dist/.
import { createApp } from '../server/app.js';
import { createPool, createStore, DatabaseUnavailableError } from '../server/store.js';

// Le store (pool PostgreSQL) n'est créé qu'à la première requête, et non au chargement du module :
// sans DATABASE_URL, une erreur au chargement ferait échouer toute la fonction, /api/health compris.
let store = null;
function getStore() {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseUnavailableError('Base de données non configurée : le catalogue et les commandes sont indisponibles pour le moment.');
  }
  store ??= createStore(createPool(process.env.DATABASE_URL));
  return store;
}

// Façade appelée par l'application : chaque méthode résout le store réel au moment de l'appel.
const lazyStore = {
  ensureReady: async () => getStore().ensureReady(),
  ping: async () => getStore().ping(),
  listStock: async () => getStore().listStock(),
  findOrderByRequest: async (requestId) => getStore().findOrderByRequest(requestId),
  trackOrder: async (params) => getStore().trackOrder(params),
  placeOrder: async (order) => getStore().placeOrder(order),
  // Espace de gestion (/admin) : mêmes méthodes que le serveur Node, résolues à l'appel.
  listCustomProducts: async () => getStore().listCustomProducts(),
  createCustomProduct: async (product) => getStore().createCustomProduct(product),
  updateCustomProduct: async (product) => getStore().updateCustomProduct(product),
  deleteCustomProduct: async (id) => getStore().deleteCustomProduct(id),
  listProductSettings: async () => getStore().listProductSettings(),
  saveProductSettings: async (settings) => getStore().saveProductSettings(settings),
  listProductPhotos: async () => getStore().listProductPhotos(),
  getProductPhoto: async (photo) => getStore().getProductPhoto(photo),
  saveProductPhoto: async (photo) => getStore().saveProductPhoto(photo),
  deleteProductPhoto: async (photo) => getStore().deleteProductPhoto(photo),
  setStock: async (id, quantity) => getStore().setStock(id, quantity),
  listOrders: async (options) => getStore().listOrders(options),
  setOrderStatus: async (order) => getStore().setOrderStatus(order),
  salesByPeriod: async (period) => getStore().salesByPeriod(period),
  listAgents: async () => getStore().listAgents(),
  createAgent: async (agent) => getStore().createAgent(agent),
  findAgentByCode: async (code) => getStore().findAgentByCode(code),
  getAgentById: async (id) => getStore().getAgentById(id),
  revokeAgent: async (id, actor) => getStore().revokeAgent(id, actor),
  recordEvent: async (event) => getStore().recordEvent(event),
  touchVisitor: async (visitor) => getStore().touchVisitor(visitor),
  getRealtimeOverview: async (options) => getStore().getRealtimeOverview(options),
};

export default createApp({store: lazyStore, production: process.env.NODE_ENV === 'production'});
