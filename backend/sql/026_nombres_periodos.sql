-- Formato de los nombres de periodo de auditoría (SF-03): "2026 Q1" … "2026 Q4" para los
-- trimestres y "2026 Fiscal" para el año completo, que es como los crea el Catálogo.
-- Renombra los que quedaron con el formato anterior ("2026Q1" de 017, "Fiscal 2026" de 015).
-- Si ya existe un periodo con el nombre nuevo no toca el anterior (no viola la unicidad).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 008.

UPDATE fiscal_periods f
SET name = substring(f.name COLLATE "C" FROM '^([0-9]{4})') || ' Q' || substring(f.name COLLATE "C" FROM '([1-4])$')
WHERE f.name COLLATE "C" ~ '^[0-9]{4}[Qq][1-4]$'
  AND NOT EXISTS (
      SELECT 1 FROM fiscal_periods o
      WHERE o.name = substring(f.name COLLATE "C" FROM '^([0-9]{4})') || ' Q' || substring(f.name COLLATE "C" FROM '([1-4])$')
  );

UPDATE fiscal_periods f
SET name = substring(f.name COLLATE "C" FROM '([0-9]{4})$') || ' Fiscal'
WHERE f.name COLLATE "C" ~* '^fiscal [0-9]{4}$'
  AND NOT EXISTS (
      SELECT 1 FROM fiscal_periods o WHERE o.name = substring(f.name COLLATE "C" FROM '([0-9]{4})$') || ' Fiscal'
  );
