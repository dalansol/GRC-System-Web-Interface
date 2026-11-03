// Evaluación de diseño y efectividad de controles (historia #98, SF-07, módulo de Ejecución).
// El auditor asignado responde cada criterio con la escala de madurez de 1 a 5 y el sistema
// calcula la calificación, el estatus y si el control tiene deficiencia.
//
// TBD: FEMSA no ha definido el modelo de madurez. Los criterios (sql/036) y estos umbrales son
// datos de prueba; se cambian aquí y en esa tabla, sin tocar el resto del flujo.

export type TipoCriterio = "diseno" | "efectividad";
export type ResultadoEvaluacion = "Efectivo" | "Parcialmente efectivo" | "Deficiente";

export interface Criterio {
  id: number;
  codigo: string;
  tipo: TipoCriterio;
  nombre: string;
  obligatorio: boolean;
  orden: number;
}

export interface RespuestaCriterio {
  criterioId: number;
  valor: number;
}

export interface Calculo {
  promedioDiseno: number;
  promedioEfectividad: number;
  calificacion: number;
  resultado: ResultadoEvaluacion;
  deficiencia: boolean;
}

export interface Evaluacion extends Calculo {
  planId: number;
  controlId: string;
  respuestas: RespuestaCriterio[];
  evaluadoPor: { id: number; nombre: string };
  evaluadoEn: string;
}

export const ESCALA_MINIMA = 1;
export const ESCALA_MAXIMA = 5;
/** Desde esta calificación el control es Efectivo. */
export const UMBRAL_EFECTIVO = 4;
/** Debajo de esta calificación la madurez es baja: Deficiente y con deficiencia. */
export const UMBRAL_DEFICIENCIA = 3;

export const MENSAJE_ESCALA = `Cada criterio se responde con un número entero de ${ESCALA_MINIMA} a ${ESCALA_MAXIMA}.`;

const redondear = (valor: number) => Math.round(valor * 100) / 100;

function promedio(criterios: Criterio[], respuestas: RespuestaCriterio[], tipo: TipoCriterio): number {
  const ids = new Set(criterios.filter((c) => c.tipo === tipo).map((c) => c.id));
  const valores = respuestas.filter((r) => ids.has(r.criterioId)).map((r) => r.valor);
  return redondear(valores.reduce((suma, valor) => suma + valor, 0) / valores.length);
}

/** Se toma el menor de los dos promedios: un control bien diseñado que no opera no mitiga el riesgo. */
export function calcularEvaluacion(criterios: Criterio[], respuestas: RespuestaCriterio[]): Calculo {
  const promedioDiseno = promedio(criterios, respuestas, "diseno");
  const promedioEfectividad = promedio(criterios, respuestas, "efectividad");
  const calificacion = Math.min(promedioDiseno, promedioEfectividad);
  const deficiencia = calificacion < UMBRAL_DEFICIENCIA;
  const resultado: ResultadoEvaluacion = deficiencia
    ? "Deficiente"
    : calificacion >= UMBRAL_EFECTIVO
      ? "Efectivo"
      : "Parcialmente efectivo";
  return { promedioDiseno, promedioEfectividad, calificacion, resultado, deficiencia };
}

/**
 * Criterios que impiden guardar: los obligatorios sin responder y, si un grupo quedó sin
 * ninguna respuesta, todos los de ese grupo, porque sin ellas no se puede promediar.
 */
export function criteriosFaltantes(criterios: Criterio[], respuestas: RespuestaCriterio[]): Criterio[] {
  const respondidos = new Set(respuestas.map((r) => r.criterioId));
  const grupoRespondido = (tipo: TipoCriterio) =>
    criterios.some((c) => c.tipo === tipo && respondidos.has(c.id));
  return criterios.filter(
    (c) => !respondidos.has(c.id) && (c.obligatorio || !grupoRespondido(c.tipo)),
  );
}

/** Devuelve el mensaje del primer error de forma, o null si las respuestas son válidas. */
export function validarRespuestas(criterios: Criterio[], respuestas: unknown): string | null {
  if (!Array.isArray(respuestas)) return "Las respuestas deben ser una lista.";
  const vistos = new Set<number>();
  for (const respuesta of respuestas as { criterioId?: unknown; valor?: unknown }[]) {
    const criterio = criterios.find((c) => c.id === respuesta?.criterioId);
    if (!criterio) return "Uno de los criterios no existe.";
    if (vistos.has(criterio.id)) return `El criterio ${criterio.codigo} viene más de una vez.`;
    vistos.add(criterio.id);
    const { valor } = respuesta;
    if (!Number.isInteger(valor) || (valor as number) < ESCALA_MINIMA || (valor as number) > ESCALA_MAXIMA) {
      return MENSAJE_ESCALA;
    }
  }
  return null;
}
