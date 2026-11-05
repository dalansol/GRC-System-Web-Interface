-- Campos y pasos usados por el Portal del Auditado.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_unit_id INT NULL
  CONSTRAINT fk_users_business_unit REFERENCES business_units (id);

ALTER TABLE action_plans
  ADD COLUMN IF NOT EXISTS title VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS root_cause TEXT NULL;

CREATE TABLE IF NOT EXISTS action_plan_findings (
    action_plan_id INT NOT NULL
        CONSTRAINT fk_action_plan_findings_plan REFERENCES action_plans (id) ON DELETE CASCADE,
    finding_id VARCHAR(100) NOT NULL
        CONSTRAINT fk_action_plan_findings_finding REFERENCES findings (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT pk_action_plan_findings PRIMARY KEY (action_plan_id, finding_id)
);
ALTER TABLE action_plan_findings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_action_plan_findings_finding_id ON action_plan_findings (finding_id);

CREATE TABLE IF NOT EXISTS action_plan_steps (
    id              INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_action_plan_steps PRIMARY KEY,
    action_plan_id  INT NOT NULL CONSTRAINT fk_action_plan_steps_plan
                    REFERENCES action_plans (id) ON DELETE CASCADE,
    assigned_user_id INT NULL CONSTRAINT fk_action_plan_steps_user REFERENCES users (id),
    description     VARCHAR(2000) NOT NULL,
    due_date        DATE NULL,
    is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE action_plan_steps ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_action_plan_steps_plan ON action_plan_steps (action_plan_id);
