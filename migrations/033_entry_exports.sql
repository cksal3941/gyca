CREATE TABLE gyca_entry_exports (
  id uuid PRIMARY KEY,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  filters jsonb NOT NULL CHECK (jsonb_typeof(filters) = 'object'),
  row_count integer NOT NULL CHECK (row_count BETWEEN 0 AND 10000),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL
);
CREATE INDEX gyca_entry_exports_history ON gyca_entry_exports(competition_id,created_at,id);
CREATE TRIGGER gyca_entry_exports_immutable BEFORE UPDATE OR DELETE ON gyca_entry_exports
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
