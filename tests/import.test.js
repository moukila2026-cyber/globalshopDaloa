import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';
import {startTestDatabase} from './helpers/postgres.js';
test('SQLite import copies stock and orders into PostgreSQL',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gs-import-'));
 const sqlitePath=join(dir,'shop.sqlite');
 const source=new DatabaseSync(sqlitePath);
 source.exec(`CREATE TABLE stock (id TEXT PRIMARY KEY, quantity INTEGER NOT NULL CHECK(quantity >= 0));
 CREATE TABLE orders (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, reference TEXT UNIQUE NOT NULL, payload TEXT NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO stock VALUES ('casque', 3);`);
 const requestId='6a746bf7-65e2-450b-b563-48c13baef05c';
 source.prepare('INSERT INTO orders (id, request_id, reference, payload, total, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('11111111-2222-4333-8444-555555555555',requestId,'GS-2026-11111111','{"customer":{"name":"Client Test"},"payment":"cash"}',26400,'2026-05-01 10:30:00');
 source.close();
 const database=await startTestDatabase();
 try {
  const result=spawnSync(process.execPath,['scripts/import-sqlite.js'],{env:{...process.env,SQLITE_PATH:sqlitePath,DATABASE_URL:database.url},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const client=new pg.Client({connectionString:database.url});await client.connect();
  try {
   assert.equal((await client.query("SELECT quantity FROM stock WHERE id='casque'")).rows[0].quantity,3);
   const orders=(await client.query('SELECT reference,total,payload,created_at FROM orders WHERE request_id=$1',[requestId])).rows;
   assert.equal(orders.length,1);assert.equal(orders[0].reference,'GS-2026-11111111');assert.equal(orders[0].total,26400);
   assert.equal(orders[0].payload.customer.name,'Client Test');
   assert.equal(orders[0].created_at.toISOString(),'2026-05-01T10:30:00.000Z');
   // Relancer l'import sur une base qui contient déjà des commandes est refusé (pas d'écrasement du stock).
   const again=spawnSync(process.execPath,['scripts/import-sqlite.js'],{env:{...process.env,SQLITE_PATH:sqlitePath,DATABASE_URL:database.url},encoding:'utf8'});
   assert.notEqual(again.status,0);
   assert.match(again.stderr,/contient déjà des commandes/);
   assert.equal((await client.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,1);
  } finally {await client.end();}
 } finally {await database.stop();rmSync(dir,{recursive:true,force:true});}
});
