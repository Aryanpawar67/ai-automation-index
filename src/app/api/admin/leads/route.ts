import { NextResponse }          from "next/server";
import { db }                    from "@/lib/db/client";
import { reportLeads, companies } from "@/lib/db/schema";
import { eq, desc }              from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      id:          reportLeads.id,
      email:       reportLeads.email,
      companyId:   reportLeads.companyId,
      companyName: companies.name,
      createdAt:   reportLeads.createdAt,
    })
    .from(reportLeads)
    .innerJoin(companies, eq(reportLeads.companyId, companies.id))
    .orderBy(desc(reportLeads.createdAt));

  return NextResponse.json(
    rows.map(r => ({
      id:          r.id,
      email:       r.email,
      companyId:   r.companyId,
      companyName: r.companyName,
      createdAt:   r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }))
  );
}
