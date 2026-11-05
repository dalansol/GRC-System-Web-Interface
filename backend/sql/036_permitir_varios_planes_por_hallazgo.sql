-- Un hallazgo/control puede tener varios planes de acción.
-- La restricción histórica impedía crear más de un plan por hallazgo.
ALTER TABLE action_plans
  DROP CONSTRAINT IF EXISTS uq_action_plans_finding;
