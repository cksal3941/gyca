CREATE TABLE gyca_payment_permissions (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  permission text NOT NULL CHECK (permission IN ('viewer','operator')),
  PRIMARY KEY(user_id,competition_id)
);
CREATE TABLE gyca_payment_admin_actions (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  expected_updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  action text NOT NULL CHECK (action = 'requeue_recovery')
);
CREATE INDEX gyca_payment_admin_history ON gyca_payment_admin_actions(order_id,created_at,id);
CREATE TRIGGER gyca_payment_admin_actions_immutable BEFORE UPDATE OR DELETE ON gyca_payment_admin_actions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
