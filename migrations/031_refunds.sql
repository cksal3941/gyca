CREATE TABLE gyca_refunds (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency text NOT NULL CHECK (currency = 'EUR'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','succeeded','failed')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  requested_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL,
  provider_refund_id text,
  refunded_at timestamptz,
  CHECK ((state = 'succeeded') = (provider_refund_id IS NOT NULL AND refunded_at IS NOT NULL))
);
CREATE UNIQUE INDEX gyca_refund_provider_identity ON gyca_refunds(order_id,provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
CREATE INDEX gyca_refunds_order ON gyca_refunds(order_id,requested_at,id);

CREATE FUNCTION gyca_preserve_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.order_id,NEW.amount_minor,NEW.currency,NEW.reason,NEW.requested_by,NEW.requested_at)
    IS DISTINCT FROM ROW(OLD.order_id,OLD.amount_minor,OLD.currency,OLD.reason,OLD.requested_by,OLD.requested_at) THEN
    RAISE EXCEPTION 'Refund terms are immutable';
  END IF;
  IF OLD.state = 'succeeded' AND ROW(NEW.state,NEW.provider_refund_id,NEW.refunded_at)
    IS DISTINCT FROM ROW(OLD.state,OLD.provider_refund_id,OLD.refunded_at) THEN
    RAISE EXCEPTION 'Verified refund cannot regress';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gyca_refunds_preserve BEFORE UPDATE ON gyca_refunds
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_refund();
CREATE TRIGGER gyca_refunds_immutable_delete BEFORE DELETE ON gyca_refunds
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
