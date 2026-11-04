-- Las evidencias se relacionan únicamente con la entidad indicada por entity_id.
-- Para controles, se conserva la asignación concreta del plan de auditoría.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'evidence' AND column_name = 'audit_id'
    ) THEN
        EXECUTE $sql$
            UPDATE evidence e
            SET entity_id = ac.id::text
            FROM audit_controls ac
            WHERE e.entity_type = 'control'
              AND e.entity_id = ac.control_id
              AND e.audit_id::text = ac.audit_id::text
        $sql$;
    END IF;
END $$;

ALTER TABLE evidence
    DROP COLUMN IF EXISTS control_id,
    DROP COLUMN IF EXISTS finding_id,
    DROP COLUMN IF EXISTS audit_id;

ALTER TABLE evidence DROP CONSTRAINT IF EXISTS ck_evidence_entity_type;
ALTER TABLE evidence ADD CONSTRAINT ck_evidence_entity_type
    CHECK (entity_type IN ('control', 'hallazgo', 'action_plan_step'));
