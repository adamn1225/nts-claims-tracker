-- Fix profile slugs that were generated with uppercase letters intact before
-- lowercasing, causing the first letter of each name segment to be dropped.
-- e.g. "dam-oah" → "adam-noah"

DO $$
DECLARE
  rec RECORD;
  base_slug text;
  candidate text;
  counter int;
BEGIN
  FOR rec IN
    SELECT id, first_name, last_name
    FROM brokers
    WHERE first_name IS NOT NULL
  LOOP
    base_slug := regexp_replace(
      lower(coalesce(rec.first_name, '') || '-' || coalesce(rec.last_name, '')),
      '[^a-z0-9]+', '-', 'g'
    );
    base_slug := trim(both '-' from base_slug);

    -- Skip if already correct or empty
    CONTINUE WHEN base_slug = '' OR base_slug = (SELECT profile_slug FROM brokers WHERE id = rec.id);

    candidate := base_slug;
    counter   := 2;

    WHILE EXISTS (SELECT 1 FROM brokers WHERE profile_slug = candidate AND id <> rec.id) LOOP
      candidate := base_slug || '-' || counter;
      counter   := counter + 1;
    END LOOP;

    UPDATE brokers SET profile_slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;
