-- Refuerza el esquema final de evidencias para bases que ya tenían migraciones previas.
ALTER TABLE evidence
    DROP COLUMN IF EXISTS control_id,
    DROP COLUMN IF EXISTS finding_id,
    DROP COLUMN IF EXISTS audit_id;

ALTER TABLE evidence DROP CONSTRAINT IF EXISTS ck_evidence_entity_type;
ALTER TABLE evidence ADD CONSTRAINT ck_evidence_entity_type
    CHECK (entity_type IN ('control', 'hallazgo', 'action_plan_step'));
