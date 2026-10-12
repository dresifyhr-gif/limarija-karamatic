-- 003: neutralan naziv procjene (zahtjev vlasnika: nigdje "besplatna procjena", ni da se plaća).
-- Mijenja SAMO retke koji još imaju točno početni (seed) tekst iz site.ts — izmjene vlasnika se ne diraju.
-- Idempotentno: drugo pokretanje ne nalazi stare tekstove i ne radi ništa.
-- Ako se išta promijenilo, označi javni sadržaj promijenjenim (gumb "Objavi na stranicu" postaje crven).

DO $$
DECLARE
  n int := 0;
  k int;
BEGIN
  -- Česta pitanja: cijena po m²
  UPDATE faq
     SET a = 'Cijena ovisi o vrsti lima, složenosti krova (uvale, dimnjaci, prozori) i stanju konstrukcije. Nakon mjerenja dobivate pisanu ponudu stavku po stavku, bez skrivenih troškova. Ponudu šaljemo nekoliko dana nakon mjerenja.',
         updated_at = now()
   WHERE a = 'Cijena ovisi o vrsti lima, složenosti krova (uvale, dimnjaci, prozori) i stanju konstrukcije. Nakon besplatnog mjerenja dobivate pisanu ponudu stavku po stavku, bez skrivenih troškova. Ponudu šaljemo nekoliko dana nakon mjerenja.';
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Česta pitanja: pitanje o procjeni (pitanje i odgovor zasebno, svako samo ako je još početno)
  UPDATE faq
     SET a = 'Dođemo na teren, izmjerimo i fotografiramo krov te vam pošaljemo pisanu ponudu stavku po stavku. Za brzu orijentaciju pošaljite slike krova na WhatsApp.',
         updated_at = now()
   WHERE a = 'Da. Dolazimo, mjerimo, fotografiramo i dajemo ponudu bez ikakve obveze. Za brzu orijentaciju pošaljite slike krova na WhatsApp.';
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  UPDATE faq
     SET q = 'Kako izgleda procjena?', updated_at = now()
   WHERE q = 'Je li procjena stvarno besplatna?';
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Usluge: opis za Google (seo_description)
  UPDATE services
     SET seo_description = 'Novi limeni krovovi i zamjena crijepa limom u Zagrebu i šire. Crijep-lim i trapez, antracit RAL 7016. Procjena na terenu.',
         updated_at = now()
   WHERE seo_description = 'Novi limeni krovovi i zamjena crijepa limom u Zagrebu i šire. Crijep-lim i trapez, antracit RAL 7016. Besplatna procjena.';
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  UPDATE services
     SET seo_description = 'Opšav atike i limarija ravnih krovova, Zagreb i šire. Kape atika po mjeri, kutovi na geru, trapezni lim. Procjena na terenu.',
         updated_at = now()
   WHERE seo_description = 'Opšav atike i limarija ravnih krovova, Zagreb i šire. Kape atika po mjeri, kutovi na geru, trapezni lim. Besplatna procjena.';
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Postavke ponude: seed ih je ostavio praznima; mijenja se samo točan početni izraz ako ga je netko upisao
  UPDATE settings
     SET value = jsonb_set(value, '{paymentTerms}', to_jsonb(replace(value->>'paymentTerms', 'Besplatna procjena', 'Procjena'))),
         updated_at = now()
   WHERE key = 'quote' AND value->>'paymentTerms' LIKE '%Besplatna procjena%';
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  UPDATE settings
     SET value = jsonb_set(value, '{footer}', to_jsonb(replace(value->>'footer', 'Besplatna procjena', 'Procjena'))),
         updated_at = now()
   WHERE key = 'quote' AND value->>'footer' LIKE '%Besplatna procjena%';
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  IF n > 0 THEN
    INSERT INTO admin_meta (key, value, updated_at)
    VALUES ('content_updated_at', to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;
  RAISE NOTICE '003: promijenjeno redaka: %', n;
END
$$;
