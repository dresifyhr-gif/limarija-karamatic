/**
 * Pomoćne funkcije za podstranice (usluge, radovi). Mapa '_parts' nije ruta (Astro preskače '_').
 *
 * PRAVILO: nijedna fotografija (ImageMetadata) ne prikazuje se dvaput na istoj stranici —
 * ni u heru, ni u galeriji, ni na karticama radova, ni kao sličica u pločici "Svi radovi".
 */
import type { ImageMetadata } from 'astro';
import {
  faq,
  projects,
  reviews,
  services,
  type Project,
  type ProjectKind,
  type Profile,
  type Review,
  type Service,
} from '@/data/site';

/** Opisni alt za fotografije galerije koje nisu glavna slika nijednog rada ni usluge. */
const extraAlt: Record<string, string> = {
  'krov-crijep-lim-spoj-radnik': 'Spoj dvije plohe krova od crijep-lima, limari u radu u pozadini',
  'atika-opsav-kut-ljestve': 'Kapa atike na kutu ravnog krova, uz susjedni krov od crijepa',
  'atika-opsav-alat': 'Kapa atike uz rub ravnog krova sa šljunkom',
  'atika-opsav-alat-siroko': 'Opšav atike oko ravnog krova sa šljunkom',
};

export function altFor(img: ImageMetadata, fallback: string): string {
  const p = projects.find((x) => x.image === img);
  if (p) return p.alt;
  const s = services.find((x) => x.image === img);
  if (s) return s.imageAlt;
  const key = Object.keys(extraAlt).find((k) => img.src.includes(`/${k}.`));
  return key ? extraAlt[key] : fallback;
}

/** Jedinstvene slike, bez onih koje su već prikazane na stranici. */
export function galleryOf(list: ImageMetadata[], ...used: (ImageMetadata | Set<ImageMetadata>)[]): ImageMetadata[] {
  const skip = new Set<ImageMetadata>();
  used.forEach((u) => (u instanceof Set ? u.forEach((x) => skip.add(x)) : skip.add(u)));
  return [...new Set(list)].filter((img) => !skip.has(img));
}

/** Rad kojem fotografija pripada (naslovna slika rada, inače prvi rad čija je galerija sadrži). */
export function projectOf(img: ImageMetadata, prefer?: (p: Project) => boolean): Project | undefined {
  const covers = projects.filter((p) => p.image === img);
  const inGallery = projects.filter((p) => p.gallery.includes(img));
  return (
    covers.find((p) => !prefer || prefer(p)) ??
    covers[0] ??
    inGallery.find((p) => !prefer || prefer(p)) ??
    inGallery[0]
  );
}

export type GalleryImage = { src: ImageMetadata; alt: string; href?: string; hrefLabel?: string };

/**
 * Raspored fotografija na stranici usluge:
 *  1. hero = service.image (ako je to naslovna slika rada, ispod heroja je poveznica na taj rad)
 *  2. kartice radova te usluge — samo oni čija naslovna slika još nije prikazana (najviše 3, jedan red)
 *  3. galerija = preostale slike usluge i njenih radova (najviše 3)
 *  4. sličice = naslovne slike drugih radova koje još nisu prikazane
 *  reserved: fotografije koje stranica prikazuje drugdje (npr. DetailSignature na /usluge/opsav-atike)
 */
export function servicePhotos(service: Service, reserved: ImageMetadata[] = []) {
  const used = new Set<ImageMetadata>([service.image, ...reserved]);
  const own = projects.filter((p) => p.service === service.slug);
  const heroProject = projectOf(service.image, (p) => p.service === service.slug);

  const cards = own.filter((p) => !used.has(p.image)).slice(0, 3);
  cards.forEach((p) => used.add(p.image));

  /* poveznica na rad samo uz prvu fotografiju tog rada (bez dvaput istog natpisa) */
  const linked = new Set<string>();
  const gallery: GalleryImage[] = galleryOf([...service.gallery, ...own.flatMap((p) => p.gallery)], used)
    .slice(0, 3)
    .map((src, k) => {
      const p = projectOf(src, (x) => x.service === service.slug);
      const img: GalleryImage = { src, alt: altFor(src, `${service.title}, fotografija s gradilišta ${k + 2}`) };
      if (p && p.image !== service.image && !linked.has(p.slug)) {
        linked.add(p.slug);
        img.href = `/radovi/${p.slug}`;
        img.hrefLabel = p.heroTitle ?? p.title;
      }
      return img;
    });
  gallery.forEach((g) => used.add(g.src));

  const thumbs = projects.filter((p) => p.service !== service.slug && !used.has(p.image)).slice(0, 4);
  return { heroProject, cards, gallery, thumbs, used };
}

/* ── Česta pitanja na stranici usluge ─────────────────────────
   Vlastita pitanja usluge + 2 opća koja odgovaraju poslu (bez ponavljanja teme). */
const generalFor: Record<string, RegExp[]> = {
  'limeni-krovovi': [/^Koliko košta/, /^Koliko traje/],
  'falcani-krovovi': [/^Je li procjena/, /^Dajete li jamstvo/],
  'popravak-krova': [/^Pomažete li kod prijave štete/, /^Radite li po kiši/],
  'opsav-atike': [/^Je li procjena/, /^Dajete li jamstvo/],
  dimnjaci: [/^Je li procjena/, /^Dajete li jamstvo/],
  'oluci-snjegobrani': [/^Je li procjena/, /^Dajete li jamstvo/],
};
const generalDefault = [/^Je li procjena/, /^Dajete li jamstvo/, /^Koliko traje/];

export function faqFor(service: Service, max = 5): { q: string; a: string }[] {
  const picks = (generalFor[service.slug] ?? generalDefault)
    .map((re) => faq.find((f) => re.test(f.q)))
    .filter((f): f is { q: string; a: string } => !!f);
  const seen = new Set<string>();
  return [...service.faq, ...picks]
    .filter((f) => (seen.has(f.q) ? false : (seen.add(f.q), true)))
    .slice(0, Math.max(max, service.faq.length));
}

/* ── Recenzija koja najbolje odgovara usluzi ──────────────────
   Samo STVARNE recenzije iz site.ts. Dok je popis prazan, vraća undefined
   i stranica prikazuje samo ocjenu i brojke (bez citata i imena). */
const reviewHint: Record<string, RegExp> = {
  dimnjaci: /dimnjak/i,
  'popravak-krova': /curi|uzrok/i,
  'opsav-atike': /atik/i,
};
export function reviewFor(slug?: string): Review | undefined {
  if (!reviews.length) return undefined;
  const re = slug ? reviewHint[slug] : undefined;
  return (re && reviews.find((r) => re.test(r.text))) || reviews[0];
}

/** Presjek profila koji najbolje opisuje vrstu rada. */
export const kindProfile: Record<ProjectKind, Profile> = {
  krov: 'crijep',
  falc: 'falc',
  atika: 'atika',
  ravni: 'trapez',
  dimnjak: 'dimnjak',
  snjegobrani: 'crijep',
};

export const pad = (n: number) => String(n).padStart(2, '0');

/** 1 rad · 2 rada · 5 radova (hrvatska množina) */
export function radova(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} rad`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} rada`;
  return `${n} radova`;
}

/** 1 vrsta · 2 vrste · 5 vrsta */
export function vrsta(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} vrste`;
  return `${n} vrsta`;
}

/** Skraćuje tekst na granici riječi (meta opis ≤ 155 znakova). */
export function clip(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:·—–-]\s*$/, '')}…`;
}
