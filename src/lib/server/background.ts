/**
 * Posao "u pozadini" nakon odgovora posjetitelju (npr. slanje push obavijesti).
 *
 *   background(sendPush(...));   // odgovor ne čeka; greška se samo zapiše u log
 *
 * Na Vercelu koristi waitUntil (@vercel/functions): funkcija živi dok se obećanje ne završi, a odgovor je već poslan.
 * Lokalno (astro dev / preview) waitUntil ne postoji pa obećanje jednostavno teče dalje u istom procesu.
 */
import { waitUntil } from '@vercel/functions';

export function background(task: Promise<unknown>, label = 'pozadina'): void {
  const safe = task.catch((e) => {
    console.error(`[${label}]`, (e as Error)?.message ?? e);
  });
  try {
    waitUntil(safe);
  } catch {
    /* izvan Vercela nema konteksta — obećanje i dalje teče */
  }
}
