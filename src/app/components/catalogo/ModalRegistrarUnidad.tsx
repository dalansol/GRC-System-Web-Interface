import { useState } from "react";
import { AlertCircle, Building2, Calendar, Landmark, Loader2, User, X } from "lucide-react";
import type { AltaUnidadInput, DepartamentoAuditoria, PeriodoFiscal, Responsable } from "../../api/estructura";
import { Card } from "../SharedComponents";
import { Sugerencias } from "./piezasCatalogo";

interface ModalRegistrarUnidadProps {
  abierto: boolean;
  periodoActivo: PeriodoFiscal | null;
  responsables: Responsable[];
  departamentos: DepartamentoAuditoria[];
  guardando: boolean;
  errorServidor: string | null;
  onGuardar: (datos: AltaUnidadInput) => Promise<boolean>;
  onCerrar: () => void;
  /** Nombre sugerido: el siguiente código UDN libre. */
  sugerenciasNombre?: readonly string[];
}

export function ModalRegistrarUnidad({
  abierto,
  periodoActivo,
  responsables,
  departamentos,
  guardando,
  errorServidor,
  onGuardar,
  onCerrar,
  sugerenciasNombre = [],
}: ModalRegistrarUnidadProps) {
  const [nombre, setNombre] = useState("");
  const [nombreReal, setNombreReal] = useState("");
  const [responsableId, setResponsableId] = useState<number | "">("");
  const [departamentoId, setDepartamentoId] = useState<number | "">("");
  const [errores, setErrores] = useState<Record<string, string>>({});

  if (!abierto) return null;

  const validar = () => {
    const err: Record<string, string> = {};
    if (!nombre.trim()) err.nombre = "El nombre de la unidad es obligatorio.";
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
      nombreReal: nombreReal.trim() || null,
      responsableId: Number(responsableId),
      departamentoAuditoriaId: departamentoId ? Number(departamentoId) : null,
    });

    if (exito) {
      setNombre("");
      setNombreReal("");
      setResponsableId("");
      setDepartamentoId("");
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
              Registra la unidad con su gerente responsable; queda asignada al periodo de auditoría activo.
            </p>
          </div>
        </div>

        {/* Error del servidor o duplicados */}
        {errorServidor && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <span className="font-semibold">Error al registrar:</span> {errorServidor}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre de la Unidad */}
          <div>
            <label
              htmlFor="unidad-nombre"
              className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5"
            >
              Nombre de la Unidad de Negocio <span className="text-red-500">*</span>
            </label>
            <input
              id="unidad-nombre"
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setErrores((prev) => ({ ...prev, nombre: "" }));
              }}
              placeholder="Ej. UDN-0007, Proximidad y Salud…"
              list="unidad-nombre-sugerencias"
              autoComplete="off"
              maxLength={150}
              disabled={guardando}
              className={`w-full text-sm px-3.5 py-2.5 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                errores.nombre ? "border-red-400 focus:ring-red-100" : "border-border"
              }`}
            />
            {errores.nombre && <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>}
            <Sugerencias id="unidad-nombre-sugerencias" opciones={sugerenciasNombre} />
          </div>

          {/* Nombre real (opcional): se muestra en lugar del código */}
          <div>
            <label htmlFor="unidad-nombre-real" className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">
              Nombre real (opcional)
            </label>
            <input
              id="unidad-nombre-real"
              type="text"
              value={nombreReal}
              onChange={(e) => setNombreReal(e.target.value)}
              placeholder="Ej. KOF, Proximidad y Salud…"
              maxLength={150}
              disabled={guardando}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              El nombre de arriba es el código del Consolidado y debe ser único; este solo se muestra.
            </p>
          </div>

          {/* Gerente Responsable */}
          <div>
            <label
              htmlFor="unidad-responsable"
              className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5"
            >
              <User size={13} className="text-muted-foreground" />
              Gerente Responsable <span className="text-red-500">*</span>
            </label>
            <select
              id="unidad-responsable"
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
              <option value="">Selecciona un Jefe de Auditoría activo…</option>
              {responsables.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            {errores.responsableId && <p className="text-xs text-red-600 mt-1">{errores.responsableId}</p>}
          </div>

          {/* Departamento de Auditoría */}
          <div>
            <label
              htmlFor="unidad-departamento"
              className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5"
            >
              <Landmark size={13} className="text-muted-foreground" />
              Departamento de Auditoría
            </label>
            <select
              id="unidad-departamento"
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

          {/* Periodo de auditoría activo (automático, solo lectura) */}
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
              La unidad de negocio se vincula automáticamente al periodo de auditoría vigente.
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
