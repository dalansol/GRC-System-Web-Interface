-- Relaciona las asignaciones de controles con los planes de auditoría.
-- Las filas existentes deben usar ids numéricos de planes; no se eliminan automáticamente.

ALTER TABLE audit_controls
    DROP CONSTRAINT IF EXISTS fk_audit_controls_audit;

ALTER TABLE audit_controls
    ALTER COLUMN audit_id TYPE INT USING audit_id::integer;

ALTER TABLE audit_controls
    ADD CONSTRAINT fk_audit_controls_audit
    FOREIGN KEY (audit_id) REFERENCES audit_plans (id);
