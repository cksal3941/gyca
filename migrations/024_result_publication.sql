ALTER TABLE gyca_entries ADD COLUMN review_status text NOT NULL DEFAULT 'not_started'
  CHECK (review_status IN ('not_started','under_review','completed'));
ALTER TABLE gyca_entries ADD COLUMN published_result text
  CHECK (published_result IS NULL OR published_result IN ('official_selection','finalist','not_selected'));

CREATE TABLE gyca_entry_reviews (
  entry_id uuid PRIMARY KEY REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  review_status text NOT NULL CHECK (review_status IN ('not_started','under_review','completed')),
  decision text CHECK (decision IS NULL OR decision IN ('official_selection','finalist','not_selected')),
  revision integer NOT NULL CHECK (revision > 0),
  updated_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL,
  CHECK ((review_status='completed') = (decision IS NOT NULL))
);

CREATE TABLE gyca_entry_review_changes (
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  review_status text NOT NULL CHECK (review_status IN ('not_started','under_review','completed')),
  decision text CHECK (decision IS NULL OR decision IN ('official_selection','finalist','not_selected')),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(entry_id,revision),
  CHECK ((review_status='completed') = (decision IS NOT NULL))
);
CREATE TRIGGER gyca_entry_review_changes_immutable BEFORE UPDATE OR DELETE ON gyca_entry_review_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_result_publication_batches (
  competition_id text PRIMARY KEY REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  source_revision integer NOT NULL,
  resulting_revision integer NOT NULL CHECK (resulting_revision=source_revision+1),
  entry_count integer NOT NULL CHECK (entry_count > 0),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_result_publication_batches_immutable BEFORE UPDATE OR DELETE ON gyca_result_publication_batches
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_entry_result_publications (
  entry_id uuid PRIMARY KEY REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  competition_id text NOT NULL REFERENCES gyca_result_publication_batches(competition_id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('official_selection','finalist','not_selected')),
  review_revision integer NOT NULL CHECK (review_revision > 0),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_entry_result_publications_immutable BEFORE UPDATE OR DELETE ON gyca_entry_result_publications
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_validate_entry_result_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status AND NOT EXISTS (
    SELECT 1 FROM gyca_entry_reviews r WHERE r.entry_id=NEW.id AND r.review_status=NEW.review_status
  ) THEN RAISE EXCEPTION 'entry review projection requires review evidence'; END IF;
  IF OLD.published_result IS NOT NULL AND NEW.published_result IS DISTINCT FROM OLD.published_result THEN
    RAISE EXCEPTION 'published result projection is immutable';
  END IF;
  IF NEW.published_result IS DISTINCT FROM OLD.published_result AND NOT EXISTS (
    SELECT 1 FROM gyca_entry_result_publications p WHERE p.entry_id=NEW.id AND p.result=NEW.published_result
  ) THEN RAISE EXCEPTION 'entry result projection requires publication evidence'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_entry_result_projection BEFORE UPDATE ON gyca_entries
  FOR EACH ROW EXECUTE FUNCTION gyca_validate_entry_result_projection();

ALTER TABLE gyca_asset_deletion_jobs DROP CONSTRAINT gyca_asset_deletion_jobs_reason_check;
ALTER TABLE gyca_asset_deletion_jobs ADD CONSTRAINT gyca_asset_deletion_jobs_reason_check
  CHECK (reason IN ('withdrawn_draft','unselected_submission','selected_submission'));

CREATE OR REPLACE FUNCTION gyca_validate_asset_deletion_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reason='withdrawn_draft' THEN
    IF NOT EXISTS (
      SELECT 1 FROM gyca_assets a JOIN gyca_entries e ON e.id=a.entry_id
      WHERE a.id=NEW.asset_id AND a.entry_id=NEW.entry_id AND e.competition_id=NEW.competition_id
        AND a.object_key=NEW.object_key AND a.object_version=NEW.object_version
        AND a.removed_at IS NOT NULL AND e.status='withdrawn'
    ) THEN RAISE EXCEPTION 'asset deletion target is not an exact withdrawn version'; END IF;
  ELSIF NEW.reason IN ('unselected_submission','selected_submission') THEN
    IF NOT EXISTS (
      SELECT 1 FROM gyca_assets a JOIN gyca_entries e ON e.id=a.entry_id
      JOIN gyca_entry_result_publications p ON p.entry_id=e.id AND p.competition_id=e.competition_id
      WHERE a.id=NEW.asset_id AND a.entry_id=NEW.entry_id AND e.competition_id=NEW.competition_id
        AND a.object_key=NEW.object_key AND a.object_version=NEW.object_version
        AND ((NEW.reason='unselected_submission' AND p.result='not_selected')
          OR (NEW.reason='selected_submission' AND p.result IN ('official_selection','finalist')))
    ) THEN RAISE EXCEPTION 'asset deletion target does not match a published result'; END IF;
  ELSE RAISE EXCEPTION 'unsupported asset deletion reason';
  END IF;
  RETURN NEW;
END; $$;
