-- La relación entre planes y hallazgos vive exclusivamente en la tabla puente.
CREATE TABLE IF NOT EXISTS action_plan_findings (
    action_plan_id INT NOT NULL
        CONSTRAINT fk_action_plan_findings_plan REFERENCES action_plans (id) ON DELETE CASCADE,
    finding_id VARCHAR(100) NOT NULL
        CONSTRAINT fk_action_plan_findings_finding REFERENCES findings (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT pk_action_plan_findings PRIMARY KEY (action_plan_id, finding_id)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'action_plans'
          AND column_name = 'finding_id'
    ) THEN
        INSERT INTO action_plan_findings (action_plan_id, finding_id)
        SELECT id, finding_id
        FROM action_plans
        WHERE finding_id IS NOT NULL
        ON CONFLICT DO NOTHING;

        ALTER TABLE action_plans
          DROP CONSTRAINT IF EXISTS fk_action_plans_finding,
          DROP COLUMN finding_id;
    END IF;
END $$;

ALTER TABLE action_plan_findings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_action_plan_findings_finding_id ON action_plan_findings (finding_id);
