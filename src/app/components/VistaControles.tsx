/**
 * VistaControles.tsx — Capa de Presentación
 *
 * Solo renderiza. No contiene lógica de negocio ni cálculos de datos.
 * Toda la lógica está delegada al hook useControlesViewModel.
 *
 * Requisitos cubiertos:
 *   SF-06 — Evaluación de controles (columna Nivel de Riesgo + validez)
 *   SF-07 — Asignación dinámica (filtro por tipo y estado)
 *   SF-13 — Exportación CSV
 *   SF-18 — Trazabilidad (botón "Ver Detalles" abre ControlDetailView vía navigate)
 */

import React, { useState, Fragment } from "react";
import {
  Search,
  XCircle,
  Download,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck
} from "lucide-react";

import { CONTROLS, INITIAL_FINDINGS } from "../data/mock_data";
import type { Navigate } from "./SharedComponents";
import { exportToCSV, ValidityBadge } from "./SharedComponents";
import { useControlesViewModel } from "../domain/controles/useControlesViewModel";
import type { ControlViewModel } from "../domain/controles/useControlesViewModel";
import EvidenciasSection from "./EvidenciasSection";

// ─── Sub-componentes de presentación ─────────────────────────────────────────

/** Badge visual para el nivel de riesgo de un control. */
function NivelRiesgoBadge({ nivel }: { nivel: ControlViewModel["nivelRiesgo"] }) {
  const config = {
    Fallido: {
      icon: <XCircle size={11} />,
      label: "Fallido",
      className: "bg-red-100 text-red-700 border border-red-200",
    },
    Vulnerable: {
      icon: <AlertTriangle size={11} />,
      label: "Vulnerable",
      className: "bg-amber-100 text-amber-700 border border-amber-200",
    },
    Activo: {
      icon: <CheckCircle2 size={11} />,
      label: "Activo",
      className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    },
  }[nivel];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  navigate: Navigate;
}

export default function VistaControles({ navigate }: Props) {
  const {
    controlesFiltrados,
    filtros,
    setFiltros,
    kpis,
    limpiarFiltros,
    filtrosActivos,
  } = useControlesViewModel(CONTROLS, INITIAL_FINDINGS);

  const [expandedControl, setExpandedControl] = useState<string | null>(null);

  // Construir filas de CSV para exportación (SF-13)
  const handleExportar = () => {
    exportToCSV(
      "controles.csv",
      ["ID", "Nombre Procedimiento", "N° Control Negocio", "Tipo", "Frecuencia", "Vulnerabilidad", "Estado", "Nivel Riesgo"],
      controlesFiltrados.map((c) => [
        c.id,
        c.controlProcedureName,
        c.businessControlNumber,
        c.controlType,
        c.frequency,
        c.currentVulnerability,
        c.controlStatus,
        c.nivelRiesgo,
      ])
    );
  };

  return (
    <div
      className="w-full space-y-4 p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Catálogo de Controles
          </h1>
          <p className="text-xs text-muted-foreground">
            {kpis.total} controles registrados · <span className="font-semibold text-primary">{kpis.tasaEfectividad}% efectividad</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportar}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Filter size={12} className="text-muted-foreground" />
        
        {/* Búsqueda */}
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Buscar..."
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            className="w-40 pl-7 pr-2 py-1 text-xs bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <span className="text-xs text-muted-foreground font-medium">Tipo:</span>
        {["Todos", "Preventivo", "Detectivo"].map(f => (
          <button key={f} onClick={() => setFiltros({ ...filtros, tipo: f })}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${filtros.tipo === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f}
          </button>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        <span className="text-xs text-muted-foreground font-medium">Estado:</span>
        {["Todos", "Activo", "Inactivo", "En Revisión"].map(f => (
          <button key={f} onClick={() => setFiltros({ ...filtros, estado: f })}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${filtros.estado === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f}
          </button>
        ))}

        <div className="w-px h-4 bg-border mx-1" />

        <span className="text-xs text-muted-foreground font-medium">Riesgo:</span>
        {["Todos", "Activo", "Vulnerable", "Fallido"].map(f => (
          <button key={f} onClick={() => setFiltros({ ...filtros, nivelRiesgo: f })}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${filtros.nivelRiesgo === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f}
          </button>
        ))}

        {filtrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="text-xs text-muted-foreground hover:text-foreground ml-2 flex items-center gap-1 transition-colors"
          >
            <XCircle size={12} />
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla de controles */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {controlesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground">
            <ShieldCheck size={28} className="mx-auto mb-3 opacity-30" />
            No se encontraron controles con los filtros aplicados.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Procedimiento</th>
                <th className="px-4 py-3">N° Negocio</th>
                <th className="px-4 py-3">Tipo / Frec.</th>
                <th className="px-4 py-3">Validez</th>
                <th className="px-4 py-3">Nivel Riesgo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {controlesFiltrados.map((control) => {
                const isExpanded = expandedControl === control.id;
                return (
                  <Fragment key={control.id}>
                    <tr
                      className={`transition-colors cursor-pointer group ${isExpanded ? "bg-secondary/40" : "hover:bg-muted/30"}`}
                      onClick={() => setExpandedControl(isExpanded ? null : control.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>
                            <ChevronRight size={12} />
                          </span>
                          <span className="text-primary bg-primary/8 px-1.5 py-0.5 rounded">
                            {control.id}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="font-medium text-foreground truncate">
                          {control.controlProcedureName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {control.controlActivity}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-mono">
                          {control.businessControlNumber}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              control.controlType === "Preventivo"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {control.controlType}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {control.frequency}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <ValidityBadge status={control.validityStatus} />
                      </td>

                      <td className="px-4 py-3">
                        <NivelRiesgoBadge nivel={control.nivelRiesgo} />
                      </td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate("control", control.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                        >
                          Ver detalles
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-4 pb-4 bg-secondary/20 border-b border-border">
                          <div className="pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                            <EvidenciasSection 
                              entityId={control.id} 
                              entityType="control" 
                              controlId={control.id}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

