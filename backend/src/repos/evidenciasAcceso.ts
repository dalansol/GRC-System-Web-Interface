// Quién puede ver una evidencia (SF-08, SNF-05). La usan el listado de evidencias y el
// asistente de IA, para que la IA nunca lea un archivo que el usuario no podría abrir.
// Las condiciones se escriben sobre el alias "e" de la tabla evidence; reciben los
// marcadores ($n) del rol y del id del usuario en sesión.

/** Evidencia de hallazgo: solo la ve quien la subió. */
export function condicionHallazgoVisible(usuario: string): string {
  return `e.uploaded_by = ${usuario}`;
}

/** Evidencia de control: el auditor que la subió, el Auditor Senior que asignó el control o el Jefe dueño del plan. */
export function condicionControlVisible(rol: string, usuario: string): string {
  return `(
    (${rol} = 'Auditor' AND e.uploaded_by = ${usuario})
    OR (${rol} = 'Auditor Senior' AND EXISTS (
      SELECT 1 FROM audit_controls ac
      WHERE ac.control_id = e.entity_id
        AND ac.audit_id::text = e.audit_id::text
        AND ac.assigned_by = ${usuario}::integer
        AND ac.auditor_id::text = e.uploaded_by
    ))
    OR (${rol} = 'Jefe de Auditoría' AND EXISTS (
      SELECT 1 FROM audit_controls ac
      JOIN audit_plans ap ON ap.id::text = ac.audit_id::text
      WHERE ac.control_id = e.entity_id
        AND ac.audit_id::text = e.audit_id::text
        AND ap.created_by = ${usuario}::integer
        AND ac.auditor_id::text = e.uploaded_by
    ))
  )`;
}

/** Cualquier evidencia, según su tipo. */
export function condicionEvidenciaVisible(rol: string, usuario: string): string {
  return `(
    (e.entity_type = 'control' AND ${condicionControlVisible(rol, usuario)})
    OR (e.entity_type <> 'control' AND ${condicionHallazgoVisible(usuario)})
  )`;
}
