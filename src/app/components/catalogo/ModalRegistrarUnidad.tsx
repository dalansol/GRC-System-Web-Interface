import { useState } from "react";
import { AlertCircle, Building2, Calendar, Loader2, User, Workflow, X } from "lucide-react";
import type { PeriodoFiscal } from "../../api/estructura";
import type { Usuario } from "../../api/usuarios";
import { Card } from "../SharedComponents";

interface ModalRegistrarUnidadProps {
  abierto: boolean;
  periodoActivo: PeriodoFiscal | null;
  usuarios: Usuario[];
  guardando: boolean;
  errorServidor: string | null;
  onGuardar: (datos: { nombre: string; proceso: string; responsableId: number }) => Promise<boolean>;
  onCerrar: () => void;
}

export function ModalRegistrarUnidad({
  abierto,
  periodoActivo,
  usuarios,
  guardando,
  errorServidor,
  onGuardar,
  onCerrar,
}: ModalRegistrarUnidadProps) {
  const [nombre, setNombre] = useState("");
  const [proceso, setProceso] = useState("");
  const [responsableId, setResponsableId] = useState<number | "">("");
  const [errores, setErrores] = useState<Record<string, string>>({});

  if (!abierto) return null;

  const validar = () => {
    const err: Record<string, string> = {};
    if (!nombre.trim()) err.nombre = "El nombre de la unidad es obligatorio.";
    if (!proceso.trim()) err.proceso = "El proceso operativo inicial es obligatorio.";
    if (!responsableId) err.responsableId = "Debes seleccionar un gerente responsable.";
    if (!periodoActivo) err.periodo = "No hay un periodo de auditoría activo configurado.";
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validar();
    if (Object.keys(err).length > 0) {
      setErrores(err);
      return;
    }

    const exito = await onGuardar({
      nombre: nombre.trim(),
      proceso: proceso.trim(),
      responsableId: Number(responsableId),
    });

    if (exito) {
      setNombre("");
      setProceso("");
      setResponsableId("");
      setErrores({});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-white shadow-2xl relative rounded-xl border border-border">
        {/* Botón cerrar */}
        <button
          onClick={onCerrar}
          disabled={guardando}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
          title="Cerrar modal"
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Nueva Unidad de Negocio</h2>
            <p className="text-xs text-muted-foreground">
              Parametriza una unidad de negocio con su proceso inicial y periodo fiscal activo.
            </p>
          </div>
        </div>

        {/* Error del servidor o duplicados */}
        {errorServidor && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <span className="font-semibold">Error al registrar:</span> {errorServidor}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre de la Unidad */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
              Nombre de la Unidad de Negocio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setErrores((prev) => ({ ...prev, nombre: "" }));
              }}
              placeholder="Ej. Banca Minorista, Logística y Distribución…"
              maxLength={150}
              disabled={guardando}
              className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errores.nombre ? "border-red-400 focus:ring-red-100" : "border-border"
              }`}
            />
            {errores.nombre && <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>}
          </div>

          {/* Proceso Operativo Inicial */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
              <Workflow size={13} className="text-muted-foreground" />
              Proceso Operativo Inicial <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={proceso}
              onChange={(e) => {
                setProceso(e.target.value);
                setErrores((prev) => ({ ...prev, proceso: "" }));
              }}
              placeholder="Ej. Originación de Créditos, Gestión de Compras…"
              maxLength={150}
              disabled={guardando}
              className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errores.proceso ? "border-red-400 focus:ring-red-100" : "border-border"
              }`}
            />
            {errores.proceso && <p className="text-xs text-red-600 mt-1">{errores.proceso}</p>}
          </div>

          {/* Gerente Responsable */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
              <User size={13} className="text-muted-foreground" />
              Gerente Responsable <span className="text-red-500">*</span>
            </label>
            <select
              value={responsableId}
              onChange={(e) => {
                setResponsableId(e.target.value ? Number(e.target.value) : "");
                setErrores((prev) => ({ ...prev, responsableId: "" }));
              }}
              disabled={guardando}
              className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errores.responsableId ? "border-red-400" : "border-border"
              }`}
            >
              <option value="">Selecciona un responsable activo…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </select>
            {errores.responsableId && <p className="text-xs text-red-600 mt-1">{errores.responsableId}</p>}
          </div>

          {/* Periodo Fiscal Activo (Automático e informativo) */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-emerald-600" />
                <span className="text-xs font-semibold text-slate-700">Periodo de Auditoría Asignado:</span>
              </div>
              {periodoActivo ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {periodoActivo.nombre} (Activo)
                </span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Sin periodo activo configurado
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              La unidad de negocio se vincula automáticamente al periodo fiscal vigente del sistema.
            </p>
            {errores.periodo && <p className="text-xs text-red-600 mt-1">{errores.periodo}</p>}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
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
              disabled={guardando || !periodoActivo}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar Unidad"
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
