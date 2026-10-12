-- Orders and refunds may be billed in KRW (Toss Payments domestic) or USD in addition to EUR.
-- Existing rows keep their original currency; amounts are never converted.
ALTER TABLE gyca_orders DROP CONSTRAINT gyca_orders_currency_check;
ALTER TABLE gyca_orders ADD CONSTRAINT gyca_orders_currency_check CHECK (currency IN ('EUR','KRW','USD'));
ALTER TABLE gyca_refunds DROP CONSTRAINT gyca_refunds_currency_check;
ALTER TABLE gyca_refunds ADD CONSTRAINT gyca_refunds_currency_check CHECK (currency IN ('EUR','KRW','USD'));
