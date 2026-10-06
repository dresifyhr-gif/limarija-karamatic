# Admin, baza i API: ugovor za sljedeće agente

Ovaj dokument je **ugovor**. Imena tablica, stupaca, ruta, funkcija i propova su fiksna. Ako ti nešto treba promijeniti, dodaj novo (novu migraciju, novu funkciju ili novi prop) i navedi to u izvještaju. Postojeće ne mijenjaj.
Dizajn i ton javne stranice opisani su u `docs/BUILD-SPEC.md`. Admin je na hrvatskom, formalan i jednostavan, i radi se **prvo za mobitel**, jer vlasnik admin koristi s mobitela.

---

## 0. Brzi pregled

| Što | Gdje |
|---|---|
| Adapter | `@astrojs/vercel` (`astro.config.mjs`). Javne stranice su statičke (prerender). `/admin/**`, `/api/**` i `/_image` su on-demand u jednoj funkciji (`_render`, fra1, Node 24, maxDuration 30 s). |
| Baza | Neon Postgres (fra1). Dev i produkcija koriste **istu bazu**. |
| Datoteke | Vercel Blob (javni store, fra1). Fotografije se spremaju pod nepogodivim putanjama. |
| Migracije | `npm run db:migrate` primjenjuje `db/migrations/NNN_ime.sql`. Evidencija je u tablici `schema_migrations`. |
| Početni sadržaj | `npm run db:seed` iz `src/data/site.ts` upisuje **samo ono čega još nema**, pa ga je sigurno pokrenuti ponovno. |
| Server lib | `src/lib/server/*`. Ne uvozi se u klijentske `<script>`. |
| Zajednički tipovi | `src/lib/types.ts` i `src/lib/quote-math.ts`. Rade i u pregledniku. |
| Klijentski pomoćnici | `src/lib/admin/ui.ts` (api, toast, confirmDialog, forme) i `src/lib/admin/upload.ts`. |
| UI kit | `src/components/admin/*`, `src/layouts/Admin.astro`, `src/styles/admin.css` |
| Sadržaj za build | `src/lib/content.ts` → `getContent()` |

**Pravila (obavezno):**
- Svaka admin stranica i API ruta ima `export const prerender = false;`.
- Javne stranice ostaju statičke. Na njima nema `prerender = false`. Sadržaj iz baze dolazi u buildu preko `getContent()`, a na stranicu ide gumbom **"Objavi na stranicu"** (deploy hook).
- Nakon svake promjene **javnog** sadržaja (settings contact/stats, services, projects/project_images, reviews, faq) pozovi `touchContent()`. Repo funkcije to već rade. Upiti i ponude nisu javni sadržaj.
- Tajne se nikad ne logiraju ni ispisuju. Lozinka postoji samo u `ADMIN-PRISTUP.txt` (gitignored).
- Testni podaci počinju s `TEST `, a prije kraja rada ih obriši, i iz baze i s Bloba (`DELETE /api/admin/upload`).
- Ne pokreći `astro build` dok drugi agent radi na istom repou. Provjera tipova: `npx astro check`. Instalirani su TypeScript 6 i `@astrojs/check`. Jedina greška koja je već postojala je u `src/lib/reveal.ts`.

---

## 1. Baza: tablice (stanje nakon `001_init.sql`)

Driver vraća ove tipove: `integer` → number, `numeric` → **string** (koristi `num()`), `timestamptz` → Date, `date` → 'YYYY-MM-DD', `jsonb` → objekt.
JSON odgovori API-ja su **camelCase**. Mapiranje rade repo funkcije.

### `settings`: ključ → JSON
| stupac | tip |
|---|---|
| key | text PK: `contact` \| `company` \| `quote` \| `stats` |
| value | jsonb NOT NULL |
| updated_at | timestamptz |

Oblici vrijednosti su u `src/lib/types.ts` (`SettingsMap`):
- `contact: ContactSettings`, polja: `{ name, tagline, phoneDisplay, phoneE164, whatsapp (bez +), email, city, area, areaLine, hours, hoursShort, responseTime, googleReviewsUrl }`. Javno.
- `company: CompanySettings`, polja: `{ naziv, oib, adresa, iban, banka, email, telefon, web }`. **Samo za ponude, ne prikazuje se na javnoj stranici.** Prazno polje se ne ispisuje.
- `quote: QuoteSettings`, polja: `{ pdvEnabled, pdvRate (25), validDays (30), paymentTerms, notes, footer }`. Kad je `pdvEnabled=false`, ispiši `PDV_EXEMPT_NOTE` = "Obveznik nije u sustavu PDV-a (čl. 90. st. 1. Zakona o PDV-u)".
- `stats: StatSetting[]`, polja: `{ value, decimals?, prefix?, suffix?, label }`. Javno.

`getSettings()` uvijek vraća potpun objekt (baza preko zadanih vrijednosti iz site.ts).
**Seed:** `quote.pdvEnabled = true`, 25 %. Vlasnik mora potvrditi je li u sustavu PDV-a.

### `admin_meta`: interni ključevi (nije sadržaj)
`key text PK, value jsonb, updated_at`. Ključevi:
- `password_hash`: ima prednost pred `ADMIN_PASSWORD_HASH`
- `session_epoch` (number): povećava se pri promjeni lozinke i „Odjavi sve uređaje”
- `revoked_sessions` ({ sid: exp }): sesije odjavljene gumbom Odjava (kopija kolačića više ne vrijedi); istekle se same čiste
- `last_publish_at` (ISO)
- `content_updated_at` (ISO)

### `rate_events`: ograničavanje učestalosti
`id bigint PK, bucket text, key_hash text (HMAC IP-a, nikad sirova IP adresa), ts timestamptz`. Indeks je `(bucket, key_hash, ts desc)`. Bucketi: `login-fail` (5/15 min po IP-u), `login-fail-all` (ključ `global`, 50/h sa svih adresa), `upit` (5/h), `upit-foto` (30/h), `ponuda-prihvat` (20/h), `ponuda-pdf` (60/h). Brojanje je **atomsko** (`hit()`, vidi §3).

### `services`: fiksni skup slugova iz site.ts (override stupci)
`slug text PK, sort int`. Svi ostali stupci su **nullable**, a NULL znači da se koristi zadano iz `site.ts`:
`title, chip, short, intro text, includes jsonb (string[]), cover jsonb (ImageRef), gallery jsonb (ImageRef[]), faq jsonb ({q,a}[]), h1, lead, seo_title, seo_description, includes_title, gallery_title, gallery_lead, related_title, faq_title text, updated_at`.
`profile` (ikona) i stranice `/usluge/[slug]` ostaju u kodu. Seed je upisao pune vrijednosti za svih 6 usluga.

### `projects`: radovi
| stupac | tip |
|---|---|
| id | integer identity PK |
| slug | text UNIQUE (URL `/radovi/[slug]`) |
| title | text NOT NULL |
| hero_title | text NULL |
| kind | text CHECK in `krov, falc, atika, ravni, dimnjak, snjegobrani` |
| service_slug | text (jedan od slugova usluga) |
| location, material | text '' |
| year | int NULL |
| alt | text (opis naslovne fotografije) |
| note | text |
| scope | jsonb string[] |
| featured | bool |
| published | bool (false = ne ide na stranicu) |
| sort | int (manji = prije; novi rad dobiva min(sort)−1, tj. ide na vrh) |
| created_at, updated_at | timestamptz |

### `project_images`
`id PK, project_id FK → projects ON DELETE CASCADE, asset_key text NULL, url text NULL, pathname text NULL, width int, height int, alt text, sort int, created_at`.
Ograničenja: točno jedno od `asset_key` / `url`. Kad postoji `url`, moraju postojati i width i height. **Prva po `sort` je naslovna.**
Seed: 12 radova i 21 fotografija, sve kao `asset_key` (npr. `projects/falcani-krov-zid.jpg`, relativno na `src/assets`).

### `reviews`
`id PK, name, place, text, stars int 1–5, source text ('Google', 'WhatsApp'…), review_date date NULL, published bool, sort, created_at, updated_at`. Seed ih ne upisuje (recenzije se ne izmišljaju).

### `faq`
`id PK, q, a, on_home bool, published bool, sort, created_at, updated_at`. Seed je upisao 12 pitanja; 5 ih ima `on_home=true` (redoslijed prati site.ts).

### `leads`: upiti s web stranice
`id PK, status text CHECK in ('novo','u_obradi','ponuda_poslana','zatvoreno') default 'novo', job_type text (id iz jobTypes ili slug usluge), variant text ('standard'|'zgrada'), location, size (jedna od roofSizes), note, photos jsonb (BlobImageRef[]), name, phone, email, call_time, source_page, admin_note, created_at, updated_at`.
Oznake: `LEAD_STATUS_LABEL` (Novo / U obradi / Ponuda poslana / Zatvoreno).

### `quote_counters`
`year int PK, last_seq int`. Brojač za brojeve ponuda.

### `quotes`: ponude
| stupac | tip / napomena |
|---|---|
| id | integer PK |
| number | text UNIQUE, `KR-YYYY-NNN` |
| year, seq | int, UNIQUE(year, seq) |
| status | `nacrt` \| `poslana` \| `prihvacena` \| `odbijena` (oznake su u `QUOTE_STATUS_LABEL`, s dijakriticima) |
| issue_date | date (zagrebački datum) |
| client_name, client_phone, client_email, client_address, client_oib | text '' |
| location | text: adresa gradilišta |
| title, intro | text |
| items | jsonb `QuoteItem[]` |
| notes, payment_terms | text |
| valid_days | int (30) |
| pdv_enabled | bool |
| pdv_rate | numeric(5,2) |
| subtotal, pdv_amount, total | numeric(12,2). **Cache koji računa server** (`computeTotals`) |
| public_token | text UNIQUE, 24 znaka base64url (za `/ponuda/[token]`) |
| lead_id | int NULL FK → leads ON DELETE SET NULL |
| sent_at, viewed_at, accepted_at, rejected_at | timestamptz NULL |
| created_at, updated_at | timestamptz |

`QuoteItem` (`src/lib/types.ts`), cijene su **NETO u EUR**:
```ts
{ id: string; type: 'item'; title; description; unit; qty: number; unitPrice: number }
| { id: string; type: 'section'; title }   // naslov skupine, bez cijene
```
Jedinice su u `QUOTE_UNITS = ['m²','m','kom','sat','paušal','kg','set']`; dopušten je i slobodan tekst do 12 znakova.

### `quote_item_templates`: cjenik i predlošci stavki
`id PK, name, description, unit ('m²'), unit_price numeric(12,2), category, sort, created_at, updated_at`. Tablica je prazna; vlasnik je puni sam.

### Nova migracija
Dodaj datoteku `db/migrations/002_opis.sql`. Koristi `IF NOT EXISTS` i `ADD COLUMN IF NOT EXISTS`. **Nikad ne mijenjaj `001_init.sql`**, jer skripta provjerava sha256. Pokreni `npm run db:migrate`, a status provjeri s `node scripts/db-migrate.mjs --status`.

---

## 2. Fotografije: `ImageRef`

```ts
type AssetImageRef = { key: string; alt?: string };                                  // src/assets/<key>, u repozitoriju
type BlobImageRef  = { url: string; pathname: string; width: number; height: number; alt?: string };  // Vercel Blob
type ImageRef = AssetImageRef | BlobImageRef;   // isBlobRef(r), isAssetRef(r), blobUrlsOf(refs)
type UploadedImage = BlobImageRef & { size: number; contentType: string };          // odgovor uploada
```
- Upload: `POST /api/admin/upload`. Server prepoznaje JPEG/PNG/WebP po potpisu datoteke. HEIC/AVIF/GIF dobivaju 415. Veće od 12 MB dobiva 413. JPEG-u se **brišu EXIF/XMP/IPTC** (GPS!), a orijentacija ostaje kao minimalni EXIF. Putanja je `<folder>/<yyyy>/<24 znaka>.<ext>`, a folder je `media` (zadano), `leads` ili `quotes`.
- **Vercel funkcija prima najviše oko 4,5 MB po zahtjevu.** Zato preglednik prije slanja smanji fotografiju: `src/lib/admin/upload.ts` → najviše 2560 px, JPEG 0,85, bez EXIF-a. Uvijek koristi `uploadImage()` ili `ImageUploader`. Ne šalji izvornu datoteku.
- Brisanje: `deleteBlobsIfUnused(urls)` briše samo ono na što se u bazi više ništa ne referira (project_images, services.cover/gallery, leads.photos, settings). Repo funkcije ga zovu same kod zamjene ili brisanja.
- Sličice u adminu (SSR): `await thumbUrl(ref, 480)` iz `@/lib/server/images` vraća `/_image?...` (sharp, radi i za lokalne i za Blob fotografije).
- Popis lokalnih fotografija (za birač "postojeće fotografije"): `ASSET_KEYS` i `assetByKey(key)` iz `@/lib/assets`.

---

## 3. Server lib (`src/lib/server/*`)

```ts
// env.ts: process.env → import.meta.env (dev) → .env.local (lokalni build). U env.ts NE piši imena varijabli (Astro bi ih inlineao).
env(name): string | undefined;  requireEnv(name): string;  isProduction(): boolean;  isLocal(): boolean

// db.ts: lijeni Neon HTTP klijent (bez Proxyja)
db(): NeonQueryFunction      // db()`SELECT … ${x}` | db().query('… $1', [x]) | db().transaction((sql) => [sql`…`, sql`…`])
hasDatabase(): boolean;  num(v): number  // numeric string → number

// http.ts
class HttpError(status, message, fields?)
json(data, status = 200, headers?) / jsonError(status, error, fields?)
readJson<T>(request, maxBytes = 1e6): Promise<T>          // 415 ako nije JSON, 400 ako je neispravan
parseId(param): number                                   // inače 404
notFound(what): never
route(handler): APIRoute   // hvata HttpError → {error, fields}; PG 23505→409, 23503→409, 23514→400; ostalo → 500 bez detalja

// validate.ts: mali validator
v.string({min,max=2000,trim=true,pattern,patternMsg}) v.text({min,max=20000}) v.slug() v.email() v.url()
v.int({min,max}) v.number({min,max})   // prihvaća i "12,50"
v.bool() v.enum([...]) v.date() v.array(item,{min,max}) v.object(shape) v.partial(obj) v.optional(x) v.nullable(x)
v.blobImage() v.imageRef() v.quoteItem()
parse(schema, input): T   // baca HttpError(400, poruka, { 'polje.podpolje': 'poruka' })
type Infer<typeof Schema>

// schemas.ts: gotove sheme (camelCase)
ContactSchema CompanySchema QuoteSettingsSchema StatsSchema SETTINGS_SCHEMAS
ServicePatchSchema ProjectSchema ProjectImagesSchema ReorderSchema ReviewSchema FaqSchema TemplateSchema
LeadCreateSchema LeadPatchSchema QuoteSchema QuoteStatusSchema PasswordSchema LoginSchema

// auth.ts
readSession(ctx): Promise<AdminSession | null>   // { username, issuedAt, expiresAt } (ms)
login(ctx, username, password)                    // 429 nakon 5 neuspjeha/15 min po IP-u ili 50/h ukupno, 401 pogrešno; postavlja kolačić
changePassword(ctx, current, next)                // next ≥ 10 znakova; hash ide u admin_meta; ostale sesije prestaju vrijediti
await clearSession(cookies, url)                  // odjava s ovog uređaja: briše kolačić I upisuje sid u revoked_sessions
await logoutEverywhere(cookies, url)              // nova epoha → svi uređaji odjavljeni
verifyPassword(pw, stored); hashPassword(pw)
sameOrigin(request, url); isMutating(method); hasDeployHook()
// kolačić `kr_admin` {u,iat,exp,ep,lt,sid}: HMAC-SHA256(SESSION_SECRET), httpOnly, SameSite=Lax, Secure na https, 14 dana,
// klizna obnova nakon 24 h, ali najdulje 30 dana od prijave (lt). Epoha i odjave keširaju se 30 s po instanci.

// rate-limit.ts (generički; koristi ga i za javnu formu!)
clientKey(ctx): string   // HMAC hash IP-a (IPv6 → /64). x-real-ip/x-forwarded-for vjeruje SAMO na Vercelu (process.env.VERCEL), inače clientAddress
await hit(bucket, key, windowSec, limit): { ok, count, retryMin }
         // ATOMSKI zabilježi pa prebroji (pg_advisory_xact_lock u transakciji) — paralelni zahtjevi se ne mogu provući.
         // NIKAD "countRecent pa recordEvent" za ograničavanje (to je bio propust: 25 istodobnih prijava sve su prošle).
countRecent(...) (samo prikaz) / clearEvents(bucket, key) / forgetOne(bucket, key)

// meta.ts
getMeta(key) / setMeta(key, value) / touchContent() / getPublishState(): { lastPublishAt, contentUpdatedAt, dirty }

// publish.ts
publishSite(): { mode: 'deploy'|'noop', message, state }   // POST na DEPLOY_HOOK_URL; lokalno noop s porukom

// blob.ts
uploadImage(bytes, folder='media', alt=''): UploadedImage;  validateImage(bytes)
deleteBlobs(urls); deleteBlobsIfUnused(urls); isBlobReferenced(url); isOurBlobUrl(url) /* točno NAŠ store (blobHost()) */; MAX_UPLOAD_BYTES; UPLOAD_FOLDERS

// images.ts
thumbUrl(ref, width=480): Promise<string|null>; thumbUrls(refs, width)

// dashboard.ts
getDashboard(): { leads: Record<LeadStatus,n>, quotes: Record<QuoteStatus,n>, content: {projects, projectsPublished, reviews, faq}, publish: PublishState & {canDeploy}, recentLeads: Lead[] }
```

### Repo (`src/lib/server/repo/*`): koristi ih i u SSR stranicama (nema potrebe za fetchom na vlastiti API)
```ts
// settings.ts
getSettings(): SettingsMap; getSetting(key); saveSetting(key, value)   // validira; contact/stats → touchContent
// services.ts
listServices(): AdminService[]; getService(slug); updateService(slug, ServicePatch); reorderServices(slugs)
//   AdminService = ServiceFields & { slug, sort, overridden: (keyof ServiceFields)[], defaults: ServiceFields, updatedAt }
// projects.ts
listProjects({publishedOnly?}): AdminProject[]; getProject(id); createProject(ProjectInput); updateProject(id, Partial)
deleteProject(id); setProjectImages(id, [{ id?, image: ImageRef }]): ProjectImage[]; reorderProjects(ids)
//   AdminProject = { id, slug, title, heroTitle, kind, serviceSlug, location, material, year, alt, note, scope, featured, published, sort, createdAt, updatedAt, images: ProjectImage[] }
//   ProjectImage = ImageRef & { id, sort }
// reviews.ts: listReviews({publishedOnly?}) getReview createReview updateReview deleteReview reorderReviews
// faq.ts:     listFaq({publishedOnly?}) getFaq createFaq updateFaq deleteFaq reorderFaq
// templates.ts: listTemplates getTemplate createTemplate updateTemplate deleteTemplate
// leads.ts:   listLeads({status?, limit?, offset?}) countLeadsByStatus getLead createLead(LeadCreateInput) updateLead(id,{status?,adminNote?}) deleteLead
// quotes.ts:  listQuotes({status?, q?, limit?, offset?}): QuoteListItem[]; countQuotesByStatus; getQuote(id); getQuoteByToken(token)
//             markQuoteViewed(id); createQuote(Partial<QuoteInput>); updateQuote(id, Partial); setQuoteStatus(id, status)
//             duplicateQuote(id); deleteQuote(id)
```
Ponašanje ponuda:
- `createQuote` dodjeljuje broj **atomski** u jednoj SQL naredbi (CTE nad `quote_counters`).
- Prazna polja nove ponude dolaze iz `settings.quote`. Ako je zadan `leadId`, ime, telefon, e-mail i lokacija dolaze iz upita.
- `updateQuote` uvijek ponovno računa iznose.
- `setQuoteStatus`:
  - `poslana` → `sent_at` (prvi put), a povezani upit prelazi u `ponuda_poslana` ako je bio `novo` ili `u_obradi`
  - `prihvacena` → `accepted_at`
  - `odbijena` → `rejected_at`
- `deleteQuote` vraća brojač samo ako je obrisana **zadnja** ponuda godine i nikad nije bila poslana.

`src/lib/quote-math.ts`:
```ts
computeTotals(items, pdvEnabled, pdvRate)   // → { lines: {id: iznos}, subtotal, pdvAmount, total }
round2(n)                                   // half away from zero
formatEur(n)                                // '1.234,50 €'
formatQty(n)
formatQuoteNumber(y, s)
```

---

## 4. API (`/api/admin/**`): JSON, sve osim login traži sesiju

Konvencije:
- Bez sesije: **401** `{error}`.
- Promjena stanja s druge domene: **403**. Origin/Referer mora biti isti, a i Astro `security.checkOrigin` je uključen.
- Greška validacije: **400** `{ error, fields: { polje: poruka } }`. Ostali kodovi su opisani u `http.ts`.
- **PUT je djelomičan** (kao PATCH, a `PATCH` je alias). Polja koja ne pošalješ ostaju ista.
- Popisi vraćaju `{ items: [...] }`, a pojedinačni zapis vraća objekt.

| Metoda i ruta | Tijelo | Odgovor |
|---|---|---|
| POST `/api/admin/login` | JSON `{username,password,next?}` ili form | 200 `{ok,next}` · 401 · 429. Form: 303 na `next` ili `/admin/login?greska=` |
| POST `/api/admin/logout` | prazno ili form | 200 `{ok}` (form → 303 `/admin/login?odjava=1`) |
| GET `/api/admin/me` | | `{username, expiresAt}` |
| POST `/api/admin/password` | `{current, next}` | `{ok}` · 400 `fields.current/next` · 429 |
| GET `/api/admin/status` | | `Dashboard` |
| POST `/api/admin/publish` | `{}` | `{mode:'deploy'\|'noop', message, state}` · 502 |
| POST `/api/admin/upload` | multipart `file`, `folder?`, `alt?` | 201 `UploadedImage` · 413 · 415 |
| DELETE `/api/admin/upload` | `{urls: string[], force?}` | `{deleted, skipped}` (skipped = još se koristi) |
| GET `/api/admin/settings` | | `SettingsMap` |
| GET/PUT `/api/admin/settings/:key` | PUT `{value}` (CIJELA vrijednost) | vrijednost |
| GET `/api/admin/services` | | `{items: AdminService[]}` |
| GET/PUT `/api/admin/services/:slug` | `ServicePatch` (null = vrati zadano) | `AdminService` |
| POST `/api/admin/services/reorder` | `{slugs}` | `{ok}` |
| GET/POST `/api/admin/projects` | POST `ProjectInput` (+ `images?: [{image}]`) | `{items}` / 201 `AdminProject` |
| GET/PUT/DELETE `/api/admin/projects/:id` | PUT `Partial<ProjectInput>` | `AdminProject` / `{ok}` |
| PUT `/api/admin/projects/:id/images` | `{images: [{id?, image: ImageRef}]}`: **cijeli popis redom** | `{items: ProjectImage[]}` |
| POST `/api/admin/projects/reorder` | `{ids}` | `{ok}` |
| GET/POST `/api/admin/reviews`, GET/PUT/DELETE `/:id`, POST `/reorder` | `ReviewInput {name, place, text, stars, source, reviewDate?, published}` | |
| GET/POST `/api/admin/faq`, GET/PUT/DELETE `/:id`, POST `/reorder` | `FaqInput {q, a, onHome, published}` | |
| GET/POST `/api/admin/quote-templates`, GET/PUT/DELETE `/:id` | `{name, description, unit, unitPrice, category}` | |
| GET `/api/admin/quotes?status=&q=&limit=&offset=` | | `{items: QuoteListItem[]}` |
| POST `/api/admin/quotes` | `Partial<QuoteInput>` (može `{}` ili `{leadId}`) | 201 `Quote` (s brojem, status nacrt) |
| GET/PUT/DELETE `/api/admin/quotes/:id` | PUT `Partial<QuoteInput>` | `Quote` / `{ok}` |
| POST `/api/admin/quotes/:id/status` | `{status}` | `Quote` |
| POST `/api/admin/quotes/:id/duplicate` | | 201 `Quote` |
| GET `/api/admin/leads?status=&limit=&offset=` | | `{items: Lead[], counts}` |
| GET/PUT/DELETE `/api/admin/leads/:id` | PUT `{status?, adminNote?}` | `Lead` / `{ok}` (briše i fotografije) |

`QuoteInput` = `{ issueDate?, clientName, clientPhone, clientEmail, clientAddress, clientOib (11 znamenki ili ''), location, title, intro, items: QuoteItem[], notes, paymentTerms, validDays, pdvEnabled, pdvRate, leadId? }`.

Javna forma, PDF, `/ponuda/[token]` i WhatsApp su gotovi — vidi §10.


---

## 5. Middleware i sigurnost (`src/middleware.ts`)

- Zaštićeno je `/admin/**` i `/api/admin/**`, osim `/admin/login` i `/api/admin/login`. Putanja se normalizira (dekodiranje, `//`, velika slova, završni `/`) i provjerava se i `routePattern`.
- Stranica bez sesije dobiva 303 na `/admin/login?next=…`. API bez sesije dobiva 401 JSON. `Astro.locals.admin` je sesija.
- Sve metode osim GET/HEAD/OPTIONS moraju doći s iste domene. Inače 403.
- Odgovori dobivaju `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Content-Security-Policy` (`ADMIN_CSP`: skripte/stilovi samo s naše domene + inline, slike i s Vercel Bloba, `connect-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`) i `Cache-Control: no-store` (ako ga ruta sama nije postavila). `robots.txt` ima `Disallow: /admin` i `/api/`.
- `vercel.json` dodaje svim odgovorima `nosniff`, HSTS i `Permissions-Policy`; javnim stranicama (ne `/admin`, `/api`, `/ponuda`) još `Referrer-Policy: strict-origin-when-cross-origin` i CSP `frame-ancestors 'self'`.
- Poruke u URL-u: `/admin/login?greska=<kod>` prihvaća samo kodove s popisa (`podaci`, `limit`, `zakljucano`, `prazno`, `baza`, `greska`); admin `?poruka=` (Toast) se prikazuje samo kad je `document.referrer` s iste domene.
- JSON u `<script>` (JSON-LD u `Base.astro`, boot podaci) UVIJEK s `.replace(/</g, '\\u003c')` — naslov iz admina inače može zatvoriti `</script>`.
- `readJson` odbija prevelika tijela prije čitanja (content-length) i prekida čitanje na limitu.
- Javne on-demand rute koje dodaš (npr. `/ponuda/[token]`, `/api/upit`) middleware ne dira. Sigurnost (rate limit, noindex) tamo rješavaš sam.

---

## 6. Sadržaj za build: `src/lib/content.ts`

```ts
const c = await getContent();   // pamti se za cijeli build (u devu 3 s)
c.source                        // 'db' | 'defaults'
c.contact                       // ContactSettings
c.telHref; c.waHref(text?)      // linkovi prema kontaktu iz baze
c.stats                         // Stat[] (confirmed: true)
c.services                      // ContentService[]: oblik kao Service iz site.ts, ali image/gallery su SiteImage
c.projects                      // ContentProject[]: samo objavljeni, poredani; image = gallery[0]; radovi bez fotografija se preskaču
c.reviews                       // ContentReview[]: {name, place, text, stars, source?, date?}, samo objavljene
c.faq; c.homeFaq                // {q,a}[] (homeFaq = on_home)
imageAlt(img, fallback)         // alt iz baze/site.ts za bilo koju SiteImage
type SiteImage = ImageMetadata | RemoteImage   // RemoteImage = { src, width, height, remote: true }; isRemoteImage(img)
```
- Bez `DATABASE_URL` ili kad baza padne, vraća se `site.ts` uz `console.warn`. **Build nikad ne pada zbog baze** (provjereno s praznim i s neispravnim URL-om).
- Ista fotografija je uvijek **isti objekt**, i lokalna i udaljena, pa pravilo "nijedna fotografija dvaput na stranici" (`media.ts`) i dalje radi preko `Set`/`===`.
- Udaljene fotografije Astro u buildu skine i optimizira (AVIF/WebP), jer je host NAŠEG storea u `image.remotePatterns` (`astro.config.mjs` ga izvodi iz `BLOB_READ_WRITE_TOKEN` → `<storeId>.public.blob.vercel-storage.com`, ili `BLOB_PUBLIC_HOST`). Wildcard `*.public.blob.vercel-storage.com` se NE smije vratiti: javni `/_image` bi tada preuzimao slike s tuđih storeova. Za udaljene fotografije **obavezno zadaj `fallbackFormat="jpg"`**, inače je zamjenski `<img>` PNG od oko 1,8 MB.
- Slugovi usluga su fiksni: `getStaticPaths` za usluge i dalje može ići iz site.ts. Radovi se mogu dodavati, pa `getStaticPaths` za `/radovi/[slug]` mora ići iz `getContent().projects`. Sitemap također.

Primjer (prerađeni `Photo.astro`, posao sljedećeg agenta):
```astro
---
import { Picture } from 'astro:assets';
import { isRemoteImage, type SiteImage } from '@/lib/content';
interface Props { src: SiteImage; alt: string; widths?: number[]; sizes?: string; /* … */ }
const { src, alt, widths = [480, 640, 800, 960, 1200], sizes = '(min-width: 1024px) 33vw, 90vw' } = Astro.props;
const common = { alt, sizes, formats: ['avif', 'webp'], quality: 55, widths: widths.filter((w) => w <= src.width) };
---
{isRemoteImage(src)
  ? <Picture {...common} src={src.src} width={src.width} height={src.height} fallbackFormat="jpg" />
  : <Picture {...common} src={src} />}
```
Stranica, primjer s naslovnicom:
```astro
---
import { getContent } from '@/lib/content';
const { homeFaq, projects, contact } = await getContent();
---
<Faq items={homeFaq} />
```

---

## 7. Admin UI

### Layout: `src/layouts/Admin.astro`
Props: `{ title: string; active?: 'pregled'|'upiti'|'ponude'|'radovi'|'usluge'|'recenzije'|'pitanja'|'postavke'; wide?: boolean }`. Stavlja noindex i ne koristi javno zaglavlje ni podnožje.
- Grafit traka sadrži KARAMATIĆ logo, gumb "Objavi na stranicu" i odjavu. Gumb je crven kad postoje neobjavljene promjene, a obrubljen ("Sve je objavljeno") kad ih nema.
- Izbornik je ispod trake. Na mobitelu klizi vodoravno, a uz "Upiti" stoji broj novih upita.
- `<Toast/>` i `<ConfirmDialog/>` su već uključeni.
- Nakon spremanja javnog sadržaja na klijentu pozovi `document.dispatchEvent(new CustomEvent('kr:content-changed'))` da gumb postane crven bez osvježavanja.
- Glavni sadržaj je `max-w-5xl` (ili `max-w-[88rem]` s `wide`) i ima `pb-24`.

### Komponente: `src/components/admin/`
| Komponenta | Props |
|---|---|
| `Button` | `variant?: 'primary'(crvena, samo glavna radnja)\|'secondary'\|'dark'\|'ghost'\|'danger'; size?: 'md'\|'sm'; href?; type?; icon?: AdminIconName; iconRight?; iconOnly?; label?; block?; class?; target?` + HTML atributi |
| `Field` | `label?; for?; name? (za grešku s API-ja); hint?; error?; required?; class?`, slot je kontrola |
| `Input` | `name; label?; hint?; error?; number? (decimalni zarez → broj); class?; fieldClass?` + input atributi |
| `Textarea` | `name; label?; hint?; error?; value?; rows?` + atributi |
| `Select` | `name; label?; options: ({value,label,disabled?}\|string)[]; value?; placeholder?; hint?; error?` |
| `Toggle` | `name; label; hint?; checked?` (checkbox role=switch) |
| `Card` | `title?; eyebrow?; description?; flush? (bez paddinga, za popise); class?; id?; as?`, slot `actions` |
| `PageHeader` | `title; description?; eyebrow?; back?: {href,label}`, slot `actions` |
| `Table` | `columns: {key,label,align?,mono?,primary?,hideOnMobile?,class?}[]; rows: (Record & {_href?})[]; empty?; caption?`. Na mobitelu se prikazuje kao kartice. |
| `ListRow` | `title; meta?; href?; thumb?: string\|null; thumbAlt?`, slotovi `start`, `end`, default |
| `Badge` | `tone?: 'neutral'\|'info'\|'success'\|'warning'\|'danger'\|'muted'; plain?`. Tonovi statusa: `LEAD_STATUS_TONE`, `QUOTE_STATUS_TONE` iz `@/lib/admin/labels` |
| `StatCard` | `label; value; href?; hint?; icon?; highlight?` |
| `EmptyState` | `title; text?; icon?`, slot su radnje |
| `ImageUploader` | `name; label?; hint?; value?: (ImageRef & {thumb?, id?})[] \| ImageRef \| null; single?; max?; folder?; withAlt?` |
| `Toast`, `ConfirmDialog` | bez propova (već su u layoutu) |
| `AdminIcon` | `name: AdminIconName; size?; class?; label?`. Imena: home inbox file image layers star help settings upload publish camera trash edit plus check close chevron-* arrow-left/right logout eye eye-off external phone grip alert info refresh download copy search menu more map-pin clock lock user whatsapp |

**ImageUploader:**
- Vrijednost je JSON u skrivenom polju `name` (`data-json`). `formData()` ga sam parsira u `ImageRef[]`, a sa `single` u `ImageRef|null`.
- Fotografija se šalje odmah po odabiru. Na mobitelu postoji "Uslikaj" (kamera), na desktopu povuci-i-ispusti. Redoslijed se mijenja strelicama; prva je naslovna. Alt se upisuje uz `withAlt`.
- Uklonjena **nova** fotografija odmah se briše s Bloba. Uklonjenu **postojeću** briše server pri spremanju.
- Dok traje slanje, korijen ima `data-busy="true"` i `submitForm()` odbija spremiti.
- Događaj `images-change` (bubbles) šalje se nakon svake promjene.
- Za postojeće ID-jeve fotografija rada: proslijedi `id` u `value`. Ostaje u JSON-u, pa ga možeš poslati u `PUT …/images` kao `{id, image}`.

### Klijent: `src/lib/admin/ui.ts` i `upload.ts`
```ts
api<T>(path, { method?, body?: object|FormData, signal? })   // 401 → login; greške → ApiError(status, message, fields)
toast(message, 'success'|'error'|'info', ms?)
confirmDialog({ title, message?, confirmLabel?, cancelLabel?, danger? }): Promise<boolean>
formData(form)                    // checkbox→bool, [data-number]/number→broj, [data-json]→JSON, [data-list]→string[]
showErrors(form, fields)          // traži [name=…] i [data-field-error=…]
withBusy(button, fn)
submitForm(form, path, { method='PUT', body?, success? })   // validacija → toast; šalje 'kr:saved' na formu
errorMessage(e)
uploadImage(file, { folder?, alt?, onProgress? }): UploadedImage   // smanjuje u pregledniku
prepareImage(file)
discardUploads(urls)
```
`src/lib/admin/labels.ts`: `LEAD_STATUS_LABEL/TONE`, `QUOTE_STATUS_LABEL/TONE`, `formatDate`, `formatDateTime`, `timeAgo` (Europe/Zagreb).
Poruka nakon preusmjeravanja: dodaj `?poruka=Spremljeno.` u URL (`&vrsta=greska` za crvenu).

### Stil: `src/styles/admin.css`
Klase su u cascade layerima, pa Tailwind utility klase uvijek imaju prednost:
- tipografija: `a-h1`, `a-h2`, `a-eyebrow`, `a-muted`, `a-mono`
- plohe: `a-card`
- polja: `a-field`, `a-label`, `a-hint`, `a-error`, `a-input`, `a-select`, `a-textarea`, `a-toggle`
- gumbi: `a-btn` + `--primary|secondary|dark|ghost|danger|sm|icon|block`
- oznake: `a-badge--*`
- popisi: `a-table`, `a-row`

CSS varijable: `--a-line`, `--a-line-strong`, `--a-muted`, `--a-radius` (3px), `--a-ok`, `--a-warn`.
Dizajn:
- Pozadina je papir, plohe bijele, traka grafit.
- **Crvena samo za glavnu radnju na ekranu** i za "Objavi" kad postoje promjene. Brisanje je `danger`: crveni tekst na bijelom.
- Polja su visoka 48 px, slova 16 px (iOS ne zumira).
- Nema bounce/elastic pokreta. Prijelazi traju 150–200 ms.

### Stranice
- `/admin/login`: gotovo. Radi s JS-om (fetch, prikaz lozinke) i bez njega (form POST).
- `/admin`: Pregled je gotov (brojke, zadnji upiti, stanje objave, sadržaj).
- **Privremene** stranice za zamjenu: `src/pages/admin/{upiti,ponude,radovi,usluge,recenzije,pitanja,postavke}.astro`. Kad gradiš odjeljak s podstranicama, **obriši** `X.astro` i napravi `X/index.astro` (+ `X/[id].astro`, `X/novi.astro`…).
- Pregled već linka na `/admin/ponude/nova`, `/admin/radovi/novi`, `/admin/upiti/:id`, `/admin/upiti?status=novo` i `/admin/ponude?status=…`. Napravi te rute.
- Postavke trebaju formu za promjenu lozinke (`POST /api/admin/password`) i PDV prekidač (`settings.quote`).

---

## 8. Objava (Vercel)

- `DEPLOY_HOOK_URL` postoji samo na produkciji. `POST /api/admin/publish` ga poziva i bilježi `last_publish_at`. Lokalno ne radi ništa i to javlja.
- Build na Vercelu ima `DATABASE_URL`, pa `getContent()` čita bazu. Javne stranice su statičke, a fotografije s Bloba optimiziraju se u buildu.
- `vercel.json` sadrži `"regions": ["fra1"]`. Adapter ima `imageService: false` (sharp u buildu, bez Vercel Image Optimization).
- Slike u `/_image` (admin sličice) servira funkcija.

## 9. Testiranje

- Prijava: korisničko ime i lozinka su u `ADMIN-PRISTUP.txt`. Čitaj ih iz datoteke u skripti i nikad ih ne ispisuj.
- Pazi da selektor `button[type=submit]` ne pogodi odjavu u zaglavlju (i ona je submit). Koristi selektor unutar svoje forme.
- Test podaci počinju s `TEST `, a obrisati ih moraš iz baze i s Bloba. Brojač ponuda se vraća samo za zadnju nikad poslanu ponudu, pa testne ponude briši obrnutim redom i ne stavljaj ih u status `poslana`.
- Testovi mijenjaju `content_updated_at`. Ako sadržaj na kraju ostane isti, postavi `admin_meta.last_publish_at` na sada (ISO), da gumb "Objavi" ne ostane crven.

---

## 10. Upiti i ponude (gotovo)

| Što | Gdje |
|---|---|
| Javna forma | `RadniNalog.astro` + `src/lib/form.ts`: fotografije se smanje u pregledniku (≤ 2048 px JPEG) → `POST /api/upit/foto` (javno, ista domena, 30/h po IP-u, folder `leads`, vraća potpis `sig`) → `POST /api/upit` JSON (zamka `web`, 5 upita/h po IP-u, provjera potpisa fotografija) → `/hvala?upit=0017&posao=…&slike=…`. Bez JS-a: multipart na `/api/upit` → 303. Redoslijed u `/api/upit`: provjera polja (bez zapisa) → `hit()` → tek onda učitavanje fotografija → spremanje; ako spremanje ne uspije, fotografije se brišu s Bloba. Telefon u formi dolazi iz `getContent().contact`. |
| Broj upita | `leadNumber(id)` = id na 4 znamenke, prikazuje se kao `#U-0017` (ponude su `KR-2026-001` — prefiksi se ne smiju miješati), `src/lib/quotes/shared.ts`. `/hvala` prihvaća i stari `KR-0017`. |
| Admin upiti | `/admin/upiti` (filtri `?status=`, `?str=`), `/admin/upiti/:id` (nazovi, WhatsApp, status, bilješka, ponude, brisanje) |
| Admin ponude | `/admin/ponude` (filtri, pretraga `?q=`, zbroj), `/admin/ponude/nova` (`?upit=<id>` popuni iz upita; ništa se ne sprema prije "Spremi"), `/admin/ponude/:id`, `/admin/ponude/predlosci` (cjenik) |
| Uređivač | `src/components/admin/quotes/QuoteEditor.astro` |
| Javna ponuda | `/ponuda/:token` (noindex, `Referrer-Policy: no-referrer`, bilježi `viewed_at` osim za admina i robote), `GET /api/ponuda/:token/pdf` (`?prikaz=1` inline), `POST /api/ponuda/:token/prihvat` (JSON ili forma; prihvaća se SAMO status `poslana` — `acceptQuoteByClient()` ima uvjet u UPDATE-u; 409 za nacrt/odbijenu/isteklu). PDF ima ograničenje 60/h po IP-u. |
| PDF | `src/lib/quotes/pdf.ts` → `renderQuotePdf(quote, settings)`; fontovi u `src/lib/quotes/fonts/` (vidi README) |

Dodano u zajedničke datoteke (aditivno):
- `QuoteItem` (type `item`) ima opcionalni `discount?: number` (popust u %, 0–100). `computeTotals`: iznos = round2(qty × cijena × (1 − popust/100)). `v.quoteItem()` ga prihvaća (0/prazno = izostavljeno).
- `repo/quotes.ts`: `issueDate` se ispravno mapira kad driver vrati `Date` (prije je bilo "Tue Oct 06").

### 10.1 Završne popravke (sigurnost i QA)
- **Zaključana prihvaćena ponuda:** `updateQuote()` vraća 409 (`LOCKED_MSG`) kad je status `prihvacena` (provjera i u samom UPDATE-u). Uređivač tada prikazuje obavijest, sva polja su onemogućena i nema gumba Spremi. Vraćanje statusa na Nacrt/Poslana briše `accepted_at` i otključava ponudu; za izmjene se preporučuje „Dupliciraj”.
- **Prazne stavke:** `dropEmptyItems()` (repo) i uređivač ne spremaju stavku bez naziva, opisa i cijene. Prazna početna stavka nove ponude zamjenjuje se prvom stavkom iz cjenika.
- **Zaokruživanje:** `round2()` svodi umnožak na 15 značajnih znamenki prije `Math.round` (302,46 × 25 % = 75,62, ne 75,61). Provjereno na 2 000 000 osnovica i 300 000 slučajnih stavki.
- **WhatsApp / „Kao klijent”:** `openTab()` otvara `about:blank`, prekida `opener` pa navigira (`window.open(…,'noopener')` uvijek vraća null). Ako je nova kartica blokirana, ista kartica ide na WhatsApp, a pitanje „Je li ponuda poslana?” postavlja se po povratku (sessionStorage `kr:ask-sent`).
- **Gumb Spremi** postojeće ponude je onemogućen dok nema promjena.
- **PDF:** naslov dulji od 3 retka ispisuje se cijeli u bloku „Predmet ponude”; međuzbroj odjeljka je „Međuzbroj: <naslov>”; svaki blok uvjeta ostaje cijeli, a samo zadnji ide zajedno s potpisima (nema seljenja svih uvjeta na novu stranicu).
- **Mobitel:** uređivač ponude nema vodoravno pomicanje ni s dugim nazivima odjeljaka (`minmax(0,1fr)` stupci, `.qi__title { flex: 1 1 0; width: 0 }`).
- **Bez pečata:** `/hvala` i forma više nemaju crveni pečat „PRIMLJENO”; forma nakon slanja prikazuje mirno „Upit je poslan”.
- **Postavke → Lozinka:** kartica „Odjava sa svih uređaja” (`POST /api/admin/logout` s `sve=1`).
- **Vrsta posla:** `isKnownJob`/`jobLabel` koriste `Object.hasOwn` (`constructor` više nije „poznata vrsta”).

