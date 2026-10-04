import React, { useState, useEffect } from "react";
import {
  Trash2,
  Edit3,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { INITIAL_FINDINGS, CONTROLS } from "../data/mock_data";

import FormularioHallazgo, {
  CreatedFinding,
  FindingControlOption,
} from "./FormularioHallazgo";

export interface Hallazgo {
  id: string;
  folio?: string;
  title: string;
  description?: string;
  type?: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  status: "Abierto" | "En Proceso" | "En Revisión" | "Asignado" | "Cerrado";
  auditId?: string;
  controlId?: string;
  ownerId?: string;
}

const metaEnv = (import.meta as any).env;
const API_BASE_URL = metaEnv?.VITE_API_URL || "http://localhost:3000/api";
const USE_REAL_BACKEND = metaEnv?.VITE_USE_REAL_BACKEND === "true";

const orderFindings = (findings: Hallazgo[]) =>
  [...findings].sort((left, right) => {
    const leftIsClosed = left.status === "Cerrado";
    const rightIsClosed = right.status === "Cerrado";

    if (leftIsClosed !== rightIsClosed) {
      return leftIsClosed ? 1 : -1;
    }

    return 0;
  });

export default function VistaHallazgo() {
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingHallazgo, setEditingHallazgo] = useState<Hallazgo | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 1. GET: Cargar hallazgos desde el Backend o Mock Data
  const fetchHallazgos = async () => {
    setLoading(true);
    try {
      if (USE_REAL_BACKEND) {
        const response = await fetch(`${API_BASE_URL}/hallazgos`);
        if (!response.ok) {
          throw new Error("No se pudieron obtener los hallazgos del servidor.");
        }
        const data = await response.json();
        setHallazgos(orderFindings(data));
      } else {
        // Fallback a mock_data.tsx
        setHallazgos(orderFindings(INITIAL_FINDINGS as unknown as Hallazgo[]));
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cargar los hallazgos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHallazgos();
  }, []);

  const findingControls: FindingControlOption[] = CONTROLS.map((control) => ({
    id: control.id,
    name: control.controlProcedureName,
    vulnerability: control.currentVulnerability as FindingControlOption["vulnerability"],
  }));

  const nextFolioNumber = hallazgos.reduce((max, finding) => {
    const number = Number(finding.folio?.split("-").pop());
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  const nextFolio = `HAL-${new Date().getFullYear()}-${String(
    nextFolioNumber,
  ).padStart(3, "0")}`;

  const handleFindingCreated = (finding: CreatedFinding) => {
    setHallazgos((current) => orderFindings([finding, ...current]));
  };

  // 2. DELETE: Eliminar hallazgo por ID
const handleDelete = async (id: string) => {
  const finding = hallazgos.find((item) => item.id === id);

  if (finding?.status === "En Revisión") {
    toast.error(
      "Este hallazgo ya fue enviado a revisión por la jefatura y no puede eliminarse.",
    );
    return;
  }

  if (
    !window.confirm("¿Estás seguro de que deseas eliminar este hallazgo?")
  ) {
    return;
  }

  setDeletingId(id);

  try {
    if (USE_REAL_BACKEND) {
      const response = await fetch(`${API_BASE_URL}/hallazgos/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.error || "Error al eliminar el hallazgo.",
        );
      }
    }

    setHallazgos((prev) => prev.filter((item) => item.id !== id));
    toast.success("Hallazgo eliminado correctamente.");
  } catch (error: any) {
    toast.error(error.message || "Error al eliminar el hallazgo.");
  } finally {
    setDeletingId(null);
  }
};

  // 3. PUT: Actualizar hallazgo desde el modal/formulario de edición
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHallazgo) return;

    setIsUpdating(true);
    try {
      if (USE_REAL_BACKEND) {
        const response = await fetch(`${API_BASE_URL}/hallazgos/${editingHallazgo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingHallazgo),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Error al actualizar el hallazgo.");
        }

        const updatedData = await response.json();
        setHallazgos((prev) =>
          prev.map((item) => (item.id === updatedData.id ? updatedData : item))
        );
      } else {
        // Fallback local
        setHallazgos((prev) =>
          prev.map((item) => (item.id === editingHallazgo.id ? editingHallazgo : item))
        );
      }

      toast.success("Hallazgo actualizado con éxito.");
      setEditingHallazgo(null);
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar.");
    } finally {
      setIsUpdating(false);
    }
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
              {hallazgos.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    {item.folio || item.id}
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
                      ) : item.status === "En Revisión" ? (
                        <Clock size={14} className="text-yellow-500" />
                      ) : (
                        <AlertCircle size={14} className="text-red-500" />
                      )}
                      {item.status || "Abierto"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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
                        disabled={deletingId === item.id}
                        title={
                          item.status === "En Revisión"
                            ? "Este hallazgo ya fue enviado a revisión y no puede eliminarse"
                            : "Eliminar hallazgo"
                        }
                        className={`rounded p-1 disabled:opacity-50 ${item.status === "En Revisión"
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
              ))}
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
                    severity: e.target.value as Hallazgo["severity"],
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
                    status: e.target.value as Hallazgo["status"],
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