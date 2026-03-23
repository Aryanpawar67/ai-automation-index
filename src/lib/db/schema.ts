import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const batches = pgTable("batches", {
  id:           uuid("id").primaryKey().defaultRandom(),
  filename:     text("filename").notNull(),
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
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  // 'pending' | 'analyzing' | 'complete' | 'failed'
  status:      text("status").notNull().default("pending"),
  retryCount:  integer("retry_count").notNull().default(0),
  error:       text("error"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
