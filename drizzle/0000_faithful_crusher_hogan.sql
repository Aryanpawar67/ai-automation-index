CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_description_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"overall_score" integer,
	"hours_saved" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"name" text,
	"uploaded_by" text DEFAULT 'admin' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_pocs" integer DEFAULT 0 NOT NULL,
	"total_jds" integer DEFAULT 0 NOT NULL,
	"processed_jds" integer DEFAULT 0 NOT NULL,
	"failed_jds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"career_page_url" text NOT NULL,
	"report_token" text,
	"token_expires_at" timestamp with time zone,
	"scrape_status" text DEFAULT 'pending' NOT NULL,
	"scrape_error" text,
	"scraped_at" timestamp with time zone,
	"ats_type" text,
	"total_jobs_available" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_report_token_unique" UNIQUE("report_token")
);
--> statement-breakpoint
CREATE TABLE "dataset_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_number" integer,
	"company_name" text NOT NULL,
	"domain" text NOT NULL,
	"headquarters" text,
	"employee_size" text,
	"hcm_raw" text,
	"ats_type" text,
	"career_page_url" text NOT NULL,
	"job_preview" jsonb,
	"source_file" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url_reachable" boolean,
	"url_confidence" text,
	"url_detected_ats" text,
	"url_suggested_url" text,
	"url_is_career_page" boolean,
	"url_validated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"title" text NOT NULL,
	"raw_text" text NOT NULL,
	"source_url" text,
	"department" text,
	"status" text DEFAULT 'scraped' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pocs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_job_description_id_job_descriptions_id_fk" FOREIGN KEY ("job_description_id") REFERENCES "public"."job_descriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocs" ADD CONSTRAINT "pocs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocs" ADD CONSTRAINT "pocs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_leads" ADD CONSTRAINT "report_leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;