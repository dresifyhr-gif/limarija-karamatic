// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // TODO: stvarna domena prije objave
  site: 'https://www.limarija-karamatic.hr',
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  build: {
    // sav CSS inline: nema render-blocking zahtjeva (≈ 28 KB gzip po stranici)
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
