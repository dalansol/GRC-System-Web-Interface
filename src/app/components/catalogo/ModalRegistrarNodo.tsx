import { useState } from "react";
import { AlertCircle, GitBranch, Loader2, X } from "lucide-react";
import { ETIQUETA_NIVEL } from "../../api/estructura";
import type { AltaNodoContexto } from "../../domain/estructura/useEstructuraViewModel";
import { Card } from "../SharedComponents";

// Alta de división, subdivisión o área dentro de su nivel padre (SF-03).
// Los nombres de estos niveles se repiten entre ramas: no hay validación de duplicados.

interface ModalRegistrarNodoProps {
  contexto: AltaNodoContexto | null;
  guardando: boolean;
  errorServidor: string | null;
  onGuardar: (datos: { nombre: string; pais?: string | null }) => Promise<boolean>;
  onCerrar: () => void;
}

const PLACEHOLDER: Record<AltaNodoContexto["nivel"], string> = {
  division: "Ej. DIVISION-0001",
  subdivision: "Ej. SUBDIVISION-0001",
  area: "Ej. Nómina, Inventarios, Compras…",
};

export function ModalRegistrarNodo({ contexto, guardando, errorServidor, onGuardar, onCerrar }: ModalRegistrarNodoProps) {
  const [nombre, setNombre] = useState("");
  const [pais, setPais] = useState("");
  const [errorLocal, setErrorLocal] = useState("");

  if (!contexto) return null;

  const etiqueta = ETIQUETA_NIVEL[contexto.nivel];
  const conPais = contexto.nivel === "subdivision";

  const cerrar = () => {
    setNombre("");
    setPais("");
    setErrorLocal("");
    onCerrar();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorLocal("El nombre es obligatorio.");
      return;
    }

    const exito = await onGuardar(conPais ? { nombre: nombre.trim(), pais: pais.trim() || null } : { nombre: nombre.trim() });
    if (exito) {
      setNombre("");
      setPais("");
      setErrorLocal("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-md p-6 bg-white shadow-2xl relative rounded-xl border border-border">
        <button
          onClick={cerrar}
          disabled={guardando}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
          title="Cerrar modal"
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-4 border-b border-border pb-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <GitBranch size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Agregar {etiqueta}</h2>
            <p className="text-xs text-muted-foreground">
              Dentro de <span className="font-semibold text-foreground">{contexto.padreNombre}</span>
            </p>
          </div>
        </div>

        {errorServidor && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
            <span>{errorServidor}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nodo-nombre" className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="nodo-nombre"
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setErrorLocal("");
              }}
              placeholder={PLACEHOLDER[contexto.nivel]}
              maxLength={150}
              disabled={guardando}
              className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errorLocal ? "border-red-400" : "border-border"
              }`}
            />
            {errorLocal && <p className="text-xs text-red-600 mt-1">{errorLocal}</p>}
          </div>

          {conPais && (
            <div>
              <label htmlFor="nodo-pais" className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
                País o región
              </label>
              <input
                id="nodo-pais"
                type="text"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                placeholder="Ej. México, Centroamérica Sur, Corporativo…"
                maxLength={100}
                disabled={guardando}
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={cerrar}
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
                "Guardar"
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
