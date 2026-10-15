import { pedir } from "./cliente";

export interface ControlAsignable {
  id: string;
  code: string;
  name: string;
}

export interface AuditorAsignable {
  id: number;
  name: string;
  email: string;
  role: "Auditor Senior" | "Auditor";
}

export interface NuevaAsignacionControl {
  controlId: string;
  auditorId: number;
}

export interface AsignacionControl {
  id: number;
  audit_id: number;
  control_id: string;
  control_code: string;
  control_name: string;
  hours_spent: string | number;
  status: string;
  feedback: string | null;
  auditor_id: number;
  auditor_name: string;
  is_lead: boolean;
  assigned_by: number;
  created_at: string;
}

export interface MiAsignacionControl {
  asignado: boolean;
  asignacion: {
    id: number;
    audit_id: number;
    control_id: number;
  } | null;
}

export const consultarMiAsignacionControl = (controlId: string) =>
  pedir<MiAsignacionControl>(
    `/controles/${encodeURIComponent(controlId)}/mi-asignacion`,
  );

export const listarControlesAsignables = () => pedir<ControlAsignable[]>("/controles/asignables");
export const listarAuditoresAsignables = () => pedir<AuditorAsignable[]>("/usuarios/auditores");
export const listarAsignacionesControl = (planId: string) =>
  pedir<AsignacionControl[]>(`/planes/${encodeURIComponent(planId)}/controles`);
export const actualizarAsignacionStatus = (
  planId: string,
  controlId: string,
  datos: { status: "En Revision" | "Completado"; feedback?: string },
) =>
  pedir<AsignacionControl>(
    `/planes/${encodeURIComponent(planId)}/controles/${encodeURIComponent(controlId)}/status`,
    { metodo: "PATCH", cuerpo: datos },
  );
export const crearAsignacionControl = (planId: string, datos: NuevaAsignacionControl) =>
  pedir(`/planes/${encodeURIComponent(planId)}/controles`, { metodo: "POST", cuerpo: datos });
