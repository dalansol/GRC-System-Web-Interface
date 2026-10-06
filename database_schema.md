```sql
-- 1. Independent Lookups & Catalogs

CREATE TABLE catalogs (
    catalog_id INT PRIMARY KEY,
    business VARCHAR(255),
    country VARCHAR(255)
);

CREATE TABLE catalog_department (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE catalog_domain (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    role VARCHAR(255)
);

CREATE TABLE risk_library (
    riskLibrary_id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE audit_status (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);

CREATE TABLE audit_procedure_type (
    id INT PRIMARY KEY,
    name VARCHAR(255)
);


-- 2. Catalog Extensions & Core Governance Entities

CREATE TABLE division (
    division_id INT PRIMARY KEY,
    name VARCHAR(255),
    catalog_id INT,
    FOREIGN KEY (catalog_id) REFERENCES catalogs(catalog_id)
);

CREATE TABLE business (
    business_id INT PRIMARY KEY,
    business_name VARCHAR(255),
    catalog_id INT,
    FOREIGN KEY (catalog_id) REFERENCES catalogs(catalog_id)
);

CREATE TABLE business_unit (
    businessUnit_id INT PRIMARY KEY,
    name VARCHAR(255),
    catalog_id INT,
    FOREIGN KEY (catalog_id) REFERENCES catalogs(catalog_id)
);

CREATE TABLE area (
    area_id INT PRIMARY KEY,
    area_name VARCHAR(255),
    catalog_id INT,
    FOREIGN KEY (catalog_id) REFERENCES catalogs(catalog_id)
);

CREATE TABLE control_procedure (
    controlProcedures_id INT PRIMARY KEY,
    description VARCHAR(255),
    catalog_id INT,
    FOREIGN KEY (catalog_id) REFERENCES catalogs(catalog_id)
);

CREATE TABLE audit_entity (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    department_id INT,
    domain_id INT,
    FOREIGN KEY (department_id) REFERENCES catalog_department(id),
    FOREIGN KEY (domain_id) REFERENCES catalog_domain(id)
);

CREATE TABLE controls (
    id INT PRIMARY KEY,
    code VARCHAR(255),
    name VARCHAR(255),
    owner_id INT,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE audits (
    id INT PRIMARY KEY,
    code VARCHAR(255),
    name VARCHAR(255),
    owner_id INT,
    status VARCHAR(255),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);


-- 3. Risk Management & Planning

CREATE TABLE risk_register (
    riskRegister_id INT PRIMARY KEY,
    catalog_id INT,
    riskLibrary_id INT,
    controlProcedures_id INT,
    FOREIGN KEY (catalog_id) REFERENCES catalogs(catalog_id),
    FOREIGN KEY (riskLibrary_id) REFERENCES risk_library(riskLibrary_id),
    FOREIGN KEY (controlProcedures_id) REFERENCES control_procedure(controlProcedures_id)
);

CREATE TABLE audit_plan (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    fiscal_period VARCHAR(255),
    department_id INT,
    status_id INT,
    created_by INT,
    FOREIGN KEY (department_id) REFERENCES catalog_department(id),
    FOREIGN KEY (status_id) REFERENCES audit_status(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);


-- 4. Audit Execution & Engagement

CREATE TABLE audit_engagement (
    id INT PRIMARY KEY,
    code VARCHAR(255),
    audit_plan_id INT,
    audit_entity_id INT,
    department_id INT,
    domain_id INT,
    lead_auditor_id INT,
    status_id INT,
    FOREIGN KEY (audit_plan_id) REFERENCES audit_plan(id),
    FOREIGN KEY (audit_entity_id) REFERENCES audit_entity(id),
    FOREIGN KEY (department_id) REFERENCES catalog_department(id),
    FOREIGN KEY (domain_id) REFERENCES catalog_domain(id),
    FOREIGN KEY (lead_auditor_id) REFERENCES users(id),
    FOREIGN KEY (status_id) REFERENCES audit_status(id)
);

CREATE TABLE audit_engagement_team (
    id INT PRIMARY KEY,
    audit_engagement_id INT,
    auditor_id INT,
    role_in_engagement VARCHAR(255),
    FOREIGN KEY (audit_engagement_id) REFERENCES audit_engagement(id),
    FOREIGN KEY (auditor_id) REFERENCES users(id)
);

CREATE TABLE audit_procedures (
    id INT PRIMARY KEY,
    code VARCHAR(255),
    audit_engagement_id INT,
    procedure_type_id INT,
    department_id INT,
    domain_id INT,
    assigned_to INT,
    status_id INT,
    FOREIGN KEY (audit_engagement_id) REFERENCES audit_engagement(id),
    FOREIGN KEY (procedure_type_id) REFERENCES audit_procedure_type(id),
    FOREIGN KEY (department_id) REFERENCES catalog_department(id),
    FOREIGN KEY (domain_id) REFERENCES catalog_domain(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (status_id) REFERENCES audit_status(id)
);

CREATE TABLE audit_controls (
    id INT PRIMARY KEY,
    audit_id INT,
    control_id INT,
    auditor_id INT,
    FOREIGN KEY (audit_id) REFERENCES audits(id),
    FOREIGN KEY (control_id) REFERENCES controls(id),
    FOREIGN KEY (auditor_id) REFERENCES users(id)
);


-- 5. Findings, Evidences & Remediation

CREATE TABLE findings (
    id INT PRIMARY KEY,
    title VARCHAR(255),
    severity VARCHAR(255),
    status VARCHAR(255),
    audit_id INT,
    control_id INT,
    owner_id INT,
    FOREIGN KEY (audit_id) REFERENCES audits(id),
    FOREIGN KEY (control_id) REFERENCES controls(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE evidence (
    id INT PRIMARY KEY,
    file_name VARCHAR(255),
    audit_id INT,
    control_id INT,
    finding_id INT,
    FOREIGN KEY (audit_id) REFERENCES audits(id),
    FOREIGN KEY (control_id) REFERENCES controls(id),
    FOREIGN KEY (finding_id) REFERENCES findings(id)
);

CREATE TABLE action_plans (
    id INT PRIMARY KEY,
    description VARCHAR(255),
    status VARCHAR(255),
    due_date DATE,
    finding_id INT,
    owner_id INT,
    FOREIGN KEY (finding_id) REFERENCES findings(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);
```
```sql
-- 1. Independent Lookups & Catalogs

INSERT INTO catalogs (catalog_id, business, country) VALUES
(1, 'KOF', 'MX'), 
(2, 'Spin', 'MX'), 
(3, 'Proximidad', 'MX'), 
(4, 'Femsa Salud', 'MX'), 
(5, 'Coca-Cola', 'MX'), 
(6, 'Heineken', 'MX'), 
(7, 'OXXO', 'MX'), 
(8, 'Andatti', 'MX'), 
(9, 'Valle Fresco', 'MX'), 
(10, 'Jugos del Valle', 'MX');

INSERT INTO catalog_department (id, name) VALUES
(1, 'Finanzas'), 
(2, 'Operaciones'), 
(3, 'TI'), 
(4, 'Recursos Humanos'), 
(5, 'Legal'), 
(6, 'Cadena de Suministro'), 
(7, 'Ventas'), 
(8, 'Marketing'), 
(9, 'Calidad'), 
(10, 'Seguridad');

INSERT INTO catalog_domain (id, name) VALUES
(1, 'Cumplimiento'), 
(2, 'Financiero'), 
(3, 'Operativo'), 
(4, 'Tecnologico'), 
(5, 'Legal'), 
(6, 'Ambiental'), 
(7, 'Laboral'), 
(8, 'Fiscal'), 
(9, 'Anticorrupcion'), 
(10, 'Ciberseguridad');

INSERT INTO users (id, name, role) VALUES
(1, 'Andre Garcia', 'Lead Auditor'),
(2, 'Marina Lopez', 'auditor'),
(3, 'Diego Ramirez', 'auditee'),
(4, 'Sofia Torres', 'manager'),
(5, 'Luis Hernandez', 'director'),
(6, 'Karla Mendoza', 'auditor'),
(7, 'Emiliano Ruiz', 'Reviewer'),
(8, 'Rafael Castro', 'auditor'),
(9, 'Magda Nunez', 'manager'),
(10, 'Cleber Souza', 'auditee');

INSERT INTO risk_library (riskLibrary_id, name) VALUES
(1, 'Fraude Financiero'), 
(2, 'Fuga de Informacion'), 
(3, 'Incumplimiento Regulatorio'), 
(4, 'Riesgo Operativo'), 
(5, 'Riesgo Reputacional'), 
(6, 'Riesgo Cibernetico'), 
(7, 'Riesgo Laboral'), 
(8, 'Riesgo Ambiental'), 
(9, 'Riesgo Fiscal'), 
(10, 'Riesgo de Proveedores');

INSERT INTO audit_status (id, name) VALUES
(1, 'Planeado'), 
(2, 'En progreso'), 
(3, 'Cerrado'), 
(4, 'Cancelado'), 
(5, 'En revision'), 
(6, 'Aprobado'), 
(7, 'Rechazado'), 
(8, 'Pendiente'), 
(9, 'En espera'), 
(10, 'Finalizado');

INSERT INTO audit_procedure_type (id, name) VALUES
(1, 'Walkthrough'), 
(2, 'Prueba de control'), 
(3, 'Inspeccion'), 
(4, 'Entrevista'), 
(5, 'Observacion'), 
(6, 'Recalculo'), 
(7, 'Confirmacion'), 
(8, 'Analisis documental'), 
(9, 'Muestreo'), 
(10, 'Revision analitica');


-- 2. Catalog Extensions & Core Governance Entities

INSERT INTO division (division_id, name, catalog_id) VALUES
(1, 'Division 1', 1),
(2, 'Division 2', 2),
(3, 'Division 3', 3),
(4, 'Division 4', 4),
(5, 'Division 5', 5),
(6, 'Division 6', 6),
(7, 'Division 7', 7),
(8, 'Division 8', 8),
(9, 'Division 9', 9),
(10, 'Division 10', 10);

INSERT INTO business (business_id, business_name, catalog_id) VALUES
(1, 'Business 1', 1),
(2, 'Business 2', 2),
(3, 'Business 3', 3),
(4, 'Business 4', 4),
(5, 'Business 5', 5),
(6, 'Business 6', 6),
(7, 'Business 7', 7),
(8, 'Business 8', 8),
(9, 'Business 9', 9),
(10, 'Business 10', 10);

INSERT INTO business_unit (businessUnit_id, name, catalog_id) VALUES
(1, 'KOF', 1),
(2, 'Proximidad', 2),
(3, 'Spin', 3),
(4, 'Femsa Salux', 4),
(5, 'Coca-Cola FEMSA', 5),
(6, 'Heineken Mexico', 6),
(7, 'OXXO Gas', 7),
(8, 'Envoy Solutions', 8),
(9, 'Jugos del Valle', 9),
(10, 'Andatti', 10);

INSERT INTO area (area_id, area_name, catalog_id) VALUES
(1, 'Area 1', 1),
(2, 'Area 2', 2),
(3, 'Area 3', 3),
(4, 'Area 4', 4),
(5, 'Area 5', 5),
(6, 'Area 6', 6),
(7, 'Area 7', 7),
(8, 'Area 8', 8),
(9, 'Area 9', 9),
(10, 'Area 10', 10);

INSERT INTO control_procedure (controlProcedures_id, description, catalog_id) VALUES
(1, 'Paso 1 de verificacion', 1),
(2, 'Paso 2 de verificacion', 2),
(3, 'Paso 3 de verificacion', 3),
(4, 'Paso 4 de verificacion', 4),
(5, 'Paso 5 de verificacion', 5),
(6, 'Paso 6 de verificacion', 6),
(7, 'Paso 7 de verificacion', 7),
(8, 'Paso 8 de verificacion', 8),
(9, 'Paso 9 de verificacion', 9),
(10, 'Paso 10 de verificacion', 10);

INSERT INTO audit_entity (id, name, department_id, domain_id) VALUES
(1, 'Planta Monterrey', 1, 1),
(2, 'Centro de Datos TI', 2, 2),
(3, 'Oficinas Corporativas', 3, 3),
(4, 'Planta Guadalajara', 4, 4),
(5, 'Centro de Distribucion Norte', 5, 5),
(6, 'Planta Toluca', 6, 6),
(7, 'Oficina Regional Bajio', 7, 7),
(8, 'Almacen Central', 8, 8),
(9, 'Planta Merida', 9, 9),
(10, 'Centro de Atencion a Clientes', 10, 10);

INSERT INTO controls (id, code, name, owner_id) VALUES
(1, 'CTRL-001', 'Control 1', 1),
(2, 'CTRL-002', 'Control 2', 2),
(3, 'CTRL-003', 'Control 3', 3),
(4, 'CTRL-004', 'Control 4', 4),
(5, 'CTRL-005', 'Control 5', 5),
(6, 'CTRL-006', 'Control 6', 6),
(7, 'CTRL-007', 'Control 7', 7),
(8, 'CTRL-008', 'Control 8', 8),
(9, 'CTRL-009', 'Control 9', 9),
(10, 'CTRL-010', 'Control 10', 10);

INSERT INTO audits (id, code, name, owner_id, status) VALUES
(1, 'AUD-001', 'Auditoria 1', 1, 'in_execution'),
(2, 'AUD-002', 'Auditoria 2', 2, 'in_closing'),
(3, 'AUD-003', 'Auditoria 3', 3, 'closed'),
(4, 'AUD-004', 'Auditoria 4', 4, 'pending'),
(5, 'AUD-005', 'Auditoria 5', 5, 'in_execution'),
(6, 'AUD-006', 'Auditoria 6', 6, 'in_closing'),
(7, 'AUD-007', 'Auditoria 7', 7, 'closed'),
(8, 'AUD-008', 'Auditoria 8', 8, 'pending'),
(9, 'AUD-009', 'Auditoria 9', 9, 'in_execution'),
(10, 'AUD-010', 'Auditoria 10', 10, 'in_closing');


-- 3. Risk Management & Planning

-- Fixed: Removed non-existent audit_department and audit_domain columns
INSERT INTO risk_register (riskRegister_id, catalog_id, riskLibrary_id, controlProcedures_id) VALUES
(1, 1, 1, 1),
(2, 2, 2, 2),
(3, 3, 3, 3),
(4, 4, 4, 4),
(5, 5, 5, 5),
(6, 6, 6, 6),
(7, 7, 7, 7),
(8, 8, 8, 8),
(9, 9, 9, 9),
(10, 10, 10, 10);

INSERT INTO audit_plan (id, name, fiscal_period, department_id, status_id, created_by) VALUES
(1, 'Plan Anual 2021', 'Q2-2021', 1, 1, 1),
(2, 'Plan Anual 2022', 'Q3-2022', 2, 2, 2),
(3, 'Plan Anual 2023', 'Q4-2023', 3, 3, 3),
(4, 'Plan Anual 2024', 'Q1-2024', 4, 4, 4),
(5, 'Plan Anual 2025', 'Q2-2025', 5, 5, 5),
(6, 'Plan Anual 2026', 'Q3-2026', 6, 6, 6),
(7, 'Plan Anual 2027', 'Q4-2027', 7, 7, 7),
(8, 'Plan Anual 2028', 'Q1-2028', 8, 8, 8),
(9, 'Plan Anual 2029', 'Q2-2029', 9, 9, 9),
(10, 'Plan Anual 2030', 'Q3-2030', 10, 10, 10);


-- 4. Audit Execution & Engagement

INSERT INTO audit_engagement (id, code, audit_plan_id, audit_entity_id, department_id, domain_id, lead_auditor_id, status_id) VALUES
(1, 'ENG-2026-001', 1, 1, 1, 1, 1, 1),
(2, 'ENG-2026-002', 2, 2, 2, 2, 2, 2),
(3, 'ENG-2026-003', 3, 3, 3, 3, 3, 3),
(4, 'ENG-2026-004', 4, 4, 4, 4, 4, 4),
(5, 'ENG-2026-005', 5, 5, 5, 5, 5, 5),
(6, 'ENG-2026-006', 6, 6, 6, 6, 6, 6),
(7, 'ENG-2026-007', 7, 7, 7, 7, 7, 7),
(8, 'ENG-2026-008', 8, 8, 8, 8, 8, 8),
(9, 'ENG-2026-009', 9, 9, 9, 9, 9, 9),
(10, 'ENG-2026-010', 10, 10, 10, 10, 10, 10);

INSERT INTO audit_engagement_team (id, audit_engagement_id, auditor_id, role_in_engagement) VALUES
(1, 1, 1, 'Lead Auditor'),
(2, 2, 2, 'Field Auditor'),
(3, 3, 3, 'Reviewer'),
(4, 4, 4, 'Field Auditor'),
(5, 5, 5, 'Lead Auditor'),
(6, 6, 6, 'Reviewer'),
(7, 7, 7, 'Field Auditor'),
(8, 8, 8, 'Lead Auditor'),
(9, 9, 9, 'Reviewer'),
(10, 10, 10, 'Field Auditor');

INSERT INTO audit_procedures (id, code, audit_engagement_id, procedure_type_id, department_id, domain_id, assigned_to, status_id) VALUES
(1, 'PROC-001', 1, 1, 1, 1, 1, 1),
(2, 'PROC-002', 2, 2, 2, 2, 2, 2),
(3, 'PROC-003', 3, 3, 3, 3, 3, 3),
(4, 'PROC-004', 4, 4, 4, 4, 4, 4),
(5, 'PROC-005', 5, 5, 5, 5, 5, 5),
(6, 'PROC-006', 6, 6, 6, 6, 6, 6),
(7, 'PROC-007', 7, 7, 7, 7, 7, 7),
(8, 'PROC-008', 8, 8, 8, 8, 8, 8),
(9, 'PROC-009', 9, 9, 9, 9, 9, 9),
(10, 'PROC-010', 10, 10, 10, 10, 10, 10);

INSERT INTO audit_controls (id, audit_id, control_id, auditor_id) VALUES
(1, 1, 1, 1),
(2, 2, 2, 2),
(3, 3, 3, 3),
(4, 4, 4, 4),
(5, 5, 5, 5),
(6, 6, 6, 6),
(7, 7, 7, 7),
(8, 8, 8, 8),
(9, 9, 9, 9),
(10, 10, 10, 10);


-- 5. Findings, Evidence & Action Plans

INSERT INTO findings (id, title, severity, status, audit_id, control_id, owner_id) VALUES
(1, 'Hallazgo 1', 'medium', 'action_plan', 1, 1, 1),
(2, 'Hallazgo 2', 'high', 'follow_up', 2, 2, 2),
(3, 'Hallazgo 3', 'critical', 'closed', 3, 3, 3),
(4, 'Hallazgo 4', 'low', 'open', 4, 4, 4),
(5, 'Hallazgo 5', 'medium', 'action_plan', 5, 5, 5),
(6, 'Hallazgo 6', 'high', 'follow_up', 6, 6, 6),
(7, 'Hallazgo 7', 'critical', 'closed', 7, 7, 7),
(8, 'Hallazgo 8', 'low', 'open', 8, 8, 8),
(9, 'Hallazgo 9', 'medium', 'action_plan', 9, 9, 9),
(10, 'Hallazgo 10', 'high', 'follow_up', 10, 10, 10);

INSERT INTO evidence (id, file_name, audit_id, control_id, finding_id) VALUES
(1, 'evidencia_1.pdf', 1, 1, 1),
(2, 'evidencia_2.pdf', 2, 2, 2),
(3, 'evidencia_3.pdf', 3, 3, 3),
(4, 'evidencia_4.pdf', 4, 4, 4),
(5, 'evidencia_5.pdf', 5, 5, 5),
(6, 'evidencia_6.pdf', 6, 6, 6),
(7, 'evidencia_7.pdf', 7, 7, 7),
(8, 'evidencia_8.pdf', 8, 8, 8),
(9, 'evidencia_9.pdf', 9, 9, 9),
(10, 'evidencia_10.pdf', 10, 10, 10);

INSERT INTO action_plans (id, description, status, due_date, finding_id, owner_id) VALUES
(1, 'Plan de accion para hallazgo 1', 'in_progress', '2026-11-15', 1, 1),
(2, 'Plan de accion para hallazgo 2', 'overdue', '2026-10-15', 2, 2),
(3, 'Plan de accion para hallazgo 3', 'completed', '2026-11-15', 3, 3),
(4, 'Plan de accion para hallazgo 4', 'validated', '2026-10-15', 4, 4),
(5, 'Plan de accion para hallazgo 5', 'pending', '2026-11-15', 5, 5),
(6, 'Plan de accion para hallazgo 6', 'in_progress', '2026-10-15', 6, 6),
(7, 'Plan de accion para hallazgo 7', 'overdue', '2026-11-15', 7, 7),
(8, 'Plan de accion para hallazgo 8', 'completed', '2026-10-15', 8, 8),
(9, 'Plan de accion para hallazgo 9', 'validated', '2026-11-15', 9, 9),
(10, 'Plan de accion para hallazgo 10', 'pending', '2026-10-15', 10, 10);

```
> ``` status
> 240 rows affected
> ```

```sql
SELECT * FROM catalogs;
SELECT * FROM catalog_department;
SELECT * FROM catalog_domain;
SELECT * FROM users;
SELECT * FROM risk_library;
SELECT * FROM audit_status;
SELECT * FROM audit_procedure_type;
SELECT * FROM division;
SELECT * FROM business;
SELECT * FROM business_unit;
SELECT * FROM area;
SELECT * FROM control_procedure;
SELECT * FROM audit_entity;
SELECT * FROM controls;
SELECT * FROM audits;
SELECT * FROM risk_register;
SELECT * FROM audit_plan;
SELECT * FROM audit_engagement;
SELECT * FROM audit_engagement_team;
SELECT * FROM audit_procedures;
SELECT * FROM audit_controls;
SELECT * FROM findings;
SELECT * FROM evidence;
SELECT * FROM action_plans;
```
| catalog\_id | business | country |
|-----------:|:---------|:--------|
| 1 | KOF | MX |
| 2 | Spin | MX |
| 3 | Proximidad | MX |
| 4 | Femsa Salud | MX |
| 5 | Coca-Cola | MX |
| 6 | Heineken | MX |
| 7 | OXXO | MX |
| 8 | Andatti | MX |
| 9 | Valle Fresco | MX |
| 10 | Jugos del Valle | MX |

| id | name |
|---:|:-----|
| 1 | Finanzas |
| 2 | Operaciones |
| 3 | TI |
| 4 | Recursos Humanos |
| 5 | Legal |
| 6 | Cadena de Suministro |
| 7 | Ventas |
| 8 | Marketing |
| 9 | Calidad |
| 10 | Seguridad |

| id | name |
|---:|:-----|
| 1 | Cumplimiento |
| 2 | Financiero |
| 3 | Operativo |
| 4 | Tecnologico |
| 5 | Legal |
| 6 | Ambiental |
| 7 | Laboral |
| 8 | Fiscal |
| 9 | Anticorrupcion |
| 10 | Ciberseguridad |

| id | name | role |
|---:|:-----|:-----|
| 1 | Andre Garcia | Lead Auditor |
| 2 | Marina Lopez | auditor |
| 3 | Diego Ramirez | auditee |
| 4 | Sofia Torres | manager |
| 5 | Luis Hernandez | director |
| 6 | Karla Mendoza | auditor |
| 7 | Emiliano Ruiz | Reviewer |
| 8 | Rafael Castro | auditor |
| 9 | Magda Nunez | manager |
| 10 | Cleber Souza | auditee |

| riskLibrary\_id | name |
|---------------:|:-----|
| 1 | Fraude Financiero |
| 2 | Fuga de Informacion |
| 3 | Incumplimiento Regulatorio |
| 4 | Riesgo Operativo |
| 5 | Riesgo Reputacional |
| 6 | Riesgo Cibernetico |
| 7 | Riesgo Laboral |
| 8 | Riesgo Ambiental |
| 9 | Riesgo Fiscal |
| 10 | Riesgo de Proveedores |

| id | name |
|---:|:-----|
| 1 | Planeado |
| 2 | En progreso |
| 3 | Cerrado |
| 4 | Cancelado |
| 5 | En revision |
| 6 | Aprobado |
| 7 | Rechazado |
| 8 | Pendiente |
| 9 | En espera |
| 10 | Finalizado |

| id | name |
|---:|:-----|
| 1 | Walkthrough |
| 2 | Prueba de control |
| 3 | Inspeccion |
| 4 | Entrevista |
| 5 | Observacion |
| 6 | Recalculo |
| 7 | Confirmacion |
| 8 | Analisis documental |
| 9 | Muestreo |
| 10 | Revision analitica |

| division\_id | name | catalog\_id |
|------------:|:-----|-----------:|
| 1 | Division 1 | 1 |
| 2 | Division 2 | 2 |
| 3 | Division 3 | 3 |
| 4 | Division 4 | 4 |
| 5 | Division 5 | 5 |
| 6 | Division 6 | 6 |
| 7 | Division 7 | 7 |
| 8 | Division 8 | 8 |
| 9 | Division 9 | 9 |
| 10 | Division 10 | 10 |

| business\_id | business\_name | catalog\_id |
|------------:|:--------------|-----------:|
| 1 | Business 1 | 1 |
| 2 | Business 2 | 2 |
| 3 | Business 3 | 3 |
| 4 | Business 4 | 4 |
| 5 | Business 5 | 5 |
| 6 | Business 6 | 6 |
| 7 | Business 7 | 7 |
| 8 | Business 8 | 8 |
| 9 | Business 9 | 9 |
| 10 | Business 10 | 10 |

| businessUnit\_id | name | catalog\_id |
|----------------:|:-----|-----------:|
| 1 | KOF | 1 |
| 2 | Proximidad | 2 |
| 3 | Spin | 3 |
| 4 | Femsa Salux | 4 |
| 5 | Coca-Cola FEMSA | 5 |
| 6 | Heineken Mexico | 6 |
| 7 | OXXO Gas | 7 |
| 8 | Envoy Solutions | 8 |
| 9 | Jugos del Valle | 9 |
| 10 | Andatti | 10 |

| area\_id | area\_name | catalog\_id |
|--------:|:----------|-----------:|
| 1 | Area 1 | 1 |
| 2 | Area 2 | 2 |
| 3 | Area 3 | 3 |
| 4 | Area 4 | 4 |
| 5 | Area 5 | 5 |
| 6 | Area 6 | 6 |
| 7 | Area 7 | 7 |
| 8 | Area 8 | 8 |
| 9 | Area 9 | 9 |
| 10 | Area 10 | 10 |

| controlProcedures\_id | description | catalog\_id |
|---------------------:|:------------|-----------:|
| 1 | Paso 1 de verificacion | 1 |
| 2 | Paso 2 de verificacion | 2 |
| 3 | Paso 3 de verificacion | 3 |
| 4 | Paso 4 de verificacion | 4 |
| 5 | Paso 5 de verificacion | 5 |
| 6 | Paso 6 de verificacion | 6 |
| 7 | Paso 7 de verificacion | 7 |
| 8 | Paso 8 de verificacion | 8 |
| 9 | Paso 9 de verificacion | 9 |
| 10 | Paso 10 de verificacion | 10 |

| id | name | department\_id | domain\_id |
|---:|:-----|--------------:|----------:|
| 1 | Planta Monterrey | 1 | 1 |
| 2 | Centro de Datos TI | 2 | 2 |
| 3 | Oficinas Corporativas | 3 | 3 |
| 4 | Planta Guadalajara | 4 | 4 |
| 5 | Centro de Distribucion Norte | 5 | 5 |
| 6 | Planta Toluca | 6 | 6 |
| 7 | Oficina Regional Bajio | 7 | 7 |
| 8 | Almacen Central | 8 | 8 |
| 9 | Planta Merida | 9 | 9 |
| 10 | Centro de Atencion a Clientes | 10 | 10 |

| id | code | name | owner\_id |
|---:|:-----|:-----|---------:|
| 1 | CTRL-001 | Control 1 | 1 |
| 2 | CTRL-002 | Control 2 | 2 |
| 3 | CTRL-003 | Control 3 | 3 |
| 4 | CTRL-004 | Control 4 | 4 |
| 5 | CTRL-005 | Control 5 | 5 |
| 6 | CTRL-006 | Control 6 | 6 |
| 7 | CTRL-007 | Control 7 | 7 |
| 8 | CTRL-008 | Control 8 | 8 |
| 9 | CTRL-009 | Control 9 | 9 |
| 10 | CTRL-010 | Control 10 | 10 |

| id | code | name | owner\_id | status |
|---:|:-----|:-----|---------:|:-------|
| 1 | AUD-001 | Auditoria 1 | 1 | in\_execution |
| 2 | AUD-002 | Auditoria 2 | 2 | in\_closing |
| 3 | AUD-003 | Auditoria 3 | 3 | closed |
| 4 | AUD-004 | Auditoria 4 | 4 | pending |
| 5 | AUD-005 | Auditoria 5 | 5 | in\_execution |
| 6 | AUD-006 | Auditoria 6 | 6 | in\_closing |
| 7 | AUD-007 | Auditoria 7 | 7 | closed |
| 8 | AUD-008 | Auditoria 8 | 8 | pending |
| 9 | AUD-009 | Auditoria 9 | 9 | in\_execution |
| 10 | AUD-010 | Auditoria 10 | 10 | in\_closing |

| riskRegister\_id | catalog\_id | riskLibrary\_id | controlProcedures\_id |
|----------------:|-----------:|---------------:|---------------------:|
| 1 | 1 | 1 | 1 |
| 2 | 2 | 2 | 2 |
| 3 | 3 | 3 | 3 |
| 4 | 4 | 4 | 4 |
| 5 | 5 | 5 | 5 |
| 6 | 6 | 6 | 6 |
| 7 | 7 | 7 | 7 |
| 8 | 8 | 8 | 8 |
| 9 | 9 | 9 | 9 |
| 10 | 10 | 10 | 10 |

| id | name | fiscal\_period | department\_id | status\_id | created\_by |
|---:|:-----|:--------------|--------------:|----------:|-----------:|
| 1 | Plan Anual 2021 | Q2-2021 | 1 | 1 | 1 |
| 2 | Plan Anual 2022 | Q3-2022 | 2 | 2 | 2 |
| 3 | Plan Anual 2023 | Q4-2023 | 3 | 3 | 3 |
| 4 | Plan Anual 2024 | Q1-2024 | 4 | 4 | 4 |
| 5 | Plan Anual 2025 | Q2-2025 | 5 | 5 | 5 |
| 6 | Plan Anual 2026 | Q3-2026 | 6 | 6 | 6 |
| 7 | Plan Anual 2027 | Q4-2027 | 7 | 7 | 7 |
| 8 | Plan Anual 2028 | Q1-2028 | 8 | 8 | 8 |
| 9 | Plan Anual 2029 | Q2-2029 | 9 | 9 | 9 |
| 10 | Plan Anual 2030 | Q3-2030 | 10 | 10 | 10 |

| id | code | audit\_plan\_id | audit\_entity\_id | department\_id | domain\_id | lead\_auditor\_id | status\_id |
|---:|:-----|--------------:|----------------:|--------------:|----------:|----------------:|----------:|
| 1 | ENG-2026-001 | 1 | 1 | 1 | 1 | 1 | 1 |
| 2 | ENG-2026-002 | 2 | 2 | 2 | 2 | 2 | 2 |
| 3 | ENG-2026-003 | 3 | 3 | 3 | 3 | 3 | 3 |
| 4 | ENG-2026-004 | 4 | 4 | 4 | 4 | 4 | 4 |
| 5 | ENG-2026-005 | 5 | 5 | 5 | 5 | 5 | 5 |
| 6 | ENG-2026-006 | 6 | 6 | 6 | 6 | 6 | 6 |
| 7 | ENG-2026-007 | 7 | 7 | 7 | 7 | 7 | 7 |
| 8 | ENG-2026-008 | 8 | 8 | 8 | 8 | 8 | 8 |
| 9 | ENG-2026-009 | 9 | 9 | 9 | 9 | 9 | 9 |
| 10 | ENG-2026-010 | 10 | 10 | 10 | 10 | 10 | 10 |

| id | audit\_engagement\_id | auditor\_id | role\_in\_engagement |
|---:|--------------------:|-----------:|:-------------------|
| 1 | 1 | 1 | Lead Auditor |
| 2 | 2 | 2 | Field Auditor |
| 3 | 3 | 3 | Reviewer |
| 4 | 4 | 4 | Field Auditor |
| 5 | 5 | 5 | Lead Auditor |
| 6 | 6 | 6 | Reviewer |
| 7 | 7 | 7 | Field Auditor |
| 8 | 8 | 8 | Lead Auditor |
| 9 | 9 | 9 | Reviewer |
| 10 | 10 | 10 | Field Auditor |

| id | code | audit\_engagement\_id | procedure\_type\_id | department\_id | domain\_id | assigned\_to | status\_id |
|---:|:-----|--------------------:|------------------:|--------------:|----------:|------------:|----------:|
| 1 | PROC-001 | 1 | 1 | 1 | 1 | 1 | 1 |
| 2 | PROC-002 | 2 | 2 | 2 | 2 | 2 | 2 |
| 3 | PROC-003 | 3 | 3 | 3 | 3 | 3 | 3 |
| 4 | PROC-004 | 4 | 4 | 4 | 4 | 4 | 4 |
| 5 | PROC-005 | 5 | 5 | 5 | 5 | 5 | 5 |
| 6 | PROC-006 | 6 | 6 | 6 | 6 | 6 | 6 |
| 7 | PROC-007 | 7 | 7 | 7 | 7 | 7 | 7 |
| 8 | PROC-008 | 8 | 8 | 8 | 8 | 8 | 8 |
| 9 | PROC-009 | 9 | 9 | 9 | 9 | 9 | 9 |
| 10 | PROC-010 | 10 | 10 | 10 | 10 | 10 | 10 |

| id | audit\_id | control\_id | auditor\_id |
|---:|---------:|-----------:|-----------:|
| 1 | 1 | 1 | 1 |
| 2 | 2 | 2 | 2 |
| 3 | 3 | 3 | 3 |
| 4 | 4 | 4 | 4 |
| 5 | 5 | 5 | 5 |
| 6 | 6 | 6 | 6 |
| 7 | 7 | 7 | 7 |
| 8 | 8 | 8 | 8 |
| 9 | 9 | 9 | 9 |
| 10 | 10 | 10 | 10 |

| id | title | severity | status | audit\_id | control\_id | owner\_id |
|---:|:------|:---------|:-------|---------:|-----------:|---------:|
| 1 | Hallazgo 1 | medium | action\_plan | 1 | 1 | 1 |
| 2 | Hallazgo 2 | high | follow\_up | 2 | 2 | 2 |
| 3 | Hallazgo 3 | critical | closed | 3 | 3 | 3 |
| 4 | Hallazgo 4 | low | open | 4 | 4 | 4 |
| 5 | Hallazgo 5 | medium | action\_plan | 5 | 5 | 5 |
| 6 | Hallazgo 6 | high | follow\_up | 6 | 6 | 6 |
| 7 | Hallazgo 7 | critical | closed | 7 | 7 | 7 |
| 8 | Hallazgo 8 | low | open | 8 | 8 | 8 |
| 9 | Hallazgo 9 | medium | action\_plan | 9 | 9 | 9 |
| 10 | Hallazgo 10 | high | follow\_up | 10 | 10 | 10 |

| id | file\_name | audit\_id | control\_id | finding\_id |
|---:|:----------|---------:|-----------:|-----------:|
| 1 | evidencia\_1.pdf | 1 | 1 | 1 |
| 2 | evidencia\_2.pdf | 2 | 2 | 2 |
| 3 | evidencia\_3.pdf | 3 | 3 | 3 |
| 4 | evidencia\_4.pdf | 4 | 4 | 4 |
| 5 | evidencia\_5.pdf | 5 | 5 | 5 |
| 6 | evidencia\_6.pdf | 6 | 6 | 6 |
| 7 | evidencia\_7.pdf | 7 | 7 | 7 |
| 8 | evidencia\_8.pdf | 8 | 8 | 8 |
| 9 | evidencia\_9.pdf | 9 | 9 | 9 |
| 10 | evidencia\_10.pdf | 10 | 10 | 10 |

| id | description | status | due\_date | finding\_id | owner\_id |
|---:|:------------|:-------|:---------|-----------:|---------:|
| 1 | Plan de accion para hallazgo 1 | in\_progress | 2026-11-15 | 1 | 1 |
| 2 | Plan de accion para hallazgo 2 | overdue | 2026-10-15 | 2 | 2 |
| 3 | Plan de accion para hallazgo 3 | completed | 2026-11-15 | 3 | 3 |
| 4 | Plan de accion para hallazgo 4 | validated | 2026-10-15 | 4 | 4 |
| 5 | Plan de accion para hallazgo 5 | pending | 2026-11-15 | 5 | 5 |
| 6 | Plan de accion para hallazgo 6 | in\_progress | 2026-10-15 | 6 | 6 |
| 7 | Plan de accion para hallazgo 7 | overdue | 2026-11-15 | 7 | 7 |
| 8 | Plan de accion para hallazgo 8 | completed | 2026-10-15 | 8 | 8 |
| 9 | Plan de accion para hallazgo 9 | validated | 2026-11-15 | 9 | 9 |
| 10 | Plan de accion para hallazgo 10 | pending | 2026-10-15 | 10 | 10 |

[fiddle](https://dbfiddle.uk/BKgNtKVr)
