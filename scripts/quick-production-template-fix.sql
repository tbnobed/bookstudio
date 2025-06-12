-- Quick fix for production template schema mismatch
-- This adds the missing camelCase columns and copies data from snake_case columns

-- Add missing camelCase columns
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "studioIds" json DEFAULT '[]'::json;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "pcrRoomId" integer;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "notifyList" json DEFAULT '[]'::json;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "startTime" text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "endTime" text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS "createdBy" integer;

-- Copy data from snake_case to camelCase columns
UPDATE templates SET "studioIds" = studio_ids WHERE studio_ids IS NOT NULL;
UPDATE templates SET "pcrRoomId" = pcr_room_id WHERE pcr_room_id IS NOT NULL;
UPDATE templates SET "notifyList" = notify_list WHERE notify_list IS NOT NULL;
UPDATE templates SET "startTime" = start_time WHERE start_time IS NOT NULL;
UPDATE templates SET "endTime" = end_time WHERE end_time IS NOT NULL;
UPDATE templates SET "createdBy" = created_by WHERE created_by IS NOT NULL;

-- Set default createdBy for any NULL values
UPDATE templates SET "createdBy" = 1 WHERE "createdBy" IS NULL;

-- Make createdBy NOT NULL
ALTER TABLE templates ALTER COLUMN "createdBy" SET NOT NULL;