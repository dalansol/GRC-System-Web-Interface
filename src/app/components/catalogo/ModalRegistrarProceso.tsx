import { useState } from "react";
import { AlertCircle, Loader2, Workflow, X } from "lucide-react";
import type { UnidadNegocio } from "../../api/estructura";
import { Card } from "../SharedComponents";

interface ModalRegistrarProcesoProps {
  abierto: boolean;
  unidad: UnidadNegocio | null;
  guardando: boolean;
  errorServidor: string | null;
  onGuardar: (unidadId: number, nombre: string) => Promise<boolean>;
  onCerrar: () => void;
}

export function ModalRegistrarProceso({
  abierto,
  unidad,
  guardando,
  errorServidor,
  onGuardar,
  onCerrar,
}: ModalRegistrarProcesoProps) {
  const [nombre, setNombre] = useState("");
  const [errorLocal, setErrorLocal] = useState("");

  if (!abierto || !unidad) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorLocal("El nombre del proceso es obligatorio.");
      return;
    }

    const exito = await onGuardar(unidad.id, nombre.trim());
    if (exito) {
      setNombre("");
      setErrorLocal("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md p-6 bg-white shadow-2xl relative rounded-xl border border-border">
        <button
          onClick={onCerrar}
          disabled={guardando}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
          title="Cerrar modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-4 border-b border-border pb-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <Workflow size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Agregar Proceso</h2>
            <p className="text-xs text-muted-foreground">
              Unidad: <span className="font-semibold text-foreground">{unidad.nombre}</span>
            </p>
          </div>
        </div>

        {errorServidor && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <span className="font-semibold">Error al agregar:</span> {errorServidor}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
              Nombre del Proceso <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setErrorLocal("");
              }}
              placeholder="Ej. Facturación Electrónica, Gestión de Almacén…"
              maxLength={150}
              disabled={guardando}
              className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errorLocal ? "border-red-400" : "border-border"
              }`}
            />
            {errorLocal && <p className="text-xs text-red-600 mt-1">{errorLocal}</p>}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Guardando…
                </>
              ) : (
                "Agregar Proceso"
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
