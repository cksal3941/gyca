CREATE TABLE gyca_result_round_publication_batches (
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  round text NOT NULL CHECK (round IN ('official_selection','finalist')),
  source_revision integer NOT NULL,
  resulting_revision integer NOT NULL CHECK (resulting_revision=source_revision+1),
  eligible_count integer NOT NULL CHECK (eligible_count > 0),
  selected_count integer NOT NULL CHECK (selected_count >= 0 AND selected_count <= eligible_count),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,round)
);
CREATE TRIGGER gyca_result_round_publication_batches_immutable BEFORE UPDATE OR DELETE ON gyca_result_round_publication_batches
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_entry_result_round_publications (
  competition_id text NOT NULL,
  round text NOT NULL,
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('official_selection','finalist','not_selected')),
  review_revision integer NOT NULL CHECK (review_revision > 0),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,round,entry_id),
  FOREIGN KEY(competition_id,round) REFERENCES gyca_result_round_publication_batches(competition_id,round) ON DELETE RESTRICT
);
CREATE TRIGGER gyca_entry_result_round_publications_immutable BEFORE UPDATE OR DELETE ON gyca_entry_result_round_publications
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_final_participations (
  entry_id uuid PRIMARY KEY REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  state text NOT NULL CHECK (state IN ('invited','confirmation_pending','confirmed','declined')),
  invitation_published_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  order_id uuid REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL,
  CHECK ((state='confirmed')=(confirmed_at IS NOT NULL))
);

ALTER TABLE gyca_entries
  ADD COLUMN final_participation_revision integer CHECK (final_participation_revision > 0),
  ADD COLUMN final_participation_state text CHECK (final_participation_state IN ('invited','confirmation_pending','confirmed','declined')),
  ADD COLUMN invitation_published_at timestamptz,
  ADD COLUMN final_participation_confirmed_at timestamptz,
  ADD COLUMN final_participation_order_id uuid REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  ADD CONSTRAINT gyca_entry_final_participation_projection_complete CHECK (
    (final_participation_revision IS NULL
      AND final_participation_state IS NULL
      AND invitation_published_at IS NULL
      AND final_participation_confirmed_at IS NULL
      AND final_participation_order_id IS NULL)
    OR
    (final_participation_revision IS NOT NULL
      AND final_participation_state IS NOT NULL
      AND invitation_published_at IS NOT NULL
      AND ((final_participation_state='confirmed')=(final_participation_confirmed_at IS NOT NULL)))
  );
CREATE TABLE gyca_final_participation_changes (
  entry_id uuid NOT NULL REFERENCES gyca_final_participations(entry_id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  state text NOT NULL CHECK (state IN ('invited','confirmation_pending','confirmed','declined')),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(entry_id,revision)
);
CREATE TRIGGER gyca_final_participation_changes_immutable BEFORE UPDATE OR DELETE ON gyca_final_participation_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_final_participation_actions (
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id text NOT NULL CHECK (length(action_id) BETWEEN 1 AND 128),
  request_hash text NOT NULL,
  entry_id uuid NOT NULL REFERENCES gyca_final_participations(entry_id) ON DELETE RESTRICT,
  resulting_revision integer NOT NULL CHECK (resulting_revision > 0),
  PRIMARY KEY(actor_id,action_id)
);
CREATE TRIGGER gyca_final_participation_actions_immutable BEFORE UPDATE OR DELETE ON gyca_final_participation_actions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

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
  IF NEW.published_result IS DISTINCT FROM OLD.published_result AND NOT (
    EXISTS (SELECT 1 FROM gyca_entry_result_publications p WHERE p.entry_id=NEW.id AND p.result=NEW.published_result)
    OR EXISTS (SELECT 1 FROM gyca_entry_result_round_publications p WHERE p.entry_id=NEW.id AND p.result=NEW.published_result)
  ) THEN RAISE EXCEPTION 'entry result projection requires publication evidence'; END IF;
  IF (NEW.final_participation_revision,NEW.final_participation_state,NEW.invitation_published_at,
      NEW.final_participation_confirmed_at,NEW.final_participation_order_id) IS DISTINCT FROM
     (OLD.final_participation_revision,OLD.final_participation_state,OLD.invitation_published_at,
      OLD.final_participation_confirmed_at,OLD.final_participation_order_id) AND NOT EXISTS (
    SELECT 1 FROM gyca_final_participations fp WHERE fp.entry_id=NEW.id
      AND fp.revision=NEW.final_participation_revision
      AND fp.state=NEW.final_participation_state
      AND fp.invitation_published_at=NEW.invitation_published_at
      AND fp.confirmed_at IS NOT DISTINCT FROM NEW.final_participation_confirmed_at
      AND fp.order_id IS NOT DISTINCT FROM NEW.final_participation_order_id
  ) THEN RAISE EXCEPTION 'entry final participation projection requires participation evidence'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION gyca_validate_asset_deletion_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reason='withdrawn_draft' THEN
    IF NOT EXISTS (
      SELECT 1 FROM gyca_assets a JOIN gyca_entries e ON e.id=a.entry_id
      WHERE a.id=NEW.asset_id AND a.entry_id=NEW.entry_id AND e.competition_id=NEW.competition_id
        AND a.object_key=NEW.object_key AND a.object_version=NEW.object_version
        AND a.removed_at IS NOT NULL AND e.status='withdrawn'
    ) THEN RAISE EXCEPTION 'asset deletion target is not an exact withdrawn version'; END IF;
  ELSIF NEW.reason IN ('unselected_submission','selected_submission') THEN
    IF NOT EXISTS (
      SELECT 1 FROM gyca_assets a JOIN gyca_entries e ON e.id=a.entry_id
      WHERE a.id=NEW.asset_id AND a.entry_id=NEW.entry_id AND e.competition_id=NEW.competition_id
        AND a.object_key=NEW.object_key AND a.object_version=NEW.object_version
        AND ((NEW.reason='unselected_submission' AND e.published_result='not_selected')
          OR (NEW.reason='selected_submission' AND e.published_result IN ('official_selection','finalist')))
        AND (EXISTS (SELECT 1 FROM gyca_entry_result_publications p WHERE p.entry_id=e.id)
          OR EXISTS (SELECT 1 FROM gyca_entry_result_round_publications p WHERE p.entry_id=e.id AND p.result=e.published_result))
    ) THEN RAISE EXCEPTION 'asset deletion target does not match a published result'; END IF;
  ELSE RAISE EXCEPTION 'unsupported asset deletion reason';
  END IF;
  RETURN NEW;
END; $$;
