-- Limarija Karamatić — početna shema (admin + sadržaj + upiti + ponude).
-- Pokreće je scripts/db-migrate.mjs (jednom; evidencija u schema_migrations).
-- Sve naredbe su ionako idempotentne (IF NOT EXISTS), pa je ponovno pokretanje bezopasno.

-- ── Postavke (ključ → JSON) ────────────────────────────────────────────────
-- ključevi: contact, company, quote, stats  (vidi docs/ADMIN-SPEC.md)
CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Interni meta podaci admina (nije sadržaj) ─────────────────────────────
-- ključevi: password_hash, session_epoch, last_publish_at, content_updated_at
CREATE TABLE IF NOT EXISTS admin_meta (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Ograničavanje učestalosti (prijava, javna forma…) ─────────────────────
CREATE TABLE IF NOT EXISTS rate_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket      text NOT NULL,              -- npr. 'login-fail'
  key_hash    text NOT NULL,              -- HMAC(SESSION_SECRET, ip) — nikad sirova IP adresa
  ts          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_events_lookup ON rate_events (bucket, key_hash, ts DESC);

-- ── Usluge: fiksni skup slugova (stranice /usluge/[slug] su u kodu) ───────
-- Svaki stupac osim slug/sort je "override": NULL = koristi zadano iz src/data/site.ts.
CREATE TABLE IF NOT EXISTS services (
  slug             text PRIMARY KEY,
  sort             integer NOT NULL DEFAULT 0,
  title            text,
  chip             text,
  short            text,
  intro            text,
  includes         jsonb,          -- string[]
  cover            jsonb,          -- ImageRef
  gallery          jsonb,          -- ImageRef[]
  faq              jsonb,          -- {q,a}[]
  h1               text,
  lead             text,
  seo_title        text,
  seo_description  text,
  includes_title   text,
  gallery_title    text,
  gallery_lead     text,
  related_title    text,
  faq_title        text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Radovi ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  hero_title    text,
  kind          text NOT NULL CHECK (kind IN ('krov','falc','atika','ravni','dimnjak','snjegobrani')),
  service_slug  text NOT NULL,
  location      text NOT NULL DEFAULT '',
  material      text NOT NULL DEFAULT '',
  year          integer,
  alt           text NOT NULL DEFAULT '',   -- opis naslovne fotografije
  note          text NOT NULL DEFAULT '',
  scope         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  featured      boolean NOT NULL DEFAULT false,
  published     boolean NOT NULL DEFAULT true,
  sort          integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_sort ON projects (sort, id);

-- Fotografije rada: ILI asset_key (fotografija u repozitoriju, src/assets/…) ILI url (Vercel Blob).
-- Prva po sort-u je naslovna.
CREATE TABLE IF NOT EXISTS project_images (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id  integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_key   text,
  url         text,
  pathname    text,
  width       integer,
  height      integer,
  alt         text NOT NULL DEFAULT '',
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_images_one_source CHECK ((asset_key IS NOT NULL) <> (url IS NOT NULL)),
  CONSTRAINT project_images_blob_size CHECK (url IS NULL OR (width > 0 AND height > 0))
);
CREATE INDEX IF NOT EXISTS project_images_project ON project_images (project_id, sort, id);

-- ── Recenzije (samo stvarne!) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL,
  place        text NOT NULL DEFAULT '',
  text         text NOT NULL,
  stars        integer NOT NULL DEFAULT 5 CHECK (stars BETWEEN 1 AND 5),
  source       text NOT NULL DEFAULT '',     -- npr. 'Google', 'WhatsApp'
  review_date  date,
  published    boolean NOT NULL DEFAULT true,
  sort         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Česta pitanja ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faq (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  q           text NOT NULL,
  a           text NOT NULL,
  on_home     boolean NOT NULL DEFAULT false,
  published   boolean NOT NULL DEFAULT true,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Upiti s web stranice ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status        text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','u_obradi','ponuda_poslana','zatvoreno')),
  job_type      text NOT NULL DEFAULT '',     -- id iz jobTypes (site.ts) ili slug usluge
  variant       text NOT NULL DEFAULT 'standard',  -- 'standard' | 'zgrada'
  location      text NOT NULL DEFAULT '',
  size          text NOT NULL DEFAULT '',     -- jedna od roofSizes
  note          text NOT NULL DEFAULT '',
  photos        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- BlobImage[]
  name          text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  call_time     text NOT NULL DEFAULT '',
  source_page   text NOT NULL DEFAULT '',
  admin_note    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_status_created ON leads (status, created_at DESC);

-- ── Ponude ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_counters (
  year      integer PRIMARY KEY,
  last_seq  integer NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number          text NOT NULL UNIQUE,          -- 'KR-2026-001'
  year            integer NOT NULL,
  seq             integer NOT NULL,
  status          text NOT NULL DEFAULT 'nacrt' CHECK (status IN ('nacrt','poslana','prihvacena','odbijena')),
  issue_date      date NOT NULL DEFAULT CURRENT_DATE,
  client_name     text NOT NULL DEFAULT '',
  client_phone    text NOT NULL DEFAULT '',
  client_email    text NOT NULL DEFAULT '',
  client_address  text NOT NULL DEFAULT '',
  client_oib      text NOT NULL DEFAULT '',
  location        text NOT NULL DEFAULT '',      -- adresa gradilišta
  title           text NOT NULL DEFAULT '',
  intro           text NOT NULL DEFAULT '',
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- QuoteItem[]
  notes           text NOT NULL DEFAULT '',
  payment_terms   text NOT NULL DEFAULT '',
  valid_days      integer NOT NULL DEFAULT 30,
  pdv_enabled     boolean NOT NULL DEFAULT true,
  pdv_rate        numeric(5,2) NOT NULL DEFAULT 25,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,   -- cache, računa server (src/lib/quote-math.ts)
  pdv_amount      numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  public_token    text NOT NULL UNIQUE,
  lead_id         integer REFERENCES leads(id) ON DELETE SET NULL,
  sent_at         timestamptz,
  viewed_at       timestamptz,
  accepted_at     timestamptz,
  rejected_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_year_seq UNIQUE (year, seq)
);
CREATE INDEX IF NOT EXISTS quotes_created ON quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_lead ON quotes (lead_id);

CREATE TABLE IF NOT EXISTS quote_item_templates (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  unit         text NOT NULL DEFAULT 'm²',
  unit_price   numeric(12,2) NOT NULL DEFAULT 0,
  category     text NOT NULL DEFAULT '',
  sort         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
