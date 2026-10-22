-- Código y nombre de la estructura organizacional (SF-03).
-- La unidad, la división y la subdivisión se identifican por su código (UDN-0003,
-- DIVISION-0002…, el formato del Consolidado). Lo asigna el backend al dar de alta: el
-- siguiente número del nivel, sin reutilizar los de elementos borrados; no se edita. Los
-- datos importados conservan el suyo (el Consolidado repite SUBDIVISION-0002 en dos
-- unidades). El nombre (KOF, Brasil…) es opcional y editable. No se renombran columnas para
-- no romper los datos de prueba de 018/022, que buscan por código: `name`/`business_name`
-- guardan el código y `display_name`, el nombre.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 017 y 021.

COMMENT ON COLUMN business_units.name IS 'Código de la unidad (UDN-…): identificador asignado por el sistema, único y fijo.';
COMMENT ON COLUMN business_units.display_name IS 'Nombre de la unidad (KOF…): opcional y editable.';
COMMENT ON COLUMN division.name IS 'Código de la división (DIVISION-…): asignado por el sistema y fijo.';
COMMENT ON COLUMN division.display_name IS 'Nombre de la división: opcional y editable.';
COMMENT ON COLUMN business.business_name IS 'Código de la subdivisión (SUBDIVISION-…): asignado por el sistema y fijo.';
COMMENT ON COLUMN business.display_name IS 'Nombre de la subdivisión: opcional y editable.';

-- Último número de código asignado por nivel. Su fila se bloquea durante el alta (dos altas
-- simultáneas no toman el mismo número) y no baja al borrar. El backend lo compara con el
-- mayor código existente, así que no hace falta llenarlo con los datos actuales.
CREATE TABLE IF NOT EXISTS structure_code_counters (
    level      VARCHAR(20) NOT NULL CONSTRAINT pk_structure_code_counters PRIMARY KEY
               CONSTRAINT ck_structure_code_counters_level CHECK (level IN ('unidad', 'division', 'subdivision')),
    last_value INT         NOT NULL DEFAULT 0
);
ALTER TABLE structure_code_counters ENABLE ROW LEVEL SECURITY;

-- Respaldo: la división no repite código dentro de su unidad. Falla si ya hay repetidas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_division_unit_code ON division (business_unit_id, lower(name));
