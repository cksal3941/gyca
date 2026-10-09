ALTER TABLE gyca_payment_admin_actions
  DROP CONSTRAINT gyca_payment_admin_actions_action_check;
ALTER TABLE gyca_payment_admin_actions
  ADD CONSTRAINT gyca_payment_admin_actions_action_check
  CHECK (action IN ('requeue_recovery','accept_late_payment'));
