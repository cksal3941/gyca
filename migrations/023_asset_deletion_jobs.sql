CREATE TABLE gyca_asset_deletion_jobs (
  asset_id uuid PRIMARY KEY REFERENCES gyca_assets(id) ON DELETE RESTRICT,
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  object_key text NOT NULL,
  object_version text NOT NULL CHECK (object_version <> '' AND object_version <> 'null'),
  reason text NOT NULL CHECK (reason IN ('withdrawn_draft')),
  policy_version text NOT NULL,
  due_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','completed','stalled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  CHECK ((state='running') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK ((state='completed') = (completed_at IS NOT NULL))
);
CREATE INDEX gyca_asset_deletion_jobs_due ON gyca_asset_deletion_jobs(due_at,asset_id)
  WHERE state IN ('pending','running');

CREATE TABLE gyca_asset_deletion_events (
  id uuid PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES gyca_asset_deletion_jobs(asset_id) ON DELETE RESTRICT,
  attempt integer NOT NULL CHECK (attempt >= 0),
  outcome text NOT NULL CHECK (outcome IN ('completed','retry_scheduled','stalled')),
  error_code text,
  created_at timestamptz NOT NULL,
  CHECK ((outcome='completed') = (error_code IS NULL))
);
CREATE TRIGGER gyca_asset_deletion_events_immutable BEFORE UPDATE OR DELETE ON gyca_asset_deletion_events
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_validate_asset_deletion_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gyca_assets a JOIN gyca_entries e ON e.id=a.entry_id
    WHERE a.id=NEW.asset_id AND a.entry_id=NEW.entry_id AND e.competition_id=NEW.competition_id
      AND a.object_key=NEW.object_key AND a.object_version=NEW.object_version
      AND a.removed_at IS NOT NULL AND e.status='withdrawn'
  ) THEN
    RAISE EXCEPTION 'asset deletion target is not an exact withdrawn version';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_asset_deletion_job_target BEFORE INSERT ON gyca_asset_deletion_jobs
  FOR EACH ROW EXECUTE FUNCTION gyca_validate_asset_deletion_job();

CREATE FUNCTION gyca_preserve_asset_deletion_job_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.asset_id IS DISTINCT FROM OLD.asset_id OR NEW.entry_id IS DISTINCT FROM OLD.entry_id
    OR NEW.competition_id IS DISTINCT FROM OLD.competition_id OR NEW.object_key IS DISTINCT FROM OLD.object_key
    OR NEW.object_version IS DISTINCT FROM OLD.object_version OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.policy_version IS DISTINCT FROM OLD.policy_version OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'asset deletion job identity is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_asset_deletion_job_identity BEFORE UPDATE ON gyca_asset_deletion_jobs
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_asset_deletion_job_identity();
