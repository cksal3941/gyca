ALTER TABLE gyca_competitions ADD COLUMN submission_policy jsonb
  CHECK (submission_policy IS NULL OR jsonb_typeof(submission_policy) = 'object');
ALTER TABLE gyca_entries ADD COLUMN submitted_at timestamptz;

CREATE TABLE gyca_submissions (
  entry_id uuid PRIMARY KEY REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 128),
  request_hash text NOT NULL,
  submitted_at timestamptz NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object')
);

CREATE FUNCTION gyca_preserve_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Submission evidence is immutable';
END;
$$;
CREATE TRIGGER gyca_submissions_immutable BEFORE UPDATE OR DELETE ON gyca_submissions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_freeze_submitted_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.submitted_at IS NOT NULL AND
    (NEW.participant IS DISTINCT FROM OLD.participant OR NEW.work IS DISTINCT FROM OLD.work
     OR NEW.guardian IS DISTINCT FROM OLD.guardian OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.competition_id IS DISTINCT FROM OLD.competition_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.status = 'draft') THEN
    RAISE EXCEPTION 'Submitted content is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gyca_entries_freeze BEFORE UPDATE ON gyca_entries
  FOR EACH ROW EXECUTE FUNCTION gyca_freeze_submitted_entry();
