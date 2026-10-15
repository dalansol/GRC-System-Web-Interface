import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { INITIAL_FINDINGS } from "../../data/mock_data";
import { listarPlanesAccion, type PlanAccion } from "../../api/planesAccion";
import {
  actualizarHallazgo,
  eliminarHallazgo,
  listarHallazgos,
  type HallazgoApi,
} from "../../api/hallazgos";

const metaEnv = (import.meta as any).env;
const USE_REAL_BACKEND = metaEnv?.VITE_USE_REAL_BACKEND !== "false";

export interface HallazgoViewModel {
  id: string;
  folio?: string;
  title: string;
  description?: string;
  type?: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  status: "Abierto" | "En Proceso" | "En Revisión" | "Asignado" | "Cerrado";
  auditId?: string;
  controlId?: string;
  failedControlId?: string;
  ownerId?: string;
}

const orderFindings = (findings: HallazgoViewModel[]) =>
  [...findings].sort((left, right) => {
    const leftIsClosed = left.status === "Cerrado";
    const rightIsClosed = right.status === "Cerrado";

    if (leftIsClosed !== rightIsClosed) {
      return leftIsClosed ? 1 : -1;
    }

    return 0;
  });

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

  // Planes de acción por id de hallazgo (SF-10). Siempre vienen del backend, que es quien valida la fecha de compromiso.
  const [planesPorHallazgo, setPlanesPorHallazgo] = useState<Record<string, PlanAccion>>({});
  const [hallazgoParaPlan, setHallazgoParaPlan] = useState<HallazgoViewModel | null>(null);

  const fetchPlanesAccion = async () => {
    try {
      const planes = await listarPlanesAccion();
      setPlanesPorHallazgo(Object.fromEntries(planes.map((plan) => [plan.hallazgo.id, plan])));
    } catch (error: any) {
      toast.error(error.message || "Error al cargar los planes de acción.");
    }
  };

  const handlePlanCreado = (plan: PlanAccion) => {
    setPlanesPorHallazgo((prev) => ({ ...prev, [plan.hallazgo.id]: plan }));
    // Al asignar un plan el hallazgo pasa a "Asignado" (el backend hace lo mismo en la base).
    setHallazgos((prev) => prev.map((item) => (item.id === plan.hallazgo.id ? { ...item, status: "Asignado" } : item)));
    setHallazgoParaPlan(null);
  };

  // La edición solo cambia el plan; el estado del hallazgo no se toca.
  const handlePlanActualizado = (plan: PlanAccion) => {
    setPlanesPorHallazgo((prev) => ({ ...prev, [plan.hallazgo.id]: plan }));
    setHallazgoParaPlan(null);
  };

  const fetchHallazgos = async () => {
    setLoading(true);
    try {
      if (USE_REAL_BACKEND) {
        const data = await listarHallazgos();
        setHallazgos(orderFindings(data as HallazgoViewModel[]));
      } else {
        // Fallback a mock_data.tsx
        setHallazgos(orderFindings(INITIAL_FINDINGS as unknown as HallazgoViewModel[]));
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cargar los hallazgos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHallazgos();
    fetchPlanesAccion();
  }, []);

  const handleDelete = async (id: string) => {
    const finding = hallazgos.find((item) => item.id === id);

    if (finding?.status !== "Abierto") {
      toast.error(
        "Solo se pueden eliminar hallazgos en estado Abierto.",
      );
      return;
    }

    if (!window.confirm("¿Estás seguro de que deseas eliminar este hallazgo?")) return;

    setDeletingId(id);
    try {
      if (USE_REAL_BACKEND) {
        await eliminarHallazgo(id);
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
        const updatedData = await actualizarHallazgo(editingHallazgo.id, editingHallazgo);
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
    setHallazgos((current) => orderFindings([finding, ...current]));
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
    planesPorHallazgo,
    hallazgoParaPlan,
    setHallazgoParaPlan,
    handlePlanCreado,
    handlePlanActualizado,
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
