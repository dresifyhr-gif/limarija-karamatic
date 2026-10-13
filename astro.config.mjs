// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';
import { fontFamiliesConfig } from './src/lib/font-config.ts';

// Točan host NAŠEG Blob storea (ne *.public.blob.vercel-storage.com — inače javni /_image
// preuzima i pretvara slike s bilo čijeg Blob storea). storeId je javni dio tokena i vidi se u svakom URL-u fotografije.
const fileEnv = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const blobToken = process.env.BLOB_READ_WRITE_TOKEN || fileEnv.BLOB_READ_WRITE_TOKEN || '';
const blobStoreId = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(blobToken)?.[1];
const BLOB_HOST = (process.env.BLOB_PUBLIC_HOST || fileEnv.BLOB_PUBLIC_HOST || (blobStoreId ? `${blobStoreId}.public.blob.vercel-storage.com` : '')).toLowerCase();

export default defineConfig({
  // TODO: stvarna domena prije objave
  site: 'https://www.limarija-karamatic.hr',
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Javna stranica ostaje statička (prerender u buildu, sadržaj iz baze preko src/lib/content.ts).
  // Admin (/admin/**) i API (/api/**) su on-demand: `export const prerender = false`.
  adapter: vercel({
    // fotografije optimizira Astro (sharp) u buildu — i lokalne i one s Vercel Bloba;
    // Vercel Image Optimization nije potreban (nema troška po slici, isti AVIF/WebP kao do sad)
    imageService: false,
    maxDuration: 30,
  }),
  image: {
    // fotografije koje vlasnik učita u adminu (Vercel Blob, javni store)
    remotePatterns: BLOB_HOST ? [{ protocol: 'https', hostname: BLOB_HOST }] : [],
  },
  security: {
    // Astro odbija cross-site POST forme na on-demand rutama; JSON zahtjeve dodatno provjerava middleware
    checkOrigin: true,
  },
  // Fontovi javne stranice (admin → Izgled): sva ponuđena pisma iz npm paketa (src/lib/fonts.ts), samostalno posluživana.
  // Stranica (Base.astro) ispisuje <Font> samo za odabrana; admin → Izgled za sva (pregled).
  fonts: fontFamiliesConfig(fontProviders.local),
  build: {
    // sav CSS inline: nema render-blocking zahtjeva (≈ 28 KB gzip po stranici)
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // dev: svi GSAP moduli unaprijed u istom paketu — inače Vite tek na /radovi otkrije gsap/Flip,
    // ponovno optimizira ovisnosti i otvorena stranica dobije 504 (Outdated Optimize Dep)
    optimizeDeps: {
      include: ['gsap', 'gsap/ScrollTrigger', 'gsap/DrawSVGPlugin', 'gsap/MorphSVGPlugin', 'gsap/CustomEase', 'gsap/Flip'],
    },
  },
});
