ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS ck_action_plans_status;
ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS action_plans_status_check;

ALTER TABLE action_plans
  ADD CONSTRAINT action_plans_status_check
  CHECK (status IN ('Asignado', 'En Progreso', 'Completado', 'En Revisión'));
