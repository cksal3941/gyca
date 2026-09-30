CREATE TABLE gyca_payment_policy_changes (
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  policy jsonb NOT NULL,
  routing jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,revision)
);
CREATE TRIGGER gyca_payment_policy_changes_immutable BEFORE UPDATE OR DELETE ON gyca_payment_policy_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
