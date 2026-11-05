// Quién puede ver una evidencia (SF-08, SNF-05). La usan el asistente de IA y el editor de Excel,
// para que nunca lean un archivo que el usuario no podría abrir; es la misma regla que el listado
// de `GET /evidencias`. Las condiciones se escriben sobre el alias "e" de la tabla evidence y
// reciben los marcadores ($n) del rol y del id del usuario en sesión, este último como texto.

/** Mismos roles que `ROLES_EDICION` de routes/planesAccion.ts. */
function esEquipoAuditoria(rol: string): string {
  return `${rol}::text IN ('Administrador', 'Jefe de Auditoría', 'Auditor Senior', 'Auditor')`;
}

/** Evidencia de hallazgo: quien la subió y el equipo de auditoría. */
export function condicionHallazgoVisible(rol: string, usuario: string): string {
  return `(e.uploaded_by = ${usuario}::text OR ${esEquipoAuditoria(rol)})`;
}

/** Evidencia de control (entity_id = audit_controls.id): quien la subió, el Auditor Senior que asignó el control o el Jefe dueño del plan. */
export function condicionControlVisible(rol: string, usuario: string): string {
  return `(
    e.uploaded_by = ${usuario}::text
    OR EXISTS (
      SELECT 1 FROM audit_controls ac
      WHERE ac.id::text = e.entity_id
        AND ac.auditor_id::text = e.uploaded_by
        AND (
          (${rol}::text = 'Auditor Senior' AND ac.assigned_by::text = ${usuario}::text)
          OR (${rol}::text = 'Jefe de Auditoría' AND EXISTS (
            SELECT 1 FROM audit_plans ap
            WHERE ap.id = ac.audit_id AND ap.created_by::text = ${usuario}::text
          ))
        )
    )
  )`;
}

/** Evidencia de un paso de plan de acción: el responsable del plan, el asignado al paso y el equipo de auditoría. */
export function condicionPasoVisible(rol: string, usuario: string): string {
  return `(
    ${esEquipoAuditoria(rol)}
    OR EXISTS (
      SELECT 1 FROM action_plan_steps paso
      JOIN action_plans plan_paso ON plan_paso.id = paso.action_plan_id
      WHERE paso.id::text = e.entity_id
        AND (plan_paso.responsible_id::text = ${usuario}::text OR paso.assigned_user_id::text = ${usuario}::text)
    )
  )`;
}

/** Cualquier evidencia, según su tipo. */
export function condicionEvidenciaVisible(rol: string, usuario: string): string {
  return `(
    (e.entity_type = 'control' AND ${condicionControlVisible(rol, usuario)})
    OR (e.entity_type = 'hallazgo' AND ${condicionHallazgoVisible(rol, usuario)})
    OR (e.entity_type = 'action_plan_step' AND ${condicionPasoVisible(rol, usuario)})
  )`;
}
