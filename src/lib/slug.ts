import { db }        from "@/lib/db/client";
import { companies } from "@/lib/db/schema";
import { like }      from "drizzle-orm";

/** Convert a company name to a URL-safe slug base. */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Generate a unique slug for a company name, avoiding collisions with existing DB slugs.
 * e.g. "Acme Corp" → "acme-corp", second one → "acme-corp-2"
 */
export async function generateUniqueSlug(name: string): Promise<string> {
  const base = toSlug(name);
  if (!base) return crypto.randomUUID().slice(0, 8);

  const existing = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(like(companies.slug, `${base}%`));

  const taken = new Set(existing.map(r => r.slug).filter(Boolean));
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
