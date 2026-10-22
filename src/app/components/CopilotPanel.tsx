import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info, Send, Sparkles, X } from "lucide-react";

import { consultarVista, PREGUNTA_MAX, PREGUNTA_MIN, obtenerEstadoAsistente, type EstadoRespuesta } from "../api/asistente";
import { ErrorApi } from "../api/cliente";
import { contextoDetalle, contextoVista, type TipoDetalle } from "../domain/contextoVista";

// ─── Copilot Panel ────────────────────────────────────────────────────────────
// Asistente general: responde con los datos de la vista abierta (UF-16, SF-19).
// El backend aplica las reglas de contención; cada pregunta es independiente.

const COPILOT_SUGGESTIONS: Record<string, string[]> = {
  dashboard: ["Resume los hallazgos abiertos", "¿Qué tareas están vencidas?", "Redacta un borrador de informe ejecutivo"],
  filter: ["¿Qué riesgos tienen nivel residual alto?", "Compara los riesgos por país", "¿Qué controles están fallidos?"],
  hierarchy: ["Explica la estructura de riesgos actual", "¿Qué entidades tienen más riesgos?", "Resume el estado de cumplimiento"],
  plans: ["Revisa el cronograma de auditorías", "¿Qué planes están en curso?", "Identifica solapamientos de alcance"],
  findings: ["Resume los hallazgos críticos abiertos", "Prioriza los hallazgos por severidad", "Redacta un borrador de plan de remediación"],
  controles: ["¿Qué controles requieren revisión?", "¿Qué controles tienen riesgo fallido?", "Sugiere mejoras a los controles detectivos"],
  bitacora: ["Resume la actividad reciente", "¿Quién hizo cambios esta semana?", "¿Hay acciones inusuales?"],
  settings: ["Resume la actividad reciente en bitácora", "¿Quién modificó permisos?", "¿Hay acciones inusuales?"],
  general_risk: ["Resume este riesgo general", "Redacta un borrador de hallazgo basado en este riesgo", "¿Qué controles lo mitigan?"],
  specific_risk: ["Analiza los controles de este riesgo", "¿Cuál es su riesgo residual?", "Redacta un borrador de hallazgo"],
  audit_entity: ["Resume el perfil de riesgo de esta entidad", "¿Qué hallazgos tiene asociados?", "¿Qué controles tiene?"],
  control: ["Evalúa la efectividad de este control", "Sugiere mejoras al control", "Redacta una conclusión de prueba del control"],
};

const AVISO_NO_DISPONIBLE = "El asistente de IA no está disponible en este momento. El resto de la plataforma sigue funcionando.";

type ChatMsg =
  | { role: "user"; content: string }
  | { role: "ai"; content: string; estado: EstadoRespuesta }
  | { role: "error"; content: string };

interface Props {
  currentView: string;
  /** Registro abierto en detalle, si lo hay. */
  detalle?: { type: TipoDetalle; id: string } | null;
  open: boolean;
  onToggle: () => void;
}

export default function CopilotPanel({ currentView, detalle, open, onToggle }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const contexto = useMemo(
    () => (detalle ? contextoDetalle(detalle.type, detalle.id) : contextoVista(currentView)),
    [currentView, detalle],
  );
  const suggestions = COPILOT_SUGGESTIONS[detalle?.type ?? currentView] ?? [];
  const hasMessages = messages.length > 0;

  // Se verifica la disponibilidad la primera vez que se abre el panel.
  useEffect(() => {
    if (!open || disponible !== null) return;
    let vigente = true;
    obtenerEstadoAsistente()
      .then(({ disponible: activo }) => {
        if (!vigente) return;
        setDisponible(activo);
        if (!activo) setAviso(AVISO_NO_DISPONIBLE);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setDisponible(false);
        setAviso(e instanceof ErrorApi && e.status !== 0 ? e.message : AVISO_NO_DISPONIBLE);
      });
    return () => {
      vigente = false;
    };
  }, [open, disponible]);

  useEffect(() => {
    if (open) {
      // Small delay so the panel is rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, loading]);

  const bloqueado = disponible !== true || loading || !contexto;

  const sendMessage = async (text: string) => {
    const pregunta = text.trim();
    if (bloqueado || pregunta.length < PREGUNTA_MIN || !contexto) return;
    setMessages((prev) => [...prev, { role: "user", content: pregunta }]);
    setInput("");
    setLoading(true);
    try {
      const respuesta = await consultarVista(contexto.vista, contexto.contexto, pregunta);
      setMessages((prev) => [...prev, { role: "ai", content: respuesta.texto, estado: respuesta.estado }]);
    } catch (e) {
      if (e instanceof ErrorApi && (e.status === 503 || e.status === 0)) {
        setDisponible(false);
        setAviso(e.message);
      } else {
        setMessages((prev) => [...prev, { role: "error", content: e instanceof ErrorApi ? e.message : "Ocurrió un error inesperado." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const sugerenciaBtn = (s: string, compacta: boolean) => (
    <button
      key={s}
      onClick={() => void sendMessage(s)}
      disabled={bloqueado}
      className={
        compacta
          ? "text-[10px] px-2 py-1 rounded-md bg-primary/5 text-primary border border-primary/15 hover:bg-primary/10 transition-colors font-medium leading-tight disabled:opacity-50"
          : "w-full text-left text-xs px-3 py-2.5 rounded-lg bg-primary/5 text-primary border border-primary/15 hover:bg-primary/10 transition-colors font-medium leading-snug disabled:opacity-50"
      }
    >
      {s}
    </button>
  );

  return (
    <>
      {/* Floating button — only visible when panel is closed */}
      {!open && (
        <button
          id="tour-copilot-btn"
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <Sparkles size={16} className="animate-pulse" />
          Asistente IA
        </button>
      )}

      {/* Panel — full-height, flex column, nothing overflows the input bar */}
      {open && (
        <div
          role="complementary"
          aria-label="Asistente Copilot IA"
          className="fixed right-0 top-0 h-screen w-96 bg-card border-l border-border shadow-2xl z-30 flex flex-col overflow-hidden"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {/* ── Header (fixed height) ── */}
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 flex-shrink-0">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Sparkles size={14} className="text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">Asistente Copilot IA</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {contexto ? `Datos de la vista: ${contexto.vista}` : "Sin datos de esta vista"}
              </div>
            </div>
            <button
              onClick={onToggle}
              aria-label="Cerrar asistente"
              className="ml-auto p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {aviso && (
            <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          {/* ── Scrollable body — takes all remaining space ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {!hasMessages ? (
              /* Empty state: suggestions centred in the chat area */
              <div className="flex flex-col items-center justify-center h-full px-5 py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles size={22} className="text-primary" />
                </div>
                <div className="text-sm font-bold text-foreground mb-1">¿En qué puedo ayudarte?</div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  {contexto
                    ? "Respondo con los datos de la vista que estás viendo: puedo resumir, priorizar, comparar y redactar borradores."
                    : "El asistente aún no tiene datos de esta vista. Abre Dashboard, Controles, Hallazgos u otra vista con información."}
                </p>
                {contexto && suggestions.length > 0 && (
                  <div className="w-full space-y-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                      Acciones sugeridas
                    </div>
                    {suggestions.map((s) => sugerenciaBtn(s, false))}
                  </div>
                )}
              </div>
            ) : (
              /* Conversation messages */
              <div className="px-4 pt-4 pb-2 space-y-3">
                {contexto && suggestions.length > 0 && (
                  <div className="pb-1 border-b border-border mb-1">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                      Acciones sugeridas
                    </div>
                    <div className="flex flex-wrap gap-1.5">{suggestions.map((s) => sugerenciaBtn(s, true))}</div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role !== "user" && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={12} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-3 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : m.role === "error"
                            ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-sm"
                            : m.estado === "respondida"
                              ? "bg-secondary/60 text-foreground rounded-bl-sm"
                              : "bg-secondary/30 text-muted-foreground border border-border rounded-bl-sm"
                      }`}
                    >
                      {m.role === "ai" && m.estado !== "respondida" && <Info size={12} className="mr-1 inline-block align-[-2px]" />}
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div role="status" aria-label="Generando respuesta" className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <div className="bg-secondary/60 rounded-xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Input bar (fixed at bottom, never scrolls away) ── */}
          <div className="flex-shrink-0 border-t border-border bg-card px-3 py-3">
            <div className="flex items-center gap-2 bg-input-background border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                maxLength={PREGUNTA_MAX}
                disabled={disponible !== true || !contexto}
                aria-label="Pregunta para el asistente"
                placeholder="Pregunta sobre los datos de esta vista…"
                className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />
              <button
                onClick={() => void sendMessage(input)}
                disabled={bloqueado || input.trim().length < PREGUNTA_MIN}
                aria-label="Enviar pregunta"
                className="flex-shrink-0 p-1.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={12} />
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              Respuestas generadas por IA con los datos de esta vista; verifícalas antes de usarlas.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
