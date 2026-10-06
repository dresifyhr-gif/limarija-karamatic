/**
 * Fotografije iz repozitorija (src/assets/**) po ključu.
 * Ključ = putanja relativno na src/assets, npr. 'projects/falcani-krov-zid.jpg'.
 * Isti ključ uvijek vraća ISTI ImageMetadata objekt kao `import x from '@/assets/…'`,
 * pa provjere identiteta (npr. "ne prikazuj istu sliku dvaput") i dalje rade.
 */
import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<ImageMetadata>('/src/assets/**/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
});

const byKey = new Map<string, ImageMetadata>();
const byMeta = new Map<ImageMetadata, string>();
for (const [path, meta] of Object.entries(modules)) {
  const key = path.replace(/^\/src\/assets\//, '');
  byKey.set(key, meta);
  byMeta.set(meta, key);
}

/** Svi ključevi (npr. za birač "postojeće fotografije" u adminu). */
export const ASSET_KEYS: string[] = [...byKey.keys()].filter((k) => k.startsWith('projects/')).sort();

export function assetByKey(key: string): ImageMetadata | undefined {
  return byKey.get(key);
}

export function keyOfAsset(meta: ImageMetadata): string | undefined {
  return byMeta.get(meta);
}
