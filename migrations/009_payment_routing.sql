ALTER TABLE gyca_competitions ADD COLUMN payment_routing jsonb
  CHECK (payment_routing IS NULL OR jsonb_typeof(payment_routing) = 'object');
