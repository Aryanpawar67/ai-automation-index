CREATE TABLE "report_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"report_slug" text,
	"company_name" text,
	"user_agent" text,
	"referrer" text,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"token" text NOT NULL,
	"session_id" uuid NOT NULL,
	"event" text NOT NULL,
	"report_type" text NOT NULL,
	"job_title" text,
	"props" jsonb,
	"user_agent" text,
	"ip_hash" text,
	"referrer" text,
	"country" text,
	"region" text,
	"city" text,
	"accuracy_km" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "url_reason" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "poc_first_name" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "poc_last_name" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "poc_email" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "hr_stack_status" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "hr_stack" jsonb;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "hr_stack_discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_confidence" integer;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_source" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_status" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "industry_status" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "industry_discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "report_leads" ADD COLUMN "source" text DEFAULT 'cta' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_events_company_idx" ON "report_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "report_events_token_idx" ON "report_events" USING btree ("token","created_at");--> statement-breakpoint
CREATE INDEX "report_events_session_idx" ON "report_events" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_slug_unique" UNIQUE("slug");