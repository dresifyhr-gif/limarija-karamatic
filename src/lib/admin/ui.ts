/**
 * Klijentski pomoćnici admina (samo u pregledniku — uvoziti iz <script> u .astro).
 *
 *   import { api, toast, confirmDialog, formData, showErrors, withBusy } from '@/lib/admin/ui';
 *   const faq = await api<AdminFaq>('/api/admin/faq', { method: 'POST', body: { q, a, onHome: true, published: true } });
 *   toast('Spremljeno.');                                   // ili toast('Greška…', 'error')
 *   if (await confirmDialog({ title: 'Obrisati rad?', confirmLabel: 'Obriši', danger: true })) …
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * fetch prema /api/admin/** s JSON-om. 401 → preusmjeri na prijavu. Greške → ApiError(status, poruka, polja).
 * body: objekt (šalje se kao JSON) ili FormData (multipart).
 */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const { method = opts.body === undefined ? 'GET' : 'POST', body, signal } = opts;
  const headers: Record<string, string> = { accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload, signal, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Nema veze s poslužiteljem. Provjerite internet i pokušajte ponovno.');
  }
  if (res.status === 401) {
    location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new ApiError(401, 'Prijava je istekla.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Greška (${res.status}).`, data?.fields);
  return data as T;
}

/* ── toast ───────────────────────────────────────────────────────────────── */

export type ToastKind = 'success' | 'error' | 'info';

/** Kratka poruka dolje (mobitel) / dolje desno (desktop). Treba <Toast /> u layoutu (Admin.astro ga ima). */
export function toast(message: string, kind: ToastKind = 'success', ms = kind === 'error' ? 6000 : 3200): void {
  const host = document.getElementById('kr-toasts');
  if (!host) return void alert(message);
  const el = document.createElement('div');
  el.className = `kr-toast kr-toast--${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const close = () => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 200);
  };
  el.addEventListener('click', close);
  setTimeout(close, ms);
}

/** Poruka greške iz bilo čega (ApiError, Error, string). */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : 'Nešto nije u redu. Pokušajte ponovno.';
}

/* ── potvrda ─────────────────────────────────────────────────────────────── */

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** crveni tekst gumba (brisanje) */
  danger?: boolean;
};

/** Modalna potvrda (<ConfirmDialog /> u layoutu). Vraća true ako je korisnik potvrdio. */
export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  const dlg = document.getElementById('kr-confirm') as HTMLDialogElement | null;
  if (!dlg || typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(o.title));
  dlg.querySelector('[data-title]')!.textContent = o.title;
  const msg = dlg.querySelector<HTMLElement>('[data-message]')!;
  msg.textContent = o.message ?? '';
  msg.hidden = !o.message;
  const ok = dlg.querySelector<HTMLButtonElement>('[data-ok]')!;
  ok.textContent = o.confirmLabel ?? 'Potvrdi';
  ok.dataset.danger = o.danger ? '1' : '';
  dlg.querySelector('[data-cancel]')!.textContent = o.cancelLabel ?? 'Odustani';
  return new Promise((resolve) => {
    const done = () => {
      dlg.removeEventListener('close', done);
      resolve(dlg.returnValue === 'ok');
    };
    dlg.returnValue = '';
    dlg.addEventListener('close', done);
    dlg.showModal();
    ok.focus();
  });
}

/* ── forme ───────────────────────────────────────────────────────────────── */

/**
 * Forma → objekt. Checkbox/Toggle → boolean, input[type=number] i [data-number] → broj (decimalni zarez dopušten),
 * [data-json] → JSON.parse (npr. ImageUploader), polja s istim imenom + [data-list] → string[] (prazni se izbacuju).
 */
export function formData(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const el of Array.from(form.elements) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[]) {
    if (!el.name || el.disabled || el instanceof HTMLButtonElement || (el as HTMLInputElement).type === 'file') continue;
    const name = el.name;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') out[name] = el.checked;
    else if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (el.checked) out[name] = el.value;
    } else if (el.dataset.json !== undefined) out[name] = el.value ? JSON.parse(el.value) : null;
    else if (el.dataset.list !== undefined) {
      const arr = (out[name] as string[]) ?? [];
      if (el.value.trim()) arr.push(el.value.trim());
      out[name] = arr;
    } else if ((el as HTMLInputElement).type === 'number' || el.dataset.number !== undefined) {
      const raw = el.value.trim().replace(/\s/g, '').replace(',', '.');
      out[name] = raw === '' ? null : Number(raw);
    } else out[name] = el.value;
  }
  return out;
}

/** Prikaži poruke grešaka po poljima (ključevi iz API-ja: 'title', 'items.2.qty'…). Vraća broj prikazanih. */
export function showErrors(form: HTMLElement, fields: Record<string, string> | undefined): number {
  form.querySelectorAll('[data-field-error]').forEach((e) => {
    (e as HTMLElement).hidden = true;
    e.textContent = '';
  });
  form.querySelectorAll('[aria-invalid="true"]').forEach((e) => e.removeAttribute('aria-invalid'));
  if (!fields) return 0;
  let n = 0;
  let first: HTMLElement | null = null;
  for (const [name, msg] of Object.entries(fields)) {
    const input = form.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
    const err = form.querySelector<HTMLElement>(`[data-field-error="${CSS.escape(name)}"]`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      first ??= input;
    }
    if (err) {
      err.textContent = msg;
      err.hidden = false;
      n++;
    }
  }
  first?.focus();
  return n;
}

/** Gumb u stanju "radim…" dok traje obećanje (onemogućen, aria-busy). */
export async function withBusy<T>(button: HTMLButtonElement | null, work: () => Promise<T>): Promise<T> {
  if (!button) return work();
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/** Standardno spremanje forme: validacija → api → toast. Vraća odgovor ili null kad nije uspjelo. */
export async function submitForm<T>(form: HTMLFormElement, path: string, opts: { method?: string; body?: unknown; success?: string } = {}): Promise<T | null> {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (form.querySelector('[data-iu][data-busy="true"]')) {
    toast('Pričekajte da se fotografije pošalju.', 'info');
    return null;
  }
  try {
    const res = await withBusy(button, () => api<T>(path, { method: opts.method ?? 'PUT', body: opts.body ?? formData(form) }));
    showErrors(form, undefined);
    form.dispatchEvent(new CustomEvent('kr:saved', { detail: res }));
    toast(opts.success ?? 'Spremljeno.');
    return res;
  } catch (e) {
    if (e instanceof ApiError && e.fields) showErrors(form, e.fields);
    toast(errorMessage(e), 'error');
    return null;
  }
}
