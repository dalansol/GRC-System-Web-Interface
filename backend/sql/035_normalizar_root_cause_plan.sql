-- Normaliza instalaciones que conservaron la columna histórica description.
-- El esquema vigente usa action_plans.root_cause.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'action_plans'
          AND column_name = 'description'
    ) THEN
        UPDATE action_plans
        SET root_cause = COALESCE(root_cause, description)
        WHERE root_cause IS NULL;
        ALTER TABLE action_plans DROP COLUMN description;
    END IF;
END $$;
