CREATE TABLE gyca_payment_recovery (
  order_id uuid PRIMARY KEY REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','completed','stalled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  due_at timestamptz NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  updated_at timestamptz NOT NULL,
  CHECK ((state = 'running') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX gyca_payment_recovery_due ON gyca_payment_recovery(due_at,order_id)
  WHERE state IN ('pending','running');
