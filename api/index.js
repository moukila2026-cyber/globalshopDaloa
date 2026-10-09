// Fonction serverless Vercel : toute la route /api/* est réécrite vers ce fichier (voir vercel.json).
// La même application Express que le serveur local ; le frontend est servi statiquement par Vercel depuis dist/.
import { createApp } from '../server/app.js';
import { createPool, createStore } from '../server/store.js';

const store = createStore(createPool(process.env.DATABASE_URL));

export default createApp({store, production: process.env.NODE_ENV === 'production'});
