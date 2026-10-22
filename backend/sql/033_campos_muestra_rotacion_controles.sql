-- Datos operativos mostrados en el detalle del control.
ALTER TABLE controls
    ADD COLUMN IF NOT EXISTS size VARCHAR(100),
    ADD COLUMN IF NOT EXISTS rotation VARCHAR(100);
