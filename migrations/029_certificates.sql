ALTER TABLE gyca_entries ADD COLUMN certificate_count integer NOT NULL DEFAULT 0 CHECK (certificate_count >= 0);

CREATE TABLE gyca_certificate_issue_batches (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id text NOT NULL CHECK (length(action_id) BETWEEN 1 AND 128),
  request_hash text NOT NULL,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  stage text NOT NULL CHECK (stage IN ('official_selection','finalist')),
  requested_count integer NOT NULL CHECK (requested_count BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL,
  UNIQUE(actor_id,action_id)
);
CREATE TRIGGER gyca_certificate_issue_batches_immutable BEFORE UPDATE OR DELETE ON gyca_certificate_issue_batches
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_certificates (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  competition_id text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('official_selection','finalist')),
  certificate_number text NOT NULL UNIQUE CHECK (length(certificate_number) BETWEEN 1 AND 128),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','issued','stalled')),
  object_key text NOT NULL UNIQUE,
  object_version text,
  checksum text CHECK (checksum IS NULL OR checksum ~ '^[0-9a-f]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  due_at timestamptz NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  issued_at timestamptz,
  created_at timestamptz NOT NULL,
  UNIQUE(entry_id,stage),
  FOREIGN KEY(competition_id,stage,entry_id)
    REFERENCES gyca_entry_result_round_publications(competition_id,round,entry_id) ON DELETE RESTRICT,
  CHECK ((state='running')=(lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK ((state='issued')=(object_version IS NOT NULL AND checksum IS NOT NULL AND issued_at IS NOT NULL))
);

CREATE TABLE gyca_certificate_issue_batch_items (
  batch_id uuid NOT NULL REFERENCES gyca_certificate_issue_batches(id) ON DELETE RESTRICT,
  certificate_id uuid NOT NULL REFERENCES gyca_certificates(id) ON DELETE RESTRICT,
  PRIMARY KEY(batch_id,certificate_id)
);
CREATE TRIGGER gyca_certificate_issue_batch_items_immutable BEFORE UPDATE OR DELETE ON gyca_certificate_issue_batch_items
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_certificate_events (
  id uuid PRIMARY KEY,
  certificate_id uuid NOT NULL REFERENCES gyca_certificates(id) ON DELETE RESTRICT,
  attempt integer NOT NULL CHECK (attempt >= 0),
  event text NOT NULL CHECK (event IN ('queued','issued','retry_scheduled','stalled')),
  error_code text,
  created_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_certificate_events_immutable BEFORE UPDATE OR DELETE ON gyca_certificate_events
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_validate_entry_certificate_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.certificate_count IS DISTINCT FROM OLD.certificate_count AND NEW.certificate_count <> (
    SELECT count(*)::integer FROM gyca_certificates c WHERE c.entry_id=NEW.id AND c.state='issued'
  ) THEN RAISE EXCEPTION 'entry certificate projection requires issued certificate evidence'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_entry_certificate_projection BEFORE UPDATE OF certificate_count ON gyca_entries
  FOR EACH ROW EXECUTE FUNCTION gyca_validate_entry_certificate_projection();
