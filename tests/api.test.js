import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {startTestDatabase} from './helpers/postgres.js';
test('API persists idempotent orders, protects origins and rolls stock back',async()=>{
 const database=await startTestDatabase();
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3099',DATABASE_URL:database.url},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timeout')),60000);server.stdout.on('data',d=>{if(d.toString().includes('listening')){clearTimeout(timeout);resolve();}});server.on('exit',()=>{clearTimeout(timeout);reject(Error('Server exited'));});});
  const url='http://localhost:3099/api';
  const body={customer:{name:'Client Test',phone:'0700000000',city:'Daloa',address:'Quartier Commerce'},items:[{id:'casque',quantity:1}],payment:'cash',requestId:randomUUID()};
  const post=(b,origin='http://localhost:3099')=>fetch(`${url}/orders`,{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(b)});
  assert.equal((await post(body,'https://evil.example')).status,403);
  assert.equal((await post({...body,total:1})).status,400);
  const before=await (await fetch(`${url}/products`)).json();
  const first=await post(body);assert.equal(first.status,201);const order=await first.json();assert.equal(order.total,26400);
  const duplicate=await (await post(body)).json();assert.equal(duplicate.reference,order.reference);assert.equal(duplicate.duplicate,true);
  const after=await (await fetch(`${url}/products`)).json();assert.equal(after.find(p=>p.id==='casque').stock,before.find(p=>p.id==='casque').stock-1);
  const fail=await post({...body,requestId:randomUUID(),items:[{id:'casque',quantity:1},{id:'lampe',quantity:10}]});assert.equal(fail.status,409);
  const rollback=await (await fetch(`${url}/products`)).json();assert.equal(rollback.find(p=>p.id==='casque').stock,after.find(p=>p.id==='casque').stock);
  // Requêtes concurrentes avec le même requestId : une seule commande, un seul décrément de stock.
  const concurrentId=randomUUID();
  const concurrent=await Promise.all(Array.from({length:4},()=>post({...body,requestId:concurrentId}).then(r=>r.json())));
  assert.equal(new Set(concurrent.map(o=>o.reference)).size,1);
  const afterConcurrent=await (await fetch(`${url}/products`)).json();assert.equal(afterConcurrent.find(p=>p.id==='casque').stock,after.find(p=>p.id==='casque').stock-1);
  assert.equal((await fetch(`${url}/orders`)).status,404);
  assert.equal((await fetch(`${url}/health`)).status,200);
 } finally {server.kill();await new Promise(resolve=>server.once('exit',resolve));await database.stop();}
});
