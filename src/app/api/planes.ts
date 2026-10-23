import { pedir } from "./cliente";

// Planes de auditoría (SF-01, SF-05). Mismo contrato que backend/src/domain/planes.ts.

export interface PlanAuditoria {
  id: number;
  codigo: string;
  nombre: string;
  tipo: "Anual" | "Trimestral";
  periodo: string | null;
  /** Fecha en formato AAAA-MM-DD. */
  fechaInicio: string;
  fechaFin: string;
  estado: "Borrador" | "Aprobado" | "En Ejecución" | "Cerrado";
  horasEstimadas: number;
  responsable: { id: number; nombre: string };
  alcance: string | null;
}

export function obtenerPlanAuditoria(planId: string): Promise<PlanAuditoria> {
  return pedir(`/planes/${encodeURIComponent(planId)}`);
}
