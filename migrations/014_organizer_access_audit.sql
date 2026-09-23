CREATE TABLE gyca_organizer_access_audit (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  previously_granted boolean NOT NULL,
  granted boolean NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  operator_reference text NOT NULL CHECK (length(operator_reference) BETWEEN 1 AND 200),
  database_actor text NOT NULL DEFAULT current_user,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER gyca_organizer_access_audit_immutable BEFORE UPDATE OR DELETE ON gyca_organizer_access_audit
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
