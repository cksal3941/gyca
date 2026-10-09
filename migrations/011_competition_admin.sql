ALTER TABLE gyca_competitions ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision>0);
CREATE TABLE gyca_competition_editors (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT
);
CREATE TABLE gyca_competition_changes (
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,revision)
);
CREATE TRIGGER gyca_competition_changes_immutable BEFORE UPDATE OR DELETE ON gyca_competition_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
