import { useEffect, useState } from "react";
import { AlertCircle, Edit3, Loader2, X } from "lucide-react";
import {
  ETIQUETA_NIVEL,
  type DepartamentoAuditoria,
  type EdicionNodoInput,
  type EdicionUnidadInput,
  type Responsable,
  type UnidadNegocio,
} from "../../api/estructura";
import type { NodoSeleccionado } from "../../domain/estructura/useEstructuraViewModel";
import { Card } from "../SharedComponents";

interface ModalEditarEntidadProps {
  unidad: UnidadNegocio | null;
  nodo: NodoSeleccionado | null;
  responsables: Responsable[];
  departamentos: DepartamentoAuditoria[];
  guardando: boolean;
  errorServidor: string | null;
  onGuardarUnidad: (id: number, cambios: EdicionUnidadInput) => Promise<boolean>;
  onGuardarNodo: (nodo: NodoSeleccionado, cambios: EdicionNodoInput) => Promise<boolean>;
  onCerrar: () => void;
}

export function ModalEditarEntidad({
  unidad,
  nodo,
  responsables,
  departamentos,
  guardando,
  errorServidor,
  onGuardarUnidad,
  onGuardarNodo,
  onCerrar,
}: ModalEditarEntidadProps) {
  const abierto = Boolean(unidad || nodo);

  const [nombre, setNombre] = useState("");
  const [responsableId, setResponsableId] = useState<number | "">("");
  const [departamentoId, setDepartamentoId] = useState<number | "">("");
  const [pais, setPais] = useState("");
  const [errorLocal, setErrorLocal] = useState("");

  useEffect(() => {
    if (unidad) {
      setNombre(unidad.nombre);
      setResponsableId(unidad.responsableId);
      setDepartamentoId(unidad.departamentoAuditoriaId ?? "");
    } else if (nodo) {
      setNombre(nodo.nombre);
      setPais(nodo.pais ?? "");
    }
    setErrorLocal("");
  }, [unidad, nodo]);

  if (!abierto) return null;

  const conPais = nodo?.nivel === "subdivision";
  // El gerente actual puede ya no ser Jefe de Auditoría; se muestra para no perderlo.
  const opcionesResponsable =
    unidad && !responsables.some((r) => r.id === unidad.responsableId)
      ? [{ id: unidad.responsableId, nombre: unidad.responsableNombre }, ...responsables]
      : responsables;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorLocal("El nombre no puede quedar vacío.");
      return;
    }

    if (unidad) {
      const cambios: EdicionUnidadInput = {
        nombre: nombre.trim(),
        departamentoAuditoriaId: departamentoId ? Number(departamentoId) : null,
      };
      if (responsableId && responsableId !== unidad.responsableId) cambios.responsableId = Number(responsableId);
      await onGuardarUnidad(unidad.id, cambios);
    } else if (nodo) {
      await onGuardarNodo(nodo, conPais ? { nombre: nombre.trim(), pais: pais.trim() || null } : { nombre: nombre.trim() });
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
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-4 border-b border-border pb-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Edit3 size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Editar {unidad ? "Unidad de Negocio" : ETIQUETA_NIVEL[nodo!.nivel]}
            </h2>
            <p className="text-xs text-muted-foreground">Actualiza la información en la estructura organizacional.</p>
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
            <label htmlFor="editar-nombre" className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="editar-nombre"
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
            <>
              <div>
                <label
                  htmlFor="editar-responsable"
                  className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5"
                >
                  Gerente Responsable
                </label>
                <select
                  id="editar-responsable"
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value ? Number(e.target.value) : "")}
                  disabled={guardando}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  {opcionesResponsable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="editar-departamento"
                  className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5"
                >
                  Departamento de Auditoría
                </label>
                <select
                  id="editar-departamento"
                  value={departamentoId}
                  onChange={(e) => setDepartamentoId(e.target.value ? Number(e.target.value) : "")}
                  disabled={guardando}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Sin asignar</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {conPais && (
            <div>
              <label htmlFor="editar-pais" className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
                País o región
              </label>
              <input
                id="editar-pais"
                type="text"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                maxLength={100}
                disabled={guardando}
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
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
