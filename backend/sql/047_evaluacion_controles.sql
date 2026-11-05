-- Evaluación de diseño y efectividad de controles (historia #98, SF-07).
-- Cada control de un plan tiene una evaluación, con una respuesta de 1 a 5 por criterio.
-- TBD: FEMSA no ha definido el modelo de madurez; estos 8 criterios son datos de prueba.
-- Se puede ejecutar más de una vez sin efecto.

CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id         INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_evaluation_criteria PRIMARY KEY,
    code       VARCHAR(10)   NOT NULL CONSTRAINT uq_evaluation_criteria_code UNIQUE,
    type       VARCHAR(15)   NOT NULL CONSTRAINT ck_evaluation_criteria_type CHECK (type IN ('diseno', 'efectividad')),
    name       VARCHAR(255)  NOT NULL,
    required   BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order INT           NOT NULL,
    active     BOOLEAN       NOT NULL DEFAULT TRUE
);
ALTER TABLE evaluation_criteria ENABLE ROW LEVEL SECURITY;

-- Las calificaciones se calculan en backend/src/domain/evaluaciones.ts y se guardan para
-- que el resultado no cambie si después cambian los criterios o los umbrales.
CREATE TABLE IF NOT EXISTS control_evaluations (
    id                 INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_control_evaluations PRIMARY KEY,
    audit_id           INT            NOT NULL CONSTRAINT fk_control_evaluations_audit REFERENCES audit_plans (id),
    control_id         VARCHAR(100)   NOT NULL CONSTRAINT fk_control_evaluations_control REFERENCES controls (id),
    design_score       NUMERIC(3,2)   NOT NULL CONSTRAINT ck_control_evaluations_design CHECK (design_score BETWEEN 1 AND 5),
    effectiveness_score NUMERIC(3,2)  NOT NULL CONSTRAINT ck_control_evaluations_effectiveness CHECK (effectiveness_score BETWEEN 1 AND 5),
    score              NUMERIC(3,2)   NOT NULL CONSTRAINT ck_control_evaluations_score CHECK (score BETWEEN 1 AND 5),
    result             VARCHAR(30)    NOT NULL CONSTRAINT ck_control_evaluations_result
                       CHECK (result IN ('Efectivo', 'Parcialmente efectivo', 'Deficiente')),
    has_deficiency     BOOLEAN        NOT NULL,
    evaluated_by       INT            NOT NULL CONSTRAINT fk_control_evaluations_evaluated_by REFERENCES users (id),
    evaluated_at       TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT uq_control_evaluations_control UNIQUE (audit_id, control_id)
);
ALTER TABLE control_evaluations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_control_evaluations_control_id ON control_evaluations (control_id);
CREATE INDEX IF NOT EXISTS ix_control_evaluations_evaluated_by ON control_evaluations (evaluated_by);

CREATE TABLE IF NOT EXISTS control_evaluation_answers (
    evaluation_id INT      NOT NULL CONSTRAINT fk_control_evaluation_answers_evaluation
                  REFERENCES control_evaluations (id) ON DELETE CASCADE,
    criterion_id  INT      NOT NULL CONSTRAINT fk_control_evaluation_answers_criterion
                  REFERENCES evaluation_criteria (id),
    value         SMALLINT NOT NULL CONSTRAINT ck_control_evaluation_answers_value CHECK (value BETWEEN 1 AND 5),
    CONSTRAINT pk_control_evaluation_answers PRIMARY KEY (evaluation_id, criterion_id)
);
ALTER TABLE control_evaluation_answers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_control_evaluation_answers_criterion_id ON control_evaluation_answers (criterion_id);

INSERT INTO evaluation_criteria (code, type, name, sort_order)
VALUES
    ('D1', 'diseno', 'El objetivo del control está ligado al riesgo', 1),
    ('D2', 'diseno', 'Tiene responsable y frecuencia definidos', 2),
    ('D3', 'diseno', 'El procedimiento está documentado', 3),
    ('D4', 'diseno', 'Puede prevenir o detectar el riesgo', 4),
    ('E1', 'efectividad', 'Se ejecutó con la frecuencia definida', 5),
    ('E2', 'efectividad', 'Lo ejecutó el responsable', 6),
    ('E3', 'efectividad', 'La evidencia es suficiente', 7),
    ('E4', 'efectividad', 'No hubo excepciones en la muestra', 8)
ON CONFLICT (code) DO NOTHING;
