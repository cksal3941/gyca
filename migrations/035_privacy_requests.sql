CREATE TABLE gyca_privacy_requests (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind='account_closure_and_erasure'),
  state text NOT NULL CHECK (state IN ('submitted','under_review','retention_hold','approved_for_execution','cancelled')),
  revision integer NOT NULL CHECK (revision > 0),
  requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX gyca_privacy_requests_one_active_owner
  ON gyca_privacy_requests(owner_id) WHERE state<>'cancelled';
CREATE INDEX gyca_privacy_requests_admin_page ON gyca_privacy_requests(state,id);

CREATE TABLE gyca_privacy_request_transitions (
  request_id uuid NOT NULL REFERENCES gyca_privacy_requests(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  state text NOT NULL CHECK (state IN ('submitted','under_review','retention_hold','approved_for_execution','cancelled')),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason_code text NOT NULL CHECK (reason_code IN ('USER_REQUESTED','REVIEW_STARTED','LEGAL_RETENTION','PAYMENT_RECORD_RETENTION',
    'CONTEST_EVIDENCE_RETENTION','REVIEW_RESUMED','NO_RETENTION_BLOCK','USER_CANCELLED')),
  evidence_reference text CHECK (evidence_reference IS NULL OR length(evidence_reference) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(request_id,revision)
);
CREATE TRIGGER gyca_privacy_request_transitions_immutable BEFORE UPDATE OR DELETE ON gyca_privacy_request_transitions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_privacy_request_actions (
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response jsonb NOT NULL CHECK (jsonb_typeof(response)='object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,action_id)
);
CREATE TRIGGER gyca_privacy_request_actions_immutable BEFORE UPDATE OR DELETE ON gyca_privacy_request_actions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_preserve_privacy_request_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.owner_id,NEW.kind,NEW.requested_at) IS DISTINCT FROM ROW(OLD.owner_id,OLD.kind,OLD.requested_at) THEN
    RAISE EXCEPTION 'Privacy request identity is immutable';
  END IF;
  IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Privacy request revision must advance by one'; END IF;
  IF NOT EXISTS (SELECT 1 FROM gyca_privacy_request_transitions t
    WHERE t.request_id=OLD.id AND t.revision=NEW.revision AND t.state=NEW.state) THEN
    RAISE EXCEPTION 'Privacy request projection requires transition evidence';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_privacy_request_terms BEFORE UPDATE ON gyca_privacy_requests
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_privacy_request_terms();
