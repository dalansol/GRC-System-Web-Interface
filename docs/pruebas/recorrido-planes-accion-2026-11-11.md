# Recorrido de punta a punta de Planes de Acción (2026-11-11)

Hallazgos del recorrido completo de Planes de Acción (SF-10, SF-11, SF-12, SF-16), para corregirlos después.
Incluye los cambios del mismo día: el Jefe Auditado crea y edita planes de su unidad, los avisos de rechazo
desaparecen al corregir el paso señalado y las vistas se recargan en vivo.

## Cómo se probó

- **Base:** PostgreSQL 17 en Docker (contenedor `expedite-e2e-pg`, puerto 55432, TLS con certificado autofirmado), base
  exclusiva `expedite_e2e` con `db:migrar --datos-prueba`. **Nunca Supabase.**
- **Backend:** puerto 3001 con un archivo de variables propio (`DOTENV_CONFIG_PATH`), sin leer `backend/.env`:
  `AUTH_MODE=dev`, `DATA_MODE=sql`, `ALMACENAMIENTO=local`, `IA_PROVEEDOR=ninguno`.
- **Frontend:** `vite --port 5174` con `VITE_API_URL=http://localhost:3001/api` y `VITE_AUTH_MODE=dev`.
- **Datos agregados a mano (solo en esa base):** se volvieron a correr 018, 020 y 022 (ver H-3); dos procesos
  (KOF con CTR-004 y Tragetta con CTR-003), dos asignaciones de control del plan de auditoría 3 a `a.rodriguez`, y la
  unidad 2 (KOF) para `j.ejemplo` y `c.ejemplo`. Los hallazgos se crearon desde la aplicación.
- **API:** guion con el flujo completo por rol (67 comprobaciones, 64 correctas).
- **Navegador (Chrome):** Jefe Auditado, Jefa de Auditoría y Empleado Auditado en pestañas separadas (cada pestaña
  tiene su propia sesión).

## Lo que funciona

- **Jefe Auditado:** ve solo los hallazgos y planes de su unidad (y los que creó); crea planes desde Hallazgos; los edita,
  incluso siendo responsable; no los envía a revisión (`403`); no crea planes para hallazgos de otra unidad
  (`403 FUERA_DE_UNIDAD`); consulta el historial de sus planes. En pantalla tiene las pestañas "Mis planes asignados" y
  "Planes de mi unidad", sin botón de envío.
- **Empleado Auditado:** no lista todos los planes ni los crea; no ve un plan en definición; en su portal el responsable
  ve todos los pasos y un asignado solo los suyos, sin causa raíz.
- **Validación de la definición:** envío (Auditor), aviso a la Jefa, bandeja de revisión, apertura, rechazo con motivo
  obligatorio (solo lo recibe quien creó el plan), corrección, reenvío y validación. El hallazgo pasa a `Asignado`.
  Validado, el título ya no cambia.
- **Prórroga:** solo la pide el responsable; la Jefa la aprueba y la fecha del plan cambia.
- **Evidencia y pasos:** no se sube a un paso ajeno, ni con el plan en definición, pendiente, en revisión o aprobado; con
  pasos incompletos no se envía al cierre; con todos completos se avisa a los Auditores Senior (el creador era Jefe
  Auditado).
- **Revisión del cierre:** rechazo señalando un archivo (el paso se reabre y el auditado ve motivo y archivo), no se
  reenvía hasta corregir, aprobación final, firma íntegra (`firmaIntegra: true`), historial con los 12 eventos; aprobado
  no se edita ni se borra su evidencia.
- **Avisos de rechazo:** al volver a marcar el paso señalado desaparecen en el portal y en la vista del auditor.
- **Recarga en vivo:** con la pestaña abierta, un envío hecho por otro usuario cambió el estado a `Pendiente` y quitó
  "Editar plan" sin recargar; al volver a una pestaña se recarga sola; la bandeja de revisión se actualizó al llegar
  evidencia. Llegaron 29 avisos durante el recorrido por la API.
- **Navegación desde notificaciones:** el aviso de envío lleva a la Jefa a la bandeja con el plan resaltado.
- Sin errores en la consola del navegador.

## Hallazgos por corregir

### Errores

**H-1. La fecha de compromiso no se compara con el cierre de la auditoría en hallazgos creados desde la aplicación.** (Alta)

- **Qué pasa:** un plan con fecha de compromiso `2020-01-01` se aceptó (`201`). El formulario muestra "La auditoría de
  este hallazgo no tiene fecha de cierre registrada".
- **Causa:** "Nuevo hallazgo" guarda en `findings."auditId"` el id del plan de auditoría (`audit_plans.id`, p. ej. `"3"`),
  pero la fecha de cierre se busca en la tabla antigua `audits` (ids `AUD-003`) en `SELECT_HALLAZGO` y `SELECT_PLAN`
  (`backend/src/repos/planesAccionSql.ts`). Nunca coincide, la fecha queda en `null` y `validarFechaCompromiso` no valida.
  `audit_plans.end_date` sí existe (2025-09-30 para el plan 3).
- **Decisión pendiente:** confirmar que el cierre es `audit_plans.end_date` (relacionado con el pendiente 12, entidad
  "auditoría"). Opción: `COALESCE(audits.end_date, audit_plans.end_date)` según a qué tabla apunte `auditId`.
- **Requisitos:** SF-10.

**H-2. Se puede completar un paso sin evidencia por la API.** (Media, conocido: pendiente 34)

- `PATCH /planes-accion/:id/pasos/:pasoId` con `completado: true` responde `200` aunque el paso no tenga evidencia; solo
  la pantalla lo impide. El envío a la revisión de cierre sí la exige en el backend.

### Datos de prueba

**H-3. En una base nueva, `--datos-prueba` deja vacía la estructura organizacional.** (Media)

- 018 (y por lo tanto 020 y 022) necesita un Jefe de Auditoría activo, pero los usuarios de prueba que lo incluyen se
  cargan después, en 030. 018 corre sin error y no inserta nada (`business_units`, `division`, `business` y `area`
  vacías). Se arregló a mano volviendo a correr 018, 020 y 022.
- Opción: que el script de usuarios de prueba corra antes, o que 018 cree o tome al Jefe de Auditoría.

**H-4. Los datos de prueba no permiten probar la unidad de negocio.** (Media, relacionado con pendientes 20 y 21)

- No hay filas en `processes` ni en `audit_controls`, así que ningún hallazgo pertenece a una unidad y un Jefe Auditado
  no puede crear planes. Los hallazgos sembrados usan `auditId` `AUD-…`, que tampoco coincide con `audit_controls.audit_id`
  (entero). Además, ningún usuario de prueba tiene `business_unit_id`.
- Opción: un script de datos de prueba con procesos, asignaciones y la unidad de los auditados.

**H-5. El plan sembrado PACC-2026-001 no tiene título** (`titulo: null`, script 043). (Baja)

### Textos

**H-6. El aviso de rechazo le pide al Jefe Auditado que reenvíe.** (Baja)

- En "Planes de mi unidad" dice "Plan rechazado: corrígelo y reenvíalo a revisión", pero el Jefe Auditado no puede
  reenviar; además, en la etapa de definición es "validación", no "revisión" (`AvisoRechazoPlan` en `VistaPlanesAccion.tsx`).

**H-7. El diálogo de rechazo de la definición dice "El auditor verá este motivo".** (Baja)

- Si el plan lo creó un Jefe Auditado, quien recibe el rechazo es él (`BandejaRevisionPlanes.tsx`).

### Presentación

**H-8. Columnas recortadas en "Gestión"/"Planes de mi unidad".** (Baja) Con ventanas angostas el folio se ve como
"PACC-2026-0…" y la insignia como "Rechaza…".

**H-9. La bandeja de revisión muestra un plan abierto bajo un filtro que ya no lo contiene.** (Baja) Tras la recarga en
vivo, el plan pasó de `Pendiente` a `En Revisión`: el filtro "Pendiente" dice "No hay planes en este estado." pero el
detalle sigue abierto debajo.

**H-10. Fechas de evidencia en UTC.** (Baja) La evidencia subida la noche del 11 de noviembre aparece como `2026-11-12`,
mientras el historial dice "11 nov 2026, 9:16 p.m.".

### Fuera de Planes de Acción (vistos de paso)

**H-11.** Hallazgos dice "Modo actual: Mock Data Servidor" aunque los datos vienen del backend. (Baja)

**H-12.** La barra superior siempre muestra "Lun 21 Jul 2025". (Baja)

**H-13.** Al cerrar sesión, el campo de correo conserva el correo anterior y el nuevo se escribe junto a él. (Baja)

**H-14.** En Hallazgos, las casillas siguen marcadas después de crear un plan de acción. (Baja)

## Resumen

| Id | Tipo | Prioridad | Estado |
|---|---|---|---|
| H-1 | Error | Alta | Pendiente; requiere decisión (cierre = `audit_plans.end_date`) |
| H-2 | Error | Media | Conocido (pendiente 34) |
| H-3 | Datos de prueba | Media | Pendiente |
| H-4 | Datos de prueba | Media | Pendiente (pendientes 20 y 21) |
| H-5 | Datos de prueba | Baja | Pendiente |
| H-6 | Texto | Baja | Pendiente |
| H-7 | Texto | Baja | Pendiente |
| H-8 | Presentación | Baja | Pendiente |
| H-9 | Presentación | Baja | Pendiente |
| H-10 | Presentación | Baja | Pendiente |
| H-11 | Fuera del módulo | Baja | Pendiente |
| H-12 | Fuera del módulo | Baja | Pendiente |
| H-13 | Fuera del módulo | Baja | Pendiente |
| H-14 | Fuera del módulo | Baja | Pendiente |
