CREATE TABLE gyca_judge_access_changes (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  active boolean NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_judge_access_changes_immutable BEFORE UPDATE OR DELETE ON gyca_judge_access_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_blind_asset_jobs (
  assignment_id uuid PRIMARY KEY REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT,
  source_asset_id uuid NOT NULL REFERENCES gyca_assets(id) ON DELETE RESTRICT,
  source_key text NOT NULL,
  source_version text NOT NULL CHECK (source_version<>'' AND source_version<>'null'),
  target_key text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('pending','running','pending_review','approved','stalled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  due_at timestamptz NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  candidate_version text,
  candidate_checksum text,
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  last_error_code text,
  created_at timestamptz NOT NULL,
  transformed_at timestamptz,
  approved_at timestamptz,
  CHECK ((state='running')=(lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK ((state IN ('pending_review','approved'))=(candidate_version IS NOT NULL AND candidate_checksum IS NOT NULL AND page_count IS NOT NULL)),
  CHECK ((state='approved')=(approved_at IS NOT NULL))
);
CREATE FUNCTION gyca_validate_blind_asset_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gyca_judge_assignments j JOIN gyca_assets a ON a.id=NEW.source_asset_id
    WHERE j.id=NEW.assignment_id AND a.entry_id=j.entry_id AND a.purpose='book_pdf' AND a.state='ready'
      AND a.removed_at IS NULL AND a.object_key=NEW.source_key AND a.object_version=NEW.source_version
      AND NEW.target_key<>NEW.source_key
  ) THEN RAISE EXCEPTION 'blind asset job requires the assigned ready PDF version'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_blind_asset_job_target BEFORE INSERT ON gyca_blind_asset_jobs
  FOR EACH ROW EXECUTE FUNCTION gyca_validate_blind_asset_job();

CREATE TABLE gyca_blind_asset_events (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES gyca_blind_asset_jobs(assignment_id) ON DELETE RESTRICT,
  attempt integer NOT NULL CHECK (attempt >= 0),
  outcome text NOT NULL CHECK (outcome IN ('transformed','retry_scheduled','stalled','approved')),
  error_code text,
  actor_id text REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_blind_asset_events_immutable BEFORE UPDATE OR DELETE ON gyca_blind_asset_events
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_blind_asset_approvals (
  assignment_id uuid PRIMARY KEY REFERENCES gyca_blind_asset_jobs(assignment_id) ON DELETE RESTRICT,
  candidate_version text NOT NULL,
  candidate_checksum text NOT NULL,
  confirmed_no_visible_identity boolean NOT NULL CHECK (confirmed_no_visible_identity),
  note text NOT NULL CHECK (length(note) BETWEEN 1 AND 2000),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_blind_asset_approvals_immutable BEFORE UPDATE OR DELETE ON gyca_blind_asset_approvals
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
