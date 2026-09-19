CREATE TABLE gyca_payment_confirmations (
  order_id uuid PRIMARY KEY REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  payment_key text NOT NULL CHECK (length(payment_key) BETWEEN 1 AND 200),
  idempotency_key uuid NOT NULL UNIQUE,
  requested_at timestamptz NOT NULL,
  replay_until timestamptz NOT NULL CHECK (replay_until >= requested_at)
);
CREATE TRIGGER gyca_payment_confirmations_immutable BEFORE UPDATE OR DELETE ON gyca_payment_confirmations
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
