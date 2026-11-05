-- Folio público de planes de acción: PACC-AAAA-NNN.
ALTER TABLE action_plans
  ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS uq_action_plans_public_id
  ON action_plans (public_id);

CREATE TABLE IF NOT EXISTS action_plan_public_id_counters (
    year         INT PRIMARY KEY,
    next_number  INT NOT NULL
);
ALTER TABLE action_plan_public_id_counters ENABLE ROW LEVEL SECURITY;

WITH numerados AS (
    SELECT id,
           EXTRACT(YEAR FROM created_at)::INT AS year,
           ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM created_at)
               ORDER BY created_at, id
           ) AS number
    FROM action_plans
    WHERE public_id IS NULL
)
UPDATE action_plans plan
SET public_id = 'PACC-' || numerados.year::TEXT || '-' || LPAD(numerados.number::TEXT, 3, '0')
FROM numerados
WHERE plan.id = numerados.id;

INSERT INTO action_plan_public_id_counters (year, next_number)
SELECT EXTRACT(YEAR FROM created_at)::INT, MAX(number) + 1
FROM (
    SELECT created_at,
           ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM created_at)
               ORDER BY created_at, id
           ) AS number
    FROM action_plans
) existentes
GROUP BY EXTRACT(YEAR FROM created_at)::INT
ON CONFLICT (year) DO UPDATE
SET next_number = GREATEST(action_plan_public_id_counters.next_number, EXCLUDED.next_number);

CREATE OR REPLACE FUNCTION generar_public_id_plan_accion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    year_value INT;
    number_value INT;
BEGIN
    year_value := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::INT;
    INSERT INTO action_plan_public_id_counters (year, next_number)
    VALUES (year_value, 2)
    ON CONFLICT (year)
    DO UPDATE SET next_number = action_plan_public_id_counters.next_number + 1
    RETURNING next_number - 1 INTO number_value;

    NEW.public_id := 'PACC-' || year_value::TEXT || '-' || LPAD(number_value::TEXT, 3, '0');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generar_public_id_plan_accion ON action_plans;
CREATE TRIGGER trg_generar_public_id_plan_accion
BEFORE INSERT ON action_plans
FOR EACH ROW
WHEN (NEW.public_id IS NULL)
EXECUTE FUNCTION generar_public_id_plan_accion();

ALTER TABLE action_plans
  ALTER COLUMN public_id SET NOT NULL;
