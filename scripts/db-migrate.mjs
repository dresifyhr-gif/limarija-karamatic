#!/usr/bin/env node
/**
 * Migracije baze:  node scripts/db-migrate.mjs  [--status]
 *
 * - čita .env.local (pa .env) — treba DATABASE_URL_UNPOOLED ili DATABASE_URL
 * - primjenjuje db/migrations/NNN_ime.sql abecednim redom, svaku u svojoj transakciji
 * - evidencija u tablici schema_migrations (ime + sha256); već primijenjene preskače
 * - promijenjena već primijenjena migracija = greška (nikad ne mijenjaj staru, dodaj novu)
 *
 * Idempotentno: drugo pokretanje ne radi ništa. Nikad ne ispisuje tajne.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from '@neondatabase/serverless';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
    } catch {}
  }
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('✗ Nema DATABASE_URL(_UNPOOLED) u okruženju ni u .env.local');
  process.exit(1);
}

const dir = path.join(root, 'db', 'migrations');
const files = readdirSync(dir)
  .filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f))
  .sort();

const client = new Client({ connectionString: url });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const { rows } = await client.query('SELECT name, sha256 FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.name, r.sha256]));

  let count = 0;
  for (const f of files) {
    const sqlText = readFileSync(path.join(dir, f), 'utf8');
    const sha = createHash('sha256').update(sqlText).digest('hex');
    if (applied.has(f)) {
      if (applied.get(f) !== sha) {
        console.error(`✗ ${f} je promijenjena nakon primjene. Ne mijenjaj stare migracije — dodaj novu.`);
        process.exitCode = 1;
      } else if (process.argv.includes('--status')) {
        console.log(`  ✓ ${f}`);
      }
      continue;
    }
    if (process.argv.includes('--status')) {
      console.log(`  · ${f} (nije primijenjena)`);
      continue;
    }
    process.stdout.write(`→ ${f} … `);
    await client.query('BEGIN');
    try {
      await client.query(sqlText);
      await client.query('INSERT INTO schema_migrations (name, sha256) VALUES ($1, $2)', [f, sha]);
      await client.query('COMMIT');
      console.log('ok');
      count++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.log('GREŠKA');
      throw e;
    }
  }
  if (!process.argv.includes('--status')) {
    console.log(count ? `✓ primijenjeno migracija: ${count}` : '✓ baza je ažurna (nema novih migracija)');
  }
} finally {
  await client.end();
}
