import type { Criterio, Evaluacion } from "../domain/evaluaciones.js";
import type {
  AsignacionEvaluable,
  DatosEvaluacion,
  RepositorioEvaluaciones,
  StatusAsignacion,
} from "./evaluaciones.js";
import type { RepositorioUsuarios } from "./repositorio.js";

// Los mismos criterios que sql/036_evaluacion_controles.sql.
const CRITERIOS: Criterio[] = [
  ["D1", "diseno", "El objetivo del control está ligado al riesgo"],
  ["D2", "diseno", "Tiene responsable y frecuencia definidos"],
  ["D3", "diseno", "El procedimiento está documentado"],
  ["D4", "diseno", "Puede prevenir o detectar el riesgo"],
  ["E1", "efectividad", "Se ejecutó con la frecuencia definida"],
  ["E2", "efectividad", "Lo ejecutó el responsable"],
  ["E3", "efectividad", "La evidencia es suficiente"],
  ["E4", "efectividad", "No hubo excepciones en la muestra"],
].map(([codigo, tipo, nombre], i) => ({
  id: i + 1,
  codigo: codigo!,
  tipo: tipo as Criterio["tipo"],
  nombre: nombre!,
  obligatorio: true,
  orden: i + 1,
}));

// Repositorio en memoria para pruebas. Sin base de datos no hay controles asignados
// (audit_controls solo existe en SQL), así que las asignaciones se reciben al crearlo.
export class RepositorioEvaluacionesMemoria implements RepositorioEvaluaciones {
  private evaluaciones = new Map<string, Evaluacion>();

  constructor(
    private readonly usuarios: RepositorioUsuarios,
    private readonly asignaciones: AsignacionEvaluable[] = [],
  ) {}

  /** Simula el avance del flujo de revisión, que vive en audit_controls. */
  cambiarStatus(planId: number, controlId: string, status: StatusAsignacion) {
    for (const asignacion of this.asignaciones) {
      if (asignacion.planId === planId && asignacion.controlId === controlId) asignacion.status = status;
    }
  }

  async listarCriterios() {
    return CRITERIOS;
  }

  async listarAsignaciones(planId: number, control: string) {
    return this.asignaciones.filter(
      (a) => a.planId === planId && (a.controlId === control || a.codigo === control),
    );
  }

  async buscar(planId: number, controlId: string) {
    return this.evaluaciones.get(`${planId}/${controlId}`) ?? null;
  }

  async guardar({ evaluadorId, ...datos }: DatosEvaluacion) {
    const usuario = await this.usuarios.buscarPorId(evaluadorId);
    const evaluacion: Evaluacion = {
      ...datos,
      evaluadoPor: { id: evaluadorId, nombre: usuario?.nombre ?? "" },
      evaluadoEn: new Date().toISOString(),
    };
    this.evaluaciones.set(`${datos.planId}/${datos.controlId}`, evaluacion);
    return evaluacion;
  }
}
