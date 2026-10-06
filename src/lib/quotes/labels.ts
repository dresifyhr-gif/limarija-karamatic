/** Oznake vrste posla iz upita (id iz jobTypes, slug usluge ili 'ravni-krov'). Radi i u pregledniku. */
import { jobTypes, services } from '@/data/site';

const JOBS: Record<string, string> = {
  ...Object.fromEntries(services.map((s) => [s.slug, s.title])),
  ravni: 'Ravni krov',
  'ravni-krov': 'Ravni krov',
  ...Object.fromEntries(jobTypes.map((j) => [j.id, j.label])),
};

// Object.hasOwn: 'constructor', 'toString'… iz prototipa nisu vrste posla
export const jobLabel = (id: string | null | undefined) => (id ? (Object.hasOwn(JOBS, id) ? JOBS[id] : id) : '');
/** Je li id poznata vrsta posla (za provjeru javne forme). */
export const isKnownJob = (id: string) => Object.hasOwn(JOBS, id);
/** Hitan upit ("curi sada") — ide na vrh popisa. */
export const isUrgentJob = (id: string) => id === 'hitno';
/** Prijedlog naslova ponude iz vrste posla. */
export function quoteTitleFromJob(id: string): string {
  if (!id || id === 'hitno') return 'Sanacija prokišnjavanja';
  const s = services.find((x) => x.slug === id || jobTypes.find((j) => j.id === id)?.service === x.slug);
  return s?.title ?? jobLabel(id);
}
