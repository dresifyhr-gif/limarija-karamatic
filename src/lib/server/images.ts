/**
 * Sličice za ADMIN (on-demand stranice). Javna stranica koristi content.ts + <Picture> u buildu.
 *
 *   const src = await thumbUrl(ref, 480);   // <img src={src} width=… loading="lazy">
 *
 * - asset ({key}): Astro getImage → /_image?… (sharp, keširano)
 * - blob ({url}):  Astro getImage s udaljenim URL-om (dopušten u image.remotePatterns) → /_image?…
 * Ako optimizacija nije moguća, vraća izvorni URL.
 */
import { getImage } from 'astro:assets';
import { assetByKey } from '@/lib/assets';
import { isBlobRef, type ImageRef } from '@/lib/types';

export async function thumbUrl(ref: ImageRef | null | undefined, width = 480): Promise<string | null> {
  if (!ref) return null;
  try {
    if (isBlobRef(ref)) {
      const w = Math.min(width, ref.width);
      const img = await getImage({ src: ref.url, width: w, height: Math.round((ref.height / ref.width) * w), format: 'webp', quality: 60 });
      return img.src;
    }
    const meta = assetByKey(ref.key);
    if (!meta) return null;
    const img = await getImage({ src: meta, width: Math.min(width, meta.width), format: 'webp', quality: 60 });
    return img.src;
  } catch {
    return isBlobRef(ref) ? ref.url : null;
  }
}

/** Kao thumbUrl, za niz (paralelno). */
export async function thumbUrls(refs: (ImageRef | null | undefined)[], width = 480): Promise<(string | null)[]> {
  return Promise.all(refs.map((r) => thumbUrl(r, width)));
}
