import { useEffect, useState } from "react";
import { Edit3, Loader2, X } from "lucide-react";
import type { Proceso, UnidadNegocio } from "../../api/estructura";
import type { Usuario } from "../../api/usuarios";
import { Card } from "../SharedComponents";

interface ModalEditarEntidadProps {
  unidad: UnidadNegocio | null;
  proceso: { proceso: Proceso; unidadId: number } | null;
  usuarios: Usuario[];
  guardando: boolean;
  onGuardarUnidad: (id: number, cambios: { nombre?: string; responsableId?: number }) => Promise<boolean>;
  onGuardarProceso: (procesoId: number, nombre: string, unidadId: number) => Promise<boolean>;
  onCerrar: () => void;
}

export function ModalEditarEntidad({
  unidad,
  proceso,
  usuarios,
  guardando,
  onGuardarUnidad,
  onCerrar,
  onGuardarProceso,
}: ModalEditarEntidadProps) {
  const abierto = Boolean(unidad || proceso);

  const [nombre, setNombre] = useState("");
  const [responsableId, setResponsableId] = useState<number | "">("");
  const [errorLocal, setErrorLocal] = useState("");

  useEffect(() => {
    if (unidad) {
      setNombre(unidad.nombre);
      setResponsableId(unidad.responsableId);
      setErrorLocal("");
    } else if (proceso) {
      setNombre(proceso.proceso.nombre);
      setErrorLocal("");
    }
  }, [unidad, proceso]);

  if (!abierto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorLocal("El nombre no puede quedar vacío.");
      return;
    }

    if (unidad) {
      await onGuardarUnidad(unidad.id, {
        nombre: nombre.trim(),
        responsableId: responsableId ? Number(responsableId) : undefined,
      });
    } else if (proceso) {
      await onGuardarProceso(proceso.proceso.id, nombre.trim(), proceso.unidadId);
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
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Edit3 size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {unidad ? "Editar Unidad de Negocio" : "Editar Proceso"}
            </h2>
            <p className="text-xs text-muted-foreground">Actualiza la información en la estructura organizacional.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setErrorLocal("");
              }}
              maxLength={150}
              disabled={guardando}
              className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errorLocal ? "border-red-400" : "border-border"
              }`}
            />
            {errorLocal && <p className="text-xs text-red-600 mt-1">{errorLocal}</p>}
          </div>

          {unidad && (
            <div>
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
                Gerente Responsable
              </label>
              <select
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value ? Number(e.target.value) : "")}
                disabled={guardando}
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.rol})
                  </option>
                ))}
              </select>
            </div>
          )}

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
                "Guardar Cambios"
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
