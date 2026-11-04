import { pedir } from "./cliente";

export interface HallazgoPortal {
  id: string;
  folio: string | null;
  title: string;
  description: string | null;
  type: string | null;
  severity: string;
  status: string;
  auditId: string | null;
  controlId: string | null;
  failedControl: string | null;
  residualRisk: string | null;
  ownerId: string | null;
  created_at: string;
}

export const listarHallazgosDeMiUnidad = () =>
  pedir<HallazgoPortal[]>("/hallazgos/unidad-negocio");
