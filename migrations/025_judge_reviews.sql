CREATE TABLE gyca_judges (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE TABLE gyca_review_rubrics (
  competition_id text PRIMARY KEY REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  version text NOT NULL,
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria)='array'),
  editable_after_submit boolean NOT NULL DEFAULT false,
  configured_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  configured_at timestamptz NOT NULL
);
CREATE TABLE gyca_review_rubric_changes (
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  competition_revision integer NOT NULL,
  version text NOT NULL,
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria)='array'),
  editable_after_submit boolean NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,competition_revision)
);
CREATE TRIGGER gyca_review_rubric_changes_immutable BEFORE UPDATE OR DELETE ON gyca_review_rubric_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_judge_assignment_actions (
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id text NOT NULL CHECK (length(action_id) BETWEEN 1 AND 128),
  request_hash text NOT NULL,
  assignment_id uuid NOT NULL,
  PRIMARY KEY(actor_id,action_id)
);
CREATE TABLE gyca_judge_assignments (
  id uuid PRIMARY KEY,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  judge_id text NOT NULL REFERENCES gyca_judges(user_id) ON DELETE RESTRICT,
  blind_code text NOT NULL CHECK (length(blind_code) BETWEEN 3 AND 64),
  rubric_version text NOT NULL,
  editable_after_submit boolean NOT NULL,
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  UNIQUE(entry_id,judge_id), UNIQUE(competition_id,blind_code)
);
ALTER TABLE gyca_judge_assignment_actions ADD CONSTRAINT gyca_judge_assignment_actions_assignment
  FOREIGN KEY(assignment_id) REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT;
CREATE TRIGGER gyca_judge_assignments_immutable BEFORE UPDATE OR DELETE ON gyca_judge_assignments
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_blinded_review_assets (
  assignment_id uuid PRIMARY KEY REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT,
  source_asset_id uuid NOT NULL REFERENCES gyca_assets(id) ON DELETE RESTRICT,
  object_key text NOT NULL,
  object_version text NOT NULL CHECK (object_version<>'' AND object_version<>'null'),
  checksum text NOT NULL,
  verified_at timestamptz NOT NULL,
  UNIQUE(object_key,object_version)
);
CREATE FUNCTION gyca_validate_blinded_review_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gyca_judge_assignments j JOIN gyca_assets a ON a.id=NEW.source_asset_id
    WHERE j.id=NEW.assignment_id AND a.entry_id=j.entry_id AND a.purpose='book_pdf' AND a.state='ready'
      AND a.removed_at IS NULL AND (a.object_key<>NEW.object_key OR a.object_version IS DISTINCT FROM NEW.object_version)
  ) THEN RAISE EXCEPTION 'blinded review asset requires a distinct ready source PDF'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_blinded_review_asset_target BEFORE INSERT ON gyca_blinded_review_assets
  FOR EACH ROW EXECUTE FUNCTION gyca_validate_blinded_review_asset();
CREATE TRIGGER gyca_blinded_review_assets_immutable BEFORE UPDATE OR DELETE ON gyca_blinded_review_assets
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_judge_reviews (
  assignment_id uuid PRIMARY KEY REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  state text NOT NULL CHECK (state IN ('in_progress','submitted')),
  scores jsonb NOT NULL CHECK (jsonb_typeof(scores)='object'),
  comment text NOT NULL,
  updated_at timestamptz NOT NULL,
  submitted_at timestamptz
  ,CHECK ((state='submitted')=(submitted_at IS NOT NULL))
);
CREATE TABLE gyca_judge_review_changes (
  assignment_id uuid NOT NULL REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  state text NOT NULL CHECK (state IN ('in_progress','submitted')),
  scores jsonb NOT NULL CHECK (jsonb_typeof(scores)='object'),
  comment text NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(assignment_id,revision)
);
CREATE TRIGGER gyca_judge_review_changes_immutable BEFORE UPDATE OR DELETE ON gyca_judge_review_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE OR REPLACE FUNCTION gyca_validate_entry_result_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status AND NOT (
    EXISTS (SELECT 1 FROM gyca_entry_reviews r WHERE r.entry_id=NEW.id AND r.review_status=NEW.review_status)
    OR (NEW.review_status='under_review' AND EXISTS (
      SELECT 1 FROM gyca_judge_assignments a JOIN gyca_judge_reviews r ON r.assignment_id=a.id
      WHERE a.entry_id=NEW.id AND r.state='in_progress'))
    OR (NEW.review_status='completed' AND EXISTS (SELECT 1 FROM gyca_judge_assignments a WHERE a.entry_id=NEW.id)
      AND NOT EXISTS (SELECT 1 FROM gyca_judge_assignments a LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
        WHERE a.entry_id=NEW.id AND r.state IS DISTINCT FROM 'submitted'))
  ) THEN RAISE EXCEPTION 'entry review projection requires review evidence'; END IF;
  IF OLD.published_result IS NOT NULL AND NEW.published_result IS DISTINCT FROM OLD.published_result THEN
    RAISE EXCEPTION 'published result projection is immutable';
  END IF;
  IF NEW.published_result IS DISTINCT FROM OLD.published_result AND NOT EXISTS (
    SELECT 1 FROM gyca_entry_result_publications p WHERE p.entry_id=NEW.id AND p.result=NEW.published_result
  ) THEN RAISE EXCEPTION 'entry result projection requires publication evidence'; END IF;
  RETURN NEW;
END; $$;
