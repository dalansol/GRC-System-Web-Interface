import React, { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowDownZA,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Bold,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FilePlus2,
  Grid2x2,
  Grid3x3,
  History,
  Italic,
  PaintBucket,
  Percent,
  Save,
  Scissors,
  Sigma,
  Search,
  Snowflake,
  Trash2,
  Underline,
  Unlock,
  X,
  ZoomIn,
} from "lucide-react";

import type { FormatoNumero } from "../../domain/hoja/tipos";
import MenuContextual, { type OpcionMenu } from "./MenuContextual";
import type { VistaModeloHoja } from "../../domain/hoja/useHojaCalculo";

// Cinta de opciones al estilo de Office: pestañas Archivo, Inicio, Insertar, Datos y Vista.

export interface AccionesCinta {
  guardar: () => void;
  guardarVersion: () => void;
  descargar: () => void;
  cerrar: () => void;
  verHistorial: () => void;
  copiar: () => void;
  cortar: () => void;
  pegar: () => void;
  autosuma: () => void;
  buscar: () => void;
  eliminarHoja: () => void;
  borrar: (que: "todo" | "contenido" | "formato") => void;
  insertar: (eje: "fila" | "columna") => void;
  eliminar: (eje: "fila" | "columna") => void;
  insertarHoja: () => void;
  ordenar: (ascendente: boolean) => void;
  inmovilizar: (tipo: "panel" | "fila" | "columna" | "ninguno") => void;
}

type Pestana = "Archivo" | "Inicio" | "Insertar" | "Datos" | "Vista";
const PESTANAS: Pestana[] = ["Archivo", "Inicio", "Insertar", "Datos", "Vista"];

export const COLORES_TEMA = [
  ["#FFFFFF", "#000000", "#E7E6E6", "#44546A", "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"],
  ["#F2F2F2", "#808080", "#D0CECE", "#D6DCE4", "#D9E1F2", "#FCE4D6", "#EDEDED", "#FFF2CC", "#DDEBF7", "#E2EFDA"],
];
export const COLORES_ESTANDAR = ["#C00000", "#FF0000", "#FFC000", "#FFFF00", "#92D050", "#00B050", "#00B0F0", "#0070C0", "#002060", "#7030A0"];

const FORMATOS: { valor: FormatoNumero; etiqueta: string }[] = [
  { valor: "general", etiqueta: "General" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "moneda", etiqueta: "Moneda" },
  { valor: "porcentaje", etiqueta: "Porcentaje" },
  { valor: "fecha", etiqueta: "Fecha corta" },
  { valor: "texto", etiqueta: "Texto" },
];

// Los botones no roban el foco a la cuadrícula (como en Excel).
const sinFoco = (e: React.MouseEvent) => e.preventDefault();

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={titulo} className="flex flex-col h-full px-3 border-r border-border last:border-r-0">
      <div className="flex-1 flex items-center gap-1">{children}</div>
      <div className="text-[10px] font-medium text-muted-foreground/80 text-center leading-none pb-1.5 select-none">{titulo}</div>
    </div>
  );
}

function BotonGrande({ icono, etiqueta, onClick, deshabilitado, atajo }: { icono: React.ReactNode; etiqueta: string; onClick: () => void; deshabilitado?: boolean; atajo?: string }) {
  return (
    <button
      type="button"
      onMouseDown={sinFoco}
      onClick={onClick}
      disabled={deshabilitado}
      title={atajo ? `${etiqueta} (${atajo})` : etiqueta}
      className="group flex flex-col items-center justify-center gap-1 px-2 h-[54px] min-w-[52px] rounded-md text-[11px] font-medium leading-tight text-foreground hover:bg-secondary active:scale-[0.98] transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40 disabled:hover:bg-transparent disabled:active:scale-100"
    >
      <span className="text-primary">{icono}</span>
      <span className="whitespace-nowrap">{etiqueta}</span>
    </button>
  );
}

/** Botón grande con menú desplegable (Insertar ▾ / Eliminar ▾). */
function BotonMenu({ icono, etiqueta, opciones, deshabilitado }: { icono: React.ReactNode; etiqueta: string; opciones: OpcionMenu[]; deshabilitado?: boolean }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseDown={(e) => {
          // No roba el foco ni llega al cierre global del menú (si no, un clic lo cerraría y reabriría).
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={() => {
          const r = ref.current!.getBoundingClientRect();
          setMenu((m) => (m ? null : { x: r.left, y: r.bottom + 2 }));
        }}
        disabled={deshabilitado}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        title={etiqueta}
        className="group flex flex-col items-center justify-center gap-1 px-2 h-[54px] min-w-[52px] rounded-md text-[11px] font-medium leading-tight text-foreground hover:bg-secondary active:scale-[0.98] transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span className="text-primary">{icono}</span>
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
          {etiqueta} <ChevronDown size={10} className="text-muted-foreground" />
        </span>
      </button>
      {menu && <MenuContextual x={menu.x} y={menu.y} opciones={opciones} onCerrar={() => setMenu(null)} />}
    </>
  );
}

function BotonChico({
  children,
  onClick,
  titulo,
  activo,
  deshabilitado,
  ancho,
}: {
  children: React.ReactNode;
  onClick: () => void;
  titulo: string;
  activo?: boolean;
  deshabilitado?: boolean;
  ancho?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={sinFoco}
      onClick={onClick}
      disabled={deshabilitado}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      className={`h-7 ${ancho ? "px-2 gap-1" : "w-7"} flex items-center justify-center rounded-md text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40 ${
        activo ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function MenuColor({ titulo, icono, color, onElegir, deshabilitado, sinColor }: { titulo: string; icono: React.ReactNode; color: string; onElegir: (c: string | undefined) => void; deshabilitado?: boolean; sinColor: string }) {
  // La paleta se posiciona fija respecto al botón: la fila de la cinta tiene overflow-x-auto
  // y recortaría un menú con position: absolute.
  const [abierto, setAbierto] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(null);
    const cerrarSiempre = () => setAbierto(null);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(null);
    window.addEventListener("mousedown", cerrar);
    window.addEventListener("resize", cerrarSiempre);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("mousedown", cerrar);
      window.removeEventListener("resize", cerrarSiempre);
      window.removeEventListener("keydown", tecla);
    };
  }, [abierto]);
  const alternarPaleta = () => {
    if (abierto) return setAbierto(null);
    const r = ref.current!.getBoundingClientRect();
    setAbierto({ x: Math.min(r.left, window.innerWidth - 216), y: r.bottom + 4 });
  };
  const muestra = (c: string) => (
    <button
      key={c}
      type="button"
      title={c}
      onMouseDown={sinFoco}
      onClick={() => {
        onElegir(c);
        setAbierto(null);
      }}
      className="w-4 h-4 rounded-[3px] border border-border hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-primary"
      style={{ background: c }}
    />
  );
  return (
    <div className="relative flex" ref={ref}>
      <button
        type="button"
        onMouseDown={sinFoco}
        onClick={() => onElegir(color)}
        disabled={deshabilitado}
        title={titulo}
        aria-label={titulo}
        className="h-7 w-7 flex flex-col items-center justify-center rounded-l-md hover:bg-secondary transition-colors disabled:opacity-40"
      >
        {icono}
        <span className="block w-4 h-[3px] -mt-0.5" style={{ background: color }} />
      </button>
      <button
        type="button"
        onMouseDown={sinFoco}
        onClick={alternarPaleta}
        aria-expanded={!!abierto}
        aria-haspopup="menu"
        disabled={deshabilitado}
        aria-label={`${titulo}: más colores`}
        className="h-7 w-4 flex items-center justify-center rounded-r-md text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-40"
      >
        <ChevronDown size={10} />
      </button>
      {abierto && (
        <div role="menu" style={{ left: abierto.x, top: abierto.y }} className="fixed z-[90] bg-card border border-border rounded-lg shadow-[0_12px_32px_rgba(15,27,45,0.14)] p-2.5 w-[204px]">
          <button
            type="button"
            onMouseDown={sinFoco}
            onClick={() => {
              onElegir(undefined);
              setAbierto(null);
            }}
            className="w-full text-left text-[11px] font-medium px-1.5 py-1 rounded-md hover:bg-secondary mb-1.5"
          >
            {sinColor}
          </button>
          <div className="text-[10px] text-muted-foreground mb-1">Colores del tema</div>
          {COLORES_TEMA.map((fila, i) => (
            <div key={i} className="flex gap-[3px] mb-[3px]">{fila.map(muestra)}</div>
          ))}
          <div className="text-[10px] text-muted-foreground mt-2 mb-1">Colores estándar</div>
          <div className="flex gap-[3px]">{COLORES_ESTANDAR.map(muestra)}</div>
        </div>
      )}
    </div>
  );
}

interface Props {
  vm: VistaModeloHoja;
  acciones: AccionesCinta;
  puedeGuardar: boolean;
}

export default function CintaOpciones({ vm, acciones, puedeGuardar }: Props) {
  const [pestana, setPestana] = useState<Pestana>("Inicio");
  const [contraida, setContraida] = useState(false);
  const [colorRelleno, setColorRelleno] = useState("#FFFF00");
  const [colorTexto, setColorTexto] = useState("#C00000");
  const { estado, estiloActivo, cambiarEstilo, alternar, despachar, hoja } = vm;
  const ro = estado.soloLectura;
  const decimales = estiloActivo.decimales ?? (estiloActivo.formato === "numero" || estiloActivo.formato === "moneda" ? 2 : 0);

  const contenido: Record<Pestana, React.ReactNode> = {
    Archivo: (
      <>
        <Grupo titulo="Guardar">
          <BotonGrande icono={<Save size={20} />} etiqueta="Guardar" onClick={acciones.guardar} deshabilitado={!puedeGuardar} atajo="Ctrl+S" />
          <BotonGrande icono={<FilePlus2 size={20} />} etiqueta="Nueva versión" onClick={acciones.guardarVersion} deshabilitado={!puedeGuardar} />
          <BotonGrande icono={<Download size={20} />} etiqueta="Descargar copia" onClick={acciones.descargar} />
        </Grupo>
        <Grupo titulo="Información">
          <BotonGrande icono={<History size={20} />} etiqueta="Historial" onClick={acciones.verHistorial} />
          <BotonGrande icono={<X size={20} />} etiqueta="Cerrar" onClick={acciones.cerrar} />
        </Grupo>
      </>
    ),
    Inicio: (
      <>
        <Grupo titulo="Portapapeles">
          <BotonGrande icono={<ClipboardPaste size={22} />} etiqueta="Pegar" onClick={acciones.pegar} deshabilitado={ro} atajo="Ctrl+V" />
          <div className="flex flex-col gap-0.5">
            <BotonChico titulo="Cortar (Ctrl+X)" onClick={acciones.cortar} deshabilitado={ro}><Scissors size={14} /></BotonChico>
            <BotonChico titulo="Copiar (Ctrl+C)" onClick={acciones.copiar}><Copy size={14} /></BotonChico>
          </div>
        </Grupo>
        <Grupo titulo="Fuente">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-0.5">
              <BotonChico titulo="Negrita (Ctrl+B)" activo={!!estiloActivo.negrita} onClick={() => alternar("negrita")} deshabilitado={ro}><Bold size={14} /></BotonChico>
              <BotonChico titulo="Cursiva (Ctrl+I)" activo={!!estiloActivo.cursiva} onClick={() => alternar("cursiva")} deshabilitado={ro}><Italic size={14} /></BotonChico>
              <BotonChico titulo="Subrayado (Ctrl+U)" activo={!!estiloActivo.subrayado} onClick={() => alternar("subrayado")} deshabilitado={ro}><Underline size={14} /></BotonChico>
              <BotonChico titulo="Bordes" activo={!!estiloActivo.bordes} onClick={() => alternar("bordes")} deshabilitado={ro}><Grid3x3 size={14} /></BotonChico>
            </div>
            <div className="flex items-center gap-1">
              <MenuColor
                titulo="Color de relleno"
                icono={<PaintBucket size={13} />}
                color={colorRelleno}
                sinColor="Sin relleno"
                deshabilitado={ro}
                onElegir={(c) => {
                  if (c) setColorRelleno(c);
                  cambiarEstilo((e) => ({ ...e, colorFondo: c }));
                }}
              />
              <MenuColor
                titulo="Color de fuente"
                icono={<Baseline size={13} />}
                color={colorTexto}
                sinColor="Automático"
                deshabilitado={ro}
                onElegir={(c) => {
                  if (c) setColorTexto(c);
                  cambiarEstilo((e) => ({ ...e, colorTexto: c }));
                }}
              />
            </div>
          </div>
        </Grupo>
        <Grupo titulo="Alineación">
          <BotonChico titulo="Alinear a la izquierda" activo={estiloActivo.alineacion === "izquierda"} onClick={() => cambiarEstilo((e) => ({ ...e, alineacion: e.alineacion === "izquierda" ? undefined : "izquierda" }))} deshabilitado={ro}><AlignLeft size={14} /></BotonChico>
          <BotonChico titulo="Centrar" activo={estiloActivo.alineacion === "centro"} onClick={() => cambiarEstilo((e) => ({ ...e, alineacion: e.alineacion === "centro" ? undefined : "centro" }))} deshabilitado={ro}><AlignCenter size={14} /></BotonChico>
          <BotonChico titulo="Alinear a la derecha" activo={estiloActivo.alineacion === "derecha"} onClick={() => cambiarEstilo((e) => ({ ...e, alineacion: e.alineacion === "derecha" ? undefined : "derecha" }))} deshabilitado={ro}><AlignRight size={14} /></BotonChico>
        </Grupo>
        <Grupo titulo="Número">
          <div className="flex flex-col gap-1">
            <select
              aria-label="Formato de número"
              value={estiloActivo.formato ?? "general"}
              disabled={ro}
              onChange={(e) => {
                const formato = e.target.value as FormatoNumero;
                cambiarEstilo((est) => ({ ...est, formato: formato === "general" ? undefined : formato, decimales: undefined, formatoOriginal: undefined }));
              }}
              className="h-7 w-[124px] text-[11px] font-medium rounded-md border border-border bg-input-background px-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-40"
            >
              {FORMATOS.map((f) => (
                <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
              ))}
            </select>
            <div className="flex items-center gap-0.5">
              <BotonChico titulo="Formato de moneda" onClick={() => cambiarEstilo((e) => ({ ...e, formato: "moneda", decimales: 2 }))} deshabilitado={ro}><span className="font-semibold">$</span></BotonChico>
              <BotonChico titulo="Estilo porcentual" onClick={() => cambiarEstilo((e) => ({ ...e, formato: "porcentaje", decimales: 0 }))} deshabilitado={ro}><Percent size={13} /></BotonChico>
              <BotonChico titulo="Estilo millares" onClick={() => cambiarEstilo((e) => ({ ...e, formato: "numero", decimales: 2 }))} deshabilitado={ro} ancho><span className="font-semibold text-[10px]">000</span></BotonChico>
              <BotonChico titulo="Aumentar decimales" onClick={() => cambiarEstilo((e) => ({ ...e, decimales: Math.min(10, decimales + 1) }))} deshabilitado={ro} ancho><span className="text-[9px] leading-none">←.0<br />.00</span></BotonChico>
              <BotonChico titulo="Disminuir decimales" onClick={() => cambiarEstilo((e) => ({ ...e, decimales: Math.max(0, decimales - 1) }))} deshabilitado={ro} ancho><span className="text-[9px] leading-none">.00<br />→.0</span></BotonChico>
            </div>
          </div>
        </Grupo>
        <Grupo titulo="Celdas">
          <BotonMenu
            icono={<BetweenHorizontalStart size={20} />}
            etiqueta="Insertar"
            deshabilitado={ro}
            opciones={[
              { etiqueta: "Insertar filas", icono: <BetweenHorizontalStart size={13} />, accion: () => acciones.insertar("fila") },
              { etiqueta: "Insertar columnas", icono: <BetweenVerticalStart size={13} />, accion: () => acciones.insertar("columna") },
              null,
              { etiqueta: "Insertar hoja", icono: <FilePlus2 size={13} />, accion: acciones.insertarHoja },
            ]}
          />
          <BotonMenu
            icono={<Trash2 size={20} />}
            etiqueta="Eliminar"
            deshabilitado={ro}
            opciones={[
              { etiqueta: "Eliminar filas", icono: <Trash2 size={13} />, accion: () => acciones.eliminar("fila"), peligro: true },
              { etiqueta: "Eliminar columnas", icono: <Trash2 size={13} />, accion: () => acciones.eliminar("columna"), peligro: true },
              null,
              { etiqueta: "Eliminar hoja", icono: <Trash2 size={13} />, accion: acciones.eliminarHoja, peligro: true, deshabilitada: vm.estado.libro.hojas.length <= 1 },
            ]}
          />
        </Grupo>
        <Grupo titulo="Edición">
          <BotonGrande icono={<Sigma size={20} />} etiqueta="Autosuma" onClick={acciones.autosuma} deshabilitado={ro} atajo="Alt+=" />
          <BotonGrande icono={<Search size={20} />} etiqueta="Buscar" onClick={acciones.buscar} atajo="Ctrl+F" />
          <div className="flex flex-col gap-0.5">
            <BotonChico titulo="Borrar todo" onClick={() => acciones.borrar("todo")} deshabilitado={ro} ancho><Eraser size={13} /> Borrar</BotonChico>
            <BotonChico titulo="Borrar formatos" onClick={() => acciones.borrar("formato")} deshabilitado={ro} ancho><Eraser size={13} /> Formatos</BotonChico>
          </div>
          <div className="flex flex-col gap-0.5">
            <BotonChico titulo="Ordenar de A a Z" onClick={() => acciones.ordenar(true)} deshabilitado={ro}><ArrowDownAZ size={14} /></BotonChico>
            <BotonChico titulo="Ordenar de Z a A" onClick={() => acciones.ordenar(false)} deshabilitado={ro}><ArrowDownZA size={14} /></BotonChico>
          </div>
        </Grupo>
      </>
    ),
    Insertar: (
      <>
        <Grupo titulo="Celdas">
          <BotonGrande icono={<BetweenHorizontalStart size={20} />} etiqueta="Filas" onClick={() => acciones.insertar("fila")} deshabilitado={ro} />
          <BotonGrande icono={<BetweenVerticalStart size={20} />} etiqueta="Columnas" onClick={() => acciones.insertar("columna")} deshabilitado={ro} />
        </Grupo>
        <Grupo titulo="Libro">
          <BotonGrande icono={<FilePlus2 size={20} />} etiqueta="Hoja" onClick={acciones.insertarHoja} deshabilitado={ro} atajo="Mayús+F11" />
        </Grupo>
        <Grupo titulo="Funciones">
          <BotonGrande icono={<Sigma size={20} />} etiqueta="Autosuma" onClick={acciones.autosuma} deshabilitado={ro} />
        </Grupo>
      </>
    ),
    Datos: (
      <>
        <Grupo titulo="Ordenar">
          <BotonGrande icono={<ArrowDownAZ size={20} />} etiqueta="A → Z" onClick={() => acciones.ordenar(true)} deshabilitado={ro} />
          <BotonGrande icono={<ArrowDownZA size={20} />} etiqueta="Z → A" onClick={() => acciones.ordenar(false)} deshabilitado={ro} />
        </Grupo>
        <Grupo titulo="Filas y columnas">
          <BotonGrande icono={<Trash2 size={20} />} etiqueta="Eliminar filas" onClick={() => acciones.eliminar("fila")} deshabilitado={ro} />
          <BotonGrande icono={<Trash2 size={20} />} etiqueta="Eliminar columnas" onClick={() => acciones.eliminar("columna")} deshabilitado={ro} />
        </Grupo>
      </>
    ),
    Vista: (
      <>
        <Grupo titulo="Ventana">
          <BotonGrande icono={<Snowflake size={20} />} etiqueta="Inmovilizar paneles" onClick={() => acciones.inmovilizar("panel")} deshabilitado={ro} />
          <div className="flex flex-col gap-0.5">
            <BotonChico titulo="Inmovilizar fila superior" onClick={() => acciones.inmovilizar("fila")} deshabilitado={ro} ancho>Fila superior</BotonChico>
            <BotonChico titulo="Inmovilizar primera columna" onClick={() => acciones.inmovilizar("columna")} deshabilitado={ro} ancho>Primera columna</BotonChico>
          </div>
          <BotonGrande
            icono={<Unlock size={20} />}
            etiqueta="Movilizar"
            onClick={() => acciones.inmovilizar("ninguno")}
            deshabilitado={ro || (!hoja.inmovilizar.filas && !hoja.inmovilizar.columnas)}
          />
        </Grupo>
        <Grupo titulo="Mostrar">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-foreground px-1.5 py-1 rounded-md hover:bg-secondary cursor-pointer select-none" onMouseDown={sinFoco}>
            <input type="checkbox" checked={estado.cuadricula} onChange={(e) => despachar({ tipo: "cuadricula", visible: e.target.checked })} className="accent-[var(--primary)]" />
            <Grid2x2 size={13} /> Líneas de cuadrícula
          </label>
        </Grupo>
        <Grupo titulo="Zoom">
          <BotonGrande icono={<ZoomIn size={20} />} etiqueta="100%" onClick={() => despachar({ tipo: "zoom", valor: 1 })} />
        </Grupo>
      </>
    ),
  };

  return (
    <div className="flex-shrink-0 bg-card border-b border-border">
      <div role="tablist" aria-label="Cinta de opciones" className="flex items-end h-9 px-3 gap-1 border-b border-border">
        {PESTANAS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pestana === p && !contraida}
            type="button"
            onMouseDown={sinFoco}
            onClick={() => {
              setPestana(p);
              if (contraida) setContraida(false);
            }}
            onDoubleClick={() => setContraida((c) => !c)}
            className={`relative px-3 h-8 text-[12.5px] rounded-t-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              pestana === p && !contraida ? "text-primary font-semibold" : "text-muted-foreground font-medium hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {p}
            {pestana === p && !contraida && <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-primary" />}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground pb-2 select-none">
          {contraida ? "Doble clic en una pestaña para mostrar la cinta" : ""}
        </span>
      </div>
      {!contraida && (
        <div className="flex items-stretch h-[78px] px-1 py-0.5 overflow-x-auto">
          {contenido[pestana]}
        </div>
      )}
    </div>
  );
}
