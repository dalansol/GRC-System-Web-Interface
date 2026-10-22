-- Declaración de conflictos de interés por plan de auditoría (historia #96).
-- Las asignaciones de controles ya son por plan (011_audit_controls_plan.sql: audit_controls.audit_id
-- apunta a audit_plans). Este script hace lo mismo con conflict_declarations, que en 008 apuntaba a
-- audits (texto, 'AUD-001'), para que "auditor asignado" y "declaración" se refieran al mismo plan.
--
-- Es seguro de correr en cualquier base:
--   * Si audit_id ya es numérico, no hace nada.
--   * Si audit_id es de texto y la tabla está VACÍA, la cambia a INT con llave a audit_plans.
--   * Si audit_id es de texto y la tabla TIENE DATOS, se detiene con un error y no cambia nada
--     (db:migrar aplica cada script en una transacción).

DO $$
DECLARE
    tipo  text;
    filas bigint;
BEGIN
    SELECT data_type INTO tipo
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'conflict_declarations' AND column_name = 'audit_id';

    IF tipo IS NULL OR tipo NOT IN ('character varying', 'text') THEN
        RETURN;
    END IF;

    SELECT count(*) INTO filas FROM conflict_declarations;
    IF filas > 0 THEN
        RAISE EXCEPTION
            'conflict_declarations tiene % filas ligadas a audits. No se cambió nada: decide a qué plan pertenece cada una antes de volver a correr este script.',
            filas;
    END IF;

    ALTER TABLE conflict_declarations DROP CONSTRAINT IF EXISTS fk_conflict_declarations_audit;
    ALTER TABLE conflict_declarations ALTER COLUMN audit_id TYPE INT USING audit_id::integer;
    ALTER TABLE conflict_declarations
        ADD CONSTRAINT fk_conflict_declarations_audit FOREIGN KEY (audit_id) REFERENCES audit_plans (id);
END $$;
