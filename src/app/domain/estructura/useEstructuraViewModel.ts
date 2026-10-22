import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  crearNodo as apiCrearNodo,
  crearPeriodo as apiCrearPeriodo,
  editarPeriodo as apiEditarPeriodo,
  crearUnidadNegocio as apiCrearUnidad,
  editarNodo as apiEditarNodo,
  editarUnidadNegocio as apiEditarUnidad,
  eliminarNodo as apiEliminarNodo,
  eliminarUnidadNegocio as apiEliminarUnidad,
  ETIQUETA_NIVEL,
  listarDepartamentos as apiListarDepartamentos,
  listarPeriodos as apiListarPeriodos,
  listarResponsables as apiListarResponsables,
  listarUnidades as apiListarUnidades,
  obtenerPeriodoActivo as apiObtenerPeriodoActivo,
  obtenerUnidadPorId as apiObtenerUnidad,
  ROLES_GESTION_ESTRUCTURA,
  type AltaPeriodoInput,
  type AltaUnidadInput,
  type DepartamentoAuditoria,
  type EdicionNodoInput,
  type EdicionUnidadInput,
  type NivelNodo,
  type PeriodoFiscal,
  type Responsable,
  type UnidadNegocio,
  type DatosNodo,
} from "../../api/estructura";
import { useSesion } from "../../auth/SesionContext";
import { nombreVisible, tieneNombre, type ConNombre } from "./nombres";

/** "KOF" (UDN-0003) o solo "UDN-0003": el aviso de alta confirma el código asignado. */
function conCodigo(nodo: ConNombre): string {
  return tieneNombre(nodo) ? `"${nombreVisible(nodo)}" (${nodo.codigo})` : `"${nombreVisible(nodo)}"`;
}

/** Nodo de la jerarquía (división, subdivisión o área) junto con la unidad a la que pertenece. */
export interface NodoSeleccionado {
  nivel: NivelNodo;
  id: number;
  /** Null en el área. */
  codigo?: string | null;
  nombre?: string | null;
  pais?: string | null;
  unidadId: number;
}

/** Contexto para dar de alta un nodo hijo. */
export interface AltaNodoContexto {
  nivel: NivelNodo;
  padreId: number;
  padreNombre: string;
  unidadId: number;
}

function mensajeDe(err: unknown, porDefecto: string): string {
  return (err as { message?: string })?.message ?? porDefecto;
}

export function useEstructuraViewModel() {
  const { usuario } = useSesion();

  const [unidades, setUnidades] = useState<UnidadNegocio[]>([]);
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoFiscal | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoFiscal[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoAuditoria[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  /** Mensaje si no se pudo leer el catálogo (para no confundirlo con un catálogo vacío). */
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<boolean>(false);

  // Estados de modales
  const [modalAltaAbierto, setModalAltaAbierto] = useState<boolean>(false);
  const [errorModalAlta, setErrorModalAlta] = useState<string | null>(null);

  const [altaNodo, setAltaNodo] = useState<AltaNodoContexto | null>(null);
  const [errorModalNodo, setErrorModalNodo] = useState<string | null>(null);

  const [unidadEditando, setUnidadEditando] = useState<UnidadNegocio | null>(null);
  const [nodoEditando, setNodoEditando] = useState<NodoSeleccionado | null>(null);
  const [errorModalEdicion, setErrorModalEdicion] = useState<string | null>(null);

  const [modalPeriodosAbierto, setModalPeriodosAbierto] = useState<boolean>(false);
  const [errorModalPeriodos, setErrorModalPeriodos] = useState<string | null>(null);

  const puedeGestionar = useMemo(() => {
    if (!usuario?.rol) return false;
    return (ROLES_GESTION_ESTRUCTURA as readonly string[]).includes(usuario.rol);
  }, [usuario?.rol]);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    const [periodoRes, periodosRes, unidadesRes, departamentosRes, responsablesRes] = await Promise.allSettled([
      apiObtenerPeriodoActivo(),
      apiListarPeriodos(),
      apiListarUnidades(),
      apiListarDepartamentos(),
      puedeGestionar ? apiListarResponsables() : Promise.resolve([]),
    ]);

    // Manejo no intrusivo: lo que falle queda vacío en la vista.
    setPeriodoActivo(periodoRes.status === "fulfilled" ? periodoRes.value : null);
    if (periodosRes.status === "fulfilled") setPeriodos(periodosRes.value);
    setUnidades(unidadesRes.status === "fulfilled" ? unidadesRes.value : []);
    setErrorCarga(
      unidadesRes.status === "rejected" ? mensajeDe(unidadesRes.reason, "No se pudo cargar el catálogo.") : null,
    );
    if (departamentosRes.status === "fulfilled") setDepartamentos(departamentosRes.value);
    if (responsablesRes.status === "fulfilled") setResponsables(responsablesRes.value);
    setCargando(false);
  }, [puedeGestionar]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  /** Vuelve a leer una unidad con su jerarquía tras cambiar uno de sus nodos. */
  const refrescarUnidad = async (unidadId: number) => {
    const actualizada = await apiObtenerUnidad(unidadId);
    setUnidades((prev) => prev.map((u) => (u.id === unidadId ? actualizada : u)));
  };

  // ── Alta de unidad de negocio ───────────────────────────────────────────────

  const abrirModalAlta = () => {
    setErrorModalAlta(null);
    setModalAltaAbierto(true);
  };

  const cerrarModalAlta = () => {
    setModalAltaAbierto(false);
    setErrorModalAlta(null);
  };

  /** Devuelve la unidad creada (la vista la abre) o null si falló. */
  const guardarNuevaUnidad = async (datos: AltaUnidadInput): Promise<UnidadNegocio | null> => {
    setGuardando(true);
    setErrorModalAlta(null);
    try {
      const nueva = await apiCrearUnidad(datos);
      setUnidades((prev) => [...prev, nueva].sort((a, b) => a.codigo.localeCompare(b.codigo)));
      toast.success(`Unidad de negocio ${conCodigo(nueva)} creada exitosamente.`);
      cerrarModalAlta();
      return nueva;
    } catch (err) {
      const mensaje = mensajeDe(err, "Error al registrar la unidad de negocio.");
      setErrorModalAlta(mensaje);
      toast.error(mensaje);
      return null;
    } finally {
      setGuardando(false);
    }
  };

  // ── Alta de división, subdivisión o área ────────────────────────────────────

  const abrirAltaNodo = (contexto: AltaNodoContexto) => {
    setErrorModalNodo(null);
    setAltaNodo(contexto);
  };

  const cerrarAltaNodo = () => {
    setAltaNodo(null);
    setErrorModalNodo(null);
  };

  const guardarNuevoNodo = async (datos: DatosNodo): Promise<boolean> => {
    if (!altaNodo) return false;
    setGuardando(true);
    setErrorModalNodo(null);
    try {
      const nodo = await apiCrearNodo(altaNodo.nivel, { ...datos, padreId: altaNodo.padreId });
      await refrescarUnidad(altaNodo.unidadId);
      toast.success(`${ETIQUETA_NIVEL[altaNodo.nivel]} ${conCodigo(nodo)} agregada exitosamente.`);
      cerrarAltaNodo();
      return true;
    } catch (err) {
      const mensaje = mensajeDe(err, "Error al agregar el elemento.");
      setErrorModalNodo(mensaje);
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // ── Edición ─────────────────────────────────────────────────────────────────

  const abrirEditarUnidad = (unidad: UnidadNegocio) => {
    setErrorModalEdicion(null);
    setUnidadEditando(unidad);
  };

  const abrirEditarNodo = (nodo: NodoSeleccionado) => {
    setErrorModalEdicion(null);
    setNodoEditando(nodo);
  };

  const cerrarEdicion = () => {
    setUnidadEditando(null);
    setNodoEditando(null);
    setErrorModalEdicion(null);
  };

  const guardarEdicionUnidad = async (id: number, cambios: EdicionUnidadInput): Promise<boolean> => {
    setGuardando(true);
    setErrorModalEdicion(null);
    try {
      const actualizada = await apiEditarUnidad(id, cambios);
      setUnidades((prev) => prev.map((u) => (u.id === id ? actualizada : u)));
      toast.success("Unidad de negocio actualizada exitosamente.");
      cerrarEdicion();
      return true;
    } catch (err) {
      const mensaje = mensajeDe(err, "Error al editar la unidad de negocio.");
      setErrorModalEdicion(mensaje);
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const guardarEdicionNodo = async (nodo: NodoSeleccionado, cambios: EdicionNodoInput): Promise<boolean> => {
    setGuardando(true);
    setErrorModalEdicion(null);
    try {
      await apiEditarNodo(nodo.nivel, nodo.id, cambios);
      await refrescarUnidad(nodo.unidadId);
      toast.success(`${ETIQUETA_NIVEL[nodo.nivel]} actualizada exitosamente.`);
      cerrarEdicion();
      return true;
    } catch (err) {
      const mensaje = mensajeDe(err, "Error al editar el elemento.");
      setErrorModalEdicion(mensaje);
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // ── Periodos de auditoría ───────────────────────────────────────────────────

  const abrirModalPeriodos = () => {
    setErrorModalPeriodos(null);
    setModalPeriodosAbierto(true);
  };

  const cerrarModalPeriodos = () => {
    setModalPeriodosAbierto(false);
    setErrorModalPeriodos(null);
  };

  /** Vuelve a leer los periodos y el activo (activar uno desactiva los demás en el backend). */
  const refrescarPeriodos = async () => {
    const lista = await apiListarPeriodos();
    setPeriodos(lista);
    setPeriodoActivo(lista.find((p) => p.activo) ?? null);
  };

  const guardarPeriodo = async (datos: AltaPeriodoInput): Promise<boolean> => {
    setGuardando(true);
    setErrorModalPeriodos(null);
    try {
      const periodo = await apiCrearPeriodo(datos);
      await refrescarPeriodos();
      toast.success(`Periodo "${periodo.nombre}" registrado${periodo.activo ? " y activado" : ""}.`);
      return true;
    } catch (err) {
      setErrorModalPeriodos(mensajeDe(err, "Error al registrar el periodo."));
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const activarPeriodo = async (periodo: PeriodoFiscal): Promise<boolean> => {
    setGuardando(true);
    setErrorModalPeriodos(null);
    try {
      await apiEditarPeriodo(periodo.id, { activo: true });
      await refrescarPeriodos();
      toast.success(`Periodo "${periodo.nombre}" activado.`);
      return true;
    } catch (err) {
      setErrorModalPeriodos(mensajeDe(err, "Error al activar el periodo."));
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminación (AC3) ───────────────────────────────────────────────────────
  // Devuelven el mensaje de error (auditorías activas, elementos dependientes) o null; la
  // vista lo muestra en el diálogo de confirmación, así que no se repite en un aviso.

  const eliminarUnidad = async (unidad: UnidadNegocio): Promise<string | null> => {
    try {
      await apiEliminarUnidad(unidad.id);
      setUnidades((prev) => prev.filter((u) => u.id !== unidad.id));
      toast.success(`Unidad de negocio "${nombreVisible(unidad)}" eliminada exitosamente.`);
      return null;
    } catch (err) {
      return mensajeDe(err, "Error al eliminar la unidad de negocio.");
    }
  };

  const eliminarNodo = async (nodo: NodoSeleccionado): Promise<string | null> => {
    try {
      await apiEliminarNodo(nodo.nivel, nodo.id);
      await refrescarUnidad(nodo.unidadId);
      toast.success(`${ETIQUETA_NIVEL[nodo.nivel]} "${nombreVisible(nodo)}" eliminada exitosamente.`);
      return null;
    } catch (err) {
      return mensajeDe(err, "Error al eliminar el elemento.");
    }
  };

  return {
    unidades,
    periodoActivo,
    periodos,
    departamentos,
    responsables,
    cargando,
    errorCarga,
    guardando,
    puedeGestionar,
    // Periodos
    modalPeriodosAbierto,
    errorModalPeriodos,
    abrirModalPeriodos,
    cerrarModalPeriodos,
    guardarPeriodo,
    activarPeriodo,
    // Alta de unidad
    modalAltaAbierto,
    errorModalAlta,
    abrirModalAlta,
    cerrarModalAlta,
    guardarNuevaUnidad,
    // Alta de nodo
    altaNodo,
    errorModalNodo,
    abrirAltaNodo,
    cerrarAltaNodo,
    guardarNuevoNodo,
    // Edición
    unidadEditando,
    nodoEditando,
    errorModalEdicion,
    abrirEditarUnidad,
    abrirEditarNodo,
    cerrarEdicion,
    guardarEdicionUnidad,
    guardarEdicionNodo,
    // Eliminación
    eliminarUnidad,
    eliminarNodo,
    // Recarga
    recargar: cargarDatos,
  };
}
