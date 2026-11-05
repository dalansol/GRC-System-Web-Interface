import React, { Fragment, useEffect, useState } from "react";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronRight,
  Filter,
  ClipboardList,
  CalendarClock,
  ArrowRight,
  Plus
} from "lucide-react";
import { toast } from "sonner";

import { listarControlesParaHallazgo } from "../api/controles";
import FormularioHallazgo, { type FindingControlOption } from "./FormularioHallazgo";
import FormularioPlanAccion from "./FormularioPlanAccion";
import { esAuditado, puedeGestionarPlanes } from "../api/planesAccion";
import { useSesion } from "../auth/SesionContext";
import { useHallazgosViewModel, HallazgoViewModel } from "../domain/hallazgos/useHallazgosViewModel";

export type Hallazgo = HallazgoViewModel;

export interface HallazgoActivo {
  id: string;
  folio: string | null;
}

interface Props {
  onSelectFinding?: (finding: HallazgoViewModel) => void;
  /** Avisa qué hallazgo está expandido, para que el asistente Copilot use su expediente. */
  onHallazgoActivo?: (hallazgo: HallazgoActivo | null) => void;
}

export default function VistaHallazgo({ onSelectFinding, onHallazgoActivo }: Props = {}) {
  const { usuario } = useSesion();
  const {
    hallazgos: rawHallazgos,
    loading,
    expandedFinding,
    sevFilter,
    statusFilter,
    USE_REAL_BACKEND,
    planesPorHallazgo,
    hallazgoParaPlan,
    setHallazgoParaPlan,
    handlePlanCreado,
    handlePlanActualizado,
    setExpandedFinding,
    setSevFilter,
    setStatusFilter,
    fetchHallazgos,
    nextFolio,
    showCreateForm,
    setShowCreateForm,
  } = useHallazgosViewModel({
    consultarPlanes: !esAuditado(usuario?.rol),
    consultarPlanesRelacionados: esAuditado(usuario?.rol),
  });

  // State for selected finding IDs via checkboxes
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);
  const [controlesHallazgo, setControlesHallazgo] = useState<FindingControlOption[]>([]);
  const [cargandoControles, setCargandoControles] = useState(false);

  // El hallazgo se liga al control y al plan de una asignación real del usuario (SF-09).
  const abrirNuevoHallazgo = async () => {
    setCargandoControles(true);
    try {
      const controles = await listarControlesParaHallazgo();
      if (controles.length === 0) {
        toast.info("No tienes controles asignados en un plan para registrar un hallazgo.");
        return;
      }
      setControlesHallazgo(
        controles.map((control) => ({
          id: control.control_id,
          name: control.name,
          vulnerability: control.tiene_deficiencia ? "Alta" : "Baja",
          auditId: String(control.audit_id),
          etiqueta: `${control.code} - ${control.name} (${control.plan_code})`,
        })),
      );
      setShowCreateForm(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los controles.");
    } finally {
      setCargandoControles(false);
    }
  };

  // Roles permitidos para ver todos los hallazgos
  const esEquipoAuditoria = Boolean(
    usuario?.rol && ["Administrador", "Jefe de Auditoría", "Auditor Senior", "Auditor"].includes(usuario.rol)
  );

  // El auditor define los planes (UF-08): solo él ve las casillas y el botón de crear.
  const puedeCrearPlan = puedeGestionarPlanes(usuario?.rol);
  // Filtrado de seguridad: si no es equipo de auditoría, solo ve hallazgos de su unidad o asignados
  const hallazgos = rawHallazgos.filter((item) => {
    if (esEquipoAuditoria) return true;

    const buUsuario = (usuario as any)?.business_unit_id ?? usuario?.businessUnitId;
    const buHallazgo = (item as any)?.business_unit_id ?? (item as any)?.businessUnitId;

    const esDeSuUnidad = buUsuario && buHallazgo && buUsuario === buHallazgo;
    const esCreadorOImpactado = item.auditId === String(usuario?.id) || (item as any)?.creadorId === usuario?.id;

    return esDeSuUnidad || esCreadorOImpactado;
  });

  // El hallazgo expandido es el que el asistente Copilot usa como expediente.
  const activo = hallazgos.find((h) => h.id === expandedFinding);
  const activoId = activo?.id ?? null;
  const activoFolio = activo?.folio ?? null;
  useEffect(() => {
    onHallazgoActivo?.(activoId ? { id: activoId, folio: activoFolio } : null);
  }, [onHallazgoActivo, activoId, activoFolio]);
  useEffect(() => () => onHallazgoActivo?.(null), [onHallazgoActivo]);

  const toggleSelectAll = () => {
    if (selectedFindingIds.length === hallazgos.length) {
      setSelectedFindingIds([]);
    } else {
      setSelectedFindingIds(hallazgos.map((h) => h.id));
    }
  };

  const toggleSelectFinding = (id: string) => {
    setSelectedFindingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full space-y-4 p-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Gestión de Hallazgos
          </h1>

          <p className="text-xs text-muted-foreground">
            Modo actual:{" "}
            <span className="font-semibold text-primary">
              {USE_REAL_BACKEND
                ? "Mock Data Servidor"
                : "Mock Data Local"}
            </span>
            {!esEquipoAuditoria && (
              <span className="ml-2 text-amber-600 font-medium">
                (Vista restringida a hallazgos de tu unidad/asignación)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {esEquipoAuditoria && (
            <button
              type="button"
              disabled={cargandoControles}
              onClick={abrirNuevoHallazgo}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Plus size={14} />
              Nuevo hallazgo
            </button>
          )}

          {puedeCrearPlan && (
            <button
              type="button"
              disabled={selectedFindingIds.length === 0}
              onClick={() => {
                const primerHallazgo = hallazgos.find((h) => h.id === selectedFindingIds[0]);
                if (primerHallazgo) {
                  setHallazgoParaPlan(primerHallazgo);
                }
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus size={14} />
              Crear plan de acción
            </button>
          )}

          <button
            onClick={fetchHallazgos}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Recargar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Filter size={12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Gravedad:</span>
        {["all", "Crítico", "Alto", "Medio", "Bajo"].map(f => (
          <button key={f} onClick={() => setSevFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${sevFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f === "all" ? "Todos" : f}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-xs text-muted-foreground font-medium">Estado:</span>
        {["all", "Abierto", "En Proceso", "Asignado", "En Revisión", "Cerrado"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f === "all" ? "Todos" : f}
          </button>
        ))}
      </div>

      {/* Tabla de Hallazgos */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={20} />
            Cargando hallazgos...
          </div>
        ) : hallazgos.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No se encontraron hallazgos registrados que afecten a tu unidad o perfil.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {puedeCrearPlan && (
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={hallazgos.length > 0 && selectedFindingIds.length === hallazgos.length}
                      onChange={toggleSelectAll}
                      aria-label="Seleccionar todos los hallazgos"
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                  </th>
                )}
                <th className="px-4 py-3">ID / Folio</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Severidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hallazgos.map((item) => {
                const isExpanded = expandedFinding === item.id;
                const isSelected = selectedFindingIds.includes(item.id);
                return (
                  <Fragment key={item.id}>
                    <tr
                      className={`transition-colors cursor-pointer group ${isExpanded ? "bg-secondary/40" : "hover:bg-muted/30"}`}
                      onClick={() => setExpandedFinding(isExpanded ? null : item.id)}
                    >
                      {puedeCrearPlan && (
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectFinding(item.id)}
                            aria-label={`Seleccionar hallazgo ${item.folio || item.id}`}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>
                            <ChevronRight size={12} />
                          </span>
                          {item.folio || item.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{item.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${item.severity === "Crítico" || item.severity === "Alto"
                            ? "bg-red-500/10 text-red-600"
                            : item.severity === "Medio"
                              ? "bg-yellow-500/10 text-yellow-600"
                              : "bg-green-500/10 text-green-600"
                            }`}
                        >
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          {item.status === "Cerrado" ? (
                            <CheckCircle2 size={14} className="text-green-500" />
                          ) : item.status === "En Proceso" || item.status === "En Revisión" ? (
                            <Clock size={14} className="text-yellow-500" />
                          ) : (
                            <AlertCircle size={14} className="text-red-500" />
                          )}
                          {item.status || "Abierto"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectFinding) {
                              onSelectFinding(item);
                            }
                          }}
                          className="inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="Ver detalle del hallazgo"
                        >
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={puedeCrearPlan ? 6 : 5} className="px-4 pb-4 bg-secondary/20 border-b border-border">
                          <div className="pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                            {/* Visualización de Planes de Acción relacionados */}
                            {(() => {
                              const planes = planesPorHallazgo[item.id] ?? [];
                              const hoy = new Date().toISOString().slice(0, 10);
                              if (planes.length > 0) {
                                return (
                                  <div className="space-y-3" data-testid={`planes-${item.id}`}>
                                    {planes.map((plan) => (
                                      <div key={plan.id} className="rounded-lg border border-border bg-card p-4">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            <ClipboardList size={14} /> Plan de acción relacionado
                                          </div>
                                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${plan.estado === "Completado" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                                            {plan.estado}
                                          </span>
                                        </div>
                                        <p className="text-sm text-foreground leading-relaxed">{plan.descripcion}</p>
                                        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border pt-3">
                                          <div>
                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Responsable auditado</div>
                                            <div className="text-sm font-medium text-foreground">{plan.responsable.nombre}</div>
                                          </div>
                                          <div>
                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Fecha límite</div>
                                            <div className={`text-sm font-semibold font-mono ${plan.estado !== "Completado" && plan.fechaCompromiso < hoy ? "text-red-600" : "text-foreground"}`}>
                                              {plan.fechaCompromiso}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {puedeCrearPlan && (
                                      <button
                                        type="button"
                                        onClick={() => setHallazgoParaPlan(item)}
                                        className="text-xs font-semibold text-primary hover:underline"
                                      >
                                        + Crear otro plan de acción
                                      </button>
                                    )}
                                  </div>
                                );
                              }
                              if (item.status === "Cerrado") return null;
                              return (
                                <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card px-4 py-3">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <CalendarClock size={14} /> Este hallazgo aún no tiene un plan de acción correctivo relacionado.
                                  </div>
                                </div>
                              );
                            })()}
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

      {showCreateForm && esEquipoAuditoria && (
        <FormularioHallazgo
          controls={controlesHallazgo}
          nextFolio={nextFolio}
          onCreated={() => {
            void fetchHallazgos();
          }}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {hallazgoParaPlan && puedeCrearPlan && (
        <FormularioPlanAccion
          hallazgosSeleccionados={hallazgos.filter(h => selectedFindingIds.includes(h.id))}
          onGuardado={handlePlanCreado}
          onCerrar={() => setHallazgoParaPlan(null)}
        />
      )}
    </div>
  );
}