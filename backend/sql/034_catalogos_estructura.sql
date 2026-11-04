-- Catálogos editables de la estructura organizacional (SF-03): opciones de nombre de área y de
-- país o región de la subdivisión. Solo el Administrador las edita (Ajustes); los formularios del
-- Catálogo solo aceptan valores de aquí. La comparación usa `sin_mayusculas` (001), igual que los
-- nombres únicos de 025: ignora mayúsculas pero distingue acentos.
-- Precarga las opciones del Consolidado (hoja Catalogs) y los valores que ya usa la estructura,
-- para que todo lo registrado quede dentro del catálogo.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 001, 010 y 017.

CREATE TABLE IF NOT EXISTS structure_options (
    id         INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_structure_options PRIMARY KEY,
    kind       VARCHAR(10)    NOT NULL CONSTRAINT ck_structure_options_kind CHECK (kind IN ('area', 'pais')),
    value      VARCHAR(150)   COLLATE sin_mayusculas NOT NULL,
    created_at TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT uq_structure_options_kind_value UNIQUE (kind, value)
);
ALTER TABLE structure_options ENABLE ROW LEVEL SECURITY;

INSERT INTO structure_options (kind, value)
VALUES
    ('area', 'Administración y Finanzas'),
    ('area', 'Tecnología de la Información'),
    ('area', 'Recursos Humanos'),
    ('area', 'Operaciones'),
    ('area', 'Finanzas'),
    ('area', 'Sostenibilidad'),
    ('area', 'Cumplimiento'),
    ('area', 'Operativa'),
    ('area', 'Nómina'),
    ('area', 'Proveedores de Distribución'),
    ('area', 'Inventarios'),
    ('area', 'Proveedores'),
    ('area', 'Cadena de Suministro'),
    ('area', 'Equipo frío, envase y pallets'),
    ('area', 'Fletes'),
    ('area', 'Expansión e Infraestructura'),
    ('area', 'Sostenibilidad y Energía'),
    ('area', 'CAPEX'),
    ('area', 'Mantenimiento'),
    ('area', 'Comercial'),
    ('area', 'Gestión de clientes'),
    ('area', 'Manufactura'),
    ('area', 'Logística'),
    ('area', 'Gastos de combustible'),
    ('area', 'Gestión de maestro de clientes'),
    ('area', 'Gestión de proveedores de transporte'),
    ('area', 'Inventarios producto terminado'),
    ('area', 'Auditoría de envases'),
    ('area', 'Jurídico y Secretarías'),
    ('area', 'Distribuidores'),
    ('area', 'Gestión de crédito de clientes'),
    ('area', 'Transportes T1'),
    ('area', 'Herramientas digitales'),
    ('area', 'Plataformas Digitales'),
    ('area', 'Seguridad de la Información'),
    ('area', 'Auditoría'),
    ('area', 'Autoevaluación Controles SOX'),
    ('area', 'Evaluación Sistema de GRyC'),
    ('area', 'Partes relacionadas'),
    ('area', 'Deportiva'),
    ('area', 'Tecnología de Información'),
    ('area', 'Gestión de combustible'),
    ('area', 'Gestión de Terceros'),
    ('area', 'Compras'),
    ('pais', 'México'),
    ('pais', 'Brasil'),
    ('pais', 'Colombia'),
    ('pais', 'Guatemala'),
    ('pais', 'Corporativo'),
    ('pais', 'Venezuela'),
    ('pais', 'Argentina'),
    ('pais', 'Costa Rica'),
    ('pais', 'Panamá'),
    ('pais', 'Chile'),
    ('pais', 'Nicaragua'),
    ('pais', 'Uruguay'),
    ('pais', 'Alemania'),
    ('pais', 'Suiza'),
    ('pais', 'Ecuador'),
    ('pais', 'Centroamérica Sur'),
    ('pais', 'Perú'),
    ('pais', 'Estados Unidos'),
    ('pais', 'KFS RTR'),
    ('pais', 'KFS CM'),
    ('pais', 'KFS PF&R')
ON CONFLICT (kind, value) DO NOTHING;

-- Valores ya registrados que no venían en el Consolidado.
INSERT INTO structure_options (kind, value)
SELECT DISTINCT 'area', btrim(area_name) FROM area WHERE btrim(area_name) <> ''
ON CONFLICT (kind, value) DO NOTHING;

INSERT INTO structure_options (kind, value)
SELECT DISTINCT 'pais', btrim(country) FROM business WHERE country IS NOT NULL AND btrim(country) <> ''
ON CONFLICT (kind, value) DO NOTHING;
