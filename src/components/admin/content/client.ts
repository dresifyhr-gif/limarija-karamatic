/**
 * Klijentski pomoćnici za uređivanje sadržaja (radovi, usluge, recenzije, pitanja, postavke).
 * Samo za preglednik — uvoziti iz <script> u .astro.
 *
 *   import { initGuards, save, makeSortable, initOptimisticToggles, slugify } from '@/components/admin/content/client';
 *
 * - initGuards(): forme s [data-guard] prate nespremljene promjene (traka za spremanje, upozorenje pri izlasku).
 * - save(form, work, opts): standardno spremanje (gumb "radim…", greške po poljima, toast, kr:saved, kr:content-changed).
 * - makeSortable(list, opts): povuci-i-ispusti za popise (miš, dodir, tipkovnica na ručki).
 * - initOptimisticToggles(): prekidači u popisima koji se spremaju odmah (s povratom pri grešci).
 */
import { api, ApiError, confirmDialog, errorMessage, formData, showErrors, toast } from '@/lib/admin/ui';

/* ── nespremljene promjene ──────────────────────────────────────────────── */

let leaving = false;
/** Dopusti izlazak sa stranice bez upozorenja (npr. nakon brisanja ili spremanja s preusmjeravanjem). */
export function allowLeave(): void {
  leaving = true;
}

/** Stanje forme za usporedbu (vrijednosti polja; ignorira data-guard-ignore). */
export function snapshot(form: HTMLFormElement): string {
  const data = formData(form);
  form.querySelectorAll<HTMLElement>('[data-guard-ignore][name]').forEach((el) => delete data[(el as HTMLInputElement).name]);
  return JSON.stringify(data);
}

const busyUploads = (form: HTMLElement) => !!form.querySelector('[data-iu][data-busy="true"]');

function renderBar(form: HTMLFormElement) {
  const bar = form.querySelector<HTMLElement>('[data-savebar]');
  if (!bar) return;
  const dirty = form.dataset.dirty === '1';
  const uploading = busyUploads(form);
  const state = bar.querySelector<HTMLElement>('[data-savebar-state]');
  bar.dataset.state = uploading ? 'busy' : dirty ? 'dirty' : 'clean';
  if (state) state.textContent = uploading ? 'Šaljem fotografije…' : dirty ? 'Nespremljene promjene' : (bar.dataset.cleanText ?? 'Sve je spremljeno');
  const btn = bar.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (btn && bar.dataset.always !== '1' && btn.getAttribute('aria-busy') !== 'true') btn.disabled = !dirty || uploading;
}

/** Uključi praćenje promjena na svim formama [data-guard] na stranici (jednom). */
export function initGuards(): void {
  const forms = [...document.querySelectorAll<HTMLFormElement>('form[data-guard]')];
  for (const form of forms) {
    if (form.dataset.guardReady) continue;
    form.dataset.guardReady = '1';
    let base = snapshot(form);
    const check = () => {
      form.dataset.dirty = snapshot(form) !== base ? '1' : '0';
      renderBar(form);
    };
    form.addEventListener('input', check);
    form.addEventListener('change', check);
    form.addEventListener('images-change', check);
    form.addEventListener('kr:saved', () => {
      base = snapshot(form);
      check();
    });
    form.addEventListener('kr:guard-reset', () => {
      base = snapshot(form);
      check();
    });
    check();
  }
  if ((window as unknown as { __krGuard?: boolean }).__krGuard) return;
  (window as unknown as { __krGuard?: boolean }).__krGuard = true;

  const anyDirty = () => [...document.querySelectorAll<HTMLFormElement>('form[data-guard]')].some((f) => f.dataset.dirty === '1');

  window.addEventListener('beforeunload', (e) => {
    if (leaving || !anyDirty()) return;
    e.preventDefault();
    e.returnValue = '';
  });

  document.addEventListener(
    'click',
    async (e) => {
      if (leaving || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('href')!.startsWith('#')) return;
      if (!anyDirty()) return;
      e.preventDefault();
      const ok = await confirmDialog({
        title: 'Odbaciti nespremljene promjene?',
        message: 'Promjene koje niste spremili bit će izgubljene.',
        confirmLabel: 'Odbaci promjene',
        cancelLabel: 'Nastavi uređivati',
        danger: true,
      });
      if (ok) {
        allowLeave();
        location.href = a.href;
      }
    },
    true,
  );
}

/* ── spremanje ──────────────────────────────────────────────────────────── */

export type SaveOpts = {
  /** poruka nakon uspjeha (null = bez poruke) */
  success?: string | null;
  /** javni sadržaj → gumb "Objavi" postaje crven (zadano true) */
  publicContent?: boolean;
  /** gumb koji pokazuje "radim…" (zadano submit u formi) */
  button?: HTMLButtonElement | null;
};

/** Spremanje forme: provjera fotografija → work() → kr:saved / greške po poljima. Vraća rezultat ili null. */
export async function save<T>(form: HTMLFormElement, work: () => Promise<T>, opts: SaveOpts = {}): Promise<T | null> {
  if (busyUploads(form)) {
    toast('Pričekajte da se fotografije pošalju.', 'info');
    return null;
  }
  const button = opts.button ?? form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    const res = await work();
    showErrors(form, undefined);
    form.dispatchEvent(new CustomEvent('kr:saved', { detail: res }));
    if (opts.publicContent !== false) document.dispatchEvent(new CustomEvent('kr:content-changed'));
    if (opts.success !== null) toast(opts.success ?? 'Spremljeno.');
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.fields) {
      const shown = showErrors(form, e.fields);
      toast(shown ? 'Provjerite označena polja.' : errorMessage(e), 'error');
    } else toast(errorMessage(e), 'error');
    return null;
  } finally {
    if (button) {
      button.removeAttribute('aria-busy');
      button.disabled = false;
    }
    renderBar(form);
  }
}

/* ── povuci-i-ispusti ───────────────────────────────────────────────────── */

export type SortableOpts = {
  /** selektor stavke (izravno dijete popisa); zadano '[data-sort-item]' */
  item?: string;
  /** selektor ručke unutar stavke; zadano '[data-sort-handle]' */
  handle?: string;
  /** poziva se kad se redoslijed promijeni (stavke redom) */
  onChange?: (items: HTMLElement[]) => void;
};

/**
 * Povuci-i-ispusti za okomite popise. Radi mišem i prstom (Pointer Events, ručka ima touch-action:none)
 * i tipkovnicom (fokus na ručki → strelice gore/dolje).
 */
export function makeSortable(list: HTMLElement, opts: SortableOpts = {}): void {
  const itemSel = opts.item ?? '[data-sort-item]';
  const handleSel = opts.handle ?? '[data-sort-handle]';
  if (list.dataset.sortReady) return;
  list.dataset.sortReady = '1';
  if (getComputedStyle(list).position === 'static') list.style.position = 'relative';
  const items = () => [...list.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.matches(itemSel));
  const order = () => items().map((i) => i.dataset.id ?? '').join(',');
  const changed = (before: string) => {
    if (order() !== before) opts.onChange?.(items());
  };

  list.addEventListener('pointerdown', (e) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>(handleSel);
    if (!handle || !list.contains(handle) || e.button !== 0) return;
    const item = handle.closest<HTMLElement>(itemSel);
    if (!item || item.parentElement !== list) return;
    e.preventDefault();
    const before = order();
    const grab = e.clientY - item.getBoundingClientRect().top;
    let y = e.clientY;
    let raf = 0;
    handle.setPointerCapture(e.pointerId);
    item.classList.add('is-dragging');
    list.classList.add('is-sorting');

    const place = () => {
      const prev = item.previousElementSibling as HTMLElement | null;
      const next = item.nextElementSibling as HTMLElement | null;
      if (next && next.matches(itemSel)) {
        const r = next.getBoundingClientRect();
        if (y > r.top + r.height / 2) list.insertBefore(next, item);
      }
      if (prev && prev.matches(itemSel)) {
        const r = prev.getBoundingClientRect();
        if (y < r.top + r.height / 2) list.insertBefore(prev, item.nextSibling); // seli susjeda, ne stavku (zadržava pointer capture)
      }
      const natural = list.getBoundingClientRect().top + item.offsetTop;
      item.style.transform = `translateY(${y - grab - natural}px)`;
    };
    const tick = () => {
      const edge = 72;
      const top = 120; // ispod ljepljivog zaglavlja
      if (y > innerHeight - edge) scrollBy(0, Math.min(14, (y - (innerHeight - edge)) / 3));
      else if (y < top + edge) scrollBy(0, -Math.min(14, (top + edge - y) / 3));
      place();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const move = (ev: PointerEvent) => {
      y = ev.clientY;
    };
    const end = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      item.style.transform = '';
      item.classList.remove('is-dragging');
      list.classList.remove('is-sorting');
      changed(before);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });

  list.addEventListener('keydown', (e) => {
    const handle = (e.target as HTMLElement).closest<HTMLElement>(handleSel);
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const item = handle.closest<HTMLElement>(itemSel);
    if (!item) return;
    e.preventDefault();
    const before = order();
    if (e.key === 'ArrowUp' && item.previousElementSibling?.matches(itemSel)) list.insertBefore(item.previousElementSibling, item.nextSibling);
    if (e.key === 'ArrowDown' && item.nextElementSibling?.matches(itemSel)) list.insertBefore(item.nextElementSibling, item);
    handle.focus();
    changed(before);
  });
}

/** Spremi novi redoslijed popisa na API ({ids} ili {slugs}). Vraća true ako je uspjelo. */
export async function saveOrder(path: string, body: Record<string, unknown>, message = 'Redoslijed je spremljen.'): Promise<boolean> {
  try {
    await api(path, { method: 'POST', body });
    document.dispatchEvent(new CustomEvent('kr:content-changed'));
    toast(message);
    return true;
  } catch (e) {
    toast(`${errorMessage(e)} Osvježite stranicu.`, 'error');
    return false;
  }
}

/* ── prekidači koji se spremaju odmah ───────────────────────────────────── */

/**
 * <input type="checkbox" data-quick-toggle data-url="/api/admin/faq/3" data-field="onHome"
 *        data-on="Pitanje je na naslovnici." data-off="Pitanje je maknuto s naslovnice.">
 * Promjena se odmah prikaže, šalje PUT {field: checked}; pri grešci se vraća i javlja.
 * before(input) može odbiti promjenu (vrati false).
 */
export function initOptimisticToggles(root: ParentNode = document, before?: (input: HTMLInputElement) => boolean | string): void {
  root.querySelectorAll<HTMLInputElement>('input[data-quick-toggle]').forEach((input) => {
    if (input.dataset.qtReady) return;
    input.dataset.qtReady = '1';
    input.addEventListener('change', async () => {
      const value = input.checked;
      const verdict = before?.(input);
      if (verdict === false || typeof verdict === 'string') {
        input.checked = !value;
        if (typeof verdict === 'string') toast(verdict, 'error');
        return;
      }
      input.dispatchEvent(new CustomEvent('kr:toggled', { bubbles: true, detail: { value } }));
      toast((value ? input.dataset.on : input.dataset.off) ?? 'Spremljeno.', 'success', 2200);
      try {
        await api(input.dataset.url!, { method: 'PUT', body: { [input.dataset.field!]: value } });
        document.dispatchEvent(new CustomEvent('kr:content-changed'));
      } catch (e) {
        input.checked = !value;
        input.dispatchEvent(new CustomEvent('kr:toggled', { bubbles: true, detail: { value: !value } }));
        toast(`Nije spremljeno: ${errorMessage(e)}`, 'error');
      }
    });
  });
}

/* ── ostalo ─────────────────────────────────────────────────────────────── */

const HR: Record<string, string> = { č: 'c', ć: 'c', đ: 'd', š: 's', ž: 'z', dž: 'dz' };
/** 'Ravni krov — Šestine 2025' → 'ravni-krov-sestine-2025' */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[čćđšž]/g, (c) => HR[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Upozori na brisanje i izvrši ga. Vraća true ako je obrisano. */
export async function confirmDelete(opts: { title: string; message?: string; path: string; button?: HTMLButtonElement | null }): Promise<boolean> {
  const ok = await confirmDialog({ title: opts.title, message: opts.message, confirmLabel: 'Obriši', danger: true });
  if (!ok) return false;
  const btn = opts.button;
  btn?.setAttribute('aria-busy', 'true');
  try {
    await api(opts.path, { method: 'DELETE' });
    document.dispatchEvent(new CustomEvent('kr:content-changed'));
    return true;
  } catch (e) {
    toast(errorMessage(e), 'error');
    return false;
  } finally {
    btn?.removeAttribute('aria-busy');
  }
}
