import { Fragment, useEffect, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSearch,
  ListTodo,
  Loader2,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  AlertTriangle,
  X,
  CheckCheck,
  User
} from "lucide-react";
import { toast } from "sonner";

import { Card, Breadcrumbs, PageHeader } from "../ComponentesCompartidos";
import BandejaProrrogas from "./BandejaProrrogas";
import BandejaRevisionPlanes from "./BandejaRevisionPlanes";
import EvidenciasSection from "../EvidenciasSection";
import { desplazarAElemento } from "../desplazarAElemento";
import FormularioPlanAccion from "./FormularioPlanAccion";
import HistorialFlujoPlan from "./HistorialFlujoPlan";
import InsigniaEstadoPlan from "./InsigniaEstadoPlan";
import PortalPlanesAuditado from "./PortalPlanesAuditado";
import { useCambiosPlanes } from "./useCambiosPlanes";
import { useSesion } from "../../auth/SesionContext";
import {
  actualizarPasoPlanAccion,
  enviarPlanARevision,
  esAuditado,
  esJefeAuditado,
  ETIQUETA_ETAPA,
  listarPlanesAccion,
  obtenerFlujoPlan,
  observacionesPendientes,
  planBloqueado,
  rechazoVigente,
  puedeEditarPlan,
  puedeEnviarPlan,
  ROLES_REVISION_PLAN_ACCION,
  type EvidenciaObservada,
  type PlanAccion,
  type SolicitudDestinoPlan
} from "../../api/planesAccion";
import { type HallazgoPortal } from "../../api/portalAuditado";

interface PlanAccionConDetalles extends Omit<PlanAccion, "estado" | "status"> {
  finding?: HallazgoPortal;
  estado?: string;
  status?: string;
}

/**
 * Motivo del último rechazo y sus archivos señalados, para saber qué corregir antes de reenviar.
 * Desaparece cuando todos los pasos señalados se vuelven a marcar como completados.
 */
function AvisoRechazoPlan({ planId, pasos }: { planId: number; pasos: PlanAccion["pasos"] }) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [observadas, setObservadas] = useState<EvidenciaObservada[]>([]);
  // Mientras no se lee el rechazo no se sabe si ya se corrigió: no se muestra para que no parpadee.
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerFlujoPlan(planId)
      .then(({ eventos }) => {
        const rechazo = [...eventos].reverse().find((evento) => evento.accion === "rechazo");
        if (vigente) {
          setMotivo(rechazo?.motivo ?? null);
          setObservadas(rechazo?.evidenciasObservadas ?? []);
        }
      })
      .catch(() => {
        if (vigente) setMotivo(null);
      })
      .finally(() => {
        if (vigente) setCargado(true);
      });
    return () => {
      vigente = false;
    };
  }, [planId]);

  if (!cargado || !rechazoVigente(observadas, pasos)) return null;
  const pendientes = observacionesPendientes(observadas, pasos);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
      <div className="mb-1 flex items-center gap-1.5 font-bold">
        <AlertTriangle size={14} />
        Plan rechazado: corrígelo y reenvíalo a revisión
      </div>
      {motivo && <p className="break-words">Motivo: {motivo}</p>}
      {pendientes.length > 0 && (
        <p className="break-words">Archivos señalados: {pendientes.map((evidencia) => evidencia.nombre).join(", ")}</p>
      )}
    </div>
  );
}

export default function VistaPlanesAccion({ destino }: { destino?: SolicitudDestinoPlan | null }) {
  const { usuario } = useSesion();
  if (esJefeAuditado(usuario?.rol)) return <PlanesJefeAuditado destino={destino} />;
  // Los auditados solo ven lo que tienen asignado, en su propia vista (SF-16).
  if (esAuditado(usuario?.rol)) {
    return (
      <div className="flex-1 w-full max-w-full overflow-x-hidden p-6 pb-24 space-y-6 box-border" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <Breadcrumbs items={["Inicio", "Auditoría", "Planes de Acción"]} />
        <PageHeader title="Mis planes de acción" subtitle="Sube la evidencia de tus pasos y actualiza su avance." />
        <PortalPlanesAuditado destino={destino} />
      </div>
    );
  }
  return <SeguimientoPlanes destino={destino} />;
}

type VistaJefeAuditado = "asignados" | "unidad";

/**
 * Jefe Auditado: su portal con lo que tiene asignado y, aparte, los planes que creó o de su unidad de negocio,
 * que puede editar pero no enviar a revisión.
 */
function PlanesJefeAuditado({ destino }: { destino?: SolicitudDestinoPlan | null }) {
  const [vista, setVista] = useState<VistaJefeAuditado>("asignados");
  // Cambiar de pestaña a mano termina el viaje de la notificación: volver no debe reabrir su plan.
  const [destinoAtendido, setDestinoAtendido] = useState<number | null>(null);
  // Plan de una notificación que no está entre los asignados: se busca entre los de su unidad.
  const [destinoUnidad, setDestinoUnidad] = useState<SolicitudDestinoPlan | null>(null);
  const destinoVigente = destino && destino.solicitud !== destinoAtendido ? destino : null;

  useEffect(() => {
    if (destino) setVista("asignados");
  }, [destino?.solicitud]);

  const cambiarVista = (nueva: VistaJefeAuditado) => {
    setVista(nueva);
    setDestinoAtendido(destino?.solicitud ?? null);
    setDestinoUnidad(null);
  };

  return (
    <div className="flex-1 w-full max-w-full overflow-x-hidden p-6 pb-24 space-y-6 box-border" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Planes de Acción"]} />
      <PageHeader title="Planes de acción" subtitle="Trabaja en tus planes asignados y gestiona los de tu unidad de negocio." />
      <div role="tablist" aria-label="Vista de planes de acción" className="flex gap-1 border-b border-border">
        {([["asignados", "Mis planes asignados"], ["unidad", "Planes de mi unidad"]] as const).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={vista === id}
            onClick={() => cambiarVista(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              vista === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      {vista === "asignados" ? (
        <PortalPlanesAuditado
          destino={destinoVigente}
          onPlanNoEncontrado={() => {
            if (!destinoVigente) return;
            setDestinoAtendido(destinoVigente.solicitud);
            setDestinoUnidad(destinoVigente);
            setVista("unidad");
          }}
        />
      ) : (
        <SeguimientoPlanes destino={destinoUnidad} incrustado />
      )}
    </div>
  );
}

/**
 * Seguimiento del equipo de auditoría: todos los planes, su envío a revisión y la bandeja del Jefe de Auditoría.
 * `incrustado`: dentro de la vista del Jefe Auditado, sin su propio encabezado de página.
 */
function SeguimientoPlanes({ destino, incrustado = false }: { destino?: SolicitudDestinoPlan | null; incrustado?: boolean }) {
  const { usuario } = useSesion();
  const esRevisor = Boolean(usuario && ROLES_REVISION_PLAN_ACCION.includes(usuario.rol));
  const [pestana, setPestana] = useState<"seguimiento" | "revision" | "prorrogas">(destino?.pestana ?? "seguimiento");
  // Pasos con un cambio en curso: un doble clic no debe mandar otro.
  const pasosEnCurso = useRef(new Set<number>());
  // Cambiar de pestaña a mano termina el viaje de la notificación: volver no debe reabrir su plan.
  const [destinoAtendido, setDestinoAtendido] = useState<number | null>(null);
  const destinoVigente = destino && destino.solicitud !== destinoAtendido ? destino : null;
  const [recargaFlujo, setRecargaFlujo] = useState(0);
  const [planEnEdicion, setPlanEnEdicion] = useState<PlanAccionConDetalles | null>(null);

  const [planes, setPlanes] = useState<PlanAccionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);

  // Dropdown table expansion state
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  // Split view state for step evidence (planId + stepId)
  const [splitStepKey, setSplitStepKey] = useState<{
    planId: number;
    stepId: number;
  } | null>(null);

  const currentUserId = usuario?.id;

  // Solo se usa la respuesta de la última petición: una recarga en vivo no debe pisar otra más reciente.
  const ultimaPeticion = useRef(0);
  // `silencioso`: recarga en vivo, sin indicador de carga ni avisos de error (se reintenta con el siguiente cambio).
  const cargarPlanes = async ({ silencioso = false } = {}) => {
    const peticion = ++ultimaPeticion.current;
    if (!silencioso) setLoading(true);
    try {
      const planesRemotos = await listarPlanesAccion();
      if (peticion !== ultimaPeticion.current) return null;
      setPlanes(planesRemotos);
      return planesRemotos;
    } catch (error) {
      if (!silencioso && peticion === ultimaPeticion.current) {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar los planes de acción.");
      }
      return null;
    } finally {
      if (peticion === ultimaPeticion.current) setLoading(false);
    }
  };

  useCambiosPlanes(() => {
    void cargarPlanes({ silencioso: true });
    setRecargaFlujo((valor) => valor + 1);
  });

  useEffect(() => {
    if (destino?.pestana === "seguimiento") return;
    void cargarPlanes();
  }, [usuario?.id, (usuario as any)?.business_unit_id, usuario?.businessUnitId]);

  // Desde una notificación se llega a la pestaña indicada; en Seguimiento, con el plan abierto.
  useEffect(() => {
    if (!destino) return;
    setPestana(destino.pestana);
    if (destino.pestana !== "seguimiento") return;
    void cargarPlanes().then((lista) => {
      if (!lista) return;
      if (lista.some((plan) => plan.id === destino.planId)) {
        setExpandedPlanId(destino.planId);
        desplazarAElemento(`plan-fila-${destino.planId}`);
      } else {
        toast.error("Ese plan ya no está disponible.");
      }
    });
  }, [destino?.solicitud]);

  // Toggle step completion status with evidence validation
  const togglePasoCompletado = async (plan: PlanAccionConDetalles, pasoId: number, completadoDeseado: boolean) => {
    if (plan.etapa !== "cierre" || planBloqueado(plan)) {
      toast.error("El plan de acción aún no se valida, está en revisión o ya se aprobó, y no puede modificarse.");
      return;
    }
    const paso = plan.pasos?.find((p) => p.id === pasoId);
    if (!paso || pasosEnCurso.current.has(pasoId)) return;

    // Si se quiere marcar como completado, validar que tenga evidencias
    if (completadoDeseado) {
      if (paso.evidenciasCount === 0) {
        toast.error("No se puede aprobar/completar el paso porque no cuenta con evidencias adjuntas.");
        return;
      }
    }

    // El paso cambia en pantalla de inmediato. Si el servidor lo rechaza, se deshace.
    const fijarPaso = (pasoNuevo: PlanAccion["pasos"][number]) => {
      setPlanes((prev) => prev.map((p) => p.id !== plan.id ? p : {
        ...p,
        pasos: p.pasos.map((item) => item.id === pasoId ? pasoNuevo : item),
      }));
    };
    pasosEnCurso.current.add(pasoId);
    fijarPaso({ ...paso, completado: completadoDeseado });
    try {
      fijarPaso(await actualizarPasoPlanAccion(plan.id, pasoId, completadoDeseado));
    } catch (error) {
      fijarPaso(paso);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la actividad.");
    } finally {
      pasosEnCurso.current.delete(pasoId);
    }
  };

  const enviarARevision = async (planId: number) => {
    try {
      const planActualizado = await enviarPlanARevision(planId);
      setPlanes((prev) => prev.map((plan) => plan.id === planId ? {
        ...plan,
        ...planActualizado,
      } : plan));
      setRecargaFlujo((valor) => valor + 1);
      toast.success("Plan de acción enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el plan a revisión.");
    }
  };

  const guardarEdicion = (actualizado: PlanAccion) => {
    setPlanes((prev) => prev.map((plan) => (plan.id === actualizado.id ? { ...plan, ...actualizado } : plan)));
    setPlanEnEdicion(null);
  };

  return (
    <div
      className={incrustado ? "space-y-6" : "flex-1 w-full max-w-full overflow-x-hidden p-6 pb-24 space-y-6 box-border"}
      style={incrustado ? undefined : { fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {!incrustado && <Breadcrumbs items={["Inicio", "Auditoría", "Planes de Acción"]} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {incrustado ? (
          <p className="text-xs text-muted-foreground">
            {planes.length} planes que creaste o de tu unidad de negocio. Un auditor los envía a validación.
          </p>
        ) : (
          <PageHeader
            title="Gestión de Planes de Acción"
            subtitle={`${planes.length} planes registrados`}
          />
        )}

        {pestana === "seguimiento" && (
        <button
          type="button"
          onClick={() => void cargarPlanes()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
        )}
      </div>

      {esRevisor && (
        <div role="tablist" aria-label="Vista de planes de acción" className="flex gap-1 border-b border-border">
          {([["seguimiento", "Seguimiento"], ["revision", "Bandeja de revisión"], ["prorrogas", "Prórrogas"]] as const).map(([id, etiqueta]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => {
                setPestana(id);
                setDestinoAtendido(destino?.solicitud ?? null);
              }}
              className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                pestana === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      )}

      {pestana === "revision" && esRevisor ? (
        <BandejaRevisionPlanes destino={destinoVigente?.pestana === "revision" ? destinoVigente : null} />
      ) : pestana === "prorrogas" && esRevisor ? (
        <BandejaProrrogas destino={destinoVigente?.pestana === "prorrogas" ? destinoVigente : null} />
      ) : (
      /* Main Table Section */
      <Card>
        <div className="w-full overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Cargando planes de acción...
            </div>
          ) : planes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground gap-2">
              <ShieldAlert size={28} className="text-muted-foreground/50" />
              <p>No hay planes de acción registrados.</p>
            </div>
          ) : (
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/6">Folio / ID</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/3">Título del Plan</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/5">Responsable</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/6">Fecha Límite</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/6">Estado</th>
                  <th className="py-3 px-4 text-right font-semibold text-muted-foreground w-1/6">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {planes.map((plan) => {
                  const estadoStr = plan.status || plan.estado || "Asignado";
                  const isExpanded = expandedPlanId === plan.id;
                  const folioDisplay = plan.publicId;
                  
                  const tituloDisplay = plan.titulo || plan.hallazgo?.titulo || plan.finding?.title || "Plan de Acción Correctivo";
                  const responsableNombre = plan.responsable?.nombre || "No asignado";

                  const bloqueado = planBloqueado(plan);
                  const rechazado = estadoStr === "Rechazado";
                  const puedeEnviar = puedeEnviarPlan(plan, usuario);
                  const destinoEnvio = plan.etapa === "definicion" ? "validación" : "revisión";
                  // Un paso solo cambia en un plan ya validado, y lo hace su asignado.
                  const pasosAbiertos = plan.etapa === "cierre" && !bloqueado;

                  return (
                    <Fragment key={plan.id}>
                      <tr id={`plan-fila-${plan.id}`} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4 font-mono font-medium text-xs text-primary truncate">{folioDisplay}</td>
                        <td className="py-3 px-4 font-medium text-foreground truncate" title={tituloDisplay}>{tituloDisplay}</td>
                        <td className="py-3 px-4 text-muted-foreground text-xs truncate" title={responsableNombre}>{responsableNombre}</td>
                        <td className="py-3 px-4 text-xs font-mono text-muted-foreground truncate">{plan.fechaCompromiso}</td>
                        <td className="py-3 px-4">
                          <InsigniaEstadoPlan estado={estadoStr} />
                          <div className="mt-1 text-[11px] text-muted-foreground">{ETIQUETA_ETAPA[plan.etapa]}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                            onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                          >
                            <ChevronDown size={14} className={isExpanded ? "rotate-180 transition-transform" : "transition-transform"} />
                            {isExpanded ? "Ocultar detalles" : "Ver detalles"}
                          </button>
                        </td>
                      </tr>

                      {/* Dropdown Detail Drawer */}
                      {isExpanded && (
                        <tr key={`${plan.id}-details`} className="border-b border-border bg-muted/10">
                          <td colSpan={6} className="px-6 py-5 max-w-full overflow-hidden">
                            <div className="space-y-4 max-w-full">
                              {rechazado && <AvisoRechazoPlan planId={plan.id} pasos={plan.pasos ?? []} />}

                              
                              {/* Metadata Grid (Responsable y Fecha Límite a la izquierda) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <UserCheck size={16} />
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable Auditado</div>
                                    <div className="text-xs font-bold text-foreground">{responsableNombre}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Calendar size={16} />
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fecha Límite del Plan</div>
                                    <div className="text-xs font-mono font-bold text-foreground">{plan.fechaCompromiso || "Sin fecha"}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Root Cause Analysis (RCA) */}
                              <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-2xs max-w-full overflow-hidden">
                                <div className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <FileSearch size={14} className="text-primary" />
                                  Análisis de Causa Raíz (RCA - Root Cause Analysis)
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed font-normal break-words">
                                  {plan.causaRaiz || plan.descripcion || "Causa raíz o descripción no documentada."}
                                </p>
                              </div>

                              {/* Related Findings Section */}
                              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                                <div className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <AlertTriangle size={14} className="text-amber-600" />
                                  Hallazgos Relacionados
                                </div>
                                {plan.hallazgosRelacionados && plan.hallazgosRelacionados.length > 0 ? (
                                  <div className="grid grid-cols-1 gap-2">
                                    {plan.hallazgosRelacionados.map((hallazgo) => (
                                      <div key={hallazgo.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/60 text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-primary">{hallazgo.folio || hallazgo.id}</span>
                                          <span className="font-medium text-foreground">{hallazgo.titulo}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                            {hallazgo.severidad || "General"}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : plan.hallazgo || plan.finding ? (
                                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/60 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-primary">{(plan.hallazgo as any)?.folio || plan.finding?.id || "N/A"}</span>
                                      <span className="font-medium text-foreground">{(plan.hallazgo as any)?.titulo || plan.finding?.title || "Hallazgo vinculado"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                        {(plan.hallazgo as any)?.severidad || plan.finding?.severity || "General"}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No hay hallazgos asociados explícitamente a este plan.</p>
                                )}
                              </div>

                              {/* Timeline Steps Breakdown */}
                              <div className="space-y-3 pt-1 max-w-full overflow-hidden">
                                <div className="flex items-center justify-between border-b border-border pb-2 gap-2 flex-wrap">
                                  <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                    <ListTodo size={15} className="text-primary" />
                                    Cronograma de Ejecución y Actividades (Plan Completo)
                                  </div>
                                  <span className="text-[11px] text-muted-foreground italic">
                                    Haz clic en la flecha para ver la descripción completa y gestionar evidencias
                                  </span>
                                </div>

                                <div className="space-y-2.5 pl-2 max-w-full">
                                  {plan.pasos && plan.pasos.length > 0 ? (
                                    plan.pasos.map((paso) => {
                                      const esAsignadoActual = paso.usuarioAsignado?.id === currentUserId;
                                      const isDone = paso.completado;
                                      const isSplitActive = splitStepKey?.planId === plan.id && splitStepKey?.stepId === paso.id;

                                      const evidenciasCount = paso.evidenciasCount;
                                      const nombreResponsablePaso = 
                                        paso.usuarioAsignado?.nombre || 
                                        (paso as any).responsible_name || 
                                        (paso as any).responsableNombre || 
                                        "Sin asignar";

                                      return (
                                        <div
                                          key={paso.id}
                                          className={`rounded-lg border transition-all max-w-full overflow-hidden ${
                                            isDone
                                              ? "bg-muted/20 border-border/60 text-muted-foreground"
                                              : esAsignadoActual
                                              ? "bg-primary/5 border-primary/30 text-foreground shadow-2xs"
                                              : "bg-background border-border text-foreground"
                                          }`}
                                        >
                                          {/* Closed View */}
                                          <div className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${isSplitActive ? "border-b border-border/60 bg-muted/30 rounded-t-lg" : ""}`}>
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (esAsignadoActual) {
                                                    void togglePasoCompletado(plan, paso.id, !isDone);
                                                  } else {
                                                    toast.error("Solo puedes modificar el estatus de tus propios pasos asignados.");
                                                  }
                                                }}
                                                className="focus:outline-none shrink-0 rounded-full transition-transform hover:scale-110 active:scale-90"
                                                title={esAsignadoActual ? (isDone ? "Marcar como pendiente" : "Marcar como completado") : "Solo el responsable asignado puede cambiar este estatus"}
                                              >
                                                {isDone ? (
                                                  <CheckCircle2 size={16} className="text-green-600 fill-green-100 animate-in zoom-in duration-200" />
                                                ) : (
                                                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                                                )}
                                              </button>
                                              <div className="min-w-0 flex-1">
                                                {/* Text disappears (opacity-0) when dropdown is clicked/active */}
                                                <div 
                                                  className={`text-sm font-semibold truncate max-w-full transition-opacity duration-200 ${
                                                    isDone ? "line-through opacity-80" : ""
                                                  } ${isSplitActive ? "opacity-0" : "opacity-100"}`} 
                                                  title={paso.descripcion}
                                                >
                                                  {paso.descripcion}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 pl-6 md:pl-0 flex-wrap">
                                              {/* Nombre del usuario asignado al paso a la izquierda de la fecha límite */}
                                              <span className="flex items-center gap-1 font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded truncate max-w-[140px]" title={nombreResponsablePaso}>
                                                <User size={12} className="text-primary shrink-0" />
                                                <span className="truncate">{nombreResponsablePaso}</span>
                                              </span>

                                              <span className="flex items-center gap-1 font-mono shrink-0">
                                                <Calendar size={13} />
                                                {paso.fechaCompromiso || "Sin fecha"}
                                              </span>
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/50 text-foreground font-medium">
                                                <Paperclip size={12} className="text-primary" />
                                                Evidencias: {evidenciasCount}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (isSplitActive) {
                                                    setSplitStepKey(null);
                                                  } else {
                                                    setSplitStepKey({ planId: plan.id, stepId: paso.id });
                                                  }
                                                }}
                                                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-card text-foreground hover:bg-secondary transition-colors shrink-0"
                                                title={isSplitActive ? "Cerrar detalles y evidencias" : "Ver detalles y evidencias"}
                                              >
                                                {isSplitActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Full-width Dropdown Box with Description in Upper Half & Evidence Below */}
                                          {isSplitActive && (
                                            <div className="bg-card rounded-b-lg p-4 space-y-4 max-w-full overflow-hidden transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-left-2">
                                              {/* Upper half: Full description text container */}
                                              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 shadow-2xs">
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                  <ListTodo size={12} className="text-primary" />
                                                  Descripción Completa de la Actividad
                                                </div>
                                                <p className="text-xs font-medium text-foreground leading-relaxed break-words animate-in fade-in duration-500">
                                                  {paso.descripcion}
                                                </p>
                                              </div>

                                              {/* Lower half / full width: Evidence submission section */}
                                              <div className="w-full max-w-full flex flex-col overflow-y-auto pt-2 border-t border-border/60">
                                                <EvidenciasSection
                                                  entityId={String(paso.id)}
                                                  entityType="action_plan_step"
                                                  puedeSubir={esAsignadoActual && pasosAbiertos}
                                                  onEvidenceCountChange={(count) => {
                                                    setPlanes((prev) => prev.map((item) => item.id !== plan.id ? item : {
                                                      ...item,
                                                      pasos: item.pasos.map((itemPaso) => itemPaso.id === paso.id
                                                        ? { ...itemPaso, evidenciasCount: count }
                                                        : itemPaso),
                                                    }));
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic">
                                      No hay pasos detallados registrados para este plan.
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Historial de la bitácora del flujo de aprobación */}
                              <div className="space-y-2 pt-1">
                                <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">Historial del flujo</div>
                                <HistorialFlujoPlan planId={plan.id} recarga={recargaFlujo} />
                              </div>

                              {/* El auditor corrige el plan y lo envía a validar o, ya terminado, a revisar su evidencia */}
                              {(puedeEnviar || puedeEditarPlan(plan, usuario)) && (
                                <div className="pt-4 flex justify-end gap-2 border-t border-border mt-4">
                                  {puedeEditarPlan(plan, usuario) && (
                                    <button
                                      type="button"
                                      onClick={() => setPlanEnEdicion(plan)}
                                      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                                    >
                                      Editar plan
                                    </button>
                                  )}
                                  {puedeEnviar && (
                                    <button
                                      type="button"
                                      onClick={() => enviarARevision(plan.id)}
                                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                                    >
                                      <CheckCheck size={15} />
                                      {rechazado ? `Reenviar a ${destinoEnvio}` : `Enviar a ${destinoEnvio}`}
                                    </button>
                                  )}
                                </div>
                              )}

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
      </Card>
      )}

      {planEnEdicion && (
        <FormularioPlanAccion
          plan={planEnEdicion as PlanAccion}
          hallazgosSeleccionados={(planEnEdicion.hallazgosRelacionados?.length ? planEnEdicion.hallazgosRelacionados : [planEnEdicion.hallazgo]).map((hallazgo) => ({
            id: hallazgo.id,
            folio: hallazgo.folio,
            title: hallazgo.titulo,
          }))}
          onGuardado={guardarEdicion}
          onCerrar={() => setPlanEnEdicion(null)}
        />
      )}
    </div>
  );
}