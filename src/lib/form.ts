/**
 * "Upit za procjenu" (komponenta RadniNalog) — logika forme u 3 koraka.
 *
 * Bez JS-a forma je obična: sva tri koraka jedan ispod drugog, POST multipart na /api/upit
 * (TODO backend: Cloudflare Pages Function → e-mail + Telegram, odgovor 303 na /hvala?upit=…).
 * S JS-om (ovdje) postaje koračna: validacija po koraku, crtež kuće dobiva sloj po korak,
 * a na slanje se crta crvena linija strehe i spušta pečat "PRIMLJENO". Napredak pokazuje kotni lanac
 * koraka iznad forme; crtež kuće stoji uz naslov koraka.
 *
 * Sve je vezano uz korijen forme ([data-rn]) pa radi i s više instanci na stranici.
 */
import { gsap, motionOn } from '@/lib/motion';

const MAX_PHOTOS = 6;
const STEPS = 3;

type Err = { el: HTMLElement; focus: HTMLElement; msg: string };
type Controller = { go: (n: number, dir: 1 | -1) => void; current: () => number };
const controllers = new WeakMap<HTMLFormElement, Controller>();

/** Hrvatski broj, labavo: +385 / 00385 / 0 pa 8–9 znamenki (mobitel 09x…, fiksni 01…, 0xx…). */
export function isCroatianPhone(raw: string): boolean {
  const n = raw.replace(/[\s\-/().]/g, '');
  return /^(?:\+385|00385|0)[1-9]\d{7,8}$/.test(n);
}

/** usluga (slug) ili id vrste posla → id vrste posla */
function resolveJob(root: HTMLElement, value: string | null): string | null {
  if (!value) return null;
  const inputs = [...root.querySelectorAll<HTMLInputElement>('input[name="vrsta"]')];
  const byId = inputs.find((i) => i.value === value);
  if (byId) return byId.value;
  const bySlug = inputs.find((i) => i.dataset.service === value);
  return bySlug ? bySlug.value : null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function initForm(form: HTMLFormElement) {
  if (form.dataset.rnReady) return;
  form.dataset.rnReady = '1';

  const root = form.closest<HTMLElement>('.rn') ?? form;
  const steps = [...form.querySelectorAll<HTMLFieldSetElement>('.rn-step')];
  const btnBack = form.querySelector<HTMLButtonElement>('[data-rn-back]')!;
  const btnNext = form.querySelector<HTMLButtonElement>('[data-rn-next]')!;
  const btnSubmit = form.querySelector<HTMLButtonElement>('[data-rn-submit]')!;
  const status = root.querySelector<HTMLElement>('[data-rn-status]')!;
  const dims = [...root.querySelectorAll<HTMLElement>('[data-rn-dim]')];
  const drawing = root.querySelector<SVGSVGElement>('[data-rn-drawing]');

  let current = 1;
  let busy = false;
  const zgrada = root.dataset.variant === 'zgrada';

  /* ── stanje "koračna forma" ─────────────────────────────── */
  form.noValidate = true;
  root.classList.add('is-stepped');
  root.querySelectorAll<HTMLElement>('[data-rn-js]').forEach((el) => (el.hidden = false));

  /* ── predodabir iz URL-a (?usluga=slug ili ?vrsta=id) ───── */
  const params = new URLSearchParams(location.search);
  const fromUrl = resolveJob(root, params.get('usluga')) ?? resolveJob(root, params.get('vrsta'));
  if (fromUrl) {
    const inp = form.querySelector<HTMLInputElement>(`input[name="vrsta"][value="${fromUrl}"]`);
    if (inp) inp.checked = true;
  }

  /* ── fotografije: do 6, pregled + uklanjanje ────────────── */
  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"][name="fotografije"]');
  const thumbs = root.querySelector<HTMLElement>('[data-rn-thumbs]');
  const photoCount = root.querySelector<HTMLElement>('[data-rn-photocount]');
  const photoNote = root.querySelector<HTMLElement>('[data-rn-photonote]');
  let photos: { file: File; url: string }[] = [];

  const syncFiles = () => {
    if (!fileInput) return;
    try {
      const dt = new DataTransfer();
      photos.forEach((p) => dt.items.add(p.file));
      fileInput.files = dt.files;
    } catch {
      /* stariji preglednici: datoteke se šalju iz polja `photos` u fetch pozivu */
    }
  };
  const renderThumbs = () => {
    if (!thumbs) return;
    thumbs.replaceChildren(
      ...photos.map((p, i) => {
        const li = document.createElement('li');
        li.className = 'rn-thumb';
        const img = document.createElement('img');
        img.src = p.url;
        img.alt = `Fotografija ${i + 1}: ${p.file.name}`;
        img.width = 72;
        img.height = 72;
        img.decoding = 'async';
        const n = document.createElement('span');
        n.className = 'rn-thumb-n';
        n.textContent = String(i + 1).padStart(2, '0');
        n.setAttribute('aria-hidden', 'true');
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'rn-thumb-rm';
        rm.setAttribute('aria-label', `Ukloni fotografiju ${i + 1}`);
        rm.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        rm.addEventListener('click', () => {
          URL.revokeObjectURL(p.url);
          photos.splice(i, 1);
          syncFiles();
          renderThumbs();
          (thumbs.querySelector<HTMLButtonElement>('.rn-thumb-rm') ?? fileInput)?.focus();
        });
        li.append(img, n, rm);
        return li;
      }),
    );
    thumbs.hidden = photos.length === 0;
    if (photoCount) {
      photoCount.textContent = `${photos.length} / ${MAX_PHOTOS}`;
      photoCount.hidden = photos.length === 0;
    }
    root.classList.toggle('has-max-photos', photos.length >= MAX_PHOTOS);
    if (fileInput) fileInput.disabled = photos.length >= MAX_PHOTOS;
  };
  fileInput?.addEventListener('change', () => {
    const picked = [...(fileInput.files ?? [])].filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - photos.length;
    const added = picked.slice(0, Math.max(0, room));
    // dodaj nove na postojeće (polje se "prazni" pri svakom odabiru)
    photos = photos.concat(added.map((file) => ({ file, url: URL.createObjectURL(file) })));
    syncFiles();
    renderThumbs();
    if (photoNote) {
      photoNote.textContent =
        picked.length > added.length ? `Stane najviše ${MAX_PHOTOS} fotografija — dodali smo prvih ${added.length}.` : '';
    }
  });

  /* ── greške ─────────────────────────────────────────────── */
  const errEl = (name: string) => root.querySelector<HTMLElement>(`[data-rn-err="${name}"]`);
  const clearErr = (name: string) => {
    const e = errEl(name);
    if (e) {
      e.textContent = '';
      e.hidden = true;
    }
    form.querySelectorAll<HTMLElement>(`[name="${name}"]`).forEach((i) => i.removeAttribute('aria-invalid'));
    form.querySelector(`[data-rn-group="${name}"]`)?.classList.remove('is-invalid');
  };
  const showErr = (name: string, msg: string) => {
    const e = errEl(name);
    if (e) {
      e.textContent = msg;
      e.hidden = false;
    }
    form.querySelectorAll<HTMLElement>(`[name="${name}"]`).forEach((i) => i.setAttribute('aria-invalid', 'true'));
    form.querySelector(`[data-rn-group="${name}"]`)?.classList.add('is-invalid');
  };

  const validateStep = (n: number): Err[] => {
    const errs: Err[] = [];
    const radio = (name: string, msg: string) => {
      const inputs = [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
      if (!inputs.some((i) => i.checked)) {
        const group = form.querySelector<HTMLElement>(`[data-rn-group="${name}"]`) ?? inputs[0];
        errs.push({ el: group, focus: inputs[0], msg });
        showErr(name, msg);
      } else clearErr(name);
    };
    const text = (name: string, test: (v: string) => string | null) => {
      const inp = form.elements.namedItem(name) as HTMLInputElement | null;
      if (!inp) return;
      const msg = test(inp.value.trim());
      if (msg) {
        errs.push({ el: inp, focus: inp, msg });
        showErr(name, msg);
      } else clearErr(name);
    };

    if (n === 1) radio('vrsta', 'Odaberite što treba — jedna opcija je dovoljna.');
    if (n === 2) {
      text('mjesto', (v) => (v.length < 2 ? 'Upišite mjesto ili kvart, da znamo kamo dolazimo.' : null));
      text('adresa', (v) => (v.length < 4 ? 'Upišite adresu zgrade, da znamo kamo dolazimo.' : null));
      // veličina je obavezna samo kod kuća, i to ne kad curi sada
      const urgent = form.querySelector<HTMLInputElement>('input[name="vrsta"]:checked')?.value === 'hitno';
      if (zgrada || urgent) clearErr('velicina');
      else radio('velicina', 'Odaberite približnu veličinu. Ako niste sigurni, „ne znam“ je sasvim u redu.');
    }
    if (n === 3) {
      text('ime', (v) => (v.length < 2 ? 'Upišite ime, da znamo koga tražimo.' : null));
      text('mobitel', (v) =>
        !v ? 'Upišite broj na koji vas možemo nazvati.' : !isCroatianPhone(v) ? 'Provjerite broj — npr. 091 234 5678 ili 01 234 5678.' : null,
      );
      text('email', (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'Provjerite e-poštu — npr. ime@upravitelj.hr.' : null));
    }
    return errs;
  };

  // greška nestaje čim korisnik ispravi polje
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name && t.getAttribute('aria-invalid') === 'true') {
      const v = t.value.trim();
      const ok =
        t.name === 'mobitel'
          ? isCroatianPhone(v)
          : t.name === 'email'
            ? !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
            : v.length >= (t.name === 'adresa' ? 4 : 2);
      if (ok) clearErr(t.name);
    }
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.type === 'radio') clearErr(t.name);
    // hitno: veličina krova više nije obavezna
    if (t.name === 'vrsta' && t.value === 'hitno') clearErr('velicina');
  });

  /* ── crtež: sloj po korak ───────────────────────────────── */
  const layer = (n: number) => drawing?.querySelector<SVGGElement>(`[data-layer="${n}"]`) ?? null;
  const setStage = (n: number, animate: boolean) => {
    const prev = Number(root.dataset.stage || 0);
    root.dataset.stage = String(n);
    if (!animate || !drawing || n <= prev) return;
    if (n === 2) {
      const strips = layer(2)?.querySelectorAll('.rn-strip');
      const edge = layer(2)?.querySelector('.rn-barge');
      const tl = gsap.timeline();
      if (edge) tl.from(edge, { opacity: 0, duration: 0.2, ease: 'press' });
      if (strips?.length)
        tl.from(strips, { opacity: 0, y: -6, duration: 0.24, ease: 'press', stagger: 0.05 }, 0.05);
    }
    if (n === 3) {
      const l3 = layer(3);
      if (!l3) return;
      gsap
        .timeline()
        .from(l3.querySelector('.rn-gutter'), { opacity: 0, y: -5, duration: 0.24, ease: 'press' })
        .from(l3.querySelector('.rn-pipe'), { opacity: 0, y: -8, duration: 0.22, ease: 'press' }, 0.08)
        .from(l3.querySelector('.rn-cap'), { opacity: 0, y: -10, duration: 0.24, ease: 'press' }, 0.16);
    }
  };

  /* ── koraci ─────────────────────────────────────────────── */
  const render = (n: number) => {
    steps.forEach((s) => {
      const on = Number(s.dataset.step) === n;
      s.classList.toggle('is-active', on);
      s.toggleAttribute('hidden', !on);
      s.setAttribute('aria-hidden', String(!on));
    });
    dims.forEach((d) => {
      const k = Number(d.dataset.rnDim);
      d.classList.toggle('is-done', k < n);
      d.classList.toggle('is-active', k === n);
      if (k === n) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
    btnBack.hidden = n === 1;
    btnNext.hidden = n === STEPS;
    btnSubmit.hidden = n !== STEPS;
    root.dataset.step = String(n);
  };

  const go = (n: number, dir: 1 | -1) => {
    if (n < 1 || n > STEPS || n === current) return;
    const from = steps[current - 1];
    const to = steps[n - 1];
    const animate = motionOn();
    current = n;
    render(n);
    if (dir > 0) setStage(n, animate);
    const heading = to.querySelector<HTMLElement>('[data-rn-heading]');
    heading?.focus({ preventScroll: true });
    // drži vrh forme u vidu kad je korisnik skrolao do gumba (mobitel)
    const top = root.getBoundingClientRect().top;
    const head = heading?.getBoundingClientRect();
    if (head && (head.top < 80 || head.bottom > innerHeight)) {
      scrollTo({ top: scrollY + Math.min(top, head.top) - 96, behavior: animate ? 'smooth' : 'auto' });
    }
    status.textContent = `Korak ${n} od ${STEPS}: ${heading?.textContent?.trim() ?? ''}`;
    if (animate && from !== to) {
      gsap.fromTo(
        to,
        { opacity: 0, x: 18 * dir },
        { opacity: 1, x: 0, duration: 0.2, ease: 'press', clearProps: 'opacity,transform' },
      );
    }
  };

  btnNext.addEventListener('click', () => {
    const errs = validateStep(current);
    if (errs.length) {
      announceErrors(errs);
      return;
    }
    go(current + 1, 1);
  });
  btnBack.addEventListener('click', () => go(current - 1, -1));

  const announceErrors = (errs: Err[]) => {
    status.textContent =
      errs.length === 1 ? errs[0].msg : `Provjerite ${errs.length} polja: ${errs.map((e) => e.msg).join(' ')}`;
    errs[0].focus.focus();
    if (motionOn()) {
      gsap.fromTo(
        errs.map((e) => e.el),
        { x: -3 },
        { x: 0, duration: 0.18, ease: 'press', clearProps: 'transform' },
      );
    }
  };

  // Enter u tekstualnom polju ne šalje formu prije zadnjeg koraka — ide na "Dalje"
  form.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && current < STEPS && t instanceof HTMLInputElement && t.type !== 'checkbox') {
      e.preventDefault();
      btnNext.click();
    }
  });

  /* ── slanje ─────────────────────────────────────────────── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    for (let s = 1; s <= STEPS; s++) {
      const errs = validateStep(s);
      if (errs.length) {
        if (s !== current) go(s, s > current ? 1 : -1);
        announceErrors(errs);
        return;
      }
    }

    busy = true;
    const label = btnSubmit.querySelector('span');
    const original = label?.textContent ?? '';
    btnSubmit.disabled = true;
    btnSubmit.setAttribute('aria-busy', 'true');
    if (label) label.textContent = 'Šaljemo…';
    btnBack.disabled = true;
    status.textContent = 'Šaljemo upit…';

    const upit = String(Math.floor(1000 + Math.random() * 9000));
    const job = form.querySelector<HTMLInputElement>('input[name="vrsta"]:checked')?.value ?? '';
    const data = new FormData(form);
    data.set('upit', `KR-${upit}`);
    // fotografije uvijek iz našeg popisa (polje je onemogućeno kad ih je 6, pa ga FormData preskače)
    data.delete('fotografije');
    photos.forEach((p) => data.append('fotografije', p.file, p.file.name));

    try {
      // TODO(backend): ovdje ide pravi endpoint — Cloudflare Pages Function
      //   POST /api/upit  (multipart/form-data: polja + do 6 fotografija)
      //   → Turnstile provjera → fotografije u R2 → e-mail vlasniku (Resend) + Telegram poruka
      //   const res = await fetch('/api/upit', { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      //   if (!res.ok) throw new Error(String(res.status));
      //   const { upit } = await res.json();
      void data;
      await wait(900); // dok nema backenda: simulacija mreže
    } catch {
      busy = false;
      btnSubmit.disabled = false;
      btnSubmit.removeAttribute('aria-busy');
      btnBack.disabled = false;
      if (label) label.textContent = original;
      status.textContent = 'Slanje nije uspjelo. Pokušajte ponovno ili nas nazovite.';
      return;
    }

    if (label) label.textContent = 'Poslano';
    root.querySelectorAll<HTMLElement>('[data-rn-no]').forEach((el) => (el.textContent = upit));
    root.classList.add('is-sent');
    status.textContent = `Upit KR-${upit} je primljen. Javljamo se isti radni dan.`;

    const stamp = root.querySelector<HTMLElement>('.rn-stamp');
    const eave = drawing?.querySelector<SVGPathElement>('.rn-eave');
    if (motionOn()) {
      const tl = gsap.timeline();
      if (eave) tl.fromTo(eave, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, ease: 'draft' });
      if (stamp)
        tl.fromTo(
          stamp,
          { opacity: 0, scale: 1.35, rotation: 4 },
          { opacity: 1, scale: 1, rotation: 0, duration: 0.24, ease: 'press' },
          eave ? '-=0.05' : 0,
        );
      await tl.then();
    }
    await wait(1400);
    // samo broj upita, vrsta posla i broj slika — nikad osobni podaci u URL-u
    const q = new URLSearchParams({ upit, posao: job, slike: String(photos.length) });
    location.assign(`/hvala?${q}`);
  });

  controllers.set(form, { go, current: () => current });

  /* ── početno stanje ─────────────────────────────────────── */
  render(1);
  setStage(1, false);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-live')));

  // obris kuće se nacrta jednom kad forma uđe u vidno polje
  if (motionOn() && drawing && 'IntersectionObserver' in window) {
    const outline = layer(1)?.querySelectorAll<SVGGeometryElement>('.rn-ln');
    if (outline?.length) {
      gsap.set(outline, { drawSVG: '0%' });
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((en) => en.isIntersecting)) return;
          io.disconnect();
          gsap.to(outline, { drawSVG: '100%', duration: 0.8, ease: 'draft', stagger: 0.04 });
        },
        { threshold: 0.4 },
      );
      io.observe(drawing);
    }
  }
}

export function initRadniNalog() {
  document.querySelectorAll<HTMLFormElement>('form[data-rn]').forEach(initForm);
}

/**
 * Predodabir vrste posla bez ponovnog učitavanja stranice (npr. klik na "Procjena →" na kartici usluge
 * kad je forma već na stranici). Prima slug usluge ili id iz jobTypes.
 * Vraća false ako na stranici nema forme ili posao ne postoji — tada neka link radi normalno.
 *
 *   link.addEventListener('click', (e) => { if (preselectJob(slug)) e.preventDefault(); });
 */
export function preselectJob(value: string, opts: { scroll?: boolean; focus?: boolean } = {}): boolean {
  const { scroll = true, focus = true } = opts;
  const form =
    document.querySelector<HTMLFormElement>('#procjena form[data-rn]') ?? document.querySelector<HTMLFormElement>('form[data-rn]');
  if (!form) return false;
  const root = form.closest<HTMLElement>('.rn') ?? form;
  const job = resolveJob(root, value);
  if (!job) return false;
  const input = form.querySelector<HTMLInputElement>(`input[name="vrsta"][value="${job}"]`);
  if (!input) return false;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const ctl = controllers.get(form);
  if (ctl && ctl.current() !== 1) ctl.go(1, -1);
  const section = document.getElementById('procjena') ?? root;
  if (scroll) section.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto', block: 'start' });
  if (focus) form.querySelector<HTMLElement>('.rn-step[data-step="1"] [data-rn-heading]')?.focus({ preventScroll: true });
  return true;
}
