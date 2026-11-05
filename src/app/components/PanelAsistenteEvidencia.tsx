import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ClipboardCheck, FileText, Info, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";

import { ErrorApi } from "../api/cliente";
import {
  borrarConversacionEvidencia,
  consultarEvidencia,
  obtenerConversacionEvidencia,
  obtenerEstadoAsistente,
  PREGUNTA_MAX,
  PREGUNTA_MIN,
  type ConversacionEvidencia,
  type EstadoRespuesta,
  type MensajeConversacion,
} from "../api/asistente";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

// Panel lateral del agente de IA para una evidencia (historia #105, task #135; SF-19).
// El backend agrega el contexto del archivo (su control y plan, o su hallazgo) y recuerda la
// conversación de cada usuario sobre el archivo.

const PREGUNTAS_SUGERIDAS = {
  control: ["¿La muestra cumple con el tamaño requerido?", "¿Cubre el periodo del plan?", "¿Hay excepciones o aprobaciones faltantes?"],
  hallazgo: ["¿Qué riesgos identifica?", "¿Qué fechas o plazos menciona?", "¿Hay incumplimientos o excepciones?"],
};

// Textos con los que el backend guarda las acciones sin pregunta.
const PREGUNTA_RESUMEN = "Resumen de la evidencia";
const PREGUNTA_VALIDAR = "Validar contra el control";

const AVISO_NO_DISPONIBLE = "El asistente de IA no está disponible en este momento. El resto de la plataforma sigue funcionando.";

type TipoConsulta = "resumen" | "pregunta" | "validacion";

interface Consulta {
  id: number;
  tipo: TipoConsulta;
  pregunta: string;
  respuesta: { estado: EstadoRespuesta; texto: string; recortado?: boolean };
}

const ETIQUETAS: Record<TipoConsulta, string> = { resumen: "Resumen", pregunta: "Pregunta", validacion: "Validación contra el control" };

// El historial guardado llega como mensajes alternos (pregunta, respuesta).
function aConsultas(mensajes: MensajeConversacion[]): Consulta[] {
  const consultas: Consulta[] = [];
  mensajes.forEach((m, i) => {
    const previo = mensajes[i - 1];
    if (m.rol !== "asistente" || previo?.rol !== "usuario") return;
    const tipo: TipoConsulta =
      previo.texto === PREGUNTA_RESUMEN ? "resumen" : previo.texto === PREGUNTA_VALIDAR ? "validacion" : "pregunta";
    consultas.push({ id: -i, tipo, pregunta: previo.texto, respuesta: { estado: m.estado ?? "respondida", texto: m.texto } });
  });
  return consultas;
}

interface Props {
  evidencia: { id: string; nombre: string };
  onCerrar: () => void;
}

// Errores que significan que la IA (o el servidor) no responde: la función se desactiva.
function desactivaLaFuncion(error: unknown): boolean {
  return error instanceof ErrorApi && (error.status === 503 || error.status === 0);
}

export default function PanelAsistenteEvidencia({ evidencia, onCerrar }: Props) {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [contexto, setContexto] = useState<ConversacionEvidencia["contexto"] | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const siguienteId = useRef(1);

  useEffect(() => {
    let vigente = true;
    obtenerEstadoAsistente()
      .then(({ disponible }) => {
        if (!vigente) return;
        setDisponible(disponible);
        if (!disponible) setAviso(AVISO_NO_DISPONIBLE);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setDisponible(false);
        setAviso(e instanceof ErrorApi && e.status !== 0 ? e.message : AVISO_NO_DISPONIBLE);
      });
    return () => {
      vigente = false;
    };
  }, []);

  // La conversación y el contexto del archivo se piden al abrir el panel.
  useEffect(() => {
    let vigente = true;
    obtenerConversacionEvidencia(evidencia.id)
      .then((conversacion) => {
        if (!vigente) return;
        setContexto(conversacion.contexto);
        setConsultas(aConsultas(conversacion.mensajes));
      })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof ErrorApi ? e.message : "No se pudo cargar la conversación.");
      });
    return () => {
      vigente = false;
    };
  }, [evidencia.id]);

  useEffect(() => {
    finRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [consultas, cargando]);

  async function consultar(tipo: TipoConsulta, textoPregunta?: string) {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await consultarEvidencia(
        evidencia.id,
        tipo === "validacion" ? { validar: true } : tipo === "pregunta" ? { pregunta: textoPregunta! } : {},
      );
      const guardada = tipo === "resumen" ? PREGUNTA_RESUMEN : tipo === "validacion" ? PREGUNTA_VALIDAR : textoPregunta!;
      setConsultas((previas) => [...previas, { id: siguienteId.current++, tipo, pregunta: guardada, respuesta }]);
      if (tipo === "pregunta") setPregunta("");
    } catch (e) {
      if (desactivaLaFuncion(e)) {
        setDisponible(false);
        setAviso((e as ErrorApi).message);
      } else {
        setError(e instanceof ErrorApi ? e.message : "Ocurrió un error inesperado.");
      }
    } finally {
      setCargando(false);
    }
  }

  const bloqueado = disponible !== true || cargando;
  const preguntaLimpia = pregunta.trim();
  const preguntaValida = preguntaLimpia.length >= PREGUNTA_MIN && preguntaLimpia.length <= PREGUNTA_MAX;

  const enviarPregunta = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!bloqueado && preguntaValida) void consultar("pregunta", preguntaLimpia);
  };

  const nuevaConversacion = async () => {
    setError(null);
    try {
      await borrarConversacionEvidencia(evidencia.id);
      setConsultas([]);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo borrar la conversación.");
    }
  };

  const esControl = contexto?.tipo === "control";
  const sugeridas = PREGUNTAS_SUGERIDAS[esControl ? "control" : "hallazgo"];

  return (
    <Sheet open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border pr-10">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <span className="rounded-lg bg-primary/10 p-1.5">
              <Sparkles size={14} className="text-primary" />
            </span>
            Asistente IA de evidencias
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs">
            <FileText size={12} className="flex-shrink-0" />
            <span className="truncate font-medium text-foreground">{evidencia.nombre}</span>
          </SheetDescription>
          {contexto && <div className="truncate text-[11px] text-muted-foreground">{contexto.etiqueta}</div>}
          {consultas.length > 0 && (
            <button
              type="button"
              onClick={() => void nuevaConversacion()}
              disabled={cargando}
              className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw size={11} /> Nueva conversación
            </button>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {aviso && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{aviso}</span>
            </div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {disponible === null && (
            <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> Verificando el asistente…
            </div>
          )}

          {consultas.length === 0 && !cargando && disponible && (
            <p className="rounded-md bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
              {esControl
                ? "Genera un resumen, valida el documento contra su control o haz una pregunta. El asistente responde con este documento y el contexto de su control y plan, y recuerda lo que hablen aquí."
                : "Genera un resumen del documento o haz una pregunta específica sobre su contenido. El asistente responde con este documento y su contexto, y recuerda lo que hablen aquí."}
            </p>
          )}

          {consultas.map(({ id, tipo, pregunta: textoPregunta, respuesta }) => {
            const respondida = respuesta.estado === "respondida";
            return (
              <div key={id} className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{ETIQUETAS[tipo]}</div>
                {tipo === "pregunta" && <p className="text-xs font-medium text-foreground">{textoPregunta}</p>}
                <div
                  className={`whitespace-pre-line rounded-lg border p-3 text-sm leading-relaxed ${
                    respondida ? "border-primary/15 bg-primary/5 text-foreground" : "border-border bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  {!respondida && <Info size={13} className="mr-1.5 inline-block align-[-2px]" />}
                  {respuesta.texto}
                </div>
                {respuesta.recortado && (
                  <p className="text-[11px] text-muted-foreground">
                    El documento es largo: solo se analizó la parte inicial.
                  </p>
                )}
              </div>
            );
          })}

          {cargando && (
            <div role="status" aria-label="Generando respuesta" className="space-y-2">
              {[1, 0.7, 0.5].map((ancho, i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-primary/10" style={{ width: `${ancho * 100}%` }} />
              ))}
            </div>
          )}
          <div ref={finRef} />
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void consultar("resumen")}
              disabled={bloqueado}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {cargando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Generar resumen
            </button>
            {esControl && (
              <button
                type="button"
                onClick={() => void consultar("validacion")}
                disabled={bloqueado}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
              >
                <ClipboardCheck size={12} />
                Validar contra el control
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sugeridas.map((sugerida) => (
              <button
                key={sugerida}
                type="button"
                onClick={() => void consultar("pregunta", sugerida)}
                disabled={bloqueado}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                {sugerida}
              </button>
            ))}
          </div>

          <form onSubmit={enviarPregunta} className="space-y-1.5">
            <label htmlFor="asistente-pregunta" className="sr-only">
              Pregunta sobre el documento
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="asistente-pregunta"
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviarPregunta();
                  }
                }}
                rows={2}
                maxLength={PREGUNTA_MAX}
                disabled={disponible !== true}
                placeholder="Pregunta algo sobre este documento…"
                className="min-h-[2.75rem] flex-1 resize-none rounded-md border border-border bg-white px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                aria-label="Preguntar"
                disabled={bloqueado || !preguntaValida}
                className="rounded-md bg-primary p-2.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Respuestas generadas por IA a partir de este documento y su contexto; verifícalas antes de usarlas.</span>
              <span className="flex-shrink-0 pl-2 font-mono">
                {pregunta.length}/{PREGUNTA_MAX}
              </span>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
