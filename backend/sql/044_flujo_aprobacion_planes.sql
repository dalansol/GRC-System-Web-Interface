-- Flujo de aprobación de planes de acción (SF-12): estados, bitácora inmutable del flujo y notificaciones.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.

ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS ck_action_plans_status;
ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS action_plans_status_check;
ALTER TABLE action_plans
  ADD CONSTRAINT action_plans_status_check
  CHECK (status IN ('Asignado', 'En Progreso', 'Completado', 'Pendiente', 'En Revisión', 'Aprobado', 'Rechazado'));

-- Bitácora del flujo. Nombre y rol se copian para que el historial no cambie si después cambia el usuario.
CREATE TABLE IF NOT EXISTS action_plan_approval_events (
    id             INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_action_plan_approval_events PRIMARY KEY,
    action_plan_id INT            NOT NULL CONSTRAINT fk_approval_events_plan REFERENCES action_plans (id),
    action         VARCHAR(20)    NOT NULL
                                  CONSTRAINT ck_approval_events_action
                                  CHECK (action IN ('envio', 'apertura', 'aprobacion', 'rechazo')),
    from_status    VARCHAR(20)    NOT NULL,
    to_status      VARCHAR(20)    NOT NULL,
    actor_id       INT            NOT NULL CONSTRAINT fk_approval_events_actor REFERENCES users (id),
    actor_name     TEXT           NOT NULL,
    actor_role     TEXT           NOT NULL,
    reason         TEXT           NULL,
    signature_hash CHAR(64)       NULL,
    created_at     TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT ck_approval_events_reason CHECK (action <> 'rechazo' OR btrim(COALESCE(reason, '')) <> ''),
    CONSTRAINT ck_approval_events_signature CHECK (action <> 'aprobacion' OR signature_hash IS NOT NULL)
);
ALTER TABLE action_plan_approval_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_approval_events_plan ON action_plan_approval_events (action_plan_id, id);

CREATE OR REPLACE FUNCTION bloquear_cambios_bitacora_flujo() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora del flujo de aprobación es inmutable.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_approval_events_inmutable ON action_plan_approval_events;
CREATE TRIGGER tr_approval_events_inmutable
  BEFORE UPDATE OR DELETE ON action_plan_approval_events
  FOR EACH ROW EXECUTE FUNCTION bloquear_cambios_bitacora_flujo();

-- Notificaciones dentro de la aplicación. El envío por correo sigue pendiente (TBD).
CREATE TABLE IF NOT EXISTS notifications (
    id          INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_notifications PRIMARY KEY,
    user_id     INT            NOT NULL CONSTRAINT fk_notifications_user REFERENCES users (id),
    type        VARCHAR(50)    NOT NULL,
    message     TEXT           NOT NULL,
    entity_type VARCHAR(30)    NOT NULL,
    entity_id   VARCHAR(50)    NOT NULL,
    read_at     TIMESTAMPTZ(0) NULL,
    created_at  TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_notifications_user_read ON notifications (user_id, read_at);

-- Antes "En Revisión" significaba "enviado" y nadie lo había abierto: esos planes quedan pendientes de revisar.
-- La condición evita deshacer revisiones reales si el script se vuelve a aplicar.
UPDATE action_plans plan
SET status = 'Pendiente'
WHERE plan.status = 'En Revisión'
  AND NOT EXISTS (SELECT 1 FROM action_plan_approval_events evento WHERE evento.action_plan_id = plan.id);
