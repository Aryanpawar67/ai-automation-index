CREATE TABLE IF NOT EXISTS "report_events" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id"  uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "token"       text NOT NULL,
  "session_id"  uuid NOT NULL,
  "event"       text NOT NULL,
  "report_type" text NOT NULL,
  "job_title"   text,
  "props"       jsonb,
  "user_agent"  text,
  "ip_hash"     text,
  "referrer"    text,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "report_events_company_idx" ON "report_events" ("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "report_events_token_idx"   ON "report_events" ("token", "created_at");
CREATE INDEX IF NOT EXISTS "report_events_session_idx" ON "report_events" ("session_id");
