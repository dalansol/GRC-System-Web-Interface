-- Las evidencias de controles se identifican por el control, no por la entidad de negocio.
UPDATE evidence
SET entity_id = control_id
WHERE entity_type = 'control'
  AND control_id IS NOT NULL
  AND entity_id IS DISTINCT FROM control_id;
