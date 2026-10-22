-- 012_seguimiento_controles.sql creó control_horas sin seguridad por filas; sin ella la API
-- de Supabase la expone. Igual que el resto de las tablas: activada y sin políticas.
-- Se puede ejecutar más de una vez sin efecto.

ALTER TABLE control_horas ENABLE ROW LEVEL SECURITY;
