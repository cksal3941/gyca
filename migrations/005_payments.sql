ALTER TABLE gyca_competitions ADD COLUMN payment_policy jsonb
  CHECK (payment_policy IS NULL OR jsonb_typeof(payment_policy) = 'object');
ALTER TABLE gyca_entries ADD COLUMN received_at timestamptz;
ALTER TABLE gyca_entries ADD COLUMN receipt_number text UNIQUE;
ALTER TABLE gyca_entries ADD CONSTRAINT gyca_receipt_pair CHECK ((received_at IS NULL) = (receipt_number IS NULL));

CREATE TABLE gyca_orders (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL UNIQUE REFERENCES gyca_submissions(entry_id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency text NOT NULL CHECK (currency = 'EUR'),
  payment_closes_at timestamptz NOT NULL,
  policy_version text NOT NULL,
  approval_basis text NOT NULL CHECK (approval_basis IN ('provider_paid_at','server_verified_at')),
  provider text NOT NULL,
  merchant_account text NOT NULL,
  live_mode boolean NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','succeeded','failed','cancelled','expired')),
  needs_review boolean NOT NULL DEFAULT false,
  provider_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL,
  next_reconcile_at timestamptz,
  CHECK ((state = 'succeeded') = (provider_payment_id IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE UNIQUE INDEX gyca_order_payment_identity ON gyca_orders(provider,merchant_account,live_mode,provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE TABLE gyca_order_creation_keys (
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 128),
  order_id uuid NOT NULL REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  PRIMARY KEY(owner_id,key)
);
CREATE TABLE gyca_payment_events (
  provider text NOT NULL, merchant_account text NOT NULL, live_mode boolean NOT NULL,
  event_id text NOT NULL, event_hash text NOT NULL,
  order_id uuid NOT NULL REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  evidence jsonb NOT NULL, verified_at timestamptz NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('applied','ignored','review')),
  PRIMARY KEY(provider,merchant_account,live_mode,event_id)
);
CREATE TABLE gyca_payment_outbox (
  key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('entry_received','payment_review')),
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  delivered_at timestamptz
);
CREATE FUNCTION gyca_preserve_order_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.entry_id,NEW.amount_minor,NEW.currency,NEW.payment_closes_at,NEW.policy_version,
    NEW.approval_basis,NEW.provider,NEW.merchant_account,NEW.live_mode,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.entry_id,OLD.amount_minor,OLD.currency,OLD.payment_closes_at,OLD.policy_version,
    OLD.approval_basis,OLD.provider,OLD.merchant_account,OLD.live_mode,OLD.created_at) THEN
    RAISE EXCEPTION 'Order terms are immutable';
  END IF;
  IF OLD.state = 'succeeded' AND ROW(NEW.state,NEW.provider_payment_id,NEW.paid_at)
    IS DISTINCT FROM ROW(OLD.state,OLD.provider_payment_id,OLD.paid_at) THEN
    RAISE EXCEPTION 'Verified payment cannot regress';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gyca_orders_terms BEFORE UPDATE ON gyca_orders
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_order_terms();
CREATE TRIGGER gyca_payment_events_immutable BEFORE UPDATE OR DELETE ON gyca_payment_events
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_preserve_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.receipt_number IS NOT NULL AND ROW(NEW.receipt_number,NEW.received_at)
    IS DISTINCT FROM ROW(OLD.receipt_number,OLD.received_at) THEN
    RAISE EXCEPTION 'Issued receipt is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gyca_entries_receipt BEFORE UPDATE ON gyca_entries
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_receipt();
