import React, { useEffect, useState } from "react";
import { AlertTriangle, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorApi } from "../../api/cliente";
import { consultarEvaluacion, guardarEvaluacion } from "../../api/evaluaciones";
import type { Criterio, EstadoEvaluacion, Evaluacion } from "../../api/evaluaciones";
import { Card } from "../ComponentesCompartidos";

// Evaluación de diseño y efectividad de un control (historia #98, SF-07). La calificación y el
// estatus los calcula el backend; aquí solo se capturan las respuestas y se muestra el resultado.

const ESCALA = [1, 2, 3, 4, 5];
const GRUPOS = [
  { tipo: "diseno", titulo: "Diseño" },
  { tipo: "efectividad", titulo: "Efectividad operativa" },
] as const;

const COLOR_RESULTADO: Record<Evaluacion["resultado"], string> = {
  Efectivo: "bg-emerald-100 text-emerald-700",
  "Parcialmente efectivo": "bg-amber-100 text-amber-700",
  Deficiente: "bg-red-100 text-red-700",
};

function FilaCriterio({
  criterio,
  valor,
  faltante,
  deshabilitado,
  onResponder,
}: {
  criterio: Criterio;
  valor: number | undefined;
  faltante: boolean;
  deshabilitado: boolean;
  onResponder: (valor: number) => void;
}) {
  const idNombre = `criterio-${criterio.id}`;
  return (
    <fieldset
      aria-labelledby={idNombre}
      className={`rounded-md border p-3 ${faltante ? "border-red-300 bg-red-50" : "border-border"}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span id={idNombre} className="text-sm text-foreground">
          {criterio.nombre}
        </span>
        <div className="flex shrink-0 gap-1">
          {/* `relative` ancla el radio oculto (sr-only, absoluto) a su etiqueta: sin ello queda fuera de la
              pantalla y, al enfocarlo con un clic, el navegador desplaza toda la ventana hacia abajo. */}
          {ESCALA.map((numero) => (
            <label key={numero} className="relative">
              <input
                type="radio"
                name={idNombre}
                value={numero}
                aria-label={String(numero)}
                checked={valor === numero}
                disabled={deshabilitado}
                onChange={() => onResponder(numero)}
                className="peer sr-only"
              />
              <span className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-xs font-semibold text-muted-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                {numero}
              </span>
            </label>
          ))}
        </div>
      </div>
      {faltante && <p className="mt-2 text-xs text-red-600">Este criterio es obligatorio.</p>}
    </fieldset>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  const id = `dato-${etiqueta.replace(/\s/g, "-")}`;
  return (
    <div>
      <div id={id} className="text-xs text-muted-foreground">
        {etiqueta}
      </div>
      <div aria-labelledby={id} role="status" className="text-lg font-bold text-foreground">
        {valor.toFixed(2)}
      </div>
    </div>
  );
}

function ResultadoEvaluacion({
  evaluacion,
  onGenerarHallazgo,
}: {
  evaluacion: Evaluacion;
  onGenerarHallazgo: () => void;
}) {
  return (
    <div className="mt-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center gap-6">
        <Dato etiqueta="Calificación" valor={evaluacion.calificacion} />
        <Dato etiqueta="Promedio de diseño" valor={evaluacion.promedioDiseno} />
        <Dato etiqueta="Promedio de efectividad" valor={evaluacion.promedioEfectividad} />
        <div>
          <div className="text-xs text-muted-foreground">Estatus</div>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_RESULTADO[evaluacion.resultado]}`}
          >
            {evaluacion.resultado}
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Evaluado por {evaluacion.evaluadoPor.nombre} el{" "}
        {new Date(evaluacion.evaluadoEn).toLocaleDateString("es-MX")}.
      </p>
      {evaluacion.deficiencia && (
        <div
          role="alert"
          className="mt-3 flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-sm text-red-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>Control con deficiencia: su nivel de madurez es bajo.</span>
          </div>
          <button
            type="button"
            onClick={onGenerarHallazgo}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <Flag size={13} /> Generar hallazgo
          </button>
        </div>
      )}
    </div>
  );
}

export default function EvaluacionControl({
  planId,
  controlId,
  onGenerarHallazgo,
}: {
  planId: string;
  controlId: string;
  onGenerarHallazgo: () => void;
}) {
  const [estado, setEstado] = useState<EstadoEvaluacion | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [faltantes, setFaltantes] = useState<number[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setEstado(null);
    setErrorCarga(null);
    setFaltantes([]);
    consultarEvaluacion(planId, controlId)
      .then((resultado) => {
        if (!activo) return;
        setEstado(resultado);
        setRespuestas(
          Object.fromEntries(
            (resultado.evaluacion?.respuestas ?? []).map((r) => [r.criterioId, r.valor]),
          ),
        );
      })
      .catch((error: unknown) => {
        if (!activo) return;
        // Quien no participa en el control simplemente no ve esta sección.
        if (error instanceof ErrorApi && (error.status === 403 || error.status === 404)) return;
        setErrorCarga(error instanceof Error ? error.message : "No se pudo cargar la evaluación.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [planId, controlId]);

  if (cargando) {
    return (
      <Card className="mb-5 flex items-center p-5 text-sm text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" size={16} /> Cargando evaluación...
      </Card>
    );
  }
  if (errorCarga) return <Card className="mb-5 p-5 text-sm text-red-600">{errorCarga}</Card>;
  if (!estado) return null;

  const { criterios, evaluacion, puedeEvaluar, motivoBloqueo } = estado;

  const responder = (criterioId: number, valor: number) => {
    setRespuestas((actuales) => ({ ...actuales, [criterioId]: valor }));
    setFaltantes((actuales) => actuales.filter((id) => id !== criterioId));
  };

  const guardar = async () => {
    const sinResponder = criterios.filter((c) => c.obligatorio && respuestas[c.id] === undefined);
    if (sinResponder.length > 0) {
      setFaltantes(sinResponder.map((c) => c.id));
      toast.error(`Falta responder: ${sinResponder.map((c) => c.nombre).join(", ")}.`);
      return;
    }
    setGuardando(true);
    try {
      const guardada = await guardarEvaluacion(
        planId,
        controlId,
        criterios
          .filter((c) => respuestas[c.id] !== undefined)
          .map((c) => ({ criterioId: c.id, valor: respuestas[c.id]! })),
      );
      setEstado({ ...estado, evaluacion: guardada });
      toast.success("Evaluación guardada.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la evaluación.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="mb-5 p-5">
      <h2 className="text-sm font-semibold text-foreground">Evaluación del control</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Califica cada criterio con la escala de madurez, de 1 (muy bajo) a 5 (muy alto).
      </p>
      {motivoBloqueo && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {motivoBloqueo}
        </p>
      )}
      {GRUPOS.map(({ tipo, titulo }) => (
        <section key={tipo} className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {titulo}
          </h3>
          <div className="space-y-2">
            {criterios
              .filter((c) => c.tipo === tipo)
              .map((criterio) => (
                <FilaCriterio
                  key={criterio.id}
                  criterio={criterio}
                  valor={respuestas[criterio.id]}
                  faltante={faltantes.includes(criterio.id)}
                  deshabilitado={!puedeEvaluar || guardando}
                  onResponder={(valor) => responder(criterio.id, valor)}
                />
              ))}
          </div>
        </section>
      ))}
      {puedeEvaluar && (
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar evaluación"}
        </button>
      )}
      {evaluacion && (
        <ResultadoEvaluacion evaluacion={evaluacion} onGenerarHallazgo={onGenerarHallazgo} />
      )}
    </Card>
  );
}
