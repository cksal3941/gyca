ALTER TABLE gyca_payment_outbox
  ADD COLUMN email_state text NOT NULL DEFAULT 'pending' CHECK (email_state IN ('pending','running','sent','stalled')),
  ADD COLUMN email_attempts integer NOT NULL DEFAULT 0 CHECK (email_attempts>=0),
  ADD COLUMN email_due_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN email_lease uuid,
  ADD COLUMN email_lease_until timestamptz,
  ADD COLUMN email_first_attempt_at timestamptz,
  ADD COLUMN email_payload jsonb,
  ADD COLUMN email_provider_id text,
  ADD CONSTRAINT gyca_email_lease CHECK ((email_state='running')=(email_lease IS NOT NULL AND email_lease_until IS NOT NULL));
CREATE FUNCTION gyca_preserve_email_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.email_payload IS NOT NULL AND ROW(NEW.email_payload,NEW.email_first_attempt_at)
    IS DISTINCT FROM ROW(OLD.email_payload,OLD.email_first_attempt_at) THEN
    RAISE EXCEPTION 'Email payload is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gyca_email_payload_immutable BEFORE UPDATE ON gyca_payment_outbox
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_email_payload();
