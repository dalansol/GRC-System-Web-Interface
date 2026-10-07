import type { DatosPlan, PlanAuditoria } from "../domain/planes.js";
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

  async listar() {
    await this.listo;
    return Promise.all(this.filas.map((f) => this.aPlan(f)));
  }

  async buscarPorId(id: number) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    return fila ? this.aPlan(fila) : null;
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
