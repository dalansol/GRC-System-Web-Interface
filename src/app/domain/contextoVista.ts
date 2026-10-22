import {
  AUDIT_ENTITIES,
  AUDIT_PLANS_DATA,
  AUDIT_RECORDS,
  BITACORA_DATA,
  CONTROLS,
  GENERAL_RISKS,
  INITIAL_FINDINGS,
  PLAN_ENTITIES,
  PROCEDURE_TRACKING,
  QUARTERLY_DATA,
  SPECIFIC_RISKS,
  TASKS,
} from "../data/mock_data";

// Datos que el asistente Copilot recibe según la vista abierta. Son los mismos que la pantalla
// muestra (hoy, datos de prueba); cuando una vista lea del backend, este módulo debe seguirla.

/** Mismo límite que valida el backend. */
export const CONTEXTO_MAX = 20_000;

export interface ContextoAsistente {
  /** Nombre legible de la vista, p. ej. "Controles" o "Control CTR-002". */
  vista: string;
  /** Datos de la vista en JSON. */
  contexto: string;
}

export type TipoDetalle = "general_risk" | "specific_risk" | "audit_entity" | "control";

const VISTAS: Record<string, { nombre: string; datos: () => Record<string, unknown> }> = {
  dashboard: {
    nombre: "Dashboard",
    datos: () => ({ tareas: TASKS, auditorias: AUDIT_RECORDS, hallazgos: INITIAL_FINDINGS, tendenciaTrimestral: QUARTERLY_DATA }),
  },
  filter: {
    nombre: "Filtrar",
    datos: () => ({ riesgosGenerales: GENERAL_RISKS, riesgosEspecificos: SPECIFIC_RISKS, entidades: AUDIT_ENTITIES, controles: CONTROLS }),
  },
  hierarchy: {
    nombre: "Catálogo",
    datos: () => ({ entidades: AUDIT_ENTITIES, riesgosGenerales: GENERAL_RISKS, riesgosEspecificos: SPECIFIC_RISKS }),
  },
  plans: { nombre: "Planes de Auditoría", datos: () => ({ planes: AUDIT_PLANS_DATA, entidadesDelPlan: PLAN_ENTITIES, auditorias: AUDIT_RECORDS }) },
  findings: { nombre: "Hallazgos", datos: () => ({ hallazgos: INITIAL_FINDINGS }) },
  controles: { nombre: "Controles", datos: () => ({ controles: CONTROLS, seguimientoDeProcedimientos: PROCEDURE_TRACKING }) },
  bitacora: { nombre: "Bitácora", datos: () => ({ bitacora: BITACORA_DATA }) },
  settings: { nombre: "Ajustes del sistema", datos: () => ({ bitacora: BITACORA_DATA }) },
};

const DETALLES: Record<TipoDetalle, { nombre: string; registros: { id: string }[] }> = {
  general_risk: { nombre: "Riesgo general", registros: GENERAL_RISKS },
  specific_risk: { nombre: "Riesgo específico", registros: SPECIFIC_RISKS },
  audit_entity: { nombre: "Entidad auditora", registros: AUDIT_ENTITIES },
  control: { nombre: "Control", registros: CONTROLS },
};

/** Etiquetas que usa AISummaryCard. */
const DETALLE_POR_ETIQUETA: Record<string, TipoDetalle> = {
  "Riesgo General": "general_risk",
  "Riesgo Específico": "specific_risk",
  "Entidad Auditora": "audit_entity",
  Control: "control",
};

const RELACIONABLES: Record<string, { id: string }[]> = {
  riesgosGenerales: GENERAL_RISKS,
  riesgosEspecificos: SPECIFIC_RISKS,
  entidades: AUDIT_ENTITIES,
  controles: CONTROLS,
  seguimientoDeProcedimientos: PROCEDURE_TRACKING,
  hallazgos: INITIAL_FINDINGS,
};

function recortar(datos: unknown): string {
  const json = JSON.stringify(datos);
  const aviso = "\n…(datos recortados por tamaño)";
  return json.length <= CONTEXTO_MAX ? json : json.slice(0, CONTEXTO_MAX - aviso.length) + aviso;
}

/** Contexto de una vista principal; null si el asistente aún no tiene datos de esa vista. */
export function contextoVista(vista: string): ContextoAsistente | null {
  const definicion = VISTAS[vista];
  return definicion ? { vista: definicion.nombre, contexto: recortar(definicion.datos()) } : null;
}

/** Contexto de un registro (riesgo, entidad o control) con los registros que lo mencionan. */
export function contextoDetalle(tipo: TipoDetalle, id: string): ContextoAsistente | null {
  const { nombre, registros } = DETALLES[tipo];
  const registro = registros.find((r) => r.id === id);
  if (!registro) return null;

  const relacionados: Record<string, unknown[]> = {};
  for (const [coleccion, lista] of Object.entries(RELACIONABLES)) {
    const encontrados = lista.filter((r) => r.id !== id && JSON.stringify(r).includes(`"${id}"`));
    if (encontrados.length > 0) relacionados[coleccion] = encontrados;
  }
  return { vista: `${nombre} ${id}`, contexto: recortar({ registro, relacionados }) };
}

export function contextoPorEtiqueta(etiqueta: string, id: string): ContextoAsistente | null {
  const tipo = DETALLE_POR_ETIQUETA[etiqueta];
  return tipo ? contextoDetalle(tipo, id) : null;
}
