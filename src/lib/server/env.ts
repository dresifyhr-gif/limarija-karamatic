/**
 * Čitanje varijabli okruženja na serveru (API, admin, build).
 *
 * Redoslijed: process.env (Vercel runtime i build) → import.meta.env (astro dev učitava .env.local)
 * → jednokratno process.loadEnvFile('.env.local') kad nismo na Vercelu (lokalni `astro build`).
 *
 * NAMJERNO bez imena varijabli u ovoj datoteci: Astro u build inlinea svaku privatnu
 * varijablu čije se ime pojavi u datoteci koja čita import.meta.env. Imena navode pozivatelji.
 */

const viteEnv = import.meta.env as unknown as Record<string, string | boolean | undefined>;

let localFilesLoaded = false;
function loadLocalFiles() {
  if (localFilesLoaded) return;
  localFilesLoaded = true;
  if (process.env.VERCEL) return;
  for (const f of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(f);
    } catch {
      /* datoteka ne postoji — u redu */
    }
  }
}

/** Vrijednost ili undefined (prazan string = nije postavljeno). */
export function env(name: string): string | undefined {
  let v: unknown = process.env[name];
  if (v === undefined || v === '') v = viteEnv[name];
  if (v === undefined || v === '') {
    loadLocalFiles();
    v = process.env[name];
  }
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Kao env(), ali baca grešku ako vrijednost nedostaje (poruka bez vrijednosti, samo ime). */
export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Nedostaje varijabla okruženja ${name}`);
  return v;
}

/** true na Vercel produkciji (VERCEL_ENV=production) — ne u previewu ni lokalno. */
export function isProduction(): boolean {
  return env('VERCEL_ENV') === 'production';
}

/** true kad radimo lokalno (astro dev / lokalni build). */
export function isLocal(): boolean {
  return !process.env.VERCEL;
}
