/**
 * Preload hero fotografije (LCP). Opcije MORAJU biti iste kao u HeroSheet.astro <Picture>,
 * inače preglednik preuzme dvije različite datoteke.
 */
import { getImage } from 'astro:assets';
import { projects } from '@/data/site';

export const HERO_SIZES = '(min-width: 1440px) 760px, (min-width: 1024px) 52vw, calc(100vw - 2.5rem)';

export async function heroPreload() {
  const project = projects.find((p) => p.slug === 'krov-crijep-lim-zalazak')!;
  const img = await getImage({
    src: project.image,
    width: 1200,
    height: 960,
    fit: 'cover',
    position: 'top',
    widths: [480, 720, 960, 1200],
    sizes: HERO_SIZES,
    format: 'avif',
    quality: 55,
  });
  return { srcset: img.srcSet.attribute, sizes: HERO_SIZES, type: 'image/avif' };
}
