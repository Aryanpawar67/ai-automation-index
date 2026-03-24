import { neon }    from "@neondatabase/serverless";
import { drizzle }  from "drizzle-orm/neon-http";
import * as schema  from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

function getInstance(): DB {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set.");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Proxy so call-sites keep using `db.select()` etc. unchanged,
// but the connection is created lazily (not at module-import time).
export const db = new Proxy({} as DB, {
  get(_, prop: string | symbol) {
    return Reflect.get(getInstance(), prop);
  },
});
