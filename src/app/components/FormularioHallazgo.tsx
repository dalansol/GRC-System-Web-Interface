import React, { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export interface FindingControlOption {
  id: string;
  name: string;
  vulnerability: "Baja" | "Media" | "Alta";
}

export interface CreatedFinding {
  id: string;
  folio: string;
  title: string;
  description: string;
  type: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  failedControl: string;
  failedControlId: string;
  residualRisk: "Crítico" | "Alto" | "Medio" | "Bajo";
  status: "Abierto";
  auditId: string;
  date: string;
}

interface FormularioHallazgoProps {
  controls: FindingControlOption[];
  nextFolio: string;
  auditId?: string;
  onCreated: (finding: CreatedFinding) => void;
  onClose: () => void;
}

const FINDING_TYPES = [
  "Deficiencia de control",
  "Incumplimiento normativo",
  "Riesgo operativo",
  "Seguridad de la información",
  "Otro",
];

const SEVERITIES: CreatedFinding["severity"][] = [
  "Crítico",
  "Alto",
  "Medio",
  "Bajo",
];

const severityScore: Record<CreatedFinding["severity"], number> = {
  Crítico: 4,
  Alto: 3,
  Medio: 2,
  Bajo: 1,
};

const vulnerabilityMitigation: Record<FindingControlOption["vulnerability"], number> = {
  Baja: 1,
  Media: 0,
  Alta: 0,
};

function calculateResidualRisk(
  severity: CreatedFinding["severity"],
  vulnerability: FindingControlOption["vulnerability"],
): CreatedFinding["residualRisk"] {
  const score = Math.max(
    1,
    severityScore[severity] - vulnerabilityMitigation[vulnerability],
  );

  if (score >= 4) return "Crítico";
  if (score === 3) return "Alto";
  if (score === 2) return "Medio";
  return "Bajo";
}

export default function FormularioHallazgo({
  controls,
  nextFolio,
  auditId = "AUD-001",
  onCreated,
  onClose,
}: FormularioHallazgoProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] =
    useState<CreatedFinding["severity"]>("Medio");
  const [controlId, setControlId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedControl = controls.find(control => control.id === controlId);

  const residualRisk = useMemo(() => {
    if (!selectedControl) return null;

    return calculateResidualRisk(
      severity,
      selectedControl.vulnerability,
    );
  }, [severity, selectedControl]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!title.trim()) nextErrors.title = "El título es obligatorio";
    if (!description.trim()) {
      nextErrors.description = "La descripción es obligatoria";
    }
    if (!type) nextErrors.type = "Selecciona un tipo";
    if (!severity) nextErrors.severity = "Selecciona una gravedad";
    if (!controlId) {
      nextErrors.controlId = "Selecciona el control que falló";
    }

    return nextErrors;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!selectedControl || !residualRisk) return;

    const finding: CreatedFinding = {
      id: `FND-${Date.now()}`,
      folio: nextFolio,
      title: title.trim(),
      description: description.trim(),
      type,
      severity,
      failedControl: selectedControl.name,
      failedControlId: selectedControl.id,
      residualRisk,
      status: "Abierto",
      auditId,
      date: new Date().toISOString().slice(0, 10),
    };

    onCreated(finding);
    toast.success(`Hallazgo ${nextFolio} registrado correctamente`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Nuevo hallazgo
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Folio asignado:{" "}
              <span className="font-mono font-semibold text-primary">
                {nextFolio}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Título
            </label>
            <input
              value={title}
              onChange={event => {
                setTitle(event.target.value);
                setErrors(current => ({ ...current, title: "" }));
              }}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Ej. Segregación de funciones insuficiente"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">{errors.title}</p>
            )}
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={event => {
                setDescription(event.target.value);
                setErrors(current => ({ ...current, description: "" }));
              }}
              rows={4}
              className="w-full resize-none rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Describe la situación identificada..."
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">
                {errors.description}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Tipo
            </label>
            <select
              value={type}
              onChange={event => {
                setType(event.target.value);
                setErrors(current => ({ ...current, type: "" }));
              }}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar tipo</option>
              {FINDING_TYPES.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1 text-xs text-red-600">{errors.type}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Gravedad
            </label>
            <select
              value={severity}
              onChange={event => {
                setSeverity(
                  event.target.value as CreatedFinding["severity"],
                );
                setErrors(current => ({ ...current, severity: "" }));
              }}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              {SEVERITIES.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Control que falló
            </label>
            <select
              value={controlId}
              onChange={event => {
                setControlId(event.target.value);
                setErrors(current => ({ ...current, controlId: "" }));
              }}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccionar control</option>
              {controls.map(control => (
                <option key={control.id} value={control.id}>
                  {control.id} - {control.name}
                </option>
              ))}
            </select>
            {errors.controlId && (
              <p className="mt-1 text-xs text-red-600">
                {errors.controlId}
              </p>
            )}
          </div>

          <div className="col-span-2 rounded-md border border-primary/20 bg-primary/5 p-3">
            <div className="text-xs font-semibold text-muted-foreground">
              Riesgo residual calculado
            </div>
            <div className="mt-1 text-lg font-bold text-primary">
              {residualRisk ?? "Selecciona un control"}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 border-t border-border pt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Check size={14} />
            Registrar hallazgo
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}