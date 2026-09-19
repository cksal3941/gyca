CREATE TABLE gyca_launch_verifications (
  id uuid PRIMARY KEY,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  competition_revision integer NOT NULL,
  code text NOT NULL CHECK (code IN ('storage','retention','live_payment_verification')),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL CHECK (length(evidence_reference) BETWEEN 1 AND 500),
  verified_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > verified_at)
);
CREATE INDEX gyca_launch_verifications_current
  ON gyca_launch_verifications(competition_id,competition_revision,code,verified_at DESC,id DESC);
CREATE TRIGGER gyca_launch_verifications_immutable BEFORE UPDATE OR DELETE ON gyca_launch_verifications
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_application_opens (
  action_id uuid PRIMARY KEY,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  previous_revision integer NOT NULL,
  resulting_revision integer NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  readiness_snapshot jsonb NOT NULL CHECK (jsonb_typeof(readiness_snapshot) = 'object'),
  created_at timestamptz NOT NULL,
  UNIQUE(competition_id,resulting_revision)
);
CREATE TRIGGER gyca_application_opens_immutable BEFORE UPDATE OR DELETE ON gyca_application_opens
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
