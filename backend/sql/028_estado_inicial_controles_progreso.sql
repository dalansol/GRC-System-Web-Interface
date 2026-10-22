-- Los controles nuevos asignados a un plan comienzan en progreso.
ALTER TABLE audit_controls
    ALTER COLUMN status SET DEFAULT 'En Progreso';
