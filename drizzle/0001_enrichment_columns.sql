ALTER TABLE "dataset_rows" ADD COLUMN "hr_stack_status" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "hr_stack" jsonb;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "hr_stack_discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_confidence" integer;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_source" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_status" text;--> statement-breakpoint
ALTER TABLE "dataset_rows" ADD COLUMN "linkedin_discovered_at" timestamp with time zone;
