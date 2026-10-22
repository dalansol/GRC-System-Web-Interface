-- Permite retirar un proceso del catálogo sin perder controles históricos.
-- Los controles quedan registrados, pero dejan de apuntar al proceso eliminado.

ALTER TABLE controls
    DROP CONSTRAINT IF EXISTS fk_controls_process;

ALTER TABLE controls
    ADD CONSTRAINT fk_controls_process
    FOREIGN KEY (process_id) REFERENCES processes (id) ON DELETE SET NULL;
