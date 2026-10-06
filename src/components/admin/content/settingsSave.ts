/**
 * Spremanje jedne postavke (PUT /api/admin/settings/:key {value}) iz forme s [data-guard].
 *   bindSettingsForm(form, 'contact', (d) => ({ ...d }), { publicContent: true });
 */
import { api, formData } from '@/lib/admin/ui';
import { save } from './client';

export function bindSettingsForm(
  form: HTMLFormElement,
  key: 'contact' | 'company' | 'quote' | 'stats',
  build: (d: Record<string, any>) => unknown,
  opts: { publicContent: boolean; success?: string },
): void {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = build(formData(form) as Record<string, any>);
    if (value === undefined) return;
    await save(form, () => api(`/api/admin/settings/${key}`, { method: 'PUT', body: { value } }), {
      publicContent: opts.publicContent,
      success: opts.success,
    });
  });
}
