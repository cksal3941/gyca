CREATE TABLE gyca_guardian_requests (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  entry_revision integer NOT NULL,
  policy_token text NOT NULL,
  locale text NOT NULL CHECK(locale IN ('en','ko')),
  recipient text NOT NULL,
  documents jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX gyca_guardian_entry_requests ON gyca_guardian_requests(entry_id,created_at);
CREATE TABLE gyca_guardian_consents (
  request_id uuid PRIMARY KEY REFERENCES gyca_guardian_requests(id) ON DELETE RESTRICT,
  guardian_name text NOT NULL,
  accepted_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_guardian_requests_immutable BEFORE UPDATE OR DELETE ON gyca_guardian_requests
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
CREATE TRIGGER gyca_guardian_consents_immutable BEFORE UPDATE OR DELETE ON gyca_guardian_consents
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
