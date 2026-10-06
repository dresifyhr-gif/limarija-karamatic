import { db } from '../db';
import { deleteBlobsIfUnused } from '../blob';
import { HttpError } from '../http';
import type { LeadCreateInput } from '../schemas';
import { LEAD_STATUSES, type BlobImageRef, type LeadStatus } from '@/lib/types';

export type Lead = {
  id: number;
  status: LeadStatus;
  jobType: string;
  variant: 'standard' | 'zgrada';
  location: string;
  size: string;
  note: string;
  photos: BlobImageRef[];
  name: string;
  phone: string;
  email: string;
  callTime: string;
  sourcePage: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
};

const map = (r: Record<string, unknown>): Lead => ({
  id: r.id as number,
  status: r.status as LeadStatus,
  jobType: r.job_type as string,
  variant: (r.variant as Lead['variant']) ?? 'standard',
  location: r.location as string,
  size: r.size as string,
  note: r.note as string,
  photos: (r.photos as BlobImageRef[]) ?? [],
  name: r.name as string,
  phone: r.phone as string,
  email: r.email as string,
  callTime: r.call_time as string,
  sourcePage: r.source_page as string,
  adminNote: r.admin_note as string,
  createdAt: new Date(r.created_at as string).toISOString(),
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

export async function listLeads(opts: { status?: LeadStatus; limit?: number; offset?: number } = {}): Promise<Lead[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const rows = opts.status
    ? await db()`SELECT * FROM leads WHERE status = ${opts.status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await db()`SELECT * FROM leads ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rows.map(map);
}

export async function countLeadsByStatus(): Promise<Record<LeadStatus, number>> {
  const rows = await db()`SELECT status, count(*)::int AS n FROM leads GROUP BY status`;
  const out = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const r of rows) out[r.status as LeadStatus] = r.n as number;
  return out;
}

export async function getLead(id: number): Promise<Lead | null> {
  const rows = await db()`SELECT * FROM leads WHERE id = ${id}`;
  return rows[0] ? map(rows[0]) : null;
}

/** Za javnu formu (/api/upit — gradi je drugi agent). Fotografije moraju već biti na Blobu (folder 'leads'). */
export async function createLead(i: LeadCreateInput): Promise<Lead> {
  const rows = await db()`INSERT INTO leads (job_type, variant, location, size, note, photos, name, phone, email, call_time, source_page)
    VALUES (${i.jobType}, ${i.variant ?? 'standard'}, ${i.location}, ${i.size}, ${i.note}, ${JSON.stringify(i.photos ?? [])}::jsonb,
      ${i.name}, ${i.phone}, ${i.email ?? ''}, ${i.callTime ?? ''}, ${i.sourcePage ?? ''}) RETURNING *`;
  return map(rows[0]);
}

export async function updateLead(id: number, p: { status?: LeadStatus; adminNote?: string }): Promise<Lead> {
  const cur = await getLead(id);
  if (!cur) throw new HttpError(404, 'Upit ne postoji.');
  const rows = await db()`UPDATE leads SET status = ${p.status ?? cur.status}, admin_note = ${p.adminNote ?? cur.adminNote},
      updated_at = now() WHERE id = ${id} RETURNING *`;
  return map(rows[0]);
}

/** Briše upit i njegove fotografije s Bloba. Ponude vezane uz upit ostaju (lead_id → NULL). */
export async function deleteLead(id: number): Promise<void> {
  const cur = await getLead(id);
  if (!cur) throw new HttpError(404, 'Upit ne postoji.');
  await db()`DELETE FROM leads WHERE id = ${id}`;
  await deleteBlobsIfUnused(cur.photos.map((p) => p.url));
}
