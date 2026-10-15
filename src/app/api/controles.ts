import { pedir } from "./cliente";
import type { ControlRecord } from "../components/SharedComponents";

interface ControlApi {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type?: string | null;
  frequency?: string | null;
  status?: "En Progreso" | "En Revision" | "Completado";
  hours_spent?: string | number;
  feedback?: string | null;
  audit_ids?: number[];
}

function convertirControl(control: ControlApi): ControlRecord {
  return {
    id: control.id,
    auditEntityId: "",
    specificRiskIds: [],
    controlProcedureName: control.name,
    validityStatus: "Vigente",
    businessControlNumber: control.code,
    controlActivity: control.description ?? "",
    currentVulnerability: "Baja",
    controlType: control.type ?? "Preventivo",
    frequency: control.frequency ?? "No definida",
    sampleSize: "",
    rotation: "",
    controlStatus: "Activo",
    status: control.status ?? "En Progreso",
    horasInvertidas: Number(control.hours_spent ?? 0),
    feedback: control.feedback,
    auditIds: control.audit_ids ?? [],
  };
}

export async function listarControles(): Promise<ControlRecord[]> {
  const controles = await pedir<ControlApi[]>("/controles");
  return controles.map(convertirControl);
}

export const registrarHoras = (controlId: string, datos: { horas: number }) =>
  pedir<{ id: string; hours_spent: string }>(`/controles/${encodeURIComponent(controlId)}/horas`, {
    metodo: "POST",
    cuerpo: datos,
  });

export const actualizarstatusControl = (
  controlId: string,
  datos: { status: "En Revision" | "Completado"; feedback?: string },
) => pedir(`/controles/${encodeURIComponent(controlId)}/status`, { metodo: "PATCH", cuerpo: datos });
