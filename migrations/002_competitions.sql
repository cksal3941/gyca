ALTER TABLE gyca_competitions
  ADD COLUMN phase text NOT NULL DEFAULT 'scheduled' CHECK (phase IN ('scheduled', 'judging', 'result', 'archived')),
  ADD COLUMN public_content jsonb,
  ADD COLUMN payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN payment_closes_at timestamptz,
  ADD CONSTRAINT gyca_competition_content_object CHECK (public_content IS NULL OR jsonb_typeof(public_content) = 'object');
