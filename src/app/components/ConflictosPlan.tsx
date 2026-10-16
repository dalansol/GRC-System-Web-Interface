import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ErrorApi } from "../api/cliente";
import {
  declararConflictos,
  LIMITE_JUSTIFICACION,
  listarDeclaraciones,
  listarPlanesPendientes,
  MENSAJE_JUSTIFICACION_OBLIGATORIA,
  obtenerMiDeclaracion,
  ROLES_JEFATURA_CONFLICTOS,
  type DeclaracionConflicto,
  type MiDeclaracion,
  type PlanResumen,
} from "../api/conflictos";
import { useSesion } from "../auth/SesionContext";

// Declaración de conflictos de interés por plan de auditoría (historia #96, tarea #129; SF-04).
// - El auditor con controles asignados en un plan declara antes de evaluarlos; mientras no declare,
//   registrar horas y enviar a revisión quedan bloqueados (el backend también lo valida).
// - Si declara un conflicto, la justificación es obligatoria (se valida aquí y en el backend).
// - El plan muestra una alerta visual cuando hay un conflicto declarado.

// Se emite al registrar una declaración para que las demás partes de la pantalla se actualicen.
const EVENTO_ACTUALIZADO = "expedite:conflictos-actualizados";
const avisarActualizacion = () => window.dispatchEvent(new Event(EVENTO_ACTUALIZADO));

function useAlActualizar(recargar: () => void) {
  useEffect(() => {
    window.addEventListener(EVENTO_ACTUALIZADO, recargar);
    return () => window.removeEventListener(EVENTO_ACTUALIZADO, recargar);
  }, [recargar]);
}

const fecha = (iso: string) => iso.slice(0, 10);

// ─── Planes pendientes del usuario (pantalla de Controles) ───────────────────

/** Planes donde el usuario en sesión tiene controles asignados y aún no declara. */
export function useDeclaracionesPendientes() {
  const [pendientes, setPendientes] = useState<PlanResumen[]>([]);
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  useAlActualizar(recargar);

  useEffect(() => {
    let vigente = true;
    listarPlanesPendientes()
      .then((planes) => {
        if (vigente) setPendientes(planes);
      })
      // Si no se puede consultar no se bloquea la pantalla; el backend sigue validando al evaluar.
      .catch(() => {
        if (vigente) setPendientes([]);
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  return { pendientes, recargar };
}

/** Aviso con un botón para declarar en cada plan pendiente. */
export function AvisoDeclaracionesPendientes({ pendientes }: { pendientes: PlanResumen[] }) {
  const [plan, setPlan] = useState<PlanResumen | null>(null);
  if (pendientes.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <div className="flex items-center gap-2 font-semibold">
        <Lock size={14} aria-hidden /> Declaración de conflictos de interés pendiente
      </div>
      <p>
        No puedes registrar horas ni enviar a revisión los controles de estos planes hasta que declares si tienes algún
        conflicto de interés.
      </p>
      <ul className="space-y-1.5">
        {pendientes.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3">
            <span className="flex-1">
              <span className="font-mono font-semibold">{p.codigo}</span> — {p.nombre}
            </span>
            <button
              type="button"
              onClick={() => setPlan(p)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Declarar conflictos
            </button>
          </li>
        ))}
      </ul>
      {plan && <FormularioDeclaracion plan={plan} onGuardado={() => setPlan(null)} onCerrar={() => setPlan(null)} />}
    </div>
  );
}

// ─── Estado de un plan (pantalla de Planes de Auditoría) ─────────────────────

export interface ConflictosDePlan {
  cargando: boolean;
  error: string | null;
  mia: MiDeclaracion | null;
  /** Declaraciones del plan (solo para la jefatura); null para otros roles. */
  declaraciones: DeclaracionConflicto[] | null;
  /** True si el usuario puede ver un conflicto declarado en el plan (alerta visual). */
  hayConflicto: boolean;
}

export function useConflictosPlan(planId: string): ConflictosDePlan {
  const { usuario } = useSesion();
  const esJefatura = Boolean(usuario && ROLES_JEFATURA_CONFLICTOS.includes(usuario.rol));
  const [mia, setMia] = useState<MiDeclaracion | null>(null);
  const [declaraciones, setDeclaraciones] = useState<DeclaracionConflicto[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  useAlActualizar(recargar);

  useEffect(() => {
    let vigente = true;
    setError(null);
    Promise.all([obtenerMiDeclaracion(planId), esJefatura ? listarDeclaraciones(planId) : Promise.resolve(null)])
      .then(([m, d]) => {
        if (!vigente) return;
        setMia(m);
        setDeclaraciones(d);
      })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error ? e.message : "No se pudo consultar la declaración de conflictos.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [planId, esJefatura, version]);

  const hayConflicto = Boolean(mia?.declaracion?.tieneConflicto || declaraciones?.some((d) => d.tieneConflicto));
  return { cargando, error, mia, declaraciones, hayConflicto };
}

/** Etiqueta roja junto al nombre del plan cuando hay un conflicto declarado. */
export function EtiquetaConflictoPlan({ planId }: { planId: string }) {
  const { hayConflicto } = useConflictosPlan(planId);
  return <EtiquetaConflicto visible={hayConflicto} />;
}

export function EtiquetaConflicto({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      role="status"
      className="ml-2 inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"
    >
      <ShieldAlert size={11} aria-hidden />
      Conflicto declarado
    </span>
  );
}

/** Bloque dentro del plan: estado de la declaración del usuario y alertas para la jefatura. */
export function SeccionConflictosPlan({ planId }: { planId: string }) {
  const { cargando, error, mia, declaraciones } = useConflictosPlan(planId);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" /> Consultando conflictos de interés...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle size={12} /> No se pudo consultar la declaración de conflictos: {error}
      </div>
    );
  }
  // Quien no tiene controles en el plan ni es jefatura no ve esta sección.
  if (!mia || (!mia.asignado && declaraciones === null)) return null;

  const conConflicto = declaraciones?.filter((d) => d.tieneConflicto) ?? [];

  return (
    <div className="mb-4 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conflictos de interés</div>

      {mia.asignado && !mia.declaracion && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <Lock size={14} className="flex-shrink-0" aria-hidden />
          <span className="flex-1">
            <strong>Declaración pendiente.</strong> No puedes evaluar los controles de este plan hasta que declares si tienes
            algún conflicto de interés.
          </span>
          <button
            type="button"
            onClick={() => setFormularioAbierto(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Declarar conflictos
          </button>
        </div>
      )}

      {mia.declaracion && !mia.declaracion.tieneConflicto && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <CheckCircle2 size={14} className="flex-shrink-0" aria-hidden />
          <span>
            Declaraste que no tienes conflictos de interés ({fecha(mia.declaracion.declaradoEn)}). Evaluación de controles habilitada.
          </span>
        </div>
      )}

      {mia.declaracion?.tieneConflicto && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden />
          <span>
            <strong>Declaraste un conflicto de interés</strong> ({fecha(mia.declaracion.declaradoEn)}): {mia.declaracion.justificacion}
            <br />
            La jefatura de auditoría fue notificada. Evaluación de controles habilitada.
          </span>
        </div>
      )}

      {declaraciones !== null && (
        <>
          {conConflicto.map((d) => (
            <div key={d.id} role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
              <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" aria-hidden />
              <span>
                <strong>{d.auditor.nombre}</strong> declaró un conflicto de interés ({fecha(d.declaradoEn)}): {d.justificacion}
              </span>
            </div>
          ))}
          {conConflicto.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Sin conflictos declarados en este plan ({declaraciones.length}{" "}
              {declaraciones.length === 1 ? "declaración recibida" : "declaraciones recibidas"}).
            </div>
          )}
        </>
      )}

      {formularioAbierto && (
        <FormularioDeclaracion
          plan={mia.plan}
          onGuardado={() => setFormularioAbierto(false)}
          onCerrar={() => setFormularioAbierto(false)}
        />
      )}
    </div>
  );
}

// ─── Formulario ──────────────────────────────────────────────────────────────

interface PropsFormulario {
  plan: PlanResumen;
  onGuardado: (declaracion: DeclaracionConflicto) => void;
  onCerrar: () => void;
}

/** Formulario de la declaración. Valida la justificación obligatoria; el backend repite la validación. */
export function FormularioDeclaracion({ plan, onGuardado, onCerrar }: PropsFormulario) {
  const [tieneConflicto, setTieneConflicto] = useState<boolean | null>(null);
  const [justificacion, setJustificacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tieneConflicto === null) return setError("Indica si tienes o no un conflicto de interés.");
    if (tieneConflicto && !justificacion.trim()) return setError(MENSAJE_JUSTIFICACION_OBLIGATORIA);

    setGuardando(true);
    try {
      const declaracion = await declararConflictos(plan.id, {
        tieneConflicto,
        ...(justificacion.trim() ? { justificacion: justificacion.trim() } : {}),
      });
      toast.success(
        declaracion.tieneConflicto
          ? "Conflicto declarado. La jefatura de auditoría fue notificada."
          : "Declaración registrada. Ya puedes evaluar los controles del plan.",
      );
      onGuardado(declaracion);
      avisarActualizacion();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo registrar la declaración.");
    } finally {
      setGuardando(false);
    }
  };

  const opcion = (valor: boolean, texto: string) => (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        tieneConflicto === valor ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <input type="radio" name="tiene-conflicto" checked={tieneConflicto === valor} onChange={() => setTieneConflicto(valor)} />
      {texto}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.stopPropagation()}>
      <form
        onSubmit={enviar}
        aria-label="Declaración de conflictos de interés"
        className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 text-foreground shadow-2xl"
      >
        <div>
          <h3 className="text-lg font-bold text-foreground">Declaración de conflictos de interés</h3>
          <p className="text-xs text-muted-foreground">
            Plan <span className="font-mono font-semibold text-primary">{plan.codigo}</span> — {plan.nombre}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Indica si tienes alguna relación personal, familiar, laboral o económica con las áreas que vas a auditar en este
          plan que pueda afectar tu independencia. Solo se presenta una vez por plan.
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">¿Tienes un conflicto de interés en este plan?</legend>
          {opcion(false, "No tengo conflictos de interés")}
          {opcion(true, "Sí, tengo un conflicto de interés")}
        </fieldset>

        {tieneConflicto && (
          <div>
            <label htmlFor="conflicto-justificacion" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Justificación (obligatoria)
            </label>
            <textarea
              id="conflicto-justificacion"
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={4}
              maxLength={LIMITE_JUSTIFICACION}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Describe el conflicto: con quién o con qué área, y de qué tipo es la relación."
            />
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Enviar declaración
          </button>
        </div>
      </form>
    </div>
  );
}
