-- Dos revisiones por plan de acción (SF-12): la definición antes de empezar y la evidencia al cierre.
-- También guarda los archivos señalados en un rechazo y las solicitudes de prórroga (SF-11).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.

ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS action_plans_status_check;
ALTER TABLE action_plans
  ADD CONSTRAINT action_plans_status_check
  CHECK (status IN ('Borrador', 'Asignado', 'En Progreso', 'Completado', 'Pendiente', 'En Revisión', 'Aprobado', 'Rechazado'));

-- El valor por omisión deja los planes existentes como ya validados, sin reescribir sus datos.
ALTER TABLE action_plans
  ADD COLUMN IF NOT EXISTS review_stage VARCHAR(20) NOT NULL DEFAULT 'cierre';
ALTER TABLE action_plans DROP CONSTRAINT IF EXISTS ck_action_plans_review_stage;
ALTER TABLE action_plans
  ADD CONSTRAINT ck_action_plans_review_stage CHECK (review_stage IN ('definicion', 'cierre'));

ALTER TABLE action_plan_approval_events
  ADD COLUMN IF NOT EXISTS stage VARCHAR(20) NOT NULL DEFAULT 'cierre';

-- Archivos señalados en un rechazo. Sin llave a evidence: el archivo se puede reemplazar y aquí debe seguir su nombre.
CREATE TABLE IF NOT EXISTS action_plan_event_evidence (
    event_id    INT          NOT NULL CONSTRAINT fk_event_evidence_event REFERENCES action_plan_approval_events (id),
    evidence_id VARCHAR(100) NOT NULL,
    step_id     INT          NOT NULL,
    file_name   TEXT         NOT NULL,
    file_hash   TEXT         NOT NULL,
    CONSTRAINT pk_action_plan_event_evidence PRIMARY KEY (event_id, evidence_id)
);
ALTER TABLE action_plan_event_evidence ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS tr_event_evidence_inmutable ON action_plan_event_evidence;
CREATE TRIGGER tr_event_evidence_inmutable
  BEFORE UPDATE OR DELETE ON action_plan_event_evidence
  FOR EACH ROW EXECUTE FUNCTION bloquear_cambios_bitacora_flujo();

-- Solicitudes de prórroga. La fecha del plan solo cambia al aprobarse.
CREATE TABLE IF NOT EXISTS action_plan_extension_requests (
    id                INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_action_plan_extension_requests PRIMARY KEY,
    action_plan_id    INT            NOT NULL CONSTRAINT fk_extension_requests_plan REFERENCES action_plans (id),
    requested_by      INT            NOT NULL CONSTRAINT fk_extension_requests_requester REFERENCES users (id),
    previous_due_date DATE           NOT NULL,
    proposed_due_date DATE           NOT NULL,
    justification     TEXT           NOT NULL,
    status            VARCHAR(20)    NOT NULL DEFAULT 'Pendiente'
                                     CONSTRAINT ck_extension_requests_status
                                     CHECK (status IN ('Pendiente', 'Aprobada', 'Rechazada')),
    decided_by        INT            NULL CONSTRAINT fk_extension_requests_decider REFERENCES users (id),
    decision_reason   TEXT           NULL,
    decided_at        TIMESTAMPTZ(0) NULL,
    created_at        TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT ck_extension_requests_reason CHECK (status <> 'Rechazada' OR btrim(COALESCE(decision_reason, '')) <> '')
);
ALTER TABLE action_plan_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_extension_requests_plan ON action_plan_extension_requests (action_plan_id, id);
-- Un plan solo tiene una solicitud abierta a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_extension_requests_open
  ON action_plan_extension_requests (action_plan_id) WHERE status = 'Pendiente';
