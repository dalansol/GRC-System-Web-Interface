-- El seguimiento pertenece a cada asignación dentro de un plan, no al catálogo global.
ALTER TABLE controls
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS hours_spent,
    DROP COLUMN IF EXISTS feedback;
