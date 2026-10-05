# Limarija Karamatić: final direction

## 1. NACRT → LIM: "Sedam puta mjerimo. Jednom savijemo."
The homepage works like a technical drawing that comes to life. The logo house is drawn in red lines. A press-brake (abkant) beam comes down, its tip shaped like the red Λ from KARAMATIĆ, and bends a flat sheet into the roof. The steel goes on, and the drawing opens into a photo of a real Karamatić roof. Most Croatian trade sites put "kvalitetno i povoljno" over a slider. This one makes one claim the client can prove, precision. It backs that claim with the client's own RAL 7016 roofs and keeps the phone one tap away. The best American roofing sites work the same way: one memorable brand moment, then proof, speed and calls. There's no WebGL, so the site looks the same on a cheap Galaxy A as on a MacBook.

## 2. Hero
**Desktop layout.** Left side, on a dark background with a millimetre grid:
- A keyword line: "Limarija Karamatić · limeni krovovi, opšavi i oluci · Zagreb".
- The H1 "Sedam puta mjerimo. Jednom savijemo." It is shown from the first moment and never animated, because it is the main element Google times for page speed (LCP).
- A subline, then three buttons: [Besplatna procjena] in red, [Nazovi] outlined, [WhatsApp: pošalji slike] in green.
- A trust row with confirmed numbers only.

Right side: the drawing sheet. The animation runs on a timer, about 3.6 s, and does not take over scrolling:
- **0.0–0.8 s:** the house outline draws itself. Red dimensions count up ("12 450", "35°").
- **0.8–1.2 s, the press hit:** the beam with the red Λ tip drops in 0.16 s. The flat sheet bends into the roof in 0.22 s with a 2% recoil, and a white flash runs along the ridge.
- **1.2–1.9 s:** standing-seam panels are laid as strips from left to right. Each seam flashes as it lands.
- **1.9–2.4 s:** the logo's red eave stripe, the gutter and downpipe, the chimney cap and the snow guards go on.
- **2.4–2.8 s:** one shine sweeps across the steel, and an "IZVEDENO" stamp lands.
- **2.8–3.6 s:** the roof shape becomes a window onto photo 17 and grows to fill the panel. A caption reads "Ovo nije crtež. Pravi krov · Zagreb · RAL 7016 →".
- Any scroll, tap or button focus jumps straight to the end. It plays once per session.

**Mobile.** Order: header, drawing panel (42% of screen height), then the H1 and buttons. All of it fits on a 360×740 screen, and the sticky call bar is there from the start. A shorter 2.6 s version runs: outline, press hit, 4 strips, red stripe, stamp, then photo 17 (loaded after 2 s).

**Reduced motion, Save-Data, low-memory phones, repeat visits, no JavaScript, or "Animacije isključene" in the menu:** they get the finished frame, with photo 17 already in the roof window.

**How it's built.**
1. Redraw the logo as a vector.
2. Trace the hero house from it in Figma or Illustrator. Use the same slightly angled 2.5D view, keep each layer in its own named group, and give paths that morph the same number of points.
3. Clean the SVG with SVGO, keeping the IDs.
4. Inline it in the page in its **finished** state. GSAP resets it to blank before the first paint, so if anything fails, visitors still see the full drawing.
5. Drive it with one GSAP timeline that has full, short and none modes (DrawSVG, MorphSVG, CustomEase).
6. Reveal the photo with a CSS clip-path on a normal `<picture>`, not an SVG mask, which is safer on iPhones.

**Weight:** SVG ≤15 KB gzipped, GSAP about 55 KB, own code about 8 KB. Photo 17 is ≤80 KB AVIF on mobile and loads after the H1 has painted.

## 3. Homepage order (the motion each section gets)
1. Utility bar (area, hours, phone) and header. A storm-damage ribbon can be switched on in the CMS. On scroll the header shrinks and the logo becomes the Λ monogram.
2. Hero.
3. **Kotna linija:** years, roofs, Google rating and warranty laid out as a dimension line. It draws in and the numbers count up.
4. **Usluge (6):** limeni krovovi, falc, popravak, opšav atike, dimnjaci, oluci i snjegobrani. Each has a photo and a "Procjena →" link. The icon is the real sheet-metal cross-section, and it bends from a flat line.
5. **"Pošaljite 3 slike krova":** WhatsApp and Viber buttons that press down when tapped.
6. **Radovi:** 9 portrait cards with short mono captions. Photos are revealed in strips, and the row swipes natively.
7. **Detalj je potpis** (photo 7): 3 red callout lines draw in.
8. **Kako radimo:** 5 steps, with space kept for a timelapse. A red line fills as you scroll.
9. **Standard izvedbe i jamstvo:** a table styled like a drawing's title block. A red ellipse draws around the warranty row.
10. **Za upravitelje zgrada i izvođače:** payment from the building reserve (pričuva), R1 invoices, photo documentation. Static.
11. **Recenzije:** real Google reviews, swipeable, no autoplay.
12. **Pokrivamo Zagreb:** an SVG map over photo 10, plus a "Dolazimo li do vas?" checker.
13. **FAQ:** 8 common objections, with FAQ markup for Google.
14. **"Ne čekajte da počne kapati." + Radni nalog form:** the drawn house gets one more layer with each form step.
15. **Footer as a title block:** a giant KARAMATIĆ that widens as it scrolls in.

The before/after section stays hidden until there are at least 3 real pairs.

## 4. Sitemap
**One SEO page per service.** Titles follow "Opšav atike Zagreb | Limarija Karamatić". Each page has real copy, the cross-section drawing, photos, an FAQ and structured data.
- /usluge/limeni-krovovi
- /falcani-krovovi
- /popravak-krova: the Google Ads landing page, H1 "Krov više neće puštati.", phone first
- /opsav-atike-ravni-krovovi
- /dimnjaci
- /oluci
- /snjegobrani

**Other pages:**
- /radovi and /radovi/[slug]
- /upravitelji-zgrada
- /procjena (for a QR code on the vans)
- /o-nama, /kontakt, /cesta-pitanja, /hvala, /privatnost, /podaci-o-tvrtki
- A 404 page, "Nije po mjeri"
- Town pages only where there are real projects in that town

## 5. Visual system
**Colours:**

| Name | Hex | Use |
|---|---|---|
| Grafit | #0E1013 | Dark background |
| Grafit 2 | #171A1E | Cards |
| Antracit | #383E42 | Steel; match it to a real sheet sample |
| Čelik | #8A939B | Muted text |
| Linija | #D5DBDF | Lines and body text on dark |
| Papir | #EEECE7 | Light background |
| Tinta | #15181B | Text on light |
| Crvena | #D7141A | Buttons, the Λ and the eave stripe only |
| Redline | #FF3B3F | Small red text on dark |
| Redline dark | #B80F15 | Small red text on light |
| WhatsApp | #25D366 | The WhatsApp button only |

**Fonts:**
- Archivo variable for everything: headlines extra-wide and heavy (wdth 125 / 800), body normal (wdth 100 / 400). Its wide heavy cut matches the KARAMATIĆ wordmark.
- IBM Plex Mono for dimensions, specs and the phone number.
- Host the fonts yourself and include the Latin Extended set so Č Ć Đ Š Ž work. Check Ć and Đ at the heaviest, widest setting, and leave room above masked text so accents aren't clipped.
- Use Croatian formatting: "0,6 mm", "12 450 mm".

**Textures:** the millimetre grid appears only in the hero, the proof strip and the footer. Use 1 px hairlines and the tile-profile wave divider at most twice. No grain, glass effects or gradients.

**Motion:**
- Two easing curves only:
  - "Draft" for lines (power2.inOut, 0.6–0.9 s).
  - "Press" for fills, folds and stamps (CustomEase: fast in, hard stop, 2% recoil, 0.18–0.3 s).
- Small UI motion takes 150–200 ms.
- Metal is laid, folded or pressed. Nothing bounces.
- Animations play once, scrolling stays native, and only one red thing moves per screen.

**Logo:** a vector redraw. Make a flat version (Archivo plus the red Λ), a line version, a one-colour version, and a Λ monogram for the favicon, van and workwear.

## 6. Conversion layer
- **Mobile bar from the first second:** Nazovi | WhatsApp | Viber | Procjena. It hides while the form is on screen. On desktop, the phone number and a red button sit in the header.
- **WhatsApp and Viber links** open with a prefilled "Pozdrav, trebam procjenu za krov u …".
- **Radni nalog form, 3 steps:**
  1. Chips for the job type: novi krov / popravak / opšav / dimnjak / oluci / hitno.
  2. Location, size chips including "ne znam", and up to 6 photos.
  3. Name, mobile, best time to call.
- Service cards open the form with step 1 already chosen.
- On submit, a "PRIMLJENO" stamp lands and the page moves to /hvala. The owner gets an email (Resend) and a Telegram message.
- No prices in v1.
- **Trust:** real reviews, years in business, number of roofs, written warranty, insurance, OIB, crew faces, and case studies by neighbourhood. Start a QR review card after every job now.

## 7. Photos and video
**Where each existing photo goes:**
- 17: hero and social share image
- 5: limeni krovovi
- 16, 18: falc
- 1: popravak
- 4: opšav atike
- 8: dimnjaci
- 12, 13: snjegobrani
- 7: "Detalj je potpis"
- 6, 20: "Kako radimo"
- 10: "Pokrivamo Zagreb"
- 2, 3, 11, 19: case studies

**Drop** 14 and 15 (finger and photographer's shadow in frame). Use 9 only as the reference for the logo redraw.

**Fix:**
- Get the original files from their phones; the current ones are 1200×1600 WhatsApp copies.
- Edit all photos with one Lightroom preset that keeps the anthracite neutral.
- Remove protective-film residue and metal shavings (17, 7, 4, 1, 5).
- Never retouch the workmanship itself.

**Shot list:**
1. A licensed drone operator at golden hour: straight-down shots, a slow orbit, and a rise with Medvednica behind. Check the Pleso and Lučko airport zones first.
2. A timelapse of one full roof, for "Tri dana u 15 sekundi".
3. Before and after photos from the same marked spot on every job.
4. The owner and crew in workwear by the van, plus one shot on a roof in harnesses.
5. Gutters, which none of the current photos show.

Shoot every key angle in both portrait and landscape.

## 8. Stack, CMS and performance
**Stack:**
- Astro as a static site, TypeScript and Tailwind v4.
- GSAP for the animations.
- One small Preact component for the form.
- Astro's image pipeline for AVIF/WebP.
- Hosting on Cloudflare Pages, with one function for the form: email, Telegram, spam check (Turnstile) and photo storage (R2).
- Plausible for analytics. It sets no cookies, so no consent banner is needed.
- Structured data for RoofingContractor, Service and FAQPage.

**CMS:** Keystatic linked to GitHub, so the owner can add a project from his phone in under 2 minutes. Fields: title, neighbourhood, type, material, RAL, m², year, photos, featured. The CMS also holds reviews, the FAQ, the storm-ribbon switch and switches for each fact.

**Performance targets on a Galaxy A over 4G:**
- Main content painted in 2.0 s or less.
- Almost no layout shift (CLS ≤ 0.05).
- Taps answered in 150 ms or less (INP).
- JavaScript ≤ 90 KB gzipped, first load ≤ 700 KB.
- Lighthouse CI fails any build that gets slower.

## 9. Build phases
**Week 0, before design:**
- Get the client to sign off every fact we will publish: years, roofs, warranty, service area, whether they have their own workshop, and whether to show prices.
- Collect and edit the original photos.
- Redraw the logo.

**Phase 1, about 22 dev-days:**

| Task | Days |
|---|---|
| Hero test on a real Android, recorded and approved by the client | 2 |
| Full hero | 3 |
| SVG drawings | 3 |
| Homepage | 5 |
| Other pages | 3 |
| CMS | 2 |
| Form and backend | 2 |
| Testing and SEO | 2 |

Add 2–3 illustrator days if the developer isn't strong with vectors.

**Phase 2, about 8 days:**
- A "Anatomija krova" exploded drawing showing the roof's layers, without scroll-pinning.
- A before/after slider with a red Λ handle.
- The timelapse.
- Town pages and a blog.
- 3D only if the client pays for it separately, and then as a pre-rendered video, never real-time.

## 10. Risks and things not to do
**Top 5 risks:**
1. **Weak source material.** WhatsApp-quality photos and an AI-style raster logo would undercut the premium look. Fix both before design starts.
2. **Unconfirmed numbers or claims.** No placeholders go live; sections stay hidden in the CMS until the facts are confirmed.
3. **The flat 2D bend looks cheap.** Prove the shading and shine in the 2-day test first.
4. **The drawing style feels cold to older homeowners.** Limit the grid to three places, use warm photos and real faces, write plain Croatian, and keep the phone always visible.
5. **Slow replies to leads.** The Telegram alert reaches the owner in seconds. Judge the site by calls, not design awards.

**3 things not to do:**
1. No real-time 3D, loading screens, or long scroll-locked animations standing between someone with a leaking roof and the phone number.
2. No fake urgency or made-up proof: no "only 3 slots left" badges, invented reviews or numbers, or AI-generated roofs.
3. No design-agency gimmicks: custom cursors, scroll hijacking on phones, information only visible on hover, or auto-rotating carousels.