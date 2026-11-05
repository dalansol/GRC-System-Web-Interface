// Interfaz del repositorio de estructura organizacional (SF-03).

import type {
  AltaNodoInput,
  AltaPeriodoInput,
  AltaUnidadInput,
  DepartamentoAuditoria,
  EdicionNodoInput,
  EdicionPeriodoInput,
  EdicionUnidadInput,
  NivelCodigo,
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

  /**
   * Código que recibiría la siguiente alta del nivel, sin consumirlo (vista previa del
   * formulario). Puede quedar adelantado si otra alta se guarda antes.
   */
  codigoProximo(nivel: NivelCodigo): Promise<string>;

  // Unidades de negocio, con su jerarquía anidada.
  listarUnidades(): Promise<UnidadNegocio[]>;
  buscarUnidadPorId(id: number): Promise<UnidadNegocio | null>;
  /**
   * Asigna el código: el mayor que exista en el nivel más uno (si se borró el último, su
   * código se vuelve a usar). El nombre, si lo tiene, es único sin distinguir mayúsculas:
   * lanza ErrorNombreDuplicado.
   */
  crearUnidad(datos: AltaUnidadInput, periodoFiscalId: number, creadoPor: number): Promise<UnidadNegocio>;
  /** El código no se edita. Lanza ErrorNombreDuplicado si el nombre ya lo usa otra unidad. */
  editarUnidad(id: number, campos: EdicionUnidadInput): Promise<UnidadNegocio | null>;
  eliminarUnidad(id: number): Promise<void>;

  // División, subdivisión y área. Sus nombres se repiten entre ramas, salvo el del área
  // dentro de su subdivisión (crearNodo y editarNodo lanzan ErrorNombreDuplicado).
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
