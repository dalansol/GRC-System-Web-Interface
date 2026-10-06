import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { INITIAL_FINDINGS } from "../../data/mock_data";

const metaEnv = (import.meta as any).env;
const API_BASE_URL = metaEnv?.VITE_API_URL || "http://localhost:3000/api";
const USE_REAL_BACKEND = metaEnv?.VITE_USE_REAL_BACKEND === "true";

export interface HallazgoViewModel {
  id: string;
  folio?: string;
  title: string;
  description?: string;
  type?: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  status: "Abierto" | "En Proceso" | "Cerrado";
  auditId?: string;
  controlId?: string;
  failedControlId?: string;
  ownerId?: string;
}

export function useHallazgosViewModel() {
  const [hallazgos, setHallazgos] = useState<HallazgoViewModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingHallazgo, setEditingHallazgo] = useState<HallazgoViewModel | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const [sevFilter, setSevFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchHallazgos = async () => {
    setLoading(true);
    try {
      if (USE_REAL_BACKEND) {
        const response = await fetch(`${API_BASE_URL}/hallazgos`);
        if (!response.ok) {
          throw new Error("No se pudieron obtener los hallazgos del servidor.");
        }
        const data = await response.json();
        setHallazgos(data);
      } else {
        // Fallback a mock_data.tsx
        setHallazgos(INITIAL_FINDINGS as unknown as HallazgoViewModel[]);
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

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este hallazgo?")) return;

    setDeletingId(id);
    try {
      if (USE_REAL_BACKEND) {
        const response = await fetch(`${API_BASE_URL}/hallazgos/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Error al eliminar el hallazgo.");
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

  const handleFindingCreated = (finding: any) => {
    setHallazgos((current) => [finding, ...current]);
  };

  const hallazgosFiltrados = useMemo(() => {
    return hallazgos.filter(f => 
      (sevFilter === "all" || f.severity === sevFilter) &&
      (statusFilter === "all" || f.status === statusFilter)
    );
  }, [hallazgos, sevFilter, statusFilter]);

  const nextFolioNumber = hallazgos.reduce((max, finding) => {
    const number = Number(finding.folio?.split("-").pop());
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  const nextFolio = `HAL-${new Date().getFullYear()}-${String(
    nextFolioNumber,
  ).padStart(3, "0")}`;

  return {
    hallazgos: hallazgosFiltrados,
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
    setEditingHallazgo,
    setShowCreateForm,
    setExpandedFinding,
    setSevFilter,
    setStatusFilter,
    fetchHallazgos,
    handleDelete,
    handleUpdate,
    handleFindingCreated,
  };
}
