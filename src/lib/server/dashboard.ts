import { db } from './db';
import { getPublishState, type PublishState } from './meta';
import { countLeadsByStatus, listLeads, type Lead } from './repo/leads';
import { countQuotesByStatus } from './repo/quotes';
import { env } from './env';
import type { LeadStatus, QuoteStatus } from '@/lib/types';

export type Dashboard = {
  leads: Record<LeadStatus, number>;
  quotes: Record<QuoteStatus, number>;
  content: { projects: number; projectsPublished: number; reviews: number; faq: number };
  publish: PublishState & { canDeploy: boolean };
  recentLeads: Lead[];
};

export async function getDashboard(): Promise<Dashboard> {
  const [leads, quotes, counts, publish, recentLeads] = await Promise.all([
    countLeadsByStatus(),
    countQuotesByStatus(),
    db()`SELECT
      (SELECT count(*)::int FROM projects) AS projects,
      (SELECT count(*)::int FROM projects WHERE published) AS projects_published,
      (SELECT count(*)::int FROM reviews) AS reviews,
      (SELECT count(*)::int FROM faq) AS faq`,
    getPublishState(),
    listLeads({ limit: 5 }),
  ]);
  const c = counts[0] as Record<string, number>;
  return {
    leads,
    quotes,
    content: { projects: c.projects, projectsPublished: c.projects_published, reviews: c.reviews, faq: c.faq },
    publish: { ...publish, canDeploy: !!env('DEPLOY_HOOK_URL') },
    recentLeads,
  };
}
