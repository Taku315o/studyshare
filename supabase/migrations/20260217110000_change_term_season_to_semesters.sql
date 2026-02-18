-- term_season を 4区分(spring/summer/fall/winter) から 2区分(first_half/second_half) へ移行

DO $$
DECLARE
  has_first_half boolean;
  has_second_half boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'term_season'
      AND e.enumlabel = 'first_half'
  ) INTO has_first_half;

  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'term_season'
      AND e.enumlabel = 'second_half'
  ) INTO has_second_half;

  IF has_first_half AND has_second_half THEN
    RETURN;
  END IF;

  CREATE TYPE public.term_season_new AS ENUM ('first_half', 'second_half');

  ALTER TABLE public.terms
    ALTER COLUMN season DROP DEFAULT,
    ALTER COLUMN season TYPE public.term_season_new
    USING (
      CASE season::text
        WHEN 'spring' THEN 'first_half'
        WHEN 'summer' THEN 'first_half'
        WHEN 'fall' THEN 'second_half'
        WHEN 'winter' THEN 'second_half'
        ELSE season::text
      END
    )::public.term_season_new,
    ALTER COLUMN season SET DEFAULT 'first_half'::public.term_season_new;

  DROP TYPE public.term_season;
  ALTER TYPE public.term_season_new RENAME TO term_season;
END;
$$;
