import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Edit2,
  GitBranch,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import type { Proceso, UnidadNegocio } from "../../api/estructura";
import { useEstructuraViewModel } from "../../domain/estructura/useEstructuraViewModel";
import { Card, StatusBadge, type StatusKey } from "../SharedComponents";
import { ModalEditarEntidad } from "./ModalEditarEntidad";
import { ModalRegistrarProceso } from "./ModalRegistrarProceso";
import { ModalRegistrarUnidad } from "./ModalRegistrarUnidad";

// ── Tipos y Helpers para Explorador de Riesgos ─────────────────────────────────

export type TreeNode = {
  id: string;
  label: string;
  type: string;
  children?: TreeNode[];
  risks?: number;
  hasCritical?: boolean;
};

export const TYPE_COLORS: Record<string, string> = {
  Negocio: "bg-blue-100 text-blue-700",
  "Unidad de Negocio": "bg-violet-100 text-violet-700",
  División: "bg-emerald-100 text-emerald-700",
  Área: "bg-amber-100 text-amber-700",
  País: "bg-slate-100 text-slate-600",
};

export const NIVEL_COLOR: Record<string, string> = {
  Crítico: "text-red-700 bg-red-50 border border-red-200",
  Alto: "text-orange-700 bg-orange-50 border border-orange-200",
  Medio: "text-amber-700 bg-amber-50 border border-amber-200",
  Bajo: "text-emerald-700 bg-emerald-50 border border-emerald-200",
};

export const TREE: TreeNode[] = [
  {
    id: "n1",
    label: "Servicios Financieros",
    type: "Negocio",
    risks: 14,
    hasCritical: true,
    children: [
      {
        id: "n1-1",
        label: "Banca Corporativa",
        type: "Unidad de Negocio",
        risks: 8,
        hasCritical: true,
        children: [
          {
            id: "n1-1-1",
            label: "División Crédito Empresarial",
            type: "División",
            risks: 5,
            hasCritical: true,
            children: [
              {
                id: "n1-1-1-1",
                label: "Área de Riesgo Crediticio",
                type: "Área",
                risks: 3,
                hasCritical: true,
                children: [
                  { id: "n1-1-1-1-1", label: "México", type: "País", risks: 2, hasCritical: true },
                  { id: "n1-1-1-1-2", label: "Colombia", type: "País", risks: 1, hasCritical: false },
                ],
              },
              { id: "n1-1-1-2", label: "Área de Tesorería", type: "Área", risks: 0, hasCritical: false },
            ],
          },
        ],
      },
      {
        id: "n1-2",
        label: "Banca Personas",
        type: "Unidad de Negocio",
        risks: 6,
        hasCritical: false,
        children: [
          {
            id: "n1-2-1",
            label: "División Productos Digitales",
            type: "División",
            risks: 4,
            hasCritical: false,
            children: [
              {
                id: "n1-2-1-1",
                label: "Área de Pagos",
                type: "Área",
                risks: 2,
                hasCritical: false,
                children: [
                  { id: "n1-2-1-1-1", label: "Brasil", type: "País", risks: 2, hasCritical: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "n2",
    label: "Comercio Minorista",
    type: "Negocio",
    risks: 10,
    hasCritical: false,
    children: [
      {
        id: "n2-1",
        label: "Proximidad",
        type: "Unidad de Negocio",
        risks: 7,
        hasCritical: false,
        children: [
          {
            id: "n2-1-1",
            label: "División OXXO México",
            type: "División",
            risks: 5,
            hasCritical: false,
            children: [
              {
                id: "n2-1-1-1",
                label: "Área de Operaciones Tienda",
                type: "Área",
                risks: 3,
                hasCritical: false,
                children: [
                  { id: "n2-1-1-1-1", label: "México", type: "País", risks: 3, hasCritical: false },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "n2-2",
        label: "Salud",
        type: "Unidad de Negocio",
        risks: 3,
        hasCritical: false,
        children: [
          {
            id: "n2-2-1",
            label: "División Farmacias",
            type: "División",
            risks: 3,
            hasCritical: false,
            children: [
              {
                id: "n2-2-1-1",
                label: "Área de Abastecimiento",
                type: "Área",
                risks: 2,
                hasCritical: false,
                children: [
                  { id: "n2-2-1-1-1", label: "Chile", type: "País", risks: 2, hasCritical: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "n3",
    label: "Bebidas",
    type: "Negocio",
    risks: 8,
    hasCritical: false,
    children: [
      {
        id: "n3-1",
        label: "Coca-Cola FEMSA",
        type: "Unidad de Negocio",
        risks: 8,
        hasCritical: false,
        children: [
          {
            id: "n3-1-1",
            label: "División México y Centroamérica",
            type: "División",
            risks: 5,
            hasCritical: false,
            children: [
              {
                id: "n3-1-1-1",
                label: "Área de Manufactura",
                type: "Área",
                risks: 3,
                hasCritical: false,
                children: [
                  { id: "n3-1-1-1-1", label: "México", type: "País", risks: 2, hasCritical: false },
                  { id: "n3-1-1-1-2", label: "Guatemala", type: "País", risks: 1, hasCritical: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const RISK_TABLE_ALL = [
  { id: "RIE-0102", name: "Fuga de datos de clientes corporativos", nivel: "Crítico", status: "open" as StatusKey, area: "Riesgo Crediticio", pais: "México" },
  { id: "RIE-0105", name: "Falla en conciliación contable de cartera", nivel: "Alto", status: "completed" as StatusKey, area: "Riesgo Crediticio", pais: "México" },
  { id: "RIE-0112", name: "Incumplimiento regulatorio SARLAFT", nivel: "Medio", status: "open" as StatusKey, area: "Riesgo Crediticio", pais: "Colombia" },
  { id: "RIE-0120", name: "Vulnerabilidad en pasarela PIX", nivel: "Alto", status: "open" as StatusKey, area: "Pagos", pais: "Brasil" },
  { id: "RIE-0125", name: "Fraude transaccional transferencias", nivel: "Medio", status: "completed" as StatusKey, area: "Pagos", pais: "Brasil" },
  { id: "RIE-0131", name: "Diferencia de inventario en CEDIS", nivel: "Medio", status: "open" as StatusKey, area: "Operaciones Tienda", pais: "México" },
  { id: "RIE-0145", name: "Ruptura de cadena de frío en biológicos", nivel: "Alto", status: "open" as StatusKey, area: "Abastecimiento", pais: "Chile" },
  { id: "RIE-0158", name: "Paro no programado en línea de envasado", nivel: "Medio", status: "completed" as StatusKey, area: "Manufactura", pais: "México" },
];

function flattenTree(nodes: TreeNode[], ancestors: TreeNode[] = []): { node: TreeNode; path: TreeNode[] }[] {
  return nodes.flatMap((n) => [{ node: n, path: ancestors }, ...flattenTree(n.children ?? [], [...ancestors, n])]);
}

const ALL_NODES = flattenTree(TREE);

function collectLabels(node: TreeNode): string[] {
  return [node.label, ...(node.children ?? []).flatMap(collectLabels)];
}

function riskColor(node: TreeNode): { stripe: string; badge: string; dot: string; label: string } {
  if (node.hasCritical || (node.risks ?? 0) >= 6) {
    return { stripe: "bg-red-500", badge: "bg-red-50 text-red-700 border border-red-200", dot: "bg-red-500", label: "Crítico" };
  }
  if ((node.risks ?? 0) >= 3) {
    return { stripe: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-400", label: "Alto" };
  }
  if ((node.risks ?? 0) >= 1) {
    return { stripe: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Normal" };
  }
  return { stripe: "bg-slate-300", badge: "bg-slate-50 text-slate-500 border border-slate-200", dot: "bg-slate-300", label: "Sin riesgos" };
}

// Tree view helper
function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onJump,
  completedIds,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onJump: (path: TreeNode[]) => void;
  completedIds: Set<string>;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = Boolean(node.children?.length);
  const col = riskColor(node);
  const nodeAllLabels = collectLabels(node);
  const nodeRisksForTree = RISK_TABLE_ALL.filter((r) => nodeAllLabels.some((l) => r.pais === l || r.area.includes(l)));
  const completedCountTree = nodeRisksForTree.filter((r) => completedIds.has(r.id)).length;
  const allCompletedTree = nodeRisksForTree.length > 0 && completedCountTree === nodeRisksForTree.length;
  const partialCompletedTree = completedCountTree > 0 && !allCompletedTree;

  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/50 cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 18}px` }}
        onClick={() => (hasChildren ? onToggle(node.id) : undefined)}
      >
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            isOpen ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />
          ) : (
            <Circle size={4} className="text-muted-foreground/50" />
          )}
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_COLORS[node.type] ?? "bg-gray-100 text-gray-600"}`}>
          {node.type}
        </span>
        <span className="text-sm font-medium text-foreground flex-1 group-hover:text-primary transition-colors">
          {node.label}
        </span>
        {allCompletedTree && (
          <div title="Todos los riesgos completados" className="flex-shrink-0 flex items-center">
            <CheckCircle2 size={13} className="text-emerald-500" />
          </div>
        )}
        {partialCompletedTree && (
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 bg-emerald-100 flex-shrink-0"
            title={`${completedCountTree} de ${nodeRisksForTree.length} realizados`}
          />
        )}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
        {node.risks !== undefined && node.risks > 0 && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${col.badge}`}>
            {node.risks}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJump([]);
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-accent font-medium hover:underline transition-opacity ml-1"
        >
          Ir →
        </button>
      </div>
      {isOpen &&
        node.children?.map((c) => (
          <TreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onJump={onJump}
            completedIds={completedIds}
          />
        ))}
    </>
  );
}

// ── Componente Principal: HierarchyView ────────────────────────────────────────

export function HierarchyView() {
  const {
    unidades,
    periodoActivo,
    usuarios,
    cargando,
    guardando,
    puedeGestionar,
    modalAltaAbierto,
    errorModalAlta,
    abrirModalAlta,
    cerrarModalAlta,
    guardarNuevaUnidad,
    unidadEditando,
    abrirEditarUnidad,
    cerrarEditarUnidad,
    guardarEdicionUnidad,
    eliminarUnidad,
    modalProcesoAbierto,
    unidadSeleccionadaParaProceso,
    errorModalProceso,
    abrirModalProceso,
    cerrarModalProceso,
    guardarNuevoProceso,
    procesoEditando,
    abrirEditarProceso,
    cerrarEditarProceso,
    guardarEdicionProceso,
    eliminarProceso,
    recargar,
  } = useEstructuraViewModel();

  // Pestañas principales: Estructura Operativa vs Explorador de Riesgos
  const [seccionActiva, setSeccionActiva] = useState<"estructura" | "riesgos">("estructura");

  // Estado de confirmación de eliminación
  const [entidadAEliminar, setEntidadAEliminar] = useState<
    | { tipo: "unidad"; item: UnidadNegocio }
    | { tipo: "proceso"; item: Proceso; unidadId: number }
    | null
  >(null);

  // Estados del Explorador de Riesgos (Drill-down y Árbol)
  const [path, setPath] = useState<TreeNode[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "tree">("cards");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [nivelFilter, setNivelFilter] = useState<string>("all");
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set(["n1", "n2", "n3"]));
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(RISK_TABLE_ALL.filter((r) => r.status === "completed").map((r) => r.id)),
  );
  const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);

  // Drill-down helpers
  const currentNode = path.length > 0 ? path[path.length - 1] : null;
  const currentChildren: TreeNode[] = currentNode ? currentNode.children ?? [] : TREE;
  const isLeaf = currentChildren.length === 0;

  const drillInto = (node: TreeNode) => {
    setPath([...path, node]);
    setNivelFilter("all");
    setSearch("");
    setSearchFocused(false);
  };

  const jumpToLevel = (index: number) => {
    setPath(path.slice(0, index + 1));
    setNivelFilter("all");
  };

  const goRoot = () => {
    setPath([]);
    setNivelFilter("all");
  };

  const searchResults = useMemo(() => {
    if (search.trim().length < 1) return [];
    return ALL_NODES.filter(({ node }) => node.label.toLowerCase().includes(search.toLowerCase())).slice(0, 7);
  }, [search]);

  const toggleTreeNode = (id: string) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Confirmar y procesar eliminación
  const ejecutarEliminacion = async () => {
    if (!entidadAEliminar) return;
    if (entidadAEliminar.tipo === "unidad") {
      await eliminarUnidad(entidadAEliminar.item);
    } else {
      await eliminarProceso(entidadAEliminar.item, entidadAEliminar.unidadId);
    }
    setEntidadAEliminar(null);
  };

  return (
    <div className="flex-1 overflow-auto flex flex-col bg-slate-50/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Encabezado de la Página ── */}
      <div className="px-6 pt-5 pb-0 flex-shrink-0 bg-white border-b border-border shadow-sm">
        {/* Macro breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <span className="hover:text-foreground cursor-pointer transition-colors">Inicio</span>
          <ChevronRight size={12} className="text-muted-foreground/40" />
          <span className="text-foreground font-semibold">Catálogo Organizacional</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Catálogo Organizacional</h1>
              {/* Badge de Periodo Activo */}
              {periodoActivo ? (
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                  title="Periodo de Auditoría activo para la parametrización de nuevas entidades"
                  data-testid="badge-periodo-activo"
                >
                  <Calendar size={13} className="text-emerald-600" />
                  <span>Periodo Activo: {periodoActivo.nombre}</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium"
                  data-testid="badge-sin-periodo"
                >
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span>Sin Periodo Activo</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Parametriza las unidades de negocio, procesos operativos y consulta la matriz de riesgos corporativos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => recargar()}
              disabled={cargando}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              title="Recargar catálogo"
            >
              <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
            </button>

            {/* Botón de Alta de Unidad de Negocio (AC1: Solo Administrador y Jefe de Auditoría) */}
            {puedeGestionar && (
              <button
                id="btn-nueva-unidad"
                data-testid="btn-nueva-unidad"
                onClick={abrirModalAlta}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
              >
                <Plus size={15} />
                Nueva Unidad de Negocio
              </button>
            )}
          </div>
        </div>

        {/* Selector de pestañas */}
        <div className="flex gap-6 border-b border-border text-sm font-semibold">
          <button
            onClick={() => setSeccionActiva("estructura")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              seccionActiva === "estructura"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 size={16} />
            Estructura Organizacional ({unidades.length})
          </button>
          <button
            onClick={() => setSeccionActiva("riesgos")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              seccionActiva === "riesgos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers size={16} />
            Explorador de Riesgos Corporativos
          </button>
        </div>
      </div>

      {/* ── Contenido Principal ── */}
      <div className="flex-1 overflow-auto p-6">
        {/* ── SECCIÓN 1: Estructura Organizacional (SF-03) ── */}
        {seccionActiva === "estructura" && (
          <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Unidades de Negocio y Procesos</h2>
                <p className="text-xs text-muted-foreground">
                  Entidades organizacionales vigentes asociadas a auditorías y controles.
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-white px-2.5 py-1 rounded-md border border-border">
                Total Unidades: <span className="font-bold text-foreground">{unidades.length}</span>
              </span>
            </div>

            {cargando ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-44 rounded-xl bg-white border border-border/70 p-5 animate-pulse shadow-sm" />
                ))}
              </div>
            ) : unidades.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-dashed border-border p-8 shadow-sm">
                <Building2 size={40} className="mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold text-foreground">No hay unidades de negocio registradas</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                  Registra la primera unidad de negocio con su proceso operativo inicial para establecer el marco de
                  referencia de auditoría.
                </p>
                {puedeGestionar && (
                  <button
                    onClick={abrirModalAlta}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
                  >
                    <Plus size={14} />
                    Registrar Unidad de Negocio
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="lista-unidades">
                {unidades.map((u) => (
                  <Card
                    key={u.id}
                    className="p-5 bg-white border border-border hover:border-primary/40 transition-all rounded-xl shadow-sm flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              Unidad de Negocio
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {u.periodoFiscalNombre}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {u.nombre}
                          </h3>
                        </div>

                        {/* Acciones de gestión para la unidad */}
                        {puedeGestionar && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => abrirEditarUnidad(u)}
                              title="Editar unidad"
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setEntidadAEliminar({ tipo: "unidad", item: u })}
                              title="Eliminar unidad"
                              data-testid={`btn-eliminar-unidad-${u.id}`}
                              className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Responsable */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 pb-3 border-b border-border/60">
                        <User size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          Responsable: <span className="font-semibold text-foreground">{u.responsableNombre}</span>
                        </span>
                      </div>

                      {/* Procesos operativos asociados */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Workflow size={13} className="text-muted-foreground" />
                            Procesos ({u.procesos.length})
                          </span>
                          {puedeGestionar && (
                            <button
                              onClick={() => abrirModalProceso(u)}
                              title="Agregar proceso a la unidad"
                              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <Plus size={12} />
                              Agregar
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {u.procesos.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/70 transition-colors"
                            >
                              <span className="font-medium text-slate-800 truncate">{p.nombre}</span>
                              {puedeGestionar && (
                                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                  <button
                                    onClick={() => abrirEditarProceso(p, u.id)}
                                    title="Editar proceso"
                                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={() => setEntidadAEliminar({ tipo: "proceso", item: p, unidadId: u.id })}
                                    title="Eliminar proceso"
                                    data-testid={`btn-eliminar-proceso-${p.id}`}
                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground/70 mt-4 pt-2 border-t border-border/40">
                      ID: #{u.id} • Creada en {new Date(u.creadoEn).toLocaleDateString()}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SECCIÓN 2: Explorador de Riesgos Corporativos ── */}
        {seccionActiva === "riesgos" && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Controles de vista y búsqueda */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative max-w-lg flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  placeholder="Buscar entidad… ej. Brasil, Banca Corporativa, Riesgo Crediticio"
                  className="w-full bg-white border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                />
                {searchFocused && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                    {searchResults.map(({ node, path: nodePath }) => (
                      <button
                        key={node.id}
                        onMouseDown={() => {
                          setPath([...nodePath, node]);
                          setSearch("");
                          setSearchFocused(false);
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-slate-50 text-left transition-colors border-b border-border/50 last:border-0"
                      >
                        <span className="text-xs font-semibold text-foreground flex-1">{node.label}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${TYPE_COLORS[node.type]}`}>
                          {node.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-1">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    viewMode === "cards" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers size={13} />
                  Tarjetas
                </button>
                <button
                  onClick={() => setViewMode("tree")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    viewMode === "tree" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GitBranch size={13} />
                  Árbol
                </button>
              </div>
            </div>

            {/* Breadcrumb de navegación */}
            {viewMode === "cards" && (
              <div className="flex items-center gap-1 flex-wrap text-xs bg-white p-2.5 rounded-lg border border-border">
                <button
                  onClick={goRoot}
                  className={`px-2 py-0.5 rounded font-medium ${
                    path.length === 0 ? "font-bold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Corporativo Central
                </button>
                {path.map((node, i) => (
                  <span key={node.id} className="flex items-center gap-1">
                    <ChevronRight size={12} className="text-muted-foreground/50" />
                    <button
                      onClick={() => jumpToLevel(i)}
                      className={`px-2 py-0.5 rounded font-medium ${
                        i === path.length - 1
                          ? "font-bold text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {node.label}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Vista Árbol */}
            {viewMode === "tree" && (
              <Card className="p-4 bg-white border border-border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground font-semibold">Jerarquía Multinivel Completa</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setTreeExpanded(new Set(["n1", "n1-1", "n1-2", "n2", "n2-1", "n3", "n3-1"]))}
                      className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary text-muted-foreground"
                    >
                      Expandir
                    </button>
                    <button
                      onClick={() => setTreeExpanded(new Set())}
                      className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary text-muted-foreground"
                    >
                      Colapsar
                    </button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {TREE.map((n) => (
                    <TreeRow
                      key={n.id}
                      node={n}
                      depth={0}
                      expanded={treeExpanded}
                      onToggle={toggleTreeNode}
                      onJump={setPath}
                      completedIds={completedIds}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Vista Tarjetas */}
            {viewMode === "cards" && (
              <>
                {!isLeaf && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {currentChildren.map((node) => {
                      const col = riskColor(node);
                      return (
                        <button
                          key={node.id}
                          onClick={() => drillInto(node)}
                          className="text-left bg-white border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group flex flex-col justify-between"
                        >
                          <div className={`h-1.5 w-full ${col.stripe}`} />
                          <div className="p-4 flex-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block mb-1.5 ${TYPE_COLORS[node.type]}`}>
                              {node.type}
                            </span>
                            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {node.label}
                            </h4>
                          </div>
                          <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                            <span>{node.risks ?? 0} riesgos</span>
                            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tabla de riesgos al llegar a nodo hoja */}
                {isLeaf && (
                  <Card className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Riesgos Identificados en {currentNode?.label}</h4>
                        <p className="text-xs text-muted-foreground">Catálogo de riesgos aplicables a esta entidad.</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                          <tr>
                            <th className="py-2.5 px-4">Código</th>
                            <th className="py-2.5 px-4">Descripción del Riesgo</th>
                            <th className="py-2.5 px-4">Nivel</th>
                            <th className="py-2.5 px-4">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {RISK_TABLE_ALL.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-semibold text-slate-700">{r.id}</td>
                              <td className="py-2.5 px-4 font-medium text-foreground">{r.name}</td>
                              <td className="py-2.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${NIVEL_COLOR[r.nivel] ?? ""}`}>
                                  {r.nivel}
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                <StatusBadge status={r.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal de Alta de Unidad de Negocio (AC1 & AC2) ── */}
      <ModalRegistrarUnidad
        abierto={modalAltaAbierto}
        periodoActivo={periodoActivo}
        usuarios={usuarios}
        guardando={guardando}
        errorServidor={errorModalAlta}
        onGuardar={guardarNuevaUnidad}
        onCerrar={cerrarModalAlta}
      />

      {/* ── Modal de Alta de Proceso ── */}
      <ModalRegistrarProceso
        abierto={modalProcesoAbierto}
        unidad={unidadSeleccionadaParaProceso}
        guardando={guardando}
        errorServidor={errorModalProceso}
        onGuardar={guardarNuevoProceso}
        onCerrar={cerrarModalProceso}
      />

      {/* ── Modal de Edición de Entidad ── */}
      <ModalEditarEntidad
        unidad={unidadEditando}
        proceso={procesoEditando}
        usuarios={usuarios}
        guardando={guardando}
        onGuardarUnidad={guardarEdicionUnidad}
        onGuardarProceso={guardarEdicionProceso}
        onCerrar={() => {
          cerrarEditarUnidad();
          cerrarEditarProceso();
        }}
      />

      {/* ── Modal de Confirmación de Eliminación (AC3) ── */}
      {entidadAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 bg-white shadow-2xl relative rounded-xl border border-border">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Confirmar Eliminación</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              ¿Estás seguro de que deseas eliminar{" "}
              {entidadAEliminar.tipo === "unidad" ? (
                <>la unidad de negocio <span className="font-bold text-foreground">"{entidadAEliminar.item.nombre}"</span> y sus procesos?</>
              ) : (
                <>el proceso <span className="font-bold text-foreground">"{entidadAEliminar.item.nombre}"</span>?</>
              )}
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mb-5">
              Si la entidad tiene auditorías activas asociadas, el sistema bloqueará la eliminación para garantizar la
              integridad del marco operativo.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEntidadAEliminar(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="btn-confirmar-eliminar"
                onClick={ejecutarEliminacion}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
              >
                Eliminar
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
