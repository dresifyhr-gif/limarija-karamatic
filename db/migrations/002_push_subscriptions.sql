-- Web Push: pretplate uređaja vlasnika (PWA admina) na obavijesti.
-- endpoint je adresa push servisa (FCM, Apple, Mozilla…) za jedan preglednik na jednom uređaju.
-- prefs: koje obavijesti uređaj prima (lead = novi upit, accepted = klijent prihvatio ponudu, opened = klijent otvorio ponudu).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint         text NOT NULL UNIQUE,
  p256dh           text NOT NULL,
  auth             text NOT NULL,
  label            text NOT NULL DEFAULT '',
  user_agent       text NOT NULL DEFAULT '',
  prefs            jsonb NOT NULL DEFAULT '{"lead": true, "accepted": true, "opened": true}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  last_success_at  timestamptz,
  failure_count    integer NOT NULL DEFAULT 0,
  CONSTRAINT push_subscriptions_endpoint_https CHECK (endpoint LIKE 'https://%'),
  CONSTRAINT push_subscriptions_prefs_object CHECK (jsonb_typeof(prefs) = 'object')
);
