-- Nombres de los trimestres en español (SF-03, 2026-11-03): "2026 Q1" … "2026 Q4" pasan a
-- "2026 T1" … "2026 T4", que es como los crea el Catálogo. "2026 Fiscal" no cambia.
-- Las unidades guardan el id del periodo, así que su "Periodo de alta" se actualiza solo.
-- Si ya existe un periodo con el nombre nuevo no toca el anterior (no viola la unicidad).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 026.

UPDATE fiscal_periods f
SET name = substring(f.name COLLATE "C" FROM '^([0-9]{4})') || ' T' || substring(f.name COLLATE "C" FROM '([1-4])$')
WHERE f.name COLLATE "C" ~ '^[0-9]{4} Q[1-4]$'
  AND NOT EXISTS (
      SELECT 1 FROM fiscal_periods o
      WHERE o.name = substring(f.name COLLATE "C" FROM '^([0-9]{4})') || ' T' || substring(f.name COLLATE "C" FROM '([1-4])$')
  );
