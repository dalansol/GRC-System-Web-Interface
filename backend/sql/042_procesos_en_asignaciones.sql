-- Columnas que usan la asignación de controles y la visibilidad de hallazgos por unidad de negocio.
-- Se agregaron a mano en Supabase; este script las crea en cualquier otra base para que coincidan.
-- En Supabase no cambia nada: las columnas ya existen. Se puede ejecutar más de una vez sin efecto.
-- PostgreSQL (Supabase). Requiere 008 y 011.

ALTER TABLE processes
    ADD COLUMN IF NOT EXISTS control_id  VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS description TEXT NULL,
    ADD COLUMN IF NOT EXISTS title       VARCHAR(255) NULL;

-- El título es obligatorio. En las bases creadas por 008 se toma del nombre del proceso.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'processes'
          AND column_name = 'name'
    ) THEN
        EXECUTE 'UPDATE processes SET title = name WHERE title IS NULL';
    END IF;
END $$;

ALTER TABLE processes ALTER COLUMN title SET NOT NULL;

ALTER TABLE audit_controls
    ADD COLUMN IF NOT EXISTS process_id INT NULL
    CONSTRAINT fk_audit_controls_process REFERENCES processes (id) ON DELETE SET NULL;
