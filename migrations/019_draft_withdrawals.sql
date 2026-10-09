CREATE TABLE gyca_draft_withdrawals (
  entry_id uuid PRIMARY KEY REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  previous_revision integer NOT NULL CHECK (previous_revision > 0),
  resulting_revision integer NOT NULL CHECK (resulting_revision = previous_revision + 1),
  withdrawn_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_draft_withdrawals_immutable BEFORE UPDATE OR DELETE ON gyca_draft_withdrawals
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
