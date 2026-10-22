-- Datos iniciales de la estructura organizacional (SF-03): el año fiscal 2026.
-- Se crea inactivo: 017 activa 2026 Q4 si no hay ningún periodo activo, y después lo elige
-- quien gestiona el Catálogo (repetir los scripts no le cambia el periodo activo).
-- Se puede ejecutar más de una vez sin efecto: no inserta si ya hay un periodo con esas
-- fechas (con el nombre anterior, "Fiscal 2026", o el actual, "2026 Fiscal"; ver 026).

INSERT INTO fiscal_periods (name, start_date, end_date, is_active)
SELECT '2026 Fiscal', DATE '2026-01-01', DATE '2026-12-31', FALSE
WHERE NOT EXISTS (
    SELECT 1 FROM fiscal_periods WHERE start_date = DATE '2026-01-01' AND end_date = DATE '2026-12-31'
);
