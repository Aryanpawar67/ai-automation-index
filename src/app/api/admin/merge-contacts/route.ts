import { NextResponse }  from "next/server";
import { db }            from "@/lib/db/client";
import { datasetRows }   from "@/lib/db/schema";
import { eq }            from "drizzle-orm";
import * as XLSX         from "xlsx";
import * as path         from "path";

// Normalise company name for fuzzy matching
function norm(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(inc|ltd|llc|corp|co|plc|pvt|private|limited|company|technologies|technology|solutions|services|group)\b/g, "")
    .replace(/\s+/g, " ").trim();
}

export async function POST() {
  const root = path.join(process.cwd());

  // ── 1. Build contact map from contacts file (exact + fuzzy keys) ──────────
  const contactsWb  = XLSX.readFile(path.join(root, "Contacts-last 6 months.xlsx"));
  const contactsRows = XLSX.utils.sheet_to_json<Record<string, string>>(
    contactsWb.Sheets[contactsWb.SheetNames[0]], { defval: "" }
  );

  const contactMap = new Map<string, { firstName: string; lastName: string; emailDomain: string }>();
  for (const r of contactsRows) {
    const val = {
      firstName:   (r["First Name"]   ?? "").trim(),
      lastName:    (r["Last Name"]    ?? "").trim(),
      emailDomain: (r["Email Domain"] ?? "").trim(),
    };
    const exact = (r["Company Name"] ?? "").toLowerCase().trim();
    const fuzzy = norm(r["Company Name"] ?? "");
    if (exact && !contactMap.has(exact)) contactMap.set(exact, val);
    if (fuzzy && !contactMap.has(fuzzy)) contactMap.set(fuzzy, val);
  }

  // ── 2. Build domain → contact map using main Excel as bridge ─────────────
  // Main Excel has both Company Name and Domain, so we can resolve
  // contacts (keyed by company name) to domains (used as DB key).
  const mainWb   = XLSX.readFile(path.join(root, "imocha_prospects_careers_updated.xlsx"));
  const mainRows = XLSX.utils.sheet_to_json<Record<string, string>>(
    mainWb.Sheets[mainWb.SheetNames[0]], { defval: "" }
  );

  // domain → contact info
  const domainContactMap = new Map<string, { firstName: string; lastName: string; emailDomain: string }>();
  for (const r of mainRows) {
    let domain = (r["Domain"] ?? "").trim();
    if (!domain) {
      try { domain = new URL((r["Career Page URL"] ?? "").trim()).hostname; } catch { continue; }
    }
    if (!domain) continue;
    const exact = (r["Company Name"] ?? "").toLowerCase().trim();
    const fuzzy = norm(r["Company Name"] ?? "");
    const contact = contactMap.get(exact) ?? contactMap.get(fuzzy);
    if (contact) domainContactMap.set(domain, contact);
  }

  // ── 3. Update DB rows — domain lookup first, company name fallback ────────
  const dbRows = await db
    .select({ id: datasetRows.id, domain: datasetRows.domain, companyName: datasetRows.companyName })
    .from(datasetRows);

  let updated = 0, skipped = 0;
  for (const row of dbRows) {
    // Try exact domain match first, then strip subdomain (e.g. careers.accenture.com → accenture.com)
    const stripped = row.domain.replace(/^[^.]+\./, "");
    const contact  =
      domainContactMap.get(row.domain) ??
      domainContactMap.get(stripped) ??
      contactMap.get(row.companyName.toLowerCase().trim()) ??
      contactMap.get(norm(row.companyName));

    if (!contact) { skipped++; continue; }
    await db
      .update(datasetRows)
      .set({
        pocFirstName: contact.firstName   || null,
        pocLastName:  contact.lastName    || null,
        pocEmail:     contact.emailDomain || null,
      })
      .where(eq(datasetRows.id, row.id));
    updated++;
  }

  return NextResponse.json({ updated, skipped, total: dbRows.length });
}
