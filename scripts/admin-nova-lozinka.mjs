#!/usr/bin/env node
/**
 * Reset zaboravljene lozinke za admin.
 *
 *   npm run admin:nova-lozinka
 *
 * - generira novu jaku lozinku i sprema njezin scrypt hash u admin_meta.password_hash
 *   (isti format kao src/lib/server/auth.ts → hashPassword)
 * - povećava session_epoch → sve postojeće prijave na svim uređajima prestaju vrijediti
 * - briše zaključavanja nakon pogrešnih pokušaja prijave (rate_events 'login-fail*')
 * - lozinku zapisuje SAMO u ADMIN-PRISTUP.txt (gitignored) — nikad je ne ispisuje
 *
 * Čita .env.local (DATABASE_URL_UNPOOLED ili DATABASE_URL). Baza je ista za razvoj i produkciju,
 * pa reset odmah vrijedi i na živoj stranici.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

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
  console.error('✗ Nema DATABASE_URL(_UNPOOLED) u okruženju ni u .env.local (pokreni: vercel env pull .env.local --yes)');
  process.exit(1);
}

const alpha = 'abcdefghjkmnpqrstuvwxyz23456789';
const group = () => Array.from(randomBytes(4), (b) => alpha[b % alpha.length]).join('');
const password = ['krov', group(), group(), group(), group()].join('-');

const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scryptCb(password, salt, 64, { N, r, p }, (err, k) => (err ? reject(err) : resolve(k))),
);
const hash = `scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${key.toString('base64')}`;

const sql = neon(url);
const setMeta = (k, v) =>
  sql`INSERT INTO admin_meta (key, value, updated_at) VALUES (${k}, ${JSON.stringify(v)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;

const [epochRow] = await sql`SELECT value FROM admin_meta WHERE key = 'session_epoch'`;
const epoch = (Number(epochRow?.value ?? 1) || 1) + 1;

await setMeta('password_hash', hash);
await setMeta('session_epoch', epoch);
await setMeta('revoked_sessions', {});
const cleared = await sql`DELETE FROM rate_events WHERE bucket IN ('login-fail', 'login-fail-all') RETURNING id`;

const site = process.env.SITE_URL || 'https://limarija-karamatic.vercel.app';
writeFileSync(
  path.join(root, 'ADMIN-PRISTUP.txt'),
  [
    'LIMARIJA KARAMATIĆ — ADMIN',
    '',
    `Adresa:   ${site}/admin`,
    `Korisnik: ${process.env.ADMIN_USERNAME || 'karamatic'}`,
    `Lozinka:  ${password}`,
    '',
    `Nova lozinka postavljena: ${new Date().toLocaleString('hr-HR')}`,
    'Sve stare prijave su odjavljene. Nakon prijave lozinku možete promijeniti u Postavke → Lozinka.',
    'Ova datoteka NIJE u gitu. Spremite lozinku u password manager i obrišite datoteku.',
    '',
  ].join('\n'),
);

console.log('✓ Nova lozinka je postavljena (sve stare prijave su odjavljene).');
console.log(`✓ Obrisano zaključavanja nakon pogrešnih pokušaja: ${cleared.length}`);
console.log('→ Lozinka je zapisana u ADMIN-PRISTUP.txt (nije u gitu). Ne ispisujem je ovdje.');
