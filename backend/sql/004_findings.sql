-- Hallazgos (SF-09, SF-10). Tabla que usa src/routes/hallazgos.ts.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.
-- Las columnas conservan el camelCase que ya espera la ruta de hallazgos; en
-- PostgreSQL eso obliga a escribirlas entre comillas dobles en cada consulta.

CREATE TABLE IF NOT EXISTS findings (
    id              VARCHAR(100)   NOT NULL CONSTRAINT pk_findings PRIMARY KEY,
    folio           VARCHAR(50)    COLLATE sin_mayusculas NULL CONSTRAINT uq_findings_folio UNIQUE,
    title           VARCHAR(255)   NOT NULL,
    description     TEXT           NULL,
    type            VARCHAR(100)   NULL,
    severity        VARCHAR(20)    NOT NULL CONSTRAINT ck_findings_severity
                                   CHECK (severity IN ('Crítico', 'Alto', 'Medio', 'Bajo')),
    status          VARCHAR(30)    NOT NULL DEFAULT 'Abierto'
                                   CONSTRAINT ck_findings_status
                                   CHECK (status IN ('Abierto', 'En Proceso', 'En Revisión', 'Asignado', 'Cerrado')),
    "auditId"       VARCHAR(100)   NULL,
    "controlId"     VARCHAR(100)   NULL,
    "failedControl" VARCHAR(255)   NULL,
    "residualRisk"  VARCHAR(20)    NULL,
    "ownerId"       VARCHAR(100)   NULL,
    created_at      TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
