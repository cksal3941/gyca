CREATE TABLE gyca_application_resumes (
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  revision integer NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  pause_revision integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,revision),
  FOREIGN KEY(competition_id,pause_revision) REFERENCES gyca_application_pauses(competition_id,revision) ON DELETE RESTRICT
);
CREATE TRIGGER gyca_application_resumes_immutable BEFORE UPDATE OR DELETE ON gyca_application_resumes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
