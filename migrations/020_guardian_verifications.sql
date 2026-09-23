CREATE TABLE gyca_guardian_verifications (
  request_id uuid PRIMARY KEY REFERENCES gyca_guardian_requests(id) ON DELETE RESTRICT,
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  entry_revision integer NOT NULL CHECK (entry_revision > 0),
  policy_token text NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL CHECK (length(evidence_reference) BETWEEN 1 AND 200),
  verified_at timestamptz NOT NULL
);
CREATE INDEX gyca_guardian_verifications_entry ON gyca_guardian_verifications(entry_id,verified_at);
CREATE TRIGGER gyca_guardian_verifications_immutable BEFORE UPDATE OR DELETE ON gyca_guardian_verifications
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
