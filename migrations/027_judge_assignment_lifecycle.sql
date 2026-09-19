CREATE TABLE gyca_judge_assignment_revocations (
  assignment_id uuid PRIMARY KEY REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT,
  previous_review_state text NOT NULL CHECK (previous_review_state IN ('not_started','in_progress')),
  previous_review_revision integer NOT NULL CHECK (previous_review_revision >= 0),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  replacement_assignment_id uuid UNIQUE REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL
);
CREATE FUNCTION gyca_validate_judge_assignment_revocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_state text; current_revision integer;
BEGIN
  SELECT COALESCE(r.state,'not_started'),COALESCE(r.revision,0) INTO current_state,current_revision
  FROM gyca_judge_assignments a LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
  WHERE a.id=NEW.assignment_id;
  IF current_state IS NULL OR current_state='submitted' OR current_state<>NEW.previous_review_state
    OR current_revision<>NEW.previous_review_revision THEN
    RAISE EXCEPTION 'judge assignment revocation requires the current unsubmitted review revision';
  END IF;
  IF NEW.replacement_assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM gyca_judge_assignments old_assignment
    JOIN gyca_judge_assignments replacement ON replacement.id=NEW.replacement_assignment_id
    WHERE old_assignment.id=NEW.assignment_id
      AND replacement.competition_id=old_assignment.competition_id
      AND replacement.entry_id=old_assignment.entry_id
      AND replacement.judge_id<>old_assignment.judge_id
  ) THEN RAISE EXCEPTION 'replacement assignment must target the same entry and another judge'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_judge_assignment_revocation_valid BEFORE INSERT ON gyca_judge_assignment_revocations
  FOR EACH ROW EXECUTE FUNCTION gyca_validate_judge_assignment_revocation();
CREATE TRIGGER gyca_judge_assignment_revocations_immutable BEFORE UPDATE OR DELETE ON gyca_judge_assignment_revocations
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_judge_assignment_change_actions (
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id text NOT NULL CHECK (length(action_id) BETWEEN 1 AND 128),
  request_hash text NOT NULL,
  revoked_assignment_id uuid NOT NULL REFERENCES gyca_judge_assignment_revocations(assignment_id) ON DELETE RESTRICT,
  replacement_assignment_id uuid REFERENCES gyca_judge_assignments(id) ON DELETE RESTRICT,
  PRIMARY KEY(actor_id,action_id)
);
CREATE TRIGGER gyca_judge_assignment_change_actions_immutable BEFORE UPDATE OR DELETE ON gyca_judge_assignment_change_actions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE INDEX gyca_judge_assignments_competition_created_idx
  ON gyca_judge_assignments(competition_id,created_at,id);

CREATE OR REPLACE FUNCTION gyca_validate_entry_result_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.review_status IS DISTINCT FROM OLD.review_status AND NOT (
    EXISTS (SELECT 1 FROM gyca_entry_reviews r WHERE r.entry_id=NEW.id AND r.review_status=NEW.review_status)
    OR (NEW.review_status='under_review' AND EXISTS (
      SELECT 1 FROM gyca_judge_assignments a JOIN gyca_judge_reviews r ON r.assignment_id=a.id
      WHERE a.entry_id=NEW.id AND r.state IN ('in_progress','submitted'))
      AND EXISTS (
        SELECT 1 FROM gyca_judge_assignments a LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE a.entry_id=NEW.id AND v.assignment_id IS NULL AND r.state IS DISTINCT FROM 'submitted'))
    OR (NEW.review_status='completed' AND EXISTS (
      SELECT 1 FROM gyca_judge_assignments a LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
      WHERE a.entry_id=NEW.id AND v.assignment_id IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM gyca_judge_assignments a LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE a.entry_id=NEW.id AND v.assignment_id IS NULL AND r.state IS DISTINCT FROM 'submitted'))
  ) THEN RAISE EXCEPTION 'entry review projection requires review evidence'; END IF;
  IF OLD.published_result IS NOT NULL AND NEW.published_result IS DISTINCT FROM OLD.published_result THEN
    RAISE EXCEPTION 'published result projection is immutable';
  END IF;
  IF NEW.published_result IS DISTINCT FROM OLD.published_result AND NOT EXISTS (
    SELECT 1 FROM gyca_entry_result_publications p WHERE p.entry_id=NEW.id AND p.result=NEW.published_result
  ) THEN RAISE EXCEPTION 'entry result projection requires publication evidence'; END IF;
  RETURN NEW;
END; $$;
