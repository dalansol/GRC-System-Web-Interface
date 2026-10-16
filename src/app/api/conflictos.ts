import { pedir } from "./cliente";

// Declaración de conflictos de interés de un auditor en un plan de auditoría (historia #96, SF-04).

export interface PlanResumen {
  id: number;
  codigo: string;
  nombre: string;
}

export interface DeclaracionConflicto {
  id: number;
  plan: PlanResumen;
  auditor: { id: number; nombre: string };
  tieneConflicto: boolean;
  justificacion: string | null;
  declaradoEn: string;
}

/** Estado del usuario en sesión frente a un plan. */
export interface MiDeclaracion {
  plan: PlanResumen;
  /** True si tiene controles asignados en el plan. */
  asignado: boolean;
  declaracion: DeclaracionConflicto | null;
  /** False mientras un auditor asignado no declare: la evaluación de controles queda bloqueada. */
  puedeEvaluar: boolean;
}

export interface NuevaDeclaracion {
  tieneConflicto: boolean;
  justificacion?: string;
}

// Deben coincidir con backend/src/domain/conflictos.ts.
export const LIMITE_JUSTIFICACION = 2000;
export const MENSAJE_JUSTIFICACION_OBLIGATORIA =
  "La justificación es obligatoria cuando declaras un conflicto de interés.";

// Roles que reciben el aviso de conflictos (los mismos que valida el backend).
export const ROLES_JEFATURA_CONFLICTOS = ["Administrador", "Jefe de Auditoría"];

const ruta = (planId: number | string) => `/planes/${encodeURIComponent(String(planId))}/conflictos`;

export const obtenerMiDeclaracion = (planId: number | string) => pedir<MiDeclaracion>(`${ruta(planId)}/mia`);

export const listarDeclaraciones = (planId: number | string) => pedir<DeclaracionConflicto[]>(ruta(planId));

export const listarPlanesPendientes = () => pedir<PlanResumen[]>("/conflictos/pendientes");

export const declararConflictos = (planId: number | string, datos: NuevaDeclaracion) =>
  pedir<DeclaracionConflicto>(ruta(planId), { metodo: "POST", cuerpo: datos });
