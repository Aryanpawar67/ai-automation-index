ALTER TABLE "report_events" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "report_events" ADD COLUMN IF NOT EXISTS "region"  text;
ALTER TABLE "report_events" ADD COLUMN IF NOT EXISTS "city"    text;
