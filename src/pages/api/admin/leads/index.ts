/** GET /api/admin/leads?status=&limit=&offset= → { items: Lead[], counts: Record<LeadStatus, number> } (novije prvo) */
import { json, route } from '@/lib/server/http';
import { listLeads, countLeadsByStatus } from '@/lib/server/repo/leads';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/types';

export const prerender = false;

export const GET = route(async ({ url }) => {
  const s = url.searchParams.get('status');
  const status = s && (LEAD_STATUSES as readonly string[]).includes(s) ? (s as LeadStatus) : undefined;
  const [items, counts] = await Promise.all([
    listLeads({
      status,
      limit: Number(url.searchParams.get('limit') ?? 50) || 50,
      offset: Number(url.searchParams.get('offset') ?? 0) || 0,
    }),
    countLeadsByStatus(),
  ]);
  return json({ items, counts });
});
