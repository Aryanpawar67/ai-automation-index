import { NextResponse } from "next/server";
import { db }           from "@/lib/db/client";
import { batches }      from "@/lib/db/schema";
import { desc }         from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(batches).orderBy(desc(batches.createdAt)).limit(50);
  return NextResponse.json(rows);
}
