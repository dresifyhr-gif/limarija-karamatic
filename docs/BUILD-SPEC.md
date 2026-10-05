# Limarija Karamatić — specifikacija za izradu prototipa

Kreativni smjer: **NACRT → LIM** — "Sedam puta mjerimo. Jednom savijemo."
Cijeli brief: `docs/creative-direction.md` (pročitaj ga prije rada).

Stranica izgleda kao tehnički crtež koji oživi. Crvene linije nacrtaju kuću, abkant (preša)
s vrhom u obliku crvenog Λ iz loga savije lim, a animacija završava na gotovom crtežu krova (bez fotografije).
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
`whatsapp` #25D366.

Klase:

- `type-display`: naslovi, Archivo wdth 125 / 800
- `type-wide`: samo širina 125
- `type-mono`: mono font
- `eyebrow`: mono oznaka velikim slovima
- `grid-paper` / `grid-paper-light`: milimetarski papir — hero, footer, Kako radimo, PageHero podstranica i završni CTA
- `wrap`: kontejner, max 88rem, padding 20/32/48

Ease u CSS-u: `ease-[var(--ease-draft)]`, `ease-[var(--ease-press)]`. U GSAP-u: `ease: 'draft'` i `ease: 'press'`.

## Ritam sekcija naslovnice (id-jevi su fiksni)

Manje buke (povratna informacija klijenta): 8 sekcija. Tamno je SAMO zaglavlje + traka, hero, footer i mobilni dock/izbornik;
sve ostale sekcije na svim stranicama su svijetle (papir / bijela / papir-2).

| # | Komponenta | id | Pozadina |
|---|---|---|---|
| 1 | Hero (samo crtež, bez fotografije; završava na gotovom crtežu) | `vrh` | grafit + grid-paper |
| 2 | Services (6 kartica s fotografijom) | `usluge` | papir |
| 3 | Projects (Radovi, rail) | `radovi` | bijela |
| 4 | Process (Kako radimo) | `kako-radimo` | papir + grid-paper-light |
| 5 | Reviews (+ brojke: `ui/StatLine`) | `recenzije` | bijela |
| 6 | Managers (kompaktna traka) | `zgrade` | papir-2 |
| 7 | Faq (5 pitanja, `ask={false}`) | `pitanja` | bijela |
| 8 | FinalCta + RadniNalog (telefon + WhatsApp) | `procjena` | papir + grid-paper-light |
| — | Footer | — | grafit + grid-paper |

DetailSignature živi na /usluge/opsav-atike, Warranty na /o-nama. ProofStrip, WhatsAppBand i ServiceArea su obrisani.
Poruke idu samo preko WhatsAppa (Viber je uklonjen). Pozicioniranje: `site.area` / `site.areaLine` (nije "samo Zagreb").
Na svijetlim sekcijama tekst je `text-tinta`, mutni tekst `text-tinta/70`; crvena na svijetlom `redline-dark`.
Vertikalni ritam punih sekcija: `py-24 sm:py-28 lg:py-32`. Zaglavlje: `SectionHead` (eyebrow, title, lead, tone) — bez brojeva sekcija.
Jedne brojke na cijeloj stranici: `ui/StatLine.astro` (kota, odbrojavanje, crtanje linije).

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
  **Ne izmišljaj nove činjenice** (godine, brojke, certifikate, cijene). Podaci su potvrđeni (nema oznaka "primjer"); recenzije se ne izmišljaju (`reviews` je prazan dok ne stignu stvarne).
- Linkovi: `telHref`, `waHref(text?)` iz `site.ts` (bez Vibera).
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
- Na mobitelu plutajući dock (WhatsApp + Besplatna procjena) zauzima do ~68 px + safe area; pojavi se tek kad
  glavni CTA heroja izađe iz ekrana, a skriva se na #procjena, footeru, `[data-hide-mobile-cta]` i uz otvoren izbornik.

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
