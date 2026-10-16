import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  crearProceso as apiCrearProceso,
  crearUnidadNegocio as apiCrearUnidad,
  editarProceso as apiEditarProceso,
  editarUnidadNegocio as apiEditarUnidad,
  eliminarProceso as apiEliminarProceso,
  eliminarUnidadNegocio as apiEliminarUnidad,
  listarPeriodos as apiListarPeriodos,
  listarResponsables as apiListarResponsables,
  listarUnidades as apiListarUnidades,
  obtenerPeriodoActivo as apiObtenerPeriodoActivo,
  ROLES_GESTION_ESTRUCTURA,
  type AltaUnidadInput,
  type PeriodoFiscal,
  type Proceso,
  type UnidadNegocio,
} from "../../api/estructura";
import { listarUsuarios, type Usuario } from "../../api/usuarios";
import { useSesion } from "../../auth/SesionContext";

export function useEstructuraViewModel() {
  const { usuario } = useSesion();

  const [unidades, setUnidades] = useState<UnidadNegocio[]>([]);
  const [periodoActivo, setPeriodoActivo] = useState<PeriodoFiscal | null>(null);
  const [periodos, setPeriodos] = useState<PeriodoFiscal[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de modales
  const [modalAltaAbierto, setModalAltaAbierto] = useState<boolean>(false);
  const [errorModalAlta, setErrorModalAlta] = useState<string | null>(null);

  const [modalProcesoAbierto, setModalProcesoAbierto] = useState<boolean>(false);
  const [unidadSeleccionadaParaProceso, setUnidadSeleccionadaParaProceso] = useState<UnidadNegocio | null>(null);
  const [errorModalProceso, setErrorModalProceso] = useState<string | null>(null);

  const [unidadEditando, setUnidadEditando] = useState<UnidadNegocio | null>(null);
  const [procesoEditando, setProcesoEditando] = useState<{ proceso: Proceso; unidadId: number } | null>(null);

  const puedeGestionar = useMemo(() => {
    if (!usuario?.rol) return false;
    return (ROLES_GESTION_ESTRUCTURA as readonly string[]).includes(usuario.rol);
  }, [usuario?.rol]);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [periodoRes, periodosRes, unidadesRes, usuariosRes] = await Promise.allSettled([
        apiObtenerPeriodoActivo(),
        apiListarPeriodos(),
        apiListarUnidades(),
        puedeGestionar
          ? apiListarResponsables().catch(() => listarUsuarios().catch(() => []))
          : Promise.resolve([]),
      ]);

      if (periodoRes.status === "fulfilled") {
        setPeriodoActivo(periodoRes.value);
      } else {
        setPeriodoActivo(null);
      }

      if (periodosRes.status === "fulfilled") {
        setPeriodos(periodosRes.value);
      }

      if (unidadesRes.status === "fulfilled") {
        setUnidades(unidadesRes.value);
      } else {
        setUnidades([]);
      }

      if (usuariosRes.status === "fulfilled" && Array.isArray(usuariosRes.value)) {
        setUsuarios(usuariosRes.value.filter((u: any) => u.estado === "active" || u.estado === undefined));
      }
    } catch {
      // Manejo no intrusivo: no mostrar pancartas rojas agresivas en la vista
    } finally {
      setCargando(false);
    }
  }, [puedeGestionar]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Alta de Unidad de Negocio ────────────────────────────────────────────────

  const abrirModalAlta = () => {
    setErrorModalAlta(null);
    setModalAltaAbierto(true);
  };

  const cerrarModalAlta = () => {
    setModalAltaAbierto(false);
    setErrorModalAlta(null);
  };

  const guardarNuevaUnidad = async (datos: AltaUnidadInput): Promise<boolean> => {
    setGuardando(true);
    setErrorModalAlta(null);
    try {
      const nueva = await apiCrearUnidad(datos);
      setUnidades((prev) => [...prev, nueva]);
      toast.success(`Unidad de negocio "${nueva.nombre}" creada exitosamente.`);
      cerrarModalAlta();
      return true;
    } catch (err: any) {
      const mensaje = err?.message ?? "Error al registrar la unidad de negocio.";
      setErrorModalAlta(mensaje);
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // ── Edición de Unidad de Negocio ─────────────────────────────────────────────

  const abrirEditarUnidad = (unidad: UnidadNegocio) => {
    setUnidadEditando(unidad);
  };

  const cerrarEditarUnidad = () => {
    setUnidadEditando(null);
  };

  const guardarEdicionUnidad = async (
    id: number,
    cambios: { nombre?: string; responsableId?: number },
  ): Promise<boolean> => {
    setGuardando(true);
    try {
      const actualizada = await apiEditarUnidad(id, cambios);
      setUnidades((prev) => prev.map((u) => (u.id === id ? actualizada : u)));
      toast.success("Unidad de negocio actualizada exitosamente.");
      cerrarEditarUnidad();
      return true;
    } catch (err: any) {
      const mensaje = err?.message ?? "Error al editar la unidad de negocio.";
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminación de Unidad de Negocio ─────────────────────────────────────────

  const eliminarUnidad = async (unidad: UnidadNegocio): Promise<boolean> => {
    try {
      await apiEliminarUnidad(unidad.id);
      setUnidades((prev) => prev.filter((u) => u.id !== unidad.id));
      toast.success(`Unidad de negocio "${unidad.nombre}" eliminada exitosamente.`);
      return true;
    } catch (err: any) {
      const mensaje = err?.message ?? "Error al eliminar la unidad de negocio.";
      toast.error(mensaje);
      return false;
    }
  };

  // ── Procesos ─────────────────────────────────────────────────────────────────

  const abrirModalProceso = (unidad: UnidadNegocio) => {
    setUnidadSeleccionadaParaProceso(unidad);
    setErrorModalProceso(null);
    setModalProcesoAbierto(true);
  };

  const cerrarModalProceso = () => {
    setModalProcesoAbierto(false);
    setUnidadSeleccionadaParaProceso(null);
    setErrorModalProceso(null);
  };

  const guardarNuevoProceso = async (unidadId: number, nombre: string): Promise<boolean> => {
    setGuardando(true);
    setErrorModalProceso(null);
    try {
      const nuevoProceso = await apiCrearProceso({ unidadNegocioId: unidadId, nombre });
      setUnidades((prev) =>
        prev.map((u) => {
          if (u.id !== unidadId) return u;
          return {
            ...u,
            procesos: [...u.procesos, nuevoProceso],
          };
        }),
      );
      toast.success(`Proceso "${nuevoProceso.nombre}" agregado exitosamente.`);
      cerrarModalProceso();
      return true;
    } catch (err: any) {
      const mensaje = err?.message ?? "Error al agregar el proceso.";
      setErrorModalProceso(mensaje);
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const abrirEditarProceso = (proceso: Proceso, unidadId: number) => {
    setProcesoEditando({ proceso, unidadId });
  };

  const cerrarEditarProceso = () => {
    setProcesoEditando(null);
  };

  const guardarEdicionProceso = async (
    procesoId: number,
    nombre: string,
    unidadId: number,
  ): Promise<boolean> => {
    setGuardando(true);
    try {
      const actualizado = await apiEditarProceso(procesoId, { nombre });
      setUnidades((prev) =>
        prev.map((u) => {
          if (u.id !== unidadId) return u;
          return {
            ...u,
            procesos: u.procesos.map((p) => (p.id === procesoId ? actualizado : p)),
          };
        }),
      );
      toast.success("Proceso actualizado exitosamente.");
      cerrarEditarProceso();
      return true;
    } catch (err: any) {
      const mensaje = err?.message ?? "Error al editar el proceso.";
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProceso = async (proceso: Proceso, unidadId: number): Promise<boolean> => {
    try {
      await apiEliminarProceso(proceso.id);
      setUnidades((prev) =>
        prev.map((u) => {
          if (u.id !== unidadId) return u;
          return {
            ...u,
            procesos: u.procesos.filter((p) => p.id !== proceso.id),
          };
        }),
      );
      toast.success(`Proceso "${proceso.nombre}" eliminado exitosamente.`);
      return true;
    } catch (err: any) {
      const mensaje = err?.message ?? "Error al eliminar el proceso.";
      toast.error(mensaje);
      return false;
    }
  };

  return {
    unidades,
    periodoActivo,
    periodos,
    usuarios,
    cargando,
    guardando,
    error,
    puedeGestionar,
    // Modales
    modalAltaAbierto,
    errorModalAlta,
    abrirModalAlta,
    cerrarModalAlta,
    guardarNuevaUnidad,
    // Edición Unidad
    unidadEditando,
    abrirEditarUnidad,
    cerrarEditarUnidad,
    guardarEdicionUnidad,
    eliminarUnidad,
    // Procesos
    modalProcesoAbierto,
    unidadSeleccionadaParaProceso,
    errorModalProceso,
    abrirModalProceso,
    cerrarModalProceso,
    guardarNuevoProceso,
    // Edición Proceso
    procesoEditando,
    abrirEditarProceso,
    cerrarEditarProceso,
    guardarEdicionProceso,
    eliminarProceso,
    // Recarga
    recargar: cargarDatos,
  };
}
