-- Plan de acción de prueba (antes en 030). Va después de 034, que crea action_plan_findings.
-- Solo para --datos-prueba. Se puede ejecutar más de una vez sin duplicar el plan.

WITH plan AS (
    INSERT INTO action_plans (root_cause, responsible_id, due_date, created_by)
    SELECT 'Revisar y reasignar roles en SAP para eliminar conflictos de acceso. Implementar aprobación dual en todas las conciliaciones.',
           responsable.id, DATE '2025-09-15', creador.id
    FROM users responsable
    JOIN users creador ON creador.email = 's.ramirez@expedite.com'
    WHERE responsable.email = 'c.morales@expedite.com'
      AND EXISTS (SELECT 1 FROM findings WHERE id = 'HAL-2025-001')
      AND NOT EXISTS (SELECT 1 FROM action_plan_findings WHERE finding_id = 'HAL-2025-001')
    RETURNING id
)
INSERT INTO action_plan_findings (action_plan_id, finding_id)
SELECT plan.id, 'HAL-2025-001'
FROM plan
ON CONFLICT DO NOTHING;
