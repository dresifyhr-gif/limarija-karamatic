/**
 * "Objavi na stranicu": pokreće Vercel Deploy Hook (novi build povuče sadržaj iz baze).
 * Lokalno (nema DEPLOY_HOOK_URL) ne radi ništa i to jasno kaže.
 */
import { env } from './env';
import { getPublishState, setMeta, type PublishState } from './meta';
import { HttpError } from './http';

export type PublishResult = { mode: 'deploy' | 'noop'; message: string; state: PublishState };

export async function publishSite(): Promise<PublishResult> {
  const hook = env('DEPLOY_HOOK_URL');
  if (!hook) {
    return {
      mode: 'noop',
      message: 'Lokalni način rada: objava nije pokrenuta (DEPLOY_HOOK_URL postoji samo na produkciji).',
      state: await getPublishState(),
    };
  }
  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) {
    console.error('[publish] deploy hook odgovorio', res.status);
    throw new HttpError(502, 'Objava nije pokrenuta. Pokušajte ponovno za minutu.');
  }
  await setMeta('last_publish_at', new Date().toISOString());
  return {
    mode: 'deploy',
    message: 'Objava je pokrenuta. Promjene će biti na stranici za 1–3 minute.',
    state: await getPublishState(),
  };
}
