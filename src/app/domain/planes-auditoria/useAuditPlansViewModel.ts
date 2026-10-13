import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { AUDIT_PLANS_DATA, INITIAL_USERS } from "../../data/mock_data";
import { pedir } from "../../api/cliente";
import { useSesion } from "../../auth/SesionContext";

const metaEnv = (import.meta as any).env;
const API_BASE_URL = metaEnv?.VITE_API_URL || "http://localhost:3000/api";
const USE_REAL_BACKEND = metaEnv?.VITE_USE_REAL_BACKEND === "true";

export interface AuditPlanViewModel {
  id: string;
  code: string;
  name: string;
  type: "Anual" | "Trimestral" | string;
  period: string;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  responsible: string;
  scope: string;
  status: "Borrador" | "Aprobado" | "En Ejecución" | "Cerrado";
}

interface PlanApi {
  id: number;
  codigo: string;
  nombre: string;
  tipo: "Anual" | "Trimestral";
  periodo: string | null;
  fechaInicio: string;
  fechaFin: string;
  horasEstimadas: number;
  responsable: { id: number; nombre: string };
  alcance: string | null;
  estado: AuditPlanViewModel["status"];
}

const convertirPlan = (plan: PlanApi): AuditPlanViewModel => ({
  id: String(plan.id),
  code: plan.codigo,
  name: plan.nombre,
  type: plan.tipo,
  period: plan.periodo ?? "",
  startDate: plan.fechaInicio,
  endDate: plan.fechaFin,
  estimatedHours: plan.horasEstimadas,
  responsible: nombreCompleto(plan.responsable.nombre),
  scope: plan.alcance ?? "",
  status: plan.estado,
});

const nombreCorto = (nombre: string) => {
  const [nombrePrincipal, ...apellidos] = nombre.split(" ");
  return apellidos.length > 0 ? `${nombrePrincipal[0]}. ${apellidos.join(" ")}` : nombre;
};

const nombreCompleto = (nombre: string) =>
  INITIAL_USERS.find((usuario) => nombreCorto(usuario.name) === nombre)?.name ?? nombre;

const orderPlans = (plans: AuditPlanViewModel[]) =>
  [...plans].sort((left, right) => {
    const leftIsClosed = left.status === "Cerrado";
    const rightIsClosed = right.status === "Cerrado";

    if (leftIsClosed !== rightIsClosed) {
      return leftIsClosed ? 1 : -1;
    }

    return 0;
  });

export function useAuditPlansViewModel() {
  const { usuario } = useSesion();
  const [plans, setPlans] = useState<AuditPlanViewModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<AuditPlanViewModel | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchPlans = async () => {
    setLoading(true);
    try {
      if (USE_REAL_BACKEND) {
        const data = await pedir<PlanApi[]>("/planes");
        setPlans(orderPlans(data.map(convertirPlan)));
      } else {
        // Fallback a mock_data.ts
        const plans = (AUDIT_PLANS_DATA as unknown as AuditPlanViewModel[]).map((plan) => ({
          ...plan,
          responsible: nombreCompleto(plan.responsible),
        }));
        setPlans(orderPlans(
          usuario?.rol === "Auditor Senior"
            ? plans.filter((plan) => plan.responsible === usuario.nombre || plan.responsible === nombreCorto(usuario.nombre))
            : plans,
        ));
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cargar los planes de auditoría.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const createPlan = async (planData: Omit<AuditPlanViewModel, "id" | "status">) => {
    setIsCreating(true);
    try {
      if (USE_REAL_BACKEND) {
        const newPlan = await pedir<PlanApi>("/planes", {
          metodo: "POST",
          cuerpo: {
            codigo: planData.code,
            nombre: planData.name,
            tipo: planData.type,
            periodo: planData.period || null,
            fechaInicio: planData.startDate,
            fechaFin: planData.endDate,
            horasEstimadas: planData.estimatedHours,
            responsableId: Number(usuario?.id),
            alcance: planData.scope || null,
          },
        });
        setPlans((prev) => orderPlans([convertirPlan(newPlan), ...prev]));
      } else {
        // Fallback local
        const newPlan: AuditPlanViewModel = {
          ...planData,
          id: `AP-${String(plans.length + 1).padStart(3, "0")}`,
          status: "Borrador"
        };
        setPlans((prev) => orderPlans([newPlan, ...prev]));
      }
      toast.success(`Plan "${planData.name}" creado correctamente.`);
      return true;
    } catch (error: any) {
      toast.error(error.message || "Error al crear el plan.");
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const plan = plans.find((item) => item.id === id);

    if (plan?.status !== "Borrador") {
      toast.error(
        "Solo se pueden eliminar planes en estado Borrador.",
      );
      return;
    }

    if (!window.confirm("¿Estás seguro de que deseas eliminar este plan?")) return;

    setDeletingId(id);
    try {
      if (USE_REAL_BACKEND) {
        const response = await fetch(`${API_BASE_URL}/audit-plans/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Error al eliminar el plan.");
        }
      }

      setPlans((prev) => prev.filter((item) => item.id !== id));
      toast.success("Plan eliminado correctamente.");
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar el plan.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setIsUpdating(true);
    try {
      if (USE_REAL_BACKEND) {
        const response = await fetch(`${API_BASE_URL}/audit-plans/${editingPlan.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingPlan),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Error al actualizar el plan.");
        }

        const updatedData = await response.json();
        setPlans((prev) =>
          prev.map((item) => (item.id === updatedData.id ? updatedData : item))
        );
      } else {
        // Fallback local
        setPlans((prev) =>
          prev.map((item) => (item.id === editingPlan.id ? editingPlan : item))
        );
      }

      toast.success("Plan actualizado con éxito.");
      setEditingPlan(null);
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar.");
    } finally {
      setIsUpdating(false);
    }
  };

  const planesFiltrados = useMemo(() => {
    return plans.filter(f => 
      (typeFilter === "all" || f.type === typeFilter) &&
      (statusFilter === "all" || f.status === statusFilter)
    );
  }, [plans, typeFilter, statusFilter]);

  // Generates the next sequential Code (e.g. "PAI-2025-004")
  const nextCodeNumber = plans.reduce((max, plan) => {
    const number = Number(plan.code?.split("-").pop());
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  const nextCode = `PAI-${new Date().getFullYear()}-${String(
    nextCodeNumber,
  ).padStart(3, "0")}`;

  return {
    plans: planesFiltrados,
    loading,
    deletingId,
    editingPlan,
    isUpdating,
    isCreating,
    showCreateForm,
    typeFilter,
    statusFilter,
    USE_REAL_BACKEND,
    nextCode,
    setEditingPlan,
    setShowCreateForm,
    setTypeFilter,
    setStatusFilter,
    fetchPlans,
    createPlan,
    handleDelete,
    handleUpdate,
  };
}