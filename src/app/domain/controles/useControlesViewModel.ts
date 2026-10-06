/**
 * useControlesViewModel.ts — Capa de Aplicación / Use Cases
 *
 * Orquesta los datos (mock_data) y las reglas de dominio (controles.domain).
 * Es el único lugar que combina ambos. No sabe nada de HTML ni de CSS.
 *
 * El componente de presentación (VistaControles) solo llama a este hook
 * y renderiza lo que recibe — nunca filtra ni calcula por su cuenta.
 */

import { useMemo, useState } from "react";
import type { ControlRecord, Finding } from "../../components/SharedComponents";
import {
  nivelRiesgoControl,
  calcularKPIsControles,
  type NivelRiesgoControl,
} from "./controles.domain";

// ─── Tipos de ViewModel ───────────────────────────────────────────────────────

/** Proyección de ControlRecord enriquecida con datos calculados para la UI. */
export interface ControlViewModel extends ControlRecord {
  /** Nivel de riesgo efectivo, calculado por la regla de dominio. */
  nivelRiesgo: NivelRiesgoControl;
}

/** Estado completo de los filtros de la vista. */
export interface FiltrosControles {
  busqueda: string;
  tipo: string;       // "Todos" | "Preventivo" | "Detectivo"
  estado: string;     // "Todos" | "Activo" | ...
  nivelRiesgo: string; // "Todos" | "Fallido" | "Vulnerable" | "Activo"
}

const FILTROS_INICIALES: FiltrosControles = {
  busqueda: "",
  tipo: "Todos",
  estado: "Todos",
  nivelRiesgo: "Todos",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Encapsula toda la lógica de estado, filtrado y métricas de la vista de Controles.
 *
 * @param controls - Array de controles proveniente de la capa de datos.
 * @param findings - Array de hallazgos proveniente de la capa de datos.
 */
export function useControlesViewModel(
  controls: ControlRecord[],
  findings: Finding[]
) {
  const [filtros, setFiltros] = useState<FiltrosControles>(FILTROS_INICIALES);

  // Enriquecer cada control con su nivel de riesgo calculado (memoizado)
  const viewModels = useMemo<ControlViewModel[]>(
    () =>
      controls.map((c) => ({
        ...c,
        nivelRiesgo: nivelRiesgoControl(c, findings),
      })),
    [controls, findings]
  );

  // Aplicar todos los filtros activos (memoizado por cambios en filtros o datos)
  const controlesFiltrados = useMemo(() => {
    const q = filtros.busqueda.toLowerCase().trim();
    return viewModels.filter((c) => {
      const matchBusqueda =
        !q ||
        c.id.toLowerCase().includes(q) ||
        c.controlProcedureName.toLowerCase().includes(q) ||
        c.businessControlNumber.toLowerCase().includes(q) ||
        c.controlActivity.toLowerCase().includes(q);

      const matchTipo =
        filtros.tipo === "Todos" || c.controlType === filtros.tipo;

      const matchEstado =
        filtros.estado === "Todos" || c.controlStatus === filtros.estado;

      const matchNivelRiesgo =
        filtros.nivelRiesgo === "Todos" || c.nivelRiesgo === filtros.nivelRiesgo;

      return matchBusqueda && matchTipo && matchEstado && matchNivelRiesgo;
    });
  }, [viewModels, filtros]);

  // KPIs globales (calculados sobre el universo completo, no sobre los filtrados)
  const kpis = useMemo(
    () => calcularKPIsControles(controls, findings),
    [controls, findings]
  );

  /** Limpia todos los filtros a sus valores iniciales. */
  const limpiarFiltros = () => setFiltros(FILTROS_INICIALES);

  /** Indica si hay algún filtro activo (para mostrar botón "Limpiar"). */
  const filtrosActivos =
    filtros.busqueda !== "" ||
    filtros.tipo !== "Todos" ||
    filtros.estado !== "Todos" ||
    filtros.nivelRiesgo !== "Todos";

  return {
    controlesFiltrados,
    filtros,
    setFiltros,
    kpis,
    limpiarFiltros,
    filtrosActivos,
  };
}
