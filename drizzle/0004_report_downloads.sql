CREATE TABLE IF NOT EXISTS "report_downloads" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email"         text NOT NULL,
  "report_slug"   text,
  "company_name"  text,
  "user_agent"    text,
  "referrer"      text,
  "downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
