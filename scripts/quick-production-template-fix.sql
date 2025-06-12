-- Quick fix for production template schema mismatch
-- This adds the missing camelCase columns and copies data from snake_case columns

-- Add missing camelCase columns
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "studioIds" json DEFAULT '[]'::json;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "pcrRoomId" integer;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "notifyList" json DEFAULT '[]'::json;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "startTime" text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "endTime" text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "createdBy" integer;

-- Extract data from old equipment/crew_required columns to new schema
UPDATE templates SET 
  "studioIds" = COALESCE((equipment->0->>'studioIds')::json, '[]'::json),
  "pcrRoomId" = (equipment->0->>'pcrRoomId')::integer,
  "color" = equipment->0->>'color',
  "status" = COALESCE(equipment->0->>'status', 'confirmed'),
  "notifyList" = COALESCE(crew_required, '[]'::json),
  "createdBy" = COALESCE(created_by, 1)
WHERE equipment IS NOT NULL AND equipment != '[]'::jsonb;

-- Set default createdBy for any NULL values
UPDATE templates SET "createdBy" = 1 WHERE "createdBy" IS NULL;

-- Make createdBy NOT NULL
ALTER TABLE templates ALTER COLUMN "createdBy" SET NOT NULL;