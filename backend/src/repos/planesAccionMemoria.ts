import type { DatosPlanAccion, HallazgoResumen, PlanAccion } from "../domain/planesAccion.js";
import { ErrorPlanDuplicado, type RepositorioPlanesAccion } from "./planesAccion.js";
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
        this.filas.push({ ...plan, responsableId: usuario.id, id: this.siguienteId++, estado: "Asignado", creadoEn: "2025-07-12T10:00:00.000Z" });
      }
    }
  }

  private async aPlan({ responsableId, hallazgoId, ...fila }: Fila): Promise<PlanAccion> {
    const usuario = await this.usuarios.buscarPorId(responsableId);
    return {
      ...fila,
      hallazgo: (await this.buscarHallazgo(hallazgoId))!,
      responsable: { id: responsableId, nombre: usuario?.nombre ?? "" },
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
    return Promise.all(this.filas.filter((f) => f.responsableId === usuarioId).map((f) => this.aPlan(f)));
  }

  async buscarPorHallazgo(hallazgoId: string) {
    await this.listo;
    const fila = this.filas.find((f) => f.hallazgoId === hallazgoId);
    return fila ? this.aPlan(fila) : null;
  }

  async crear(datos: DatosPlanAccion) {
    await this.listo;
    if (this.filas.some((f) => f.hallazgoId === datos.hallazgoId)) throw new ErrorPlanDuplicado(datos.hallazgoId);
    const fila: Fila = { ...datos, id: this.siguienteId++, estado: "Asignado", creadoEn: new Date().toISOString() };
    this.filas.push(fila);
    return this.aPlan(fila);
  }
}
