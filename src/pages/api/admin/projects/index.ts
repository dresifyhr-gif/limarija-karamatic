/**
 * GET  /api/admin/projects → { items: AdminProject[] } (svi, i neobjavljeni; s fotografijama)
 * POST /api/admin/projects  JSON ProjectInput (+ opcionalno images: [{image: ImageRef}]) → 201 AdminProject (ide na vrh popisa)
 */
import { json, readJson, route } from '@/lib/server/http';
import { listProjects, createProject, setProjectImages, getProject } from '@/lib/server/repo/projects';
import { parse } from '@/lib/server/validate';
import { ProjectSchema, ProjectImagesSchema } from '@/lib/server/schemas';

export const prerender = false;

export const GET = route(async () => json({ items: await listProjects() }));

export const POST = route(async ({ request }) => {
  const body = await readJson<Record<string, unknown>>(request);
  const input = parse(ProjectSchema, body);
  const imgs = body.images !== undefined ? parse(ProjectImagesSchema, { images: body.images }).images : [];
  const p = await createProject(input);
  if (imgs.length) await setProjectImages(p.id, imgs.map(({ image }) => ({ image })));
  return json(await getProject(p.id), 201);
});
