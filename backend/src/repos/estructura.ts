// Interfaz del repositorio de estructura organizacional (SF-03).

import type {
  AltaNodoInput,
  AltaPeriodoInput,
  AltaUnidadInput,
  DepartamentoAuditoria,
  EdicionNodoInput,
  EdicionPeriodoInput,
  EdicionUnidadInput,
  NivelEstructura,
  NivelNodo,
  NodoPlano,
  PeriodoFiscal,
  UnidadNegocio,
} from "../domain/estructura.js";

export class ErrorNombreDuplicado extends Error {
  constructor(entidad: string, nombre: string) {
    super(`Ya existe ${entidad} con el nombre "${nombre}".`);
    this.name = "ErrorNombreDuplicado";
  }
}

export interface RepositorioEstructura {
  // Periodos de auditoría (uno activo a la vez: activar uno desactiva los demás).
  obtenerPeriodoActivo(): Promise<PeriodoFiscal | null>;
  listarPeriodos(): Promise<PeriodoFiscal[]>;
  buscarPeriodoPorId(id: number): Promise<PeriodoFiscal | null>;
  /** Lanza ErrorNombreDuplicado. */
  crearPeriodo(datos: AltaPeriodoInput): Promise<PeriodoFiscal>;
  /** Lanza ErrorNombreDuplicado. */
  editarPeriodo(id: number, campos: EdicionPeriodoInput): Promise<PeriodoFiscal | null>;

  listarDepartamentos(): Promise<DepartamentoAuditoria[]>;

  // Unidades de negocio, con su jerarquía anidada.
  listarUnidades(): Promise<UnidadNegocio[]>;
  buscarUnidadPorId(id: number): Promise<UnidadNegocio | null>;
  /**
   * Asigna el código: el siguiente número del nivel, por encima del mayor que se haya
   * asignado o exista (no reutiliza los de unidades borradas).
   */
  crearUnidad(datos: AltaUnidadInput, periodoFiscalId: number, creadoPor: number): Promise<UnidadNegocio>;
  /** El código no se edita; el nombre no es único. */
  editarUnidad(id: number, campos: EdicionUnidadInput): Promise<UnidadNegocio | null>;
  eliminarUnidad(id: number): Promise<void>;

  // División, subdivisión y área. Sus nombres no son únicos.
  buscarNodo(nivel: NivelNodo, id: number): Promise<NodoPlano | null>;
  /** A la división y la subdivisión les asigna el código igual que a la unidad. */
  crearNodo(nivel: NivelNodo, datos: AltaNodoInput): Promise<NodoPlano>;
  editarNodo(nivel: NivelNodo, id: number, campos: EdicionNodoInput): Promise<NodoPlano | null>;
  eliminarNodo(nivel: NivelNodo, id: number): Promise<void>;

  /**
   * True si algún `audit_engagement` de un plan Aprobado o En Ejecución apunta a una
   * entidad auditable de esta rama. Las entidades cuelgan de la subdivisión, así que
   * para un área se revisa su subdivisión.
   */
  tieneAuditoriasActivas(nivel: NivelEstructura, id: number): Promise<boolean>;

  /** True si el nodo tiene hijos en el nivel siguiente (para una subdivisión, también riesgos registrados). */
  tieneHijos(nivel: NivelEstructura, id: number): Promise<boolean>;
}
