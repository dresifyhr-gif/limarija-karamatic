import { db, num } from '../db';
import { HttpError } from '../http';
import type { TemplateInput } from '../schemas';

/** Predložak stavke ponude (cjenik). unitPrice je NETO u EUR. */
export type QuoteTemplate = TemplateInput & { id: number; sort: number; createdAt: string; updatedAt: string };

const map = (r: Record<string, unknown>): QuoteTemplate => ({
  id: r.id as number,
  name: r.name as string,
  description: r.description as string,
  unit: r.unit as string,
  unitPrice: num(r.unit_price),
  category: r.category as string,
  sort: r.sort as number,
  createdAt: new Date(r.created_at as string).toISOString(),
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

export async function listTemplates(): Promise<QuoteTemplate[]> {
  return (await db()`SELECT * FROM quote_item_templates ORDER BY category, sort, name`).map(map);
}

export async function getTemplate(id: number): Promise<QuoteTemplate | null> {
  const rows = await db()`SELECT * FROM quote_item_templates WHERE id = ${id}`;
  return rows[0] ? map(rows[0]) : null;
}

export async function createTemplate(i: TemplateInput): Promise<QuoteTemplate> {
  const rows = await db()`INSERT INTO quote_item_templates (name, description, unit, unit_price, category, sort)
    VALUES (${i.name}, ${i.description}, ${i.unit}, ${i.unitPrice}, ${i.category},
      (SELECT coalesce(max(sort), -1) + 1 FROM quote_item_templates)) RETURNING *`;
  return map(rows[0]);
}

export async function updateTemplate(id: number, p: Partial<TemplateInput>): Promise<QuoteTemplate> {
  const cur = await getTemplate(id);
  if (!cur) throw new HttpError(404, 'Predložak ne postoji.');
  const n = { ...cur, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) } as QuoteTemplate;
  const rows = await db()`UPDATE quote_item_templates SET name = ${n.name}, description = ${n.description}, unit = ${n.unit},
      unit_price = ${n.unitPrice}, category = ${n.category}, updated_at = now() WHERE id = ${id} RETURNING *`;
  return map(rows[0]);
}

export async function deleteTemplate(id: number): Promise<void> {
  const rows = await db()`DELETE FROM quote_item_templates WHERE id = ${id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, 'Predložak ne postoji.');
}
