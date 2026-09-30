ALTER TABLE gyca_competitions ADD COLUMN retention_policy jsonb
  CHECK (retention_policy IS NULL OR jsonb_typeof(retention_policy)='object');

CREATE TABLE gyca_retention_policy_changes (
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  policy jsonb NOT NULL CHECK (jsonb_typeof(policy)='object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,revision)
);
CREATE TRIGGER gyca_retention_policy_changes_immutable BEFORE UPDATE OR DELETE ON gyca_retention_policy_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
