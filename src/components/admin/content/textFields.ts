/**
 * Klijentski dio za TextField.astro (samo preglednik).
 *   import { initTextFields, refreshTextField, clearSection } from '@/components/admin/content/textFields';
 *   initTextFields(form);
 *
 * - brojač znakova i stanje polja (izvorno / izmijenjeno) prate svaki unos
 * - "Vrati izvorno" isprazni polje; "Uredi izvorni tekst" upiše izvorni tekst u polje za doradu
 * - promjene šalju 'input' (bubbles), pa ih forma s [data-guard] vidi kao nespremljene
 */

type TfInput = HTMLInputElement | HTMLTextAreaElement;

/** Visina textarea prema sadržaju (ili izvornom tekstu u placeholderu, ako je polje prazno). */
function fitHeight(el: TfInput): void {
  if (!(el instanceof HTMLTextAreaElement)) return;
  const empty = el.value === '';
  if (empty) el.value = el.placeholder; // izmjeri i izvorni tekst, da se vidi cijeli
  el.style.height = 'auto';
  const b = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + b}px`;
  if (empty) el.value = '';
}

/** Osvježi brojač i stanje jednog polja (nakon programske promjene vrijednosti). */
export function refreshTextField(input: TfInput): void {
  const root = input.closest<HTMLElement>('[data-tf]');
  if (!root) return;
  const max = Number(input.dataset.max) || input.maxLength || 0;
  const len = [...input.value].length;
  const custom = input.value.trim() !== '';
  root.dataset.state = custom ? 'custom' : 'default';
  root.dataset.near = custom && max && len >= max * 0.9 ? '1' : '0';
  const count = root.querySelector<HTMLElement>('[data-tf-count]');
  if (count) count.textContent = custom ? `${len}/${max}` : 'izvorno';
  fitHeight(input);
}

function setValue(input: TfInput, value: string, focus = false): void {
  input.value = value;
  refreshTextField(input);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (focus) {
    input.focus();
    const end = input.value.length;
    try {
      input.setSelectionRange(end, end);
    } catch {}
  }
}

/** Isprazni sva polja unutar elementa (cijela sekcija → izvorni tekstovi). Vraća broj ispražnjenih. */
export function clearSection(scope: ParentNode): number {
  let n = 0;
  scope.querySelectorAll<TfInput>('[data-tf-input]').forEach((input) => {
    if (input.value === '') return;
    setValue(input, '');
    n++;
  });
  return n;
}

export function initTextFields(root: ParentNode = document): void {
  root.querySelectorAll<TfInput>('[data-tf-input]').forEach((input) => {
    if (input.dataset.tfReady) return;
    input.dataset.tfReady = '1';
    refreshTextField(input);
    input.addEventListener('input', () => refreshTextField(input));
    if (input instanceof HTMLTextAreaElement) {
      let w = input.clientWidth;
      new ResizeObserver(() => {
        if (input.clientWidth !== w) (w = input.clientWidth), fitHeight(input);
      }).observe(input);
    }
    const field = input.closest<HTMLElement>('[data-tf]');
    field?.querySelector('[data-tf-reset]')?.addEventListener('click', () => setValue(input, '', true));
    field?.querySelector('[data-tf-edit]')?.addEventListener('click', () => setValue(input, input.dataset.default ?? '', true));
  });
}
