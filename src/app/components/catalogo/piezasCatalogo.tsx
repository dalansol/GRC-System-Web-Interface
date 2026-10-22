import { useId, useState, type InputHTMLAttributes } from "react";
import { Edit2, Lock, Trash2 } from "lucide-react";
import type { NivelNodo, Riesgo } from "../../api/estructura";
import type { AltaNodoContexto, NodoSeleccionado } from "../../domain/estructura/useEstructuraViewModel";
import { nombreVisible, tieneNombre, type ConNombre } from "../../domain/estructura/nombres";
import { COLOR_NIVEL_RIESGO, distribucionRiesgos, nivelMaximo } from "../../domain/estructura/riesgos";
import { filtrarSugerencias } from "../../domain/estructura/sugerencias";

// Piezas compartidas por el árbol de navegación (ArbolCatalogo) y el panel de detalle
// (DetalleCatalogo), para que ambos se vean igual.

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
  const descripcion = `${riesgos.length === 1 ? "riesgo" : "riesgos"} · peor nivel: ${peor ?? "sin nivel"}`;
  return (
    <span
      data-testid={testId}
      title={`${riesgos.length} ${descripcion}`}
      className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded tabular-nums whitespace-nowrap flex-shrink-0 ${color.insignia}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.punto}`} aria-hidden />
      {riesgos.length}
      {/* El color indica el peor nivel; el texto lo repite para lectores de pantalla. */}
      <span className="sr-only"> {descripcion}</span>
    </span>
  );
}

/** Chip con el nivel de un riesgo. */
export function ChipNivelRiesgo({ riesgo }: { riesgo: Riesgo }) {
  const color = COLOR_NIVEL_RIESGO[riesgo.nivel ?? "sin"];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex-shrink-0 ${color.insignia}`}>
      {riesgo.nivel ?? "Sin nivel"}
    </span>
  );
}

/** El nombre (o el código si no hay) y, si hay nombre, el código aparte en pequeño. */
export function NombreConCodigo({ nodo }: { nodo: ConNombre }) {
  return (
    <>
      {nombreVisible(nodo)}
      {tieneNombre(nodo) && (
        <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground" title="Código (identificador)">
          {nodo.codigo}
        </span>
      )}
    </>
  );
}

/**
 * Código de solo lectura en los formularios: el que ya tiene (edición) o el próximo que
 * asignará el sistema (alta). El usuario nunca lo escribe.
 */
export function CampoCodigo({ codigo, proximo = false }: { codigo: string; proximo?: boolean }) {
  return (
    <div>
      <span className="text-xs font-semibold text-foreground uppercase tracking-wide block mb-1.5">Código</span>
      <div
        data-testid="campo-codigo"
        className="flex items-center justify-between gap-2 text-sm px-3.5 py-2.5 rounded-lg border border-border bg-slate-50 text-muted-foreground"
      >
        <span className="font-mono text-foreground truncate">{codigo}</span>
        {proximo ? (
          // En el alta solo el candado: el código lo asigna el sistema al guardar.
          <span role="img" aria-label="Se asigna al guardar" title="Se asigna al guardar" className="flex-shrink-0">
            <Lock size={13} aria-hidden />
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] whitespace-nowrap">
            <Lock size={12} aria-hidden />
            No se puede cambiar
          </span>
        )}
      </div>
    </div>
  );
}

type PropsCampoSugerido = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list"> & {
  value: string;
  onChange: (valor: string) => void;
  opciones: readonly string[];
};

/**
 * Campo de texto con sugerencias (combobox). Al enfocarlo muestra todas; al escribir filtra
 * sin distinguir mayúsculas ni acentos. Acepta cualquier otro valor. Flechas para recorrer,
 * Enter para elegir, Escape para cerrar. Sustituye a `<datalist>`, que no muestra la lista
 * completa con el campo vacío en todos los navegadores.
 */
export function CampoSugerido({ value, onChange, opciones, className, onBlur, onFocus, onKeyDown, ...props }: PropsCampoSugerido) {
  const idLista = useId();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const visibles = filtrarSugerencias(opciones, value);
  const mostrar = abierto && visibles.length > 0 && !props.disabled;

  const elegir = (opcion: string) => {
    onChange(opcion);
    setAbierto(false);
    setActivo(-1);
  };

  return (
    <div className="relative">
      <input
        {...props}
        type="text"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && activo >= 0 ? `${idLista}-${activo}` : undefined}
        autoComplete="off"
        value={value}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setAbierto(true);
          setActivo(-1);
        }}
        onFocus={(e) => {
          setAbierto(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setAbierto(false);
          setActivo(-1);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAbierto(true);
            const paso = e.key === "ArrowDown" ? 1 : -1;
            setActivo((i) => (visibles.length ? (i + paso + visibles.length) % visibles.length : -1));
          } else if (e.key === "Enter" && mostrar && activo >= 0) {
            e.preventDefault(); // elige la sugerencia en lugar de enviar el formulario
            elegir(visibles[activo]!);
          } else if (e.key === "Escape" && mostrar) {
            e.stopPropagation();
            setAbierto(false);
          }
          onKeyDown?.(e);
        }}
      />
      {mostrar && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-lg"
        >
          {visibles.map((opcion, i) => (
            <li
              key={opcion}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === activo}
              // mousedown para que el campo no pierda el foco antes de elegir.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(opcion);
              }}
              onMouseEnter={() => setActivo(i)}
              className={`cursor-pointer px-3.5 py-1.5 text-sm ${i === activo ? "bg-primary/10 text-primary" : "text-foreground hover:bg-slate-50"}`}
            >
              {opcion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Barra con la proporción de riesgos por nivel (del peor al mejor). Con `leyenda` muestra
 * debajo el conteo de cada nivel; sin riesgos pinta una barra gris.
 */
export function BarraRiesgos({ riesgos, leyenda = false, testId }: { riesgos: Riesgo[]; leyenda?: boolean; testId?: string }) {
  const distribucion = distribucionRiesgos(riesgos);
  const resumen = distribucion.map((d) => `${d.cantidad} ${d.nivel === "sin" ? "sin nivel" : d.nivel}`).join(" · ");
  return (
    <div data-testid={testId} className="min-w-0">
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 gap-px"
        role="img"
        aria-label={riesgos.length ? `Riesgos por nivel: ${resumen}` : "Sin riesgos registrados"}
        title={riesgos.length ? resumen : "Sin riesgos registrados"}
      >
        {distribucion.map((d) => (
          <span
            key={d.nivel}
            className={COLOR_NIVEL_RIESGO[d.nivel].punto}
            style={{ width: `${(d.cantidad / riesgos.length) * 100}%` }}
          />
        ))}
      </div>
      {leyenda && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
          {distribucion.length === 0 && <span>Sin riesgos registrados</span>}
          {distribucion.map((d) => (
            <span key={d.nivel} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${COLOR_NIVEL_RIESGO[d.nivel].punto}`} aria-hidden />
              <span className="font-semibold text-foreground tabular-nums">{d.cantidad}</span>
              {d.nivel === "sin" ? "Sin nivel" : d.nivel}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Botones de editar y eliminar de un nodo (solo para quien puede gestionar). */
export function BotonesGestion({
  etiqueta,
  onEditar,
  onEliminar,
  testId,
  tamano = 13,
}: {
  etiqueta: string;
  onEditar: () => void;
  onEliminar: () => void;
  testId: string;
  tamano?: number;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      <button
        type="button"
        onClick={onEditar}
        title={`Editar ${etiqueta}`}
        aria-label={`Editar ${etiqueta}`}
        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      >
        <Edit2 size={tamano} />
      </button>
      <button
        type="button"
        onClick={onEliminar}
        title={`Eliminar ${etiqueta}`}
        aria-label={`Eliminar ${etiqueta}`}
        data-testid={`btn-eliminar-${testId}`}
        className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
      >
        <Trash2 size={tamano} />
      </button>
    </div>
  );
}
