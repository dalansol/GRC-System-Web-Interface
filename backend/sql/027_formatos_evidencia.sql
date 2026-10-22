-- Formatos de evidencia documental (SF-08): además de PDF y XLSX se aceptan correos
-- (.eml, .msg) y archivos comprimidos (.zip, .7z).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 001.

ALTER TABLE evidence DROP CONSTRAINT IF EXISTS ck_evidence_mime_type;
ALTER TABLE evidence ADD CONSTRAINT ck_evidence_mime_type
    CHECK (mime_type IN ('pdf', 'xlsx', 'eml', 'msg', 'zip', '7z'));
