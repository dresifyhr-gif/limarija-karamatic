/** Oznake i tonovi statusa za admin UI (Badge tone). */
import { LEAD_STATUS_LABEL, QUOTE_STATUS_LABEL, type LeadStatus, type QuoteStatus } from '@/lib/types';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

export const LEAD_STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  novo: 'danger',
  u_obradi: 'warning',
  ponuda_poslana: 'info',
  zatvoreno: 'muted',
};
export const QUOTE_STATUS_TONE: Record<QuoteStatus, BadgeTone> = {
  nacrt: 'muted',
  poslana: 'info',
  prihvacena: 'success',
  odbijena: 'danger',
};
export { LEAD_STATUS_LABEL, QUOTE_STATUS_LABEL };

const dateFmt = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Zagreb' });
const dateTimeFmt = new Intl.DateTimeFormat('hr-HR', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Zagreb',
});
/** '6. 10. 2026.' */
export const formatDate = (d: string | Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : '');
/** '6. 10. 2026. 14:05' */
export const formatDateTime = (d: string | Date | null | undefined) => (d ? dateTimeFmt.format(new Date(d)) : '');
/** 'prije 5 min' / 'jučer' / datum */
export function timeAgo(d: string | Date | null | undefined, now = Date.now()): string {
  if (!d) return '';
  const s = Math.round((now - new Date(d).getTime()) / 1000);
  if (s < 60) return 'upravo';
  if (s < 3600) return `prije ${Math.floor(s / 60)} min`;
  if (s < 86400) return `prije ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'jučer';
  if (s < 7 * 86400) return `prije ${Math.floor(s / 86400)} dana`;
  return formatDate(d);
}
