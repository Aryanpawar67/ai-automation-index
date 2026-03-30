import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export interface HrStackVendor {
  vendor:     string;
  confidence: number;   // 0–100
  source:     string;
}

export interface HrStackResult {
  ats?:  HrStackVendor | null;
  hcm?:  HrStackVendor | null;
  lxp?:  HrStackVendor | null;
  hris?: HrStackVendor | null;
}

export const batches = pgTable("batches", {
  id:           uuid("id").primaryKey().defaultRandom(),
  filename:     text("filename").notNull(),
  name:         text("name"),   // human-readable name for dataset-created batches
  uploadedBy:   text("uploaded_by").notNull().default("admin"),
  // 'pending' | 'scraping' | 'analyzing' | 'complete' | 'partial_failure'
  status:       text("status").notNull().default("pending"),
  totalPocs:    integer("total_pocs").notNull().default(0),
  totalJds:     integer("total_jds").notNull().default(0),
  processedJds: integer("processed_jds").notNull().default(0),
  failedJds:    integer("failed_jds").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
});

export const datasetRows = pgTable("dataset_rows", {
  id:            uuid("id").primaryKey().defaultRandom(),
  rowNumber:     integer("row_number"),
  companyName:   text("company_name").notNull(),
  domain:        text("domain").notNull(),
  headquarters:  text("headquarters"),
  employeeSize:  text("employee_size"),
  hcmRaw:        text("hcm_raw"),
  atsType:       text("ats_type"),
  careerPageUrl:    text("career_page_url").notNull(),
  jobPreview:       jsonb("job_preview").$type<string[]>(),
  sourceFile:       text("source_file"),
  uploadedAt:       timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  // URL validation results (written back after validate-all)
  urlReachable:     boolean("url_reachable"),
  urlConfidence:    text("url_confidence"),      // 'high' | 'medium' | 'low' | 'blocked'
  urlDetectedAts:   text("url_detected_ats"),
  urlSuggestedUrl:  text("url_suggested_url"),
  urlIsCareerPage:  boolean("url_is_career_page"),
  urlReason:        text("url_reason"),
  urlValidatedAt:   timestamp("url_validated_at", { withTimezone: true }),
  // POC contact fields from Excel (if present in upload sheet)
  pocFirstName:     text("poc_first_name"),
  pocLastName:      text("poc_last_name"),
  pocEmail:         text("poc_email"),
  // ── HR Stack enrichment ──────────────────────────────────────────────────────
  hrStackStatus:        text("hr_stack_status"),       // 'pending' | 'running' | 'complete' | 'failed' | 'not_found'
  hrStack:              jsonb("hr_stack").$type<HrStackResult>(),
  hrStackDiscoveredAt:  timestamp("hr_stack_discovered_at", { withTimezone: true }),
  // ── LinkedIn POC finder ──────────────────────────────────────────────────────
  linkedinUrl:          text("linkedin_url"),
  linkedinConfidence:   integer("linkedin_confidence"),
  linkedinSource:       text("linkedin_source"),        // 'google_cse' | 'manual'
  linkedinStatus:       text("linkedin_status"),        // 'pending' | 'running' | 'complete' | 'not_found' | 'failed'
  linkedinDiscoveredAt: timestamp("linkedin_discovered_at", { withTimezone: true }),
});

export const companies = pgTable("companies", {
  id:             uuid("id").primaryKey().defaultRandom(),
  name:           text("name").notNull(),
  careerPageUrl:  text("career_page_url").notNull(),
  reportToken:    text("report_token").unique(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  // 'pending' | 'in_progress' | 'complete' | 'failed' | 'blocked'
  scrapeStatus:   text("scrape_status").notNull().default("pending"),
  scrapeError:    text("scrape_error"),
  scrapedAt:      timestamp("scraped_at", { withTimezone: true }),
  // ATS/HCM platform type from Excel upload — used to route to the correct Tier 1 scraper
  // 'workday' | 'oracle_hcm' | 'oracle_taleo' | 'sap_sf' | null
  atsType:             text("ats_type"),
  totalJobsAvailable:  integer("total_jobs_available"),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pocs = pgTable("pocs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  batchId:   uuid("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  firstName: text("first_name").notNull(),
  lastName:  text("last_name").notNull(),
  email:     text("email").notNull(),
  country:   text("country"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobDescriptions = pgTable("job_descriptions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  companyId:   uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  batchId:     uuid("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  rawText:     text("raw_text").notNull(),
  sourceUrl:   text("source_url"),
  department:  text("department"),
  // 'scraped' | 'pending' | 'analyzing' | 'complete' | 'failed' | 'cancelled' | 'invalid'
  status:      text("status").notNull().default("scraped"),
  retryCount:  integer("retry_count").notNull().default(0),
  error:       text("error"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reportLeads = pgTable("report_leads", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  email:     text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyses = pgTable("analyses", {
  id:               uuid("id").primaryKey().defaultRandom(),
  jobDescriptionId: uuid("job_description_id").notNull()
    .references(() => jobDescriptions.id, { onDelete: "cascade" }),
  companyId:        uuid("company_id").notNull().references(() => companies.id),
  result:           jsonb("result").notNull(),
  overallScore:     integer("overall_score"),
  hoursSaved:       numeric("hours_saved"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
