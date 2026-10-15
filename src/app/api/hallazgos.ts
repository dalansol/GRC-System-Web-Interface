import { pedir } from "./cliente";

export interface HallazgoApi {
  id: string;
  folio?: string;
  title: string;
  description?: string;
  type?: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  status: "Abierto" | "En Proceso" | "En Revisión" | "Asignado" | "Cerrado";
  auditId?: string;
  controlId?: string;
  failedControlId?: string;
  failedControl?: string;
  residualRisk?: "Crítico" | "Alto" | "Medio" | "Bajo";
  ownerId?: string;
}

export const listarHallazgos = () => pedir<HallazgoApi[]>("/hallazgos");

export const crearHallazgo = (datos: Omit<HallazgoApi, "id">) =>
  pedir<HallazgoApi>("/hallazgos", { metodo: "POST", cuerpo: datos });

export const actualizarHallazgo = (id: string, datos: Partial<HallazgoApi>) =>
  pedir<HallazgoApi>(`/hallazgos/${encodeURIComponent(id)}`, {
    metodo: "PUT",
    cuerpo: datos,
  });

export const eliminarHallazgo = (id: string) =>
  pedir<{ message: string }>(`/hallazgos/${encodeURIComponent(id)}`, { metodo: "DELETE" });
