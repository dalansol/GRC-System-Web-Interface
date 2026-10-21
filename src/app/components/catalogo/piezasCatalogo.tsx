import { ShieldAlert } from "lucide-react";
import type { NivelNodo, Riesgo } from "../../api/estructura";
import type { AltaNodoContexto, NodoSeleccionado } from "../../domain/estructura/useEstructuraViewModel";
import { nombreVisible, tieneNombreReal, type ConNombre } from "../../domain/estructura/nombres";
import { COLOR_NIVEL_RIESGO, nivelMaximo } from "../../domain/estructura/riesgos";

// Piezas compartidas por la vista de árbol (HierarchyView) y la de tarjetas
// (DetalleUnidadTarjetas), para que ambas se vean igual.

/** Color del chip de tipo de cada nivel. */
export const COLOR_NIVEL: Record<NivelNodo, string> = {
  division: "bg-emerald-100 text-emerald-700",
  subdivision: "bg-sky-100 text-sky-700",
  area: "bg-amber-100 text-amber-700",
};

/** Acciones de gestión sobre los nodos; solo se muestran si `puedeGestionar`. */
export interface AccionesGestion {
  puedeGestionar: boolean;
  onAgregar: (contexto: AltaNodoContexto) => void;
  onEditar: (nodo: NodoSeleccionado) => void;
  onEliminar: (nodo: NodoSeleccionado) => void;
}

/** Punto de color y conteo de riesgos de una rama; no pinta nada si no hay riesgos. */
export function ResumenRiesgos({ riesgos, testId }: { riesgos: Riesgo[]; testId?: string }) {
  if (riesgos.length === 0) return null;
  const peor = nivelMaximo(riesgos);
  const color = COLOR_NIVEL_RIESGO[peor ?? "sin"];
  return (
    <span
      data-testid={testId}
      title={`${riesgos.length} ${riesgos.length === 1 ? "riesgo" : "riesgos"} · peor nivel: ${peor ?? "sin nivel"}`}
      className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${color.insignia}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${color.punto}`} />
      {riesgos.length}
    </span>
  );
}

/** Chip con el nivel de un riesgo. */
export function ChipNivelRiesgo({ riesgo }: { riesgo: Riesgo }) {
  const color = COLOR_NIVEL_RIESGO[riesgo.nivel ?? "sin"];
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${color.insignia}`}>
      {riesgo.nivel ?? "Sin nivel"}
    </span>
  );
}

/** Nombre real (o el código si no hay) y, si hay nombre real, el código aparte en pequeño. */
export function NombreConCodigo({ nodo }: { nodo: ConNombre }) {
  return (
    <>
      {nombreVisible(nodo)}
      {tieneNombreReal(nodo) && (
        <span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground" title="Código en el Consolidado">
          {nodo.nombre}
        </span>
      )}
    </>
  );
}

/** Lista de sugerencias para un input (el usuario puede escribir otro valor). */
export function Sugerencias({ id, opciones }: { id: string; opciones: readonly string[] }) {
  return (
    <datalist id={id} data-testid={id}>
      {opciones.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );
}

/** Riesgo como fila del árbol, con sangría según la profundidad. */
export function FilaRiesgo({ riesgo, profundidad }: { riesgo: Riesgo; profundidad: number }) {
  return (
    <div
      data-testid={`riesgo-${riesgo.id}`}
      className="flex items-start gap-1.5 py-1 pr-1 text-xs"
      style={{ paddingLeft: `${profundidad * 16 + 20}px` }}
    >
      <ShieldAlert size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
      <ChipNivelRiesgo riesgo={riesgo} />
      <div className="min-w-0">
        <p className="text-slate-800 truncate">{riesgo.nombre}</p>
        {riesgo.procedimientoControl && (
          <p className="text-[10px] text-muted-foreground truncate">Control: {riesgo.procedimientoControl}</p>
        )}
      </div>
    </div>
  );
}
