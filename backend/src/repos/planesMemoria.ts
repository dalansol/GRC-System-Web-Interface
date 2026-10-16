import { periodoClave, type DatosPlan, type PlanAuditoria } from "../domain/planes.js";
import { ErrorCodigoDuplicado, type RepositorioPlanes } from "./planes.js";
import type { RepositorioUsuarios } from "./repositorio.js";
import { PLANES_DEMO } from "./semilla.js";

interface Fila extends DatosPlan {
  id: number;
}

// Repositorio en memoria para pruebas y desarrollo sin base de datos.
// El nombre del responsable se lee del repositorio de usuarios.
export class RepositorioPlanesMemoria implements RepositorioPlanes {
  private filas: Fila[] = [];
  private siguienteId = 1;
  private readonly listo: Promise<void>;

  constructor(private readonly usuarios: RepositorioUsuarios) {
    this.listo = this.sembrar();
  }

  private async sembrar() {
    for (const { responsable, ...plan } of PLANES_DEMO) {
      const usuario = await this.usuarios.buscarPorCorreo(responsable);
      if (usuario) this.filas.push({ ...plan, id: this.siguienteId++, responsableId: usuario.id });
    }
  }

  private async aPlan({ responsableId, ...fila }: Fila): Promise<PlanAuditoria> {
    const usuario = await this.usuarios.buscarPorId(responsableId);
    return { ...fila, responsable: { id: responsableId, nombre: usuario?.nombre ?? "" } };
  }

  async listar(responsableId?: number, auditorId?: number) {
    await this.listo;
    const filas = this.filas.filter((fila) => {
      const coincideResponsable = responsableId === undefined || fila.responsableId === responsableId;
      // El repositorio en memoria no modela asignaciones de controles.
      const coincideAuditor = auditorId === undefined;
      return coincideResponsable && coincideAuditor;
    });
    return Promise.all(filas.map((f) => this.aPlan(f)));
  }

  async buscarPorId(id: number) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    return fila ? this.aPlan(fila) : null;
  }

  async siguienteCodigo(datos: DatosPlan) {
    await this.listo;
    const periodo = periodoClave(datos);
    const prefijo = datos.tipo === "Anual" ? "PAA" : "PAT";
    const planes = this.filas.filter((fila) =>
      fila.tipo === datos.tipo &&
      (datos.tipo === "Anual"
        ? fila.fechaInicio.slice(0, 4) === periodo
        : periodoClave({
            tipo: fila.tipo,
            periodo: fila.periodo,
            fechaInicio: fila.fechaInicio,
          }) === periodo),
    );
    const ultimo = planes.reduce((maximo, fila) => {
      const coincidencia = fila.codigo.match(/(\d+)$/);
      return coincidencia ? Math.max(maximo, Number(coincidencia[1])) : maximo;
    }, 0);
    const sufijoPeriodo = datos.tipo === "Anual"
      ? periodo
      : `${datos.fechaInicio.slice(0, 4)}-${periodo.match(/Q[1-4]/)![0]}`;
    return `${prefijo}-${sufijoPeriodo}-${String(ultimo + 1).padStart(3, "0")}`;
  }

  async crear(datos: DatosPlan) {
    await this.listo;
    if (this.filas.some((f) => f.codigo === datos.codigo)) throw new ErrorCodigoDuplicado(datos.codigo);
    const fila = { ...datos, id: this.siguienteId++ };
    this.filas.push(fila);
    return this.aPlan(fila);
  }

  async actualizar(id: number, datos: DatosPlan) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    if (!fila) return null;
    if (this.filas.some((f) => f.codigo === datos.codigo && f.id !== id)) throw new ErrorCodigoDuplicado(datos.codigo);
    Object.assign(fila, datos);
    return this.aPlan(fila);
  }
}
