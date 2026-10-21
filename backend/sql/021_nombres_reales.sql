-- Nombre real opcional de la unidad de negocio, la división y la subdivisión (SF-03).
-- `name` sigue siendo el código del Consolidado (UDN-0003, DIVISION-0002…): es el que se
-- valida como único y se busca. `display_name` (KOF, Brasil…) solo se muestra. El área no
-- lo necesita: su nombre ya es el real.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 017.

ALTER TABLE business_units ADD COLUMN IF NOT EXISTS display_name VARCHAR(150) NULL;
ALTER TABLE division ADD COLUMN IF NOT EXISTS display_name VARCHAR(150) NULL;
ALTER TABLE business ADD COLUMN IF NOT EXISTS display_name VARCHAR(150) NULL;
