-- Auditorías (SF-05). Solo los datos que necesitan los planes de acción: la fecha
-- de cierre es la que se compara con la fecha de compromiso (historia #91).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.

CREATE TABLE IF NOT EXISTS audits (
    id         VARCHAR(100)   NOT NULL CONSTRAINT pk_audits PRIMARY KEY,
    name       VARCHAR(255)   NOT NULL,
    end_date   DATE           NOT NULL,
    created_at TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- Auditorías de prueba (las mismas que AUDIT_RECORDS en mock_data.tsx y que usan los hallazgos de 005_seed_findings.sql).
INSERT INTO audits (id, name, end_date)
VALUES
    ('AUD-001', 'Auditoría SOX — Cuentas por Pagar', '2025-08-31'),
    ('AUD-002', 'Auditoría Operacional — Cadena de Suministro', '2025-05-30'),
    ('AUD-003', 'Auditoría de Cumplimiento — GDPR', '2025-11-30'),
    ('AUD-004', 'Auditoría Interna — Recursos Humanos', '2025-06-30')
ON CONFLICT (id) DO NOTHING;
