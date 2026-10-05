# Limarija Karamatić — specifikacija za izradu prototipa

Kreativni smjer: **NACRT → LIM** — "Sedam puta mjerimo. Jednom savijemo."
Cijeli brief: `docs/creative-direction.md` (pročitaj ga prije rada).

Stranica izgleda kao tehnički crtež koji oživi. Crvene linije nacrtaju kuću, abkant (preša)
s vrhom u obliku crvenog Λ iz loga savije lim, a crtež se otvori u fotografiju pravog krova.
Prodaje se **preciznost**, dokazana stvarnim radovima (sav lim je antracit RAL 7016), dok je
telefon uvijek na jedan dodir. Premium dolazi iz suzdržanosti, brzine i stvarnih radova, ne iz efekata.

## Stack (već postavljen, radi)

- **Astro 7.3** (statički), TypeScript strict, alias `@/*` → `src/*`
- **Tailwind v4.3**: CSS-first, tokeni su u `src/styles/global.css` (`@theme`). Nema `tailwind.config`.
- **GSAP 3.15**: svi pluginovi su besplatni (DrawSVG, MorphSVG, CustomEase, ScrollTrigger, Flip). SplitText se više ne koristi i `@/lib/motion` ga ne izvozi.
  **Uvozi ih isključivo iz `@/lib/motion`**: `import { gsap, ScrollTrigger, DrawSVGPlugin, MorphSVGPlugin, motionOn } from '@/lib/motion'`.
  Za Flip: `import { Flip } from 'gsap/Flip'` pa `gsap.registerPlugin(Flip)` (samo gdje treba).
- Fontovi: **Archivo Variable** (wdth 62–125, wght 100–900, latin-ext ima Č Ć Đ Š Ž) i **IBM Plex Mono** 400/500.
- Ikone: `@/components/ui/Icon.astro` (phone, whatsapp, viber, google, arrow-right, arrow-up-right, check, menu, close, star, map-pin, camera, clock, shield, plus, minus, mail, ruler, file, building).
- **Dev server već radi na http://localhost:4321** i ima HMR. NE pokreći ga, NE gasi ga i **NE pokreći `astro build` ni `astro check`**: paralelni buildovi se sudaraju. Za provjeru koristi dev server i screenshot skriptu.

## Vlasništvo nad datotekama (STROGO)

Mijenjaj **samo svoje datoteke**. Nove datoteke smiješ stvarati samo unutar svog prostora (navedeno u zadatku).
Zajedničke datoteke su **samo za čitanje**:

- `src/styles/global.css`, `src/lib/motion.ts`, `src/lib/reveal.ts`
- `src/data/site.ts`, `src/layouts/Base.astro`, `src/pages/index.astro`
- `src/components/ui/{Button,Icon,SectionHead,Photo,ExampleTag}.astro`

Ako ti treba promjena zajedničke datoteke, zaobiđi to lokalno (scoped `<style>`, lokalni podaci u komponenti)
i navedi to u završnom izvještaju pod "shared-change-requests".

Ako uvoziš komponentu drugog agenta (npr. `RadniNalog`, `ProfileIcon`, `ProjectCard`, `Faq`), drži se ugovora o propovima.
Te komponente se paralelno grade, pa ćeš ih možda vidjeti kao stub.

| Ugovor | Props |
|---|---|
| `ui/ProfileIcon.astro` | `profile: Profile; size?: number; class?: string; animate?: boolean` |
| `ui/ProjectCard.astro` | `project: Project; sizes?: string; class?: string; eager?: boolean` |
| `home/Faq.astro` | `items?: {q,a}[]; tone?: 'dark'\|'light'; id?: string; title?: string; index?: string` |
| `form/RadniNalog.astro` | `preselect?: string` (id iz `jobTypes` ili slug usluge); `id?: string` |
| `ui/Logo.astro` | `variant?: 'full'\|'compact'\|'mark'; tone?: 'light'\|'dark'; class?: string` |
| `layout/PageHero.astro` | vidi zadatak agenta G |

## Tokeni i utility klase

Boje (Tailwind): `grafit` #0E1013, `grafit-2` #171A1E, `grafit-3` #22272C, `antracit` #383E42, `antracit-2`,
`celik` #8A939B, `linija` #D5DBDF, `papir` #EEECE7, `papir-2` #E2DFD8, `tinta` #15181B,
`crvena` #D7141A (**samo** CTA pozadine, Λ, linija strehe), `crvena-hover`,
`redline` #FF3B3F (mali crveni tekst/linije na tamnom), `redline-dark` #B80F15 (na svijetlom),
`whatsapp` #25D366, `viber` #7360F2.

Klase:

- `type-display`: naslovi, Archivo wdth 125 / 800
- `type-wide`: samo širina 125
- `type-mono`: mono font
- `eyebrow`: mono oznaka velikim slovima
- `grid-paper` / `grid-paper-light`: milimetarski papir, **samo** hero, kotna linija, završni CTA i footer
- `wrap`: kontejner, max 88rem, padding 20/32/48

Ease u CSS-u: `ease-[var(--ease-draft)]`, `ease-[var(--ease-press)]`. U GSAP-u: `ease: 'draft'` i `ease: 'press'`.

## Ritam sekcija naslovnice (id-jevi su fiksni)

| # | Komponenta | id | Pozadina |
|---|---|---|---|
| 1 | Hero | `vrh` | grafit + grid-paper |
| 2 | ProofStrip ("Kotna linija") | `dokazi` | grafit (grid-paper) |
| 3 | Services | `usluge` | papir (svijetlo) |
| 4 | WhatsAppBand | `slike` | antracit |
| 5 | Projects (Radovi) | `radovi` | grafit |
| 6 | DetailSignature | `detalj` | papir |
| 7 | Process (Kako radimo) | `kako-radimo` | grafit |
| 8 | Warranty (Standard i jamstvo) | `jamstvo` | papir |
| 9 | Managers (Za upravitelje) | `zgrade` | grafit-2 |
| 10 | Reviews | `recenzije` | papir |
| 11 | ServiceArea | `podrucje` | grafit |
| 12 | Faq | `pitanja` | papir |
| 13 | FinalCta + RadniNalog | `procjena` | grafit + grid-paper |
| — | Footer (blok s podacima + veliki znak KARAMATIĆ; telefon/WhatsApp/Viber su u FinalCta) | — | grafit + grid-paper |

Na svijetlim sekcijama tekst je `text-tinta`, a mutni tekst `text-tinta/60`. Na tamnim je tekst `text-linija`, naslovi `text-white`, a mutni tekst `text-celik`.
Vertikalni ritam: `py-20 sm:py-28 lg:py-32`. Zaglavlje sekcije radi se preko `SectionHead` (index "02", eyebrow, title, lead, tone).

## Pravila pokreta: "lim se savija, ne skakuće"

1. **HTML je uvijek u završnom stanju.** Prije animacije elemente skrivaj samo CSS-om pod `.motion`
   (npr. `.motion .moj-el { opacity: 0 }`). Bez JS-a, s reduced-motion ili sa Save-Data korisnik vidi gotov sadržaj.
   U skripti uvijek prvo: `if (!motionOn()) return;`.
2. Standardno otkrivanje radi atribut `data-reveal` (i `data-reveal-group` na roditelju za niz).
   Fotografije otkriva `data-scan`: crvena scan linija ide odozgo prema dolje. To je **jedini stil otkrivanja fotki** na stranici.
3. Postoje samo dvije krivulje:
   - `draft` za linije i crteže, 0,6–0,9 s
   - `press` za savijanje, polaganje traka i pečate, 0,18–0,3 s

   Mali UI pokreti traju 150–200 ms. **Nikad** elastic/bounce/back.
4. **Bez scroll-jackinga**: nema pinanja na mobitelu, nema Lenisa, nema custom kursora, nema preloadera.
   Pinanje na desktopu samo ako je kratko i ima jasan razlog (radije bez).
5. Na ekranu se u jednom trenutku miče najviše **jedna crvena stvar**.
6. Animacije se vrte **jednom** (`once: true`). Ne vrte se u petlji i nema autoplay karusela.
7. Za razlike desktop/mobitel koristi `gsap.matchMedia()`.
8. Astro `<script>` je modul koji se uključuje **jednom** po stranici, čak i kad je komponenta prikazana više puta,
   zato inicijaliziraj sve instance (`querySelectorAll`).

## Sadržaj i ton

- Hrvatski, prirodno i kratko. Govori se kao majstor koji zna posao, ne kao agencija. Bez "kvalitetno i povoljno".
- Podatke (kontakt, brojke, usluge, radovi, koraci, FAQ, recenzije, područja) uzimaj iz `src/data/site.ts`.
  **Ne izmišljaj nove činjenice** (godine, brojke, certifikate, cijene). Nepotvrđeno označi s `<ExampleTag />`.
- Linkovi: `telHref`, `waHref(text?)`, `viberHref` iz `site.ts`.
- Format brojeva: hrvatski, `0,6 mm`, `12 450 mm`, `35°`.

## Fotografije

Koristi `Photo` (`@/components/ui/Photo.astro`) sa slikama iz `site.ts` (`services[].image/gallery`, `projects[].image/gallery`)
ili direktno iz `@/assets/projects/*.jpg`. Sve su portretne (3:4 ili 9:16).
Daj točan `sizes` atribut. Nikad ne učitavaj original bez `Photo`/`Picture`.

## Pristupačnost i responzivnost

- Na naslovnici je jedan `h1` (u Heru). Sekcije koriste `h2`, a kartice `h3`.
- Ciljevi za dodir moraju biti ≥ 44 px. Fokus mora biti vidljiv. Kontrast mora zadovoljiti AA.
- Interaktivni elementi trebaju ispravne `aria-*` atribute (accordion, tabovi, forma).
- Mobile-first. Provjeri na **360/390 px** i na **1440 px**. Nigdje ne smije biti horizontalnog scrolla.
- Na mobitelu donja CTA traka zauzima oko 64 px, pa sadržaj ne smije ostati skriven ispod nje
  (footer ima `pb` za to, to radi agent B).

## Performanse

- Bez novih npm paketa: nema three.js, lottie, lenis, swipera ni jQueryja. Native `scroll-snap` za rail.
- JS mora biti mali: samo GSAP iz `@/lib/motion` plus vlastiti kod.
- SVG crteže inlineaj ručno, optimizirane (bez nepotrebnih decimala).

## Provjera (obavezno prije završetka)

```bash
node scripts/shot.mjs / shots/<prefiks>-desk.png --selector="#id-sekcije"
node scripts/shot.mjs / shots/<prefiks>-mob.png --selector="#id-sekcije" --mobile
node scripts/shot.mjs / shots/<prefiks>-reduced.png --selector="#id-sekcije" --reduced
node scripts/shot.mjs / shots/<prefiks>-t.png --tiles --mobile   # stranica ekran po ekran (-01, -02…)
node scripts/shot.mjs / shots/<prefiks>-frames.png --frames=0,600,1200,2400,4000   # kadrovi animacije
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/   # 200 = kompajlira
```

Pročitaj PNG-ove alatom Read i ispravljaj dok ne izgleda kao premium američki studio, a ne kao predložak.
Skripta ispisuje greške iz konzole: mora ih biti nula.
Screenshotove spremaj samo u `shots/` sa svojim prefiksom.

## Dogovori nakon revizije (obavezno)

- **Linkovi na formu** u zajedničkom okviru (header, mobilna traka, izbornik, footer): `href="/procjena"` + `data-quote-link`.
  Skripta u Headeru svaki `a[data-quote-link]` prebaci na `#procjena` kad na stranici postoji forma. Nikad `/#procjena`.
- **Završna forma** je uvijek `home/FinalCta.astro` (`title`, `lead`, `preselect`, `variant: 'standard'|'zgrada'`, `index`, `headingLevel`), s `id="procjena"`.
  Kad je `preselect` slug usluge, WhatsApp poruka navodi tu uslugu.
- **Hvala stranica**: `/hvala?upit=1234&posao=<jobTypeId|slug>&slike=<broj>`.
- Interne testne stranice (`src/pages/dev/`, `layouts/Dev.astro`) su obrisane.
