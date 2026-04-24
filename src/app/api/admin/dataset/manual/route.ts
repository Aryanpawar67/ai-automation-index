import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db/client";
import { datasetRows }               from "@/lib/db/schema";
import { ATS_VALUES }                from "@/lib/ats";
import { inArray, eq }               from "drizzle-orm";

interface ManualRowInput {
  companyName?:   string;
  careerPageUrl?: string;
  atsType?:       string;
  headquarters?:  string;
  employeeSize?:  string;
  pocFirstName?:  string;
  pocLastName?:   string;
  pocEmail?:      string;
}

interface NormalizedRow {
  companyName:   string;
  careerPageUrl: string;
  atsType:       string;
  domain:        string;
  headquarters:  string | null;
  employeeSize:  string | null;
  pocFirstName:  string | null;
  pocLastName:   string | null;
  pocEmail:      string | null;
}

interface RowError {
  index:  number;
  reason: string;
}

function normalize(row: ManualRowInput, index: number): { row: NormalizedRow } | { error: RowError } {
  const companyName   = (row.companyName   ?? "").trim();
  const careerPageUrl = (row.careerPageUrl ?? "").trim();
  const atsType       = (row.atsType       ?? "").trim();

  if (!companyName)   return { error: { index, reason: "Company name is required." } };
  if (!careerPageUrl) return { error: { index, reason: "Career page URL is required." } };
  if (!atsType)       return { error: { index, reason: "HCM/ATS is required." } };
  if (!ATS_VALUES.includes(atsType))
    return { error: { index, reason: `HCM/ATS "${atsType}" is not supported.` } };

  let domain: string;
  try { domain = new URL(careerPageUrl).hostname; }
  catch { return { error: { index, reason: "Career page URL is not a valid URL." } }; }
  if (!domain) return { error: { index, reason: "Could not derive domain from career page URL." } };

  const clean = (v?: string) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };

  return {
    row: {
      companyName,
      careerPageUrl,
      atsType,
      domain,
      headquarters: clean(row.headquarters),
      employeeSize: clean(row.employeeSize),
      pocFirstName: clean(row.pocFirstName),
      pocLastName:  clean(row.pocLastName),
      pocEmail:     clean(row.pocEmail),
    },
  };
}

// POST ?dryRun=true → parse + dedup, return stats (no DB write)
// POST             → insert new rows; update POC fields on existing domains
export async function POST(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

  let body: { rows?: ManualRowInput[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const inputRows = Array.isArray(body.rows) ? body.rows : [];
  if (inputRows.length === 0)
    return NextResponse.json({ error: "No rows provided." }, { status: 400 });

  const parsed: NormalizedRow[] = [];
  const errors:  RowError[]     = [];
  inputRows.forEach((r, i) => {
    const result = normalize(r, i);
    if ("error" in result) errors.push(result.error);
    else                   parsed.push(result.row);
  });

  if (errors.length > 0)
    return NextResponse.json({ error: "Some rows are invalid.", errors }, { status: 422 });

  if (parsed.length === 0)
    return NextResponse.json({ error: "No valid rows to process." }, { status: 422 });

  // Dedup against existing domains
  const incomingDomains = parsed.map(r => r.domain);
  const existing = await db
    .select({ id: datasetRows.id, domain: datasetRows.domain })
    .from(datasetRows)
    .where(inArray(datasetRows.domain, incomingDomains));

  const existingByDomain = new Map(existing.map(r => [r.domain, r.id]));
  const newRows          = parsed.filter(r => !existingByDomain.has(r.domain));
  const updateRows       = parsed.filter(r => existingByDomain.has(r.domain) && (r.pocFirstName || r.pocLastName || r.pocEmail));
  const duplicateCount   = parsed.length - newRows.length;

  if (dryRun) {
    return NextResponse.json({
      total:        parsed.length,
      newRows:      newRows.length,
      duplicates:   duplicateCount,
      existingInDb: existingByDomain.size,
    });
  }

  if (newRows.length > 0) {
    await db.insert(datasetRows).values(
      newRows.map(r => ({
        companyName:   r.companyName,
        domain:        r.domain,
        headquarters:  r.headquarters,
        employeeSize:  r.employeeSize,
        hcmRaw:        null,
        atsType:       r.atsType,
        careerPageUrl: r.careerPageUrl,
        sourceFile:    "Manual Entry",
        pocFirstName:  r.pocFirstName,
        pocLastName:   r.pocLastName,
        pocEmail:      r.pocEmail,
      }))
    );
  }

  for (const r of updateRows) {
    const id = existingByDomain.get(r.domain)!;
    await db
      .update(datasetRows)
      .set({ pocFirstName: r.pocFirstName, pocLastName: r.pocLastName, pocEmail: r.pocEmail })
      .where(eq(datasetRows.id, id));
  }

  return NextResponse.json({
    inserted:   newRows.length,
    updated:    updateRows.length,
    duplicates: duplicateCount,
    total:      parsed.length,
  });
}
