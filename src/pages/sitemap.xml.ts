/**
 * sitemap.xml — gradi se iz istih podataka kao i stranice.
 * Ne uključuje /dev, /hvala ni 404.
 */
import type { APIRoute } from 'astro';
import { services, projects } from '@/data/site';

const STATIC = ['/', '/usluge', '/radovi', '/upravitelji-zgrada', '/o-nama', '/kontakt', '/procjena', '/privatnost'];

export const GET: APIRoute = ({ site }) => {
  const paths = [
    ...STATIC,
    ...services.map((s) => `/usluge/${s.slug}`),
    ...projects.map((p) => `/radovi/${p.slug}`),
  ];
  const urls = paths
    .map((p) => `  <url><loc>${new URL(p, site).toString().replace(/\/$/, p === '/' ? '/' : '')}</loc></url>`)
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
