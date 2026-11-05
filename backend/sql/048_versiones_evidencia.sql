-- Versiones de las evidencias editadas en la plataforma (UF-17, SF-08, historia #106).
-- Guardar desde el editor de Excel no sobrescribe el archivo: crea una versión nueva con
-- su propio hash. La fila de evidence siempre refleja la versión vigente (hash, tamaño y
-- clave de almacenamiento); evidence_versions guarda el historial completo, incluida la
-- versión 1 (el archivo original) a partir del primer guardado.
-- También se aceptan libros con macros (.xlsm); el editor avisa que las macros no son
-- compatibles y la versión guardada sale como .xlsx.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 027 y se aplica después de 040.

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE evidence DROP CONSTRAINT IF EXISTS ck_evidence_mime_type;
ALTER TABLE evidence ADD CONSTRAINT ck_evidence_mime_type
    CHECK (mime_type IN ('pdf', 'xlsx', 'xlsm', 'eml', 'msg', 'zip', '7z'));

CREATE TABLE IF NOT EXISTS evidence_versions (
    evidence_id   VARCHAR(50)    NOT NULL CONSTRAINT fk_evidence_versions_evidence REFERENCES evidence (id) ON DELETE CASCADE,
    version       INTEGER        NOT NULL CONSTRAINT ck_evidence_versions_version CHECK (version >= 1),
    file_name     VARCHAR(255)   NOT NULL,
    file_size     BIGINT         NOT NULL,
    file_hash     VARCHAR(128)   NOT NULL,
    storage_path  VARCHAR(500)   NOT NULL,
    uploaded_by   VARCHAR(100)   NULL,
    comentario    VARCHAR(500)   NULL,
    created_at    TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT pk_evidence_versions PRIMARY KEY (evidence_id, version)
);
ALTER TABLE evidence_versions ENABLE ROW LEVEL SECURITY;
