/**
 * PUT /api/admin/projects/:id/images  JSON { images: [{ id?: number, image: ImageRef }] }
 *     Zamjenjuje CIJELI popis redom (prva = naslovna). Postojeće šalji s id-jem; izostavljene se brišu.
 *     → { items: ProjectImage[] }
 */
import { json, readJson, route, parseId } from '@/lib/server/http';
import { setProjectImages } from '@/lib/server/repo/projects';
import { parse } from '@/lib/server/validate';
import { ProjectImagesSchema } from '@/lib/server/schemas';

export const prerender = false;

export const PUT = route(async ({ params, request }) => {
  const { images } = parse(ProjectImagesSchema, await readJson(request));
  return json({ items: await setProjectImages(parseId(params.id), images) });
});
