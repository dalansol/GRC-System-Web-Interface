-- Datos iniciales de la estructura organizacional (SF-03).
-- Al menos un periodo fiscal activo para que las unidades de negocio se creen
-- sin error de llave foránea. Solo con --datos-prueba.
-- Se puede ejecutar más de una vez sin efecto.

INSERT INTO fiscal_periods (name, start_date, end_date, is_active)
VALUES ('Fiscal 2026', '2026-01-01', '2026-12-31', TRUE)
ON CONFLICT (name) DO NOTHING;
