import React, { Fragment } from "react";
import {
  Trash2,
  Edit3,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  ChevronRight,
  Filter,
  ClipboardList,
  CalendarClock
} from "lucide-react";
import { toast } from "sonner";
import { CONTROLS } from "../data/mock_data";

import FormularioHallazgo, {
  CreatedFinding,
  FindingControlOption,
} from "./FormularioHallazgo";
import EvidenciasSection from "./EvidenciasSection";
import FormularioPlanAccion from "./FormularioPlanAccion";
import { useHallazgosViewModel, HallazgoViewModel } from "../domain/hallazgos/useHallazgosViewModel";

export type Hallazgo = HallazgoViewModel;

export default function VistaHallazgo() {
  const {
    hallazgos,
    loading,
    deletingId,
    editingHallazgo,
    isUpdating,
    showCreateForm,
    expandedFinding,
    sevFilter,
    statusFilter,
    USE_REAL_BACKEND,
    nextFolio,
    planesPorHallazgo,
    hallazgoParaPlan,
    setHallazgoParaPlan,
    handlePlanCreado,
    setEditingHallazgo,
    setShowCreateForm,
    setExpandedFinding,
    setSevFilter,
    setStatusFilter,
    fetchHallazgos,
    handleDelete,
    handleUpdate,
    handleFindingCreated,
  } = useHallazgosViewModel();

  const findingControls: FindingControlOption[] = CONTROLS.map((control) => ({
    id: control.id,
    name: control.controlProcedureName,
    vulnerability: control.currentVulnerability as FindingControlOption["vulnerability"],
  }));

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
                ? "API Backend (SQL Server)"
                : "Mock Data Local"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <Plus size={14} />
            Nuevo hallazgo
          </button>

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
            No se encontraron hallazgos registrados.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID / Folio</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Severidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hallazgos.map((item) => {
                const isExpanded = expandedFinding === item.id;
                return (
                  <Fragment key={item.id}>
                    <tr 
                      className={`transition-colors cursor-pointer group ${isExpanded ? "bg-secondary/40" : "hover:bg-muted/30"}`}
                      onClick={() => setExpandedFinding(isExpanded ? null : item.id)}
                    >
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
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingHallazgo(item)}
                            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id || item.status !== "Abierto"}
                            title={
                              item.status !== "Abierto"
                                ? "Solo se pueden eliminar hallazgos en estado Abierto"
                                : "Eliminar hallazgo"
                            }
                            className={`rounded p-1 disabled:opacity-50 ${item.status !== "Abierto"
                                ? "cursor-not-allowed text-muted-foreground/40"
                                : "text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                              }`}
                          >
                            {deletingId === item.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-4 pb-4 bg-secondary/20 border-b border-border">
                          <div className="pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                            {/* Plan de acción (SF-10) */}
                            {(() => {
                              const plan = planesPorHallazgo[item.id];
                              const hoy = new Date().toISOString().slice(0, 10);
                              if (plan) {
                                return (
                                  <div className="rounded-lg border border-border bg-card p-4" data-testid={`plan-${item.id}`}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <ClipboardList size={14} /> Plan de acción
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
                                );
                              }
                              if (item.status === "Cerrado") return null;
                              return (
                                <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card px-4 py-3">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <CalendarClock size={14} /> Este hallazgo aún no tiene un plan de acción correctivo.
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setHallazgoParaPlan(item)}
                                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                                  >
                                    <Plus size={14} />
                                    Crear plan de acción
                                  </button>
                                </div>
                              );
                            })()}
                            <EvidenciasSection 
                              entityId={item.id} 
                              entityType="hallazgo" 
                              findingId={item.id}
                              auditId={item.auditId}
                              controlId={item.failedControlId || item.controlId}
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

      {/* Modal de Edición (PUT) */}
      {editingHallazgo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleUpdate}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-foreground">Editar Hallazgo</h3>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Título
              </label>
              <input
                type="text"
                value={editingHallazgo.title}
                onChange={(e) =>
                  setEditingHallazgo({ ...editingHallazgo, title: e.target.value })
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Severidad
              </label>
              <select
                value={editingHallazgo.severity}
                onChange={(e) =>
                  setEditingHallazgo({
                    ...editingHallazgo,
                    severity: e.target.value as HallazgoViewModel["severity"],
                  })
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="Crítico">Crítico</option>
                <option value="Alto">Alto</option>
                <option value="Medio">Medio</option>
                <option value="Bajo">Bajo</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Estado
              </label>
              <select
                value={editingHallazgo.status || "Abierto"}
                onChange={(e) =>
                  setEditingHallazgo({
                    ...editingHallazgo,
                    status: e.target.value as HallazgoViewModel["status"],
                  })
                }
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="Abierto">Abierto</option>
                <option value="En Proceso">En Proceso</option>
                <option value="En Revisión">En Revisión</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setEditingHallazgo(null)}
                disabled={isUpdating}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isUpdating && <Loader2 size={14} className="animate-spin" />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
      {hallazgoParaPlan && (
        <FormularioPlanAccion
          hallazgoId={hallazgoParaPlan.id}
          hallazgoTitulo={hallazgoParaPlan.title}
          onCreado={handlePlanCreado}
          onCerrar={() => setHallazgoParaPlan(null)}
        />
      )}
      {showCreateForm && (
        <FormularioHallazgo
          controls={findingControls}
          nextFolio={nextFolio}
          auditId="AUD-001"
          onCreated={handleFindingCreated}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}