-- Auditorías (SF-05). Solo los datos que necesitan los planes de acción: la fecha
-- de cierre es la que se compara con la fecha de compromiso (historia #91).
-- Azure SQL / SQL Server. Se puede ejecutar más de una vez sin efecto.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID('dbo.audits', 'U') IS NULL
CREATE TABLE dbo.audits (
    id         NVARCHAR(100) NOT NULL CONSTRAINT pk_audits PRIMARY KEY,
    name       NVARCHAR(255) NOT NULL,
    end_date   DATE          NOT NULL,
    created_at DATETIME2(0)  NOT NULL CONSTRAINT df_audits_created_at DEFAULT SYSUTCDATETIME()
);

-- Auditorías de prueba (las mismas que AUDIT_RECORDS en mock_data.tsx y que usan los hallazgos de 005_seed_findings.sql).
INSERT INTO dbo.audits (id, name, end_date)
SELECT v.*
FROM (VALUES
    (N'AUD-001', N'Auditoría SOX — Cuentas por Pagar', CONVERT(DATE, '2025-08-31')),
    (N'AUD-002', N'Auditoría Operacional — Cadena de Suministro', CONVERT(DATE, '2025-05-30')),
    (N'AUD-003', N'Auditoría de Cumplimiento — GDPR', CONVERT(DATE, '2025-11-30')),
    (N'AUD-004', N'Auditoría Interna — Recursos Humanos', CONVERT(DATE, '2025-06-30'))
) AS v (id, name, end_date)
WHERE NOT EXISTS (SELECT 1 FROM dbo.audits a WHERE a.id = v.id);
