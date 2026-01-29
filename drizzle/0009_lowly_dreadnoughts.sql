-- Convert existing plain text content to Tiptap JSON format
-- This migration converts the cards.content column from text to jsonb

-- Step 1: Only convert if the column is still text type (idempotent check)
DO $$
BEGIN
  -- Check if content column is still text type (not yet migrated)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cards'
    AND column_name = 'content'
    AND data_type = 'text'
  ) THEN
    -- Drop the existing default first (required before type change)
    ALTER TABLE "cards" ALTER COLUMN "content" DROP DEFAULT;
    
    -- Convert all existing text content to Tiptap JSON format
    UPDATE "cards"
    SET content = jsonb_build_object(
      'type', 'doc',
      'content', CASE
        WHEN content IS NULL OR content = '' THEN jsonb_build_array(
          jsonb_build_object('type', 'paragraph')
        )
        ELSE jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', content)
            )
          )
        )
      END
    )::text;

    -- Change the column type to jsonb
    ALTER TABLE "cards" ALTER COLUMN "content" SET DATA TYPE jsonb USING content::jsonb;
  END IF;
END $$;

--> statement-breakpoint

-- Step 2: Set the default value (safe to run multiple times)
ALTER TABLE "cards" ALTER COLUMN "content" SET DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb;
