import type { DatosEdicionPlanAccion, DatosPlanAccion, HallazgoResumen, PlanAccion } from "../domain/planesAccion.js";
import type { RepositorioPlanesAccion } from "./planesAccion.js";
import type { RepositorioUsuarios } from "./repositorio.js";
import { AUDITORIAS_DEMO, HALLAZGOS_DEMO, PLANES_ACCION_DEMO } from "./semilla.js";

interface Fila extends DatosPlanAccion {
  id: number;
  estado: PlanAccion["estado"];
  creadoEn: string;
}

// Repositorio en memoria para pruebas y desarrollo sin base de datos.
// Los hallazgos y auditorías son los de prueba; el nombre del responsable se lee del repositorio de usuarios.
export class RepositorioPlanesAccionMemoria implements RepositorioPlanesAccion {
  private filas: Fila[] = [];
  private siguienteId = 1;
  private readonly listo: Promise<void>;

  constructor(private readonly usuarios: RepositorioUsuarios) {
    this.listo = this.sembrar();
  }

  private async sembrar() {
    for (const { responsable, ...plan } of PLANES_ACCION_DEMO) {
      const usuario = await this.usuarios.buscarPorCorreo(responsable);
      if (usuario) {
        this.filas.push({
          ...plan,
          titulo: "Plan de acción",
          causaRaiz: plan.descripcion,
          pasos: [],
          responsableId: usuario.id,
          id: this.siguienteId++,
          estado: "Asignado",
          creadoEn: "2025-07-12T10:00:00.000Z",
        });
      }
    }
  }

  private async aPlan({ responsableId, hallazgoId, pasos: _pasos, ...fila }: Fila): Promise<PlanAccion> {
    const usuario = await this.usuarios.buscarPorId(responsableId);
    const hallazgo = await this.buscarHallazgo(hallazgoId);
    return {
      ...fila,
      publicId: `PACC-${new Date(fila.creadoEn).getUTCFullYear()}-${String(fila.id).padStart(3, "0")}`,
      hallazgo: hallazgo!,
      responsable: { id: responsableId, nombre: usuario?.nombre ?? "" },
      titulo: fila.titulo ?? fila.descripcion,
      causaRaiz: fila.causaRaiz ?? fila.descripcion,
      status: fila.estado,
      hallazgosRelacionados: hallazgo ? [hallazgo] : [],
      pasos: [],
    };
  }

  async buscarHallazgo(hallazgoId: string): Promise<HallazgoResumen | null> {
    const hallazgo = HALLAZGOS_DEMO.find((h) => h.id === hallazgoId);
    if (!hallazgo) return null;
    const auditoria = AUDITORIAS_DEMO.find((a) => a.id === hallazgo.auditoriaId);
    return { ...hallazgo, fechaCierreAuditoria: auditoria?.fechaCierre ?? null };
  }

  async listar() {
    await this.listo;
    return Promise.all(this.filas.map((f) => this.aPlan(f)));
  }

  async listarPorResponsable(usuarioId: number) {
    await this.listo;
    return Promise.all(
      this.filas
        .filter((f) =>
          f.responsableId === usuarioId ||
          f.pasos?.some((paso) => paso.usuarioAsignadoId === usuarioId),
        )
        .map((f) => this.aPlan(f)),
    );
  }

  async buscarPorHallazgo(hallazgoId: string) {
    await this.listo;
    const fila = this.filas.find((f) => f.hallazgoId === hallazgoId);
    return fila ? this.aPlan(fila) : null;
  }

  async crear(datos: DatosPlanAccion) {
    await this.listo;
    const fila: Fila = { ...datos, id: this.siguienteId++, estado: "Asignado", creadoEn: new Date().toISOString() };
    this.filas.push(fila);
    return this.aPlan(fila);
  }

  async buscarPorId(id: number) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    return fila ? this.aPlan(fila) : null;
  }

  async actualizar(id: number, datos: DatosEdicionPlanAccion) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    if (!fila) return null;
    Object.assign(fila, datos);
    return this.aPlan(fila);
  }

  async actualizarPaso(_planId: number, _pasoId: number, _completado: boolean) {
    return null;
  }
}
