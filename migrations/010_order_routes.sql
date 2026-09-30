CREATE TABLE gyca_order_routes (
  order_id uuid PRIMARY KEY REFERENCES gyca_orders(id) ON DELETE RESTRICT,
  route_id text NOT NULL,
  policy_token text NOT NULL,
  terms jsonb NOT NULL CHECK (jsonb_typeof(terms)='object'),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL
);
CREATE TRIGGER gyca_order_routes_immutable BEFORE UPDATE OR DELETE ON gyca_order_routes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
