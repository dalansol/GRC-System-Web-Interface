import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { esFormula } from "../../domain/hoja/calculo";
import { MAX_COLUMNAS, MAX_FILAS, puedeSenalar, rangoSeleccion } from "../../domain/hoja/estadoHoja";
import { alineacionEfectiva, formatearValor } from "../../domain/hoja/formato";
import { cambiarTamano, rellenar, ultimaCeldaUsada } from "../../domain/hoja/operaciones";
import { letraColumna } from "../../domain/hoja/referencias";
import { referenciasDe } from "../../domain/hoja/reescritura";
import { ANCHO_COLUMNA, ALTO_FILA, claveCelda, ErrorHoja, type Posicion, type Rango } from "../../domain/hoja/tipos";
import type { VistaModeloHoja } from "../../domain/hoja/useHojaCalculo";
import {
  contenidoEn,
  estiloFuente,
  fuenteCelda,
  indiceEn,
  medirTexto,
  pantallaDe,
  posicionesColumnas,
  posicionesFilas,
  tramos,
  type Tramo,
} from "./geometria";

// Cuadrícula tipo Excel virtualizada: solo se pintan las celdas visibles. Toda la
// geometría sale del estado de desplazamiento, así los paneles inmovilizados, los
// encabezados y las celdas se mueven juntos.

/** Colores con los que Excel resalta las referencias de la fórmula que se edita. */
export const COLORES_REFERENCIA = ["#4472C4", "#C00000", "#7030A0", "#00A651", "#ED7D31", "#0070C0"];

const ESTILOS = `
@keyframes hoja-hormigas { to { background-position: 8px 0, -8px 100%, 0 -8px, 100% 8px; } }
.hoja-hormigas {
  background-image:
    linear-gradient(90deg, var(--c) 50%, transparent 50%),
    linear-gradient(90deg, var(--c) 50%, transparent 50%),
    linear-gradient(0deg, var(--c) 50%, transparent 50%),
    linear-gradient(0deg, var(--c) 50%, transparent 50%);
  background-size: 8px 2px, 8px 2px, 2px 8px, 2px 8px;
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-position: 0 0, 0 100%, 0 0, 100% 0;
  animation: hoja-hormigas 0.5s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .hoja-hormigas { animation: none; } }
.hoja-enc:hover { filter: brightness(0.95); }
.hoja-enc-completo:hover { filter: brightness(1.08); }
`;

type Arrastre =
  | { tipo: "celdas" }
  | { tipo: "senalar" }
  | { tipo: "columnas"; ancla: number }
  | { tipo: "filas"; ancla: number }
  | { tipo: "relleno"; origen: Rango }
  | { tipo: "tamano"; eje: "fila" | "columna"; indice: number; inicio: number; tam: number };

export interface VistaCuadricula {
  filasVisibles: number;
  /** Filas/columnas que muestra la vista; acota operaciones sobre filas o columnas completas. */
  filas: number;
  columnas: number;
}

interface Props {
  vm: VistaModeloHoja;
  entradaRef: React.RefObject<HTMLTextAreaElement>;
  onTecla: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCopiar: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onCortar: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onPegar: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onMenu: (x: number, y: number) => void;
  vistaRef: React.MutableRefObject<VistaCuadricula>;
  /** Celdas de la hoja activa que coinciden con la búsqueda; `activa` es la coincidencia actual. */
  resaltados?: { lista: Posicion[]; activa: Posicion | null };
  /** Posición en pantalla del editor en celda (para colocar la ayuda de fórmulas debajo). */
  onPosicionEditor?: (pos: { x: number; y: number } | null) => void;
  onCursor?: (cursor: number) => void;
}

const EXPLICACION_ERROR: Record<string, string> = {
  "#¡DIV/0!": "División entre cero o entre una celda vacía.",
  "#¡REF!": "Una referencia no es válida (celda eliminada o referencia circular).",
  "#¿NOMBRE?": "Hay un nombre que no se reconoce o la fórmula está mal escrita.",
  "#¡VALOR!": "Un argumento tiene un tipo incorrecto (por ejemplo texto donde va un número).",
  "#¡NUM!": "El resultado es demasiado grande o no es un número válido.",
  "#N/D": "El valor no está disponible.",
};

/** true si cambió la parte "visible" del extremo (no la que está en el límite de la hoja). */
function extremoCambioParcial(previo: { extremo: Posicion }, sel: { extremo: Posicion }): boolean {
  const fVisible = (p: Posicion) => (p.f >= MAX_FILAS - 1 ? -1 : p.f);
  const cVisible = (p: Posicion) => (p.c >= MAX_COLUMNAS - 1 ? -1 : p.c);
  return fVisible(previo.extremo) !== fVisible(sel.extremo) || cVisible(previo.extremo) !== cVisible(sel.extremo);
}

function recortar(r: Rango, filas: number, columnas: number): Rango {
  return { f1: r.f1, c1: r.c1, f2: Math.min(r.f2, filas - 1), c2: Math.min(r.c2, columnas - 1) };
}

export default function CuadriculaHoja({ vm, entradaRef, onTecla, onCopiar, onCortar, onPegar, onMenu, vistaRef, resaltados, onPosicionEditor, onCursor }: Props) {
  const { estado, despachar, calc, hoja } = vm;
  const { zoom, sel, edicion, copia, hojaActiva } = estado;
  const rango = rangoSeleccion(sel);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [tam, setTam] = useState({ w: 1000, h: 600 });
  const [crecer, setCrecer] = useState({ filas: 0, columnas: 0 });
  const [relleno, setRellenoEstado] = useState<Rango | null>(null);
  const rellenoRef = useRef<Rango | null>(null);
  const setRelleno = (r: Rango | null) => {
    rellenoRef.current = r;
    setRellenoEstado(r);
  };
  const [guia, setGuia] = useState<{ eje: "fila" | "columna"; px: number; medida: number } | null>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const ultimoClicRelleno = useRef(0);

  // ─── Tamaño de la vista ────────────────────────────────────────────────────
  const usada = useMemo(() => ultimaCeldaUsada(hoja), [hoja]);
  const punto = edicion?.punto;
  // Una fila o columna completa pone su extremo en el límite de Excel; la vista no debe
  // perseguirlo ni crecer hasta allá: se queda donde está el usuario.
  const columnaCompletaSel = sel.extremo.f >= MAX_FILAS - 1 || sel.ancla.f >= MAX_FILAS - 1;
  const filaCompletaSel = sel.extremo.c >= MAX_COLUMNAS - 1 || sel.ancla.c >= MAX_COLUMNAS - 1;
  const extremoF = columnaCompletaSel ? sel.activa.f : sel.extremo.f;
  const extremoC = filaCompletaSel ? sel.activa.c : sel.extremo.c;
  const nFilas = Math.min(
    MAX_FILAS,
    Math.max(hoja.filas, usada.f + 30, Math.max(extremoF, sel.activa.f, punto?.extremo.f ?? 0) + 20, crecer.filas),
  );
  const nCols = Math.min(
    MAX_COLUMNAS,
    Math.max(hoja.columnas, usada.c + 5, Math.max(extremoC, sel.activa.c, punto?.extremo.c ?? 0) + 5, crecer.columnas),
  );
  const xs = useMemo(() => posicionesColumnas(hoja, nCols, zoom), [hoja, nCols, zoom]);
  const ys = useMemo(() => posicionesFilas(hoja, nFilas, zoom), [hoja, nFilas, zoom]);
  const encW = Math.round(Math.max(34, String(nFilas).length * 8 + 12) * zoom);
  const encH = Math.round(20 * zoom);
  const fc = Math.min(hoja.inmovilizar.columnas, nCols);
  const fr = Math.min(hoja.inmovilizar.filas, nFilas);

  const tx = tramos(xs, fc, scroll.x, encW, tam.w);
  const ty = tramos(ys, fr, scroll.y, encH, tam.h);

  vistaRef.current = {
    filasVisibles: Math.max(1, Math.floor((tam.h - encH - ys[fr]) / (ALTO_FILA * zoom)) - 1),
    filas: nFilas,
    columnas: nCols,
  };

  // Geometría vigente para los manejadores de ventana (arrastres).
  const geo = useRef({ xs, ys, fc, fr, scroll, encW, encH });
  geo.current = { xs, ys, fc, fr, scroll, encW, encH };

  // ─── Medidas y desplazamiento ──────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const medir = () => setTam({ w: el.clientWidth || 1000, h: el.clientHeight || 600 });
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const alDesplazar = () => {
    const el = scrollerRef.current!;
    setScroll({ x: el.scrollLeft, y: el.scrollTop });
    // Hoja "infinita": al acercarse al final se agregan filas y columnas.
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) setCrecer((c) => ({ ...c, filas: nFilas + 100 }));
    if (el.scrollLeft + el.clientWidth > el.scrollWidth - 200) setCrecer((c) => ({ ...c, columnas: nCols + 10 }));
  };

  // La rueda sobre la capa visible desplaza el contenedor real; Ctrl+rueda hace zoom.
  useEffect(() => {
    const capa = capaRef.current;
    if (!capa) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        despachar({ tipo: "zoom", valor: estado.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1) });
        return;
      }
      const factor = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? tam.h : 1;
      const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * factor;
      const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * factor;
      scrollerRef.current?.scrollBy({ left: dx, top: dy });
    };
    capa.addEventListener("wheel", rueda, { passive: false });
    return () => capa.removeEventListener("wheel", rueda);
  }, [despachar, estado.zoom, tam.h]);

  // Mantiene visible la celda que se mueve (activa, extremo del rango o la señalada).
  const anterior = useRef(sel);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const previo = anterior.current;
    anterior.current = sel;
    const extremoCambio = sel.extremo.f !== previo.extremo.f || sel.extremo.c !== previo.extremo.c;
    const extremoVisible = { f: columnaCompletaSel ? sel.activa.f : sel.extremo.f, c: filaCompletaSel ? sel.activa.c : sel.extremo.c };
    const activaCambio = sel.activa.f !== previo.activa.f || sel.activa.c !== previo.activa.c;
    // Seleccionar una fila o columna completa no desplaza la vista.
    if (!punto && !activaCambio && (columnaCompletaSel || filaCompletaSel) && !extremoCambioParcial(previo, sel)) return;
    const objetivo = punto && edicion?.hoja !== undefined ? punto.extremo : extremoCambio ? extremoVisible : sel.activa;
    const vistaW = tam.w - encW - xs[fc];
    const vistaH = tam.h - encH - ys[fr];
    if (objetivo.c >= fc && objetivo.c < nCols) {
      const izq = xs[objetivo.c] - xs[fc];
      const der = xs[objetivo.c + 1] - xs[fc];
      if (izq < el.scrollLeft) el.scrollLeft = izq;
      else if (der > el.scrollLeft + vistaW) el.scrollLeft = der - vistaW;
    }
    if (objetivo.f >= fr && objetivo.f < nFilas) {
      const arr = ys[objetivo.f] - ys[fr];
      const aba = ys[objetivo.f + 1] - ys[fr];
      if (arr < el.scrollTop) el.scrollTop = arr;
      else if (aba > el.scrollTop + vistaH) el.scrollTop = aba - vistaH;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, punto?.extremo]);

  // ─── Coordenadas ───────────────────────────────────────────────────────────
  const celdaEn = (clientX: number, clientY: number) => {
    const g = geo.current;
    const r = capaRef.current!.getBoundingClientRect();
    const x = contenidoEn(clientX - r.left - g.encW, g.xs, g.fc, g.scroll.x);
    const y = contenidoEn(clientY - r.top - g.encH, g.ys, g.fr, g.scroll.y);
    return { f: indiceEn(g.ys, y), c: indiceEn(g.xs, x) };
  };

  const enfocar = () => entradaRef.current?.focus({ preventScroll: true });

  // ─── Arrastres (ratón en ventana) ──────────────────────────────────────────
  const empezarArrastre = (a: Arrastre) => {
    arrastre.current = a;
    const mover = (e: MouseEvent) => {
      const actual = arrastre.current;
      if (!actual) return;
      // Desplazamiento automático al salir del área arrastrando.
      const capa = capaRef.current!.getBoundingClientRect();
      const sc = scrollerRef.current!;
      if (actual.tipo !== "tamano") {
        if (e.clientX > capa.right) sc.scrollLeft += e.clientX - capa.right;
        if (e.clientY > capa.bottom) sc.scrollTop += e.clientY - capa.bottom;
        if (e.clientX < capa.left + geo.current.encW && geo.current.scroll.x > 0) sc.scrollLeft -= 20;
        if (e.clientY < capa.top + geo.current.encH && geo.current.scroll.y > 0) sc.scrollTop -= 20;
      }
      const pos = celdaEn(e.clientX, e.clientY);
      switch (actual.tipo) {
        case "celdas":
          despachar({ tipo: "seleccionar", pos, extender: true });
          break;
        case "senalar":
          despachar({ tipo: "senalar", pos, extender: true });
          break;
        case "columnas":
          despachar({ tipo: "seleccionarRango", activa: { f: 0, c: actual.ancla }, extremo: { f: MAX_FILAS - 1, c: pos.c } });
          break;
        case "filas":
          despachar({ tipo: "seleccionarRango", activa: { f: actual.ancla, c: 0 }, extremo: { f: pos.f, c: MAX_COLUMNAS - 1 } });
          break;
        case "relleno": {
          const o = actual.origen;
          const df = pos.f > o.f2 ? pos.f - o.f2 : pos.f < o.f1 ? pos.f - o.f1 : 0;
          const dc = pos.c > o.c2 ? pos.c - o.c2 : pos.c < o.c1 ? pos.c - o.c1 : 0;
          if (!df && !dc) setRelleno(o);
          else if (Math.abs(df) >= Math.abs(dc)) setRelleno({ ...o, f1: Math.min(o.f1, pos.f), f2: Math.max(o.f2, pos.f) });
          else setRelleno({ ...o, c1: Math.min(o.c1, pos.c), c2: Math.max(o.c2, pos.c) });
          break;
        }
        case "tamano": {
          const delta = (actual.eje === "columna" ? e.clientX : e.clientY) - actual.inicio;
          const g = geo.current;
          const base = actual.eje === "columna" ? g.encW + pantallaDe(actual.indice, g.xs, g.fc, g.scroll.x, 0) : g.encH + pantallaDe(actual.indice, g.ys, g.fr, g.scroll.y, 0);
          setGuia({ eje: actual.eje, px: base + Math.max(4, actual.tam + delta), medida: Math.round(Math.max(4, actual.tam + delta) / zoom) });
          break;
        }
      }
    };
    const soltar = (e: MouseEvent) => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      const actual = arrastre.current;
      arrastre.current = null;
      if (actual?.tipo === "relleno") {
        const destino = rellenoRef.current;
        const o = actual.origen;
        if (destino && (destino.f1 !== o.f1 || destino.f2 !== o.f2 || destino.c1 !== o.c1 || destino.c2 !== o.c2)) {
          vm.aplicar((libro, idx) => rellenar(libro, idx, o, destino), {
            activa: { f: destino.f1, c: destino.c1 },
            ancla: { f: destino.f1, c: destino.c1 },
            extremo: { f: destino.f2, c: destino.c2 },
          });
        }
        setRelleno(null);
      }
      if (actual?.tipo === "tamano") {
        const delta = (actual.eje === "columna" ? e.clientX : e.clientY) - actual.inicio;
        const px = Math.max(4, actual.tam + delta) / zoom;
        const r = rangoSeleccion(estado.sel);
        // Si la columna/fila es parte de una selección completa, se ajustan todas.
        const completas =
          actual.eje === "columna"
            ? r.f1 === 0 && r.f2 >= MAX_FILAS - 1 && actual.indice >= r.c1 && actual.indice <= r.c2
            : r.c1 === 0 && r.c2 >= MAX_COLUMNAS - 1 && actual.indice >= r.f1 && actual.indice <= r.f2;
        const indices = completas
          ? Array.from({ length: (actual.eje === "columna" ? r.c2 - r.c1 : r.f2 - r.f1) + 1 }, (_, i) => (actual.eje === "columna" ? r.c1 : r.f1) + i)
          : [actual.indice];
        if (delta !== 0) vm.aplicar((libro, idx) => cambiarTamano(libro, idx, actual.eje, indices, px));
        setGuia(null);
      }
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  };

  // ─── Ratón sobre celdas ────────────────────────────────────────────────────
  const alPresionarCelda = (e: React.MouseEvent) => {
    if (e.button === 1) return;
    e.preventDefault();
    const pos = celdaEn(e.clientX, e.clientY);
    if (e.button === 2) {
      if (!(pos.f >= rango.f1 && pos.f <= rango.f2 && pos.c >= rango.c1 && pos.c <= rango.c2)) {
        if (edicion) despachar({ tipo: "confirmarEdicion", df: 0, dc: 0 });
        despachar({ tipo: "seleccionar", pos });
      }
      enfocar();
      return;
    }
    if (edicion && puedeSenalar(edicion, true)) {
      despachar({ tipo: "senalar", pos, extender: e.shiftKey });
      empezarArrastre({ tipo: "senalar" });
      return;
    }
    if (edicion) despachar({ tipo: "confirmarEdicion", df: 0, dc: 0 });
    despachar({ tipo: "seleccionar", pos, extender: e.shiftKey });
    enfocar();
    empezarArrastre({ tipo: "celdas" });
  };

  const alDobleClic = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset?.relleno !== undefined) return;
    const pos = celdaEn(e.clientX, e.clientY);
    if (pos.f !== sel.activa.f || pos.c !== sel.activa.c || estado.soloLectura) return;
    despachar({ tipo: "iniciarEdicion", modo: "editar" });
    requestAnimationFrame(() => {
      const t = entradaRef.current;
      if (t) t.selectionStart = t.selectionEnd = t.value.length;
    });
  };

  // ─── Encabezados ───────────────────────────────────────────────────────────
  const filaCompleta = rango.c1 === 0 && rango.c2 >= MAX_COLUMNAS - 1;
  const columnaCompleta = rango.f1 === 0 && rango.f2 >= MAX_FILAS - 1;

  const presionarColumna = (e: React.MouseEvent, c: number) => {
    if (e.button !== 0) {
      if (!(columnaCompleta && c >= rango.c1 && c <= rango.c2)) {
        despachar({ tipo: "seleccionarRango", activa: { f: 0, c }, extremo: { f: MAX_FILAS - 1, c } });
      }
      return;
    }
    e.preventDefault();
    if (edicion) despachar({ tipo: "confirmarEdicion", df: 0, dc: 0 });
    const ancla = e.shiftKey ? sel.ancla.c : c;
    despachar({ tipo: "seleccionarRango", activa: { f: 0, c: ancla }, extremo: { f: MAX_FILAS - 1, c } });
    enfocar();
    empezarArrastre({ tipo: "columnas", ancla });
  };

  const presionarFila = (e: React.MouseEvent, f: number) => {
    if (e.button !== 0) {
      if (!(filaCompleta && f >= rango.f1 && f <= rango.f2)) {
        despachar({ tipo: "seleccionarRango", activa: { f, c: 0 }, extremo: { f, c: MAX_COLUMNAS - 1 } });
      }
      return;
    }
    e.preventDefault();
    if (edicion) despachar({ tipo: "confirmarEdicion", df: 0, dc: 0 });
    const ancla = e.shiftKey ? sel.ancla.f : f;
    despachar({ tipo: "seleccionarRango", activa: { f: ancla, c: 0 }, extremo: { f, c: MAX_COLUMNAS - 1 } });
    enfocar();
    empezarArrastre({ tipo: "filas", ancla });
  };

  const presionarBorde = (e: React.MouseEvent, eje: "fila" | "columna", indice: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (estado.soloLectura) return;
    const tamActual = eje === "columna" ? xs[indice + 1] - xs[indice] : ys[indice + 1] - ys[indice];
    empezarArrastre({ tipo: "tamano", eje, indice, inicio: eje === "columna" ? e.clientX : e.clientY, tam: tamActual });
  };

  /** Doble clic en el controlador: rellena hacia abajo hasta donde la columna vecina tiene datos. */
  const rellenarHastaVecinos = () => {
    if (estado.soloLectura) return;
    const r = rangoSeleccion(estado.sel);
    const tiene = (f: number, c: number) => !!hoja.celdas[claveCelda(f, c)]?.entrada;
    const vecinas = [r.c1 - 1, r.c2 + 1].filter((c) => c >= 0 && tiene(r.f2 + 1, c));
    if (!vecinas.length) return;
    let fin = r.f2;
    while (fin + 1 < MAX_FILAS && vecinas.some((c) => tiene(fin + 1, c))) fin++;
    if (fin === r.f2) return;
    const destino = { ...r, f2: fin };
    vm.aplicar((libro, idx) => rellenar(libro, idx, r, destino), {
      activa: { f: r.f1, c: r.c1 },
      ancla: { f: r.f1, c: r.c1 },
      extremo: { f: fin, c: r.c2 },
    });
    setRelleno(null);
  };

  /** Doble clic en el borde: autoajusta al contenido más ancho, como Excel. */
  const autoajustar = (e: React.MouseEvent, eje: "fila" | "columna", indice: number) => {
    e.stopPropagation();
    if (estado.soloLectura) return;
    if (eje === "fila") {
      vm.aplicar((libro, idx) => cambiarTamano(libro, idx, "fila", [indice], ALTO_FILA));
      return;
    }
    let ancho = 0;
    for (const [k, celda] of Object.entries(hoja.celdas)) {
      const [f, c] = k.split(",").map(Number);
      if (c !== indice || !celda.entrada) continue;
      const texto = formatearValor(calc.valor(hojaActiva, f, c), celda.estilo);
      ancho = Math.max(ancho, medirTexto(texto, fuenteCelda(celda.estilo?.negrita, celda.estilo?.cursiva, 1)));
    }
    vm.aplicar((libro, idx) => cambiarTamano(libro, idx, "columna", [indice], ancho ? ancho + 12 : ANCHO_COLUMNA));
  };

  // ─── Pintado ───────────────────────────────────────────────────────────────
  const rect = (r: Rango, ox: Tramo, oy: Tramo) => {
    const rr = recortar(r, nFilas, nCols);
    return {
      left: xs[rr.c1] - ox.origen,
      top: ys[rr.f1] - oy.origen,
      width: xs[rr.c2 + 1] - xs[rr.c1],
      height: ys[rr.f2 + 1] - ys[rr.f1],
    };
  };
  const visibleEn = (r: Rango, ox: Tramo, oy: Tramo) => r.c2 >= ox.desde && r.c1 <= ox.hasta && r.f2 >= oy.desde && r.f1 <= oy.hasta;

  const referencias = useMemo(() => {
    if (!edicion || !esFormula(edicion.texto)) return [];
    return referenciasDe(edicion.texto)
      .map((ref, i) => ({ ...ref, color: COLORES_REFERENCIA[i % COLORES_REFERENCIA.length] }))
      .filter((ref) => {
        if (ref.hoja === undefined) return hojaActiva === edicion.hoja;
        return ref.hoja.toLowerCase() === hoja.nombre.toLowerCase();
      });
  }, [edicion, hojaActiva, hoja.nombre]);

  const mostrarSeleccion = !edicion || edicion.hoja === hojaActiva;

  const pintarPanel = (ox: Tramo, oy: Tramo) => {
    const elementos: React.ReactNode[] = [];

    // Líneas de cuadrícula: una por columna y fila visibles (no una caja por celda).
    if (estado.cuadricula) {
      for (let c = ox.desde; c <= ox.hasta; c++) {
        elementos.push(
          <div key={`v${c}`} className="absolute top-0 bottom-0" style={{ left: xs[c + 1] - ox.origen - 1, width: 1, background: "var(--hoja-cuadricula)" }} />,
        );
      }
      for (let f = oy.desde; f <= oy.hasta; f++) {
        elementos.push(
          <div key={`h${f}`} className="absolute left-0 right-0" style={{ top: ys[f + 1] - oy.origen - 1, height: 1, background: "var(--hoja-cuadricula)" }} />,
        );
      }
    }

    for (let f = oy.desde; f <= oy.hasta; f++) {
      for (let c = ox.desde; c <= ox.hasta; c++) {
        const celda = hoja.celdas[claveCelda(f, c)];
        if (!celda) continue;
        const estilo = celda.estilo;
        const valor = celda.entrada ? calc.valor(hojaActiva, f, c) : null;
        let texto = celda.entrada ? formatearValor(valor, estilo) : "";
        const alineacion = alineacionEfectiva(valor, estilo);
        const fuente = fuenteCelda(estilo?.negrita, estilo?.cursiva, zoom);
        let ancho = xs[c + 1] - xs[c];
        const anchoTexto = texto ? medirTexto(texto, fuente) : 0;
        let desborda = false;
        if (anchoTexto > ancho - 4) {
          if (typeof valor === "number") {
            // Un número que no cabe se muestra como ####, como en Excel.
            texto = "#".repeat(Math.max(1, Math.floor((ancho - 4) / medirTexto("#", fuente))));
          } else if (alineacion === "izquierda") {
            let fin = c;
            while (fin + 1 < nCols && fin < ox.hasta + 8 && !hoja.celdas[claveCelda(f, fin + 1)]?.entrada && xs[fin + 1] - xs[c] < anchoTexto + 6) fin++;
            ancho = xs[fin + 1] - xs[c];
            desborda = fin > c;
          }
        }
        if (!texto && !estilo?.colorFondo && !estilo?.bordes) continue;
        const error = valor instanceof ErrorHoja ? EXPLICACION_ERROR[valor.codigo] : undefined;
        elementos.push(
          <div
            key={`c${f},${c}`}
            data-celda={`${letraColumna(c)}${f + 1}`}
            title={error ? `${valor} · ${error}` : undefined}
            className="absolute flex items-end overflow-hidden"
            style={{
              left: xs[c] - ox.origen,
              top: ys[f] - oy.origen,
              width: ancho - (desborda || !estado.cuadricula ? 0 : 1),
              height: ys[f + 1] - ys[f] - 1,
              padding: `0 ${3 * zoom}px ${1 * zoom}px`,
              justifyContent: alineacion === "centro" ? "center" : alineacion === "derecha" ? "flex-end" : "flex-start",
              ...estiloFuente(estilo?.negrita, estilo?.cursiva, zoom),
              color: estilo?.colorTexto ?? "var(--hoja-texto)",
              textDecoration: estilo?.subrayado ? "underline" : undefined,
              background: estilo?.colorFondo ?? (desborda ? "var(--hoja-fondo)" : undefined),
              boxShadow: estilo?.bordes ? "inset 0 0 0 1px #000, 1px 1px 0 0 #000" : undefined,
              whiteSpace: "pre",
              zIndex: desborda ? 1 : undefined,
              lineHeight: 1.2,
            }}
          >
            {texto}
          </div>,
        );
      }
    }

    // Coincidencias de la búsqueda.
    if (resaltados?.lista.length) {
      for (const p of resaltados.lista) {
        if (p.f < oy.desde || p.f > oy.hasta || p.c < ox.desde || p.c > ox.hasta) continue;
        const esActiva = resaltados.activa?.f === p.f && resaltados.activa?.c === p.c;
        elementos.push(
          <div
            key={`b${p.f},${p.c}`}
            className="absolute pointer-events-none"
            style={{
              left: xs[p.c] - ox.origen - 1,
              top: ys[p.f] - oy.origen - 1,
              width: xs[p.c + 1] - xs[p.c] + 1,
              height: ys[p.f + 1] - ys[p.f] + 1,
              background: esActiva ? "rgba(217, 119, 6, 0.28)" : "rgba(245, 158, 11, 0.16)",
              outline: esActiva ? "2px solid #D97706" : undefined,
              outlineOffset: -2,
              zIndex: 2,
            }}
          />,
        );
      }
    }

    // Selección: relleno tenue salvo la celda activa, borde verde y controlador de relleno.
    if (mostrarSeleccion && visibleEn(rango, ox, oy)) {
      const a = sel.activa;
      const esUnica = rango.f1 === rango.f2 && rango.c1 === rango.c2;
      if (!esUnica) {
        const tiras: Rango[] = [
          { f1: rango.f1, f2: a.f - 1, c1: rango.c1, c2: rango.c2 },
          { f1: a.f + 1, f2: rango.f2, c1: rango.c1, c2: rango.c2 },
          { f1: a.f, f2: a.f, c1: rango.c1, c2: a.c - 1 },
          { f1: a.f, f2: a.f, c1: a.c + 1, c2: rango.c2 },
        ].filter((t) => t.f1 <= t.f2 && t.c1 <= t.c2);
        tiras.forEach((t, i) =>
          elementos.push(<div key={`s${i}`} className="absolute pointer-events-none" style={{ ...rect(t, ox, oy), background: "var(--hoja-seleccion)", zIndex: 2 }} />),
        );
      }
      const r = rect(rango, ox, oy);
      elementos.push(
        <div
          key="borde"
          className="absolute pointer-events-none"
          style={{ left: r.left - 1, top: r.top - 1, width: r.width + 1, height: r.height + 1, border: "2px solid var(--hoja-acento)", zIndex: 3 }}
        />,
      );
      const finVisible = rango.c2 <= ox.hasta && rango.c2 >= ox.desde && rango.f2 <= oy.hasta && rango.f2 >= oy.desde;
      if (finVisible && !edicion && !estado.soloLectura && rango.f2 < MAX_FILAS - 1 && rango.c2 < MAX_COLUMNAS - 1) {
        elementos.push(
          <div
            key="relleno"
            title="Arrastre para rellenar · doble clic rellena hasta donde llegan los datos vecinos"
            data-relleno
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Doble clic: el segundo mousedown llega antes de que el navegador emita dblclick
              // (y a veces sobre otro elemento), así que se detecta aquí por tiempo.
              const ahora = performance.now();
              if (ahora - ultimoClicRelleno.current < 400) {
                ultimoClicRelleno.current = 0;
                rellenarHastaVecinos();
                return;
              }
              ultimoClicRelleno.current = ahora;
              setRelleno(rango);
              empezarArrastre({ tipo: "relleno", origen: rango });
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute"
            style={{
              left: r.left + r.width - 4,
              top: r.top + r.height - 4,
              width: 7,
              height: 7,
              background: "var(--hoja-acento)",
              border: "1px solid var(--hoja-fondo)",
              borderRadius: 1,
              cursor: "crosshair",
              zIndex: 4,
            }}
          />,
        );
      }
    }

    if (relleno && visibleEn(relleno, ox, oy)) {
      elementos.push(
        <div key="vista-relleno" className="absolute pointer-events-none" style={{ ...rect(relleno, ox, oy), border: "1px dashed var(--hoja-acento)", zIndex: 4 }} />,
      );
    }

    if (copia && copia.hoja === hojaActiva && visibleEn(copia.rango, ox, oy)) {
      const r = rect(copia.rango, ox, oy);
      elementos.push(
        <div
          key="copia"
          className="absolute pointer-events-none hoja-hormigas"
          style={{ left: r.left - 1, top: r.top - 1, width: r.width + 1, height: r.height + 1, ["--c" as string]: "var(--hoja-acento)", zIndex: 4 }}
        />,
      );
    }

    referencias.forEach((ref, i) => {
      if (!visibleEn(ref, ox, oy)) return;
      const r = rect(ref, ox, oy);
      const esPunto = punto && punto.hoja === hojaActiva && i === referencias.length - 1;
      elementos.push(
        <div
          key={`ref${i}`}
          className={`absolute pointer-events-none ${esPunto ? "hoja-hormigas" : ""}`}
          style={{
            left: r.left - 1,
            top: r.top - 1,
            width: r.width + 1,
            height: r.height + 1,
            border: esPunto ? undefined : `2px solid ${ref.color}`,
            background: esPunto ? undefined : `${ref.color}14`,
            ["--c" as string]: ref.color,
            zIndex: 4,
          }}
        />,
      );
    });

    return (
      <div
        key={`p${ox.pantalla},${oy.pantalla}`}
        className="absolute overflow-hidden"
        style={{ left: ox.pantalla, top: oy.pantalla, width: ox.tam, height: oy.tam, cursor: "cell" }}
        onMouseDown={alPresionarCelda}
        onDoubleClick={alDobleClic}
      >
        {elementos}
      </div>
    );
  };

  const estiloEncabezado = (activo: boolean, completo: boolean): React.CSSProperties => ({
    background: completo ? "var(--hoja-acento)" : activo ? "var(--hoja-encabezado-activo)" : "var(--hoja-encabezado)",
    color: completo ? "var(--primary-foreground)" : activo ? "var(--hoja-acento)" : "var(--muted-foreground)",
    fontWeight: activo ? 700 : 500,
    fontSize: 11 * zoom,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "background-color 120ms ease-out, color 120ms ease-out",
  });

  const encabezadosColumnas = tx.map((t) => (
    <div key={`ec${t.pantalla}`} className="absolute top-0 overflow-hidden" style={{ left: t.pantalla, width: t.tam, height: encH }}>
      {Array.from({ length: t.hasta - t.desde + 1 }, (_, i) => t.desde + i).map((c) => {
        const activo = mostrarSeleccion && c >= rango.c1 && c <= rango.c2;
        return (
          <div
            key={c}
            className={`absolute top-0 flex items-center justify-center select-none ${activo && columnaCompleta ? "hoja-enc-completo" : "hoja-enc"}`}
            style={{
              left: xs[c] - t.origen,
              width: xs[c + 1] - xs[c],
              height: encH,
              borderRight: "1px solid var(--hoja-encabezado-borde)",
              borderBottom: activo ? "2px solid var(--hoja-acento)" : "1px solid var(--hoja-encabezado-borde)",
              cursor: "s-resize",
              ...estiloEncabezado(activo, activo && columnaCompleta),
            }}
            data-encabezado-columna={letraColumna(c)}
            onMouseDown={(e) => presionarColumna(e, c)}
          >
            {letraColumna(c)}
            <div
              className="absolute top-0 bottom-0"
              style={{ right: -3, width: 6, cursor: "col-resize", zIndex: 1 }}
              onMouseDown={(e) => presionarBorde(e, "columna", c)}
              onDoubleClick={(e) => autoajustar(e, "columna", c)}
            />
          </div>
        );
      })}
    </div>
  ));

  const encabezadosFilas = ty.map((t) => (
    <div key={`ef${t.pantalla}`} className="absolute left-0 overflow-hidden" style={{ top: t.pantalla, height: t.tam, width: encW }}>
      {Array.from({ length: t.hasta - t.desde + 1 }, (_, i) => t.desde + i).map((f) => {
        const activo = mostrarSeleccion && f >= rango.f1 && f <= rango.f2;
        return (
          <div
            key={f}
            className={`absolute left-0 flex items-center justify-center select-none ${activo && filaCompleta ? "hoja-enc-completo" : "hoja-enc"}`}
            style={{
              top: ys[f] - t.origen,
              height: ys[f + 1] - ys[f],
              width: encW,
              borderBottom: "1px solid var(--hoja-encabezado-borde)",
              borderRight: activo ? "2px solid var(--hoja-acento)" : "1px solid var(--hoja-encabezado-borde)",
              cursor: "e-resize",
              ...estiloEncabezado(activo, activo && filaCompleta),
            }}
            onMouseDown={(e) => presionarFila(e, f)}
          >
            {f + 1}
            <div
              className="absolute left-0 right-0"
              style={{ bottom: -3, height: 6, cursor: "row-resize", zIndex: 1 }}
              onMouseDown={(e) => presionarBorde(e, "fila", f)}
              onDoubleClick={(e) => autoajustar(e, "fila", f)}
            />
          </div>
        );
      })}
    </div>
  ));

  // ─── Entrada de texto (siempre enfocada, como en Excel Online) ─────────────
  const idxEdicion = edicion?.hoja ?? hojaActiva;
  const celdaEdicion = sel.activa;
  const estiloEdicion = estado.libro.hojas[idxEdicion].celdas[claveCelda(celdaEdicion.f, celdaEdicion.c)]?.estilo;
  const editandoAqui = !!edicion && idxEdicion === hojaActiva;
  const izqEntrada = pantallaDe(celdaEdicion.c, xs, fc, scroll.x, encW);
  const arrEntrada = pantallaDe(celdaEdicion.f, ys, fr, scroll.y, encH);
  const fuenteEntrada = fuenteCelda(estiloEdicion?.negrita, estiloEdicion?.cursiva, zoom);
  const lineas = edicion ? edicion.texto.split("\n") : [""];
  const anchoEntrada = Math.min(
    Math.max(xs[celdaEdicion.c + 1] - xs[celdaEdicion.c], Math.max(...lineas.map((l) => medirTexto(l, fuenteEntrada))) + 14 * zoom),
    Math.max(40, tam.w - izqEntrada - 4),
  );
  const altoEntrada = Math.max(ys[celdaEdicion.f + 1] - ys[celdaEdicion.f], lineas.length * 15 * zoom * 1.25 + 4);

  useEffect(() => {
    if (!onPosicionEditor) return;
    if (!editandoAqui) return onPosicionEditor(null);
    const r = capaRef.current?.getBoundingClientRect();
    if (!r) return;
    onPosicionEditor({ x: r.left + izqEntrada, y: r.top + arrEntrada + altoEntrada + 4 });
  }, [onPosicionEditor, editandoAqui, izqEntrada, arrEntrada, altoEntrada]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden" style={{ background: "var(--hoja-fondo)" }}>
      <style>{ESTILOS}</style>
      <div
        ref={scrollerRef}
        className="absolute inset-0 overflow-scroll"
        onScroll={alDesplazar}
        data-testid="hoja-desplazamiento"
      >
        <div style={{ width: encW + xs[nCols], height: encH + ys[nFilas] }} />
      </div>
      <div
        ref={capaRef}
        className="absolute top-0 left-0 overflow-hidden select-none"
        style={{ width: tam.w, height: tam.h }}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu(e.clientX, e.clientY);
        }}
      >
        {ty.map((y) => tx.map((x) => pintarPanel(x, y)))}
        {fc > 0 && <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: encW + xs[fc] - 1, width: 1, background: "var(--muted-foreground)", opacity: 0.45, zIndex: 5 }} />}
        {fr > 0 && <div className="absolute left-0 right-0 pointer-events-none" style={{ top: encH + ys[fr] - 1, height: 1, background: "var(--muted-foreground)", opacity: 0.45, zIndex: 5 }} />}
        {encabezadosColumnas}
        {encabezadosFilas}
        <div
          className="absolute top-0 left-0"
          title="Seleccionar todo"
          style={{ width: encW, height: encH, background: "var(--hoja-encabezado)", borderRight: "1px solid var(--hoja-encabezado-borde)", borderBottom: "1px solid var(--hoja-encabezado-borde)", zIndex: 6 }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (edicion) despachar({ tipo: "confirmarEdicion", df: 0, dc: 0 });
            despachar({ tipo: "seleccionarRango", activa: { f: 0, c: 0 }, extremo: { f: MAX_FILAS - 1, c: MAX_COLUMNAS - 1 } });
            enfocar();
          }}
        >
          <div className="absolute" style={{ right: 3, bottom: 3, width: 0, height: 0, borderLeft: "9px solid transparent", borderBottom: "9px solid var(--hoja-encabezado-borde)" }} />
        </div>
        {guia && (
          <div
            className="absolute pointer-events-none"
            style={
              guia.eje === "columna"
                ? { left: guia.px - 1, top: 0, bottom: 0, width: 1, borderLeft: "1px dashed var(--hoja-acento)", zIndex: 7 }
                : { top: guia.px - 1, left: 0, right: 0, height: 1, borderTop: "1px dashed var(--hoja-acento)", zIndex: 7 }
            }
          />
        )}
        {guia && (
          <div
            className="absolute pointer-events-none px-2 py-0.5 rounded-md bg-sidebar text-white text-[11px] font-medium tabular-nums shadow-md"
            style={guia.eje === "columna" ? { left: guia.px + 6, top: encH + 4, zIndex: 9 } : { left: encW + 6, top: guia.px + 4, zIndex: 9 }}
          >
            {guia.eje === "columna" ? "Ancho" : "Alto"}: {guia.medida} px
          </div>
        )}
        <textarea
          ref={entradaRef}
          aria-label="Celda activa"
          data-testid="hoja-entrada"
          spellCheck={false}
          autoComplete="off"
          value={editandoAqui ? edicion!.texto : ""}
          readOnly={estado.soloLectura}
          onChange={(e) => {
            if (!edicion) despachar({ tipo: "iniciarEdicion", modo: "escribir", texto: e.target.value });
            else despachar({ tipo: "textoEdicion", texto: e.target.value });
          }}
          onKeyDown={onTecla}
          onKeyUp={(e) => onCursor?.(e.currentTarget.selectionStart)}
          onClick={(e) => onCursor?.(e.currentTarget.selectionStart)}
          onCopy={onCopiar}
          onCut={onCortar}
          onPaste={onPegar}
          className="absolute resize-none border-0 outline-none overflow-hidden"
          style={{
            left: izqEntrada,
            top: arrEntrada,
            width: editandoAqui ? anchoEntrada : 2,
            height: editandoAqui ? altoEntrada : 2,
            opacity: editandoAqui ? 1 : 0,
            padding: `${2 * zoom}px ${3 * zoom}px`,
            ...estiloFuente(estiloEdicion?.negrita, estiloEdicion?.cursiva, zoom),
            lineHeight: 1.25,
            background: "var(--hoja-fondo)",
            color: estiloEdicion?.colorTexto ?? "var(--hoja-texto)",
            boxShadow: editandoAqui ? "0 0 0 2px var(--hoja-acento), 0 4px 12px rgba(15,27,45,0.12)" : "none",
            zIndex: 8,
            whiteSpace: "pre",
            caretColor: editandoAqui ? undefined : "transparent",
          }}
        />
      </div>
    </div>
  );
}
