import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Renvoie une base PostgreSQL de test. Utilise TEST_DATABASE_URL si fourni, sinon un cluster éphémère (npm embedded-postgres).
export async function startTestDatabase() {
  if (process.env.TEST_DATABASE_URL) return {url: process.env.TEST_DATABASE_URL, stop: async () => {}};
  const dir = mkdtempSync(join(tmpdir(), 'gs-pg-'));
  const port = 55000 + Math.floor(Math.random() * 5000);
  const pg = new EmbeddedPostgres({databaseDir: join(dir, 'data'), port, user: 'postgres', password: 'postgres', authMethod: 'password', persistent: false, onLog: () => {}, onError: () => {}});
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('gs_test');
  return {
    url: `postgres://postgres:postgres@localhost:${port}/gs_test`,
    stop: async () => {
      await pg.stop();
      rmSync(dir, {recursive: true, force: true});
    }
  };
}
