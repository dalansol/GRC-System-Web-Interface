-- Planes de acción correctivos de un hallazgo (SF-10, SF-11; historia #91).
-- Un hallazgo tiene a lo más un plan. El responsable es un usuario registrado.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.

CREATE TABLE IF NOT EXISTS action_plans (
    id             INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_action_plans PRIMARY KEY,
    finding_id     VARCHAR(100)   NOT NULL CONSTRAINT fk_action_plans_finding REFERENCES findings (id)
                                  CONSTRAINT uq_action_plans_finding UNIQUE,
    description    VARCHAR(2000)  NOT NULL,
    responsible_id INT            NOT NULL CONSTRAINT fk_action_plans_responsible REFERENCES users (id),
    due_date       DATE           NOT NULL,
    status         VARCHAR(20)    NOT NULL DEFAULT 'Asignado'
                                  CONSTRAINT ck_action_plans_status
                                  CHECK (status IN ('Asignado', 'En Progreso', 'Completado')),
    created_by     INT            NOT NULL CONSTRAINT fk_action_plans_created_by REFERENCES users (id),
    created_at     TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_action_plans_responsible_id ON action_plans (responsible_id);
