-- Add slug column to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate base slugs from company names
UPDATE companies
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Resolve duplicate slugs by appending -2, -3, etc. (ordered by created_at)
WITH duplicates AS (
  SELECT id, slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM companies
  WHERE slug IS NOT NULL
)
UPDATE companies c
SET slug = CASE WHEN d.rn = 1 THEN d.slug ELSE d.slug || '-' || d.rn END
FROM duplicates d
WHERE c.id = d.id AND d.rn > 1;

-- Add unique index (allows NULL for any future edge cases)
CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_idx ON companies(slug);
