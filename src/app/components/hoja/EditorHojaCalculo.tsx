import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowDownZA,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  ClipboardPaste,
  Copy,
  Eraser,
  Scissors,
  Trash2,
  CheckCircle2,
  Download, Eye, FileSpreadsheet, History, Loader2, Lock, PencilLine, Redo2, Save, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { ErrorApi } from "../../api/cliente";
import { LogoExpedite } from "../../auth/LogoExpedite";
import {
  descargarArchivoEvidencia,
  guardarVersionEvidencia,
  hashSha256,
  listarVersionesEvidencia,
  type VersionEvidencia,
} from "../../api/evidencias";
import { fechaASerial } from "../../domain/hoja/calculo";
import { libroDeEjemplo } from "../../domain/hoja/ejemplos";
import { celdaUnica, haySinGuardar, MAX_COLUMNAS, MAX_FILAS, puedeSenalar } from "../../domain/hoja/estadoHoja";
import { formatearValor } from "../../domain/hoja/formato";
import {
  aplicarEstilo,
  cambiarEstructura,
  copiarBloque,
  inmovilizar,
  limpiarRango,
  ordenarRango,
  pegarBloque,
  pegarTexto,
  agregarHoja,
  eliminarHoja,
  type Bloque,
} from "../../domain/hoja/operaciones";
import { aHtml, aTsv, desdeTsv } from "../../domain/hoja/portapapeles";
import { nombreRango, parsearRango } from "../../domain/hoja/referencias";
import type { Libro, Rango } from "../../domain/hoja/tipos";
import { useHojaCalculo } from "../../domain/hoja/useHojaCalculo";
import { escribirXlsx, leerXlsx } from "../../domain/hoja/xlsx";
import { buscarEnLibro, coincidenciaDesde, type Coincidencia } from "../../domain/hoja/buscar";
import { aplicarSugerencia, sugerirFormula, type FuncionCatalogo } from "../../domain/hoja/funciones";
import AutocompletadoFormula from "./AutocompletadoFormula";
import AyudaAtajos from "./AyudaAtajos";
import BarraBuscar from "./BarraBuscar";
import BarraEstado from "./BarraEstado";
import BarraFormulas from "./BarraFormulas";
import CintaOpciones, { type AccionesCinta } from "./CintaOpciones";
import CuadriculaHoja, { type VistaCuadricula } from "./CuadriculaHoja";
import MenuContextual, { type OpcionMenu } from "./MenuContextual";
import PestanasHojas from "./PestanasHojas";

// Editor de hojas de cálculo de Expedite (UF-17, SF-08): abre el .xlsx real de la
// evidencia, se usa como Excel y guarda una versión nueva (el backend calcula el hash y
// registra la bitácora). Sin archivo del servidor abre un libro de ejemplo.

export interface PropsEditorHoja {
  filename: string;
  /** Sin id (documentos de ejemplo) se abre un libro de ejemplo. */
  evidenciaId?: string;
  soloLectura?: boolean;
  onClose: () => void;
  onGuardado?: (version: VersionEvidencia) => void;
}

type Carga =
  | { estado: "cargando" }
  | { estado: "listo"; libro: Libro; avisos: string[]; servidor: boolean };

/** Un error inesperado del editor no debe dejar en blanco toda la plataforma. */
class BarreraEditor extends React.Component<{ onClose: () => void; filename: string; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} role="alertdialog" aria-label="Error en el editor">
        <div className="bg-card rounded-xl shadow-2xl border border-border max-w-md w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-red-50 rounded-lg flex-shrink-0"><AlertTriangle size={16} className="text-red-600" /></div>
            <div>
              <div className="text-sm font-bold text-foreground mb-1">El editor dejó de responder</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ocurrió un error inesperado al trabajar con <strong className="text-foreground">{this.props.filename}</strong>. Los cambios que no se guardaron se perdieron. Puedes volver a abrir el archivo.
              </p>
              <pre className="mt-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all">{this.state.error.message}</pre>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={this.props.onClose} className="whitespace-nowrap px-4 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              Cerrar editor
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function EditorHojaCalculo(props: PropsEditorHoja) {
  return (
    <BarreraEditor onClose={props.onClose} filename={props.filename}>
      <CargadorEditor {...props} />
    </BarreraEditor>
  );
}

function CargadorEditor(props: PropsEditorHoja) {
  const { filename, evidenciaId } = props;
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });

  useEffect(() => {
    let vigente = true;
    const ejemplo = (motivo: string) =>
      vigente && setCarga({ estado: "listo", libro: libroDeEjemplo(filename), avisos: [motivo], servidor: false });

    if (!evidenciaId) {
      ejemplo("Vista de ejemplo: este documento no tiene archivo en el servidor. Los cambios no se guardan; puedes descargar una copia.");
      return;
    }
    descargarArchivoEvidencia(evidenciaId)
      .then(leerXlsx)
      .then(({ libro, avisos }) => vigente && setCarga({ estado: "listo", libro, avisos, servidor: true }))
      .catch((error: unknown) => {
        const motivo =
          error instanceof ErrorApi
            ? error.status === 404
              ? "El servidor todavía no entrega el archivo de esta evidencia."
              : error.message
            : "El archivo no es un libro de Excel (.xlsx) válido.";
        ejemplo(`${motivo} Se muestra un libro de ejemplo; los cambios no se guardan en el servidor (puedes descargar una copia).`);
      });
    return () => {
      vigente = false;
    };
  }, [evidenciaId, filename]);

  if (carga.estado === "cargando") {
    // Esqueleto con la forma del editor (barra, cinta, cuadrícula) mientras llega el archivo.
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-background" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} role="status" aria-label={`Abriendo ${filename}`}>
        <div className="flex items-center h-12 px-3 gap-3 bg-sidebar flex-shrink-0">
          <LogoExpedite className="w-5 h-5 text-white" chevrones={LOGO_COMPLETO} />
          <span className="text-[13px] font-semibold text-white truncate">{filename}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-sidebar-foreground">
            <Loader2 size={12} className="animate-spin" /> Abriendo…
          </span>
        </div>
        <div className="h-[118px] bg-card border-b border-border px-4 py-3 flex gap-3 flex-shrink-0">
          {[64, 120, 96, 140, 88].map((w, i) => (
            <div key={i} className="h-full rounded-md bg-secondary/70 motion-safe:animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="flex-1 bg-card m-0 overflow-hidden">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="flex gap-px border-b border-[var(--hoja-cuadricula)]">
              {Array.from({ length: 10 }, (_, j) => (
                <div key={j} className="h-5 flex-1 p-1">
                  {(i * 7 + j * 3) % 5 < 2 && <div className="h-full rounded bg-secondary/80 motion-safe:animate-pulse" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <EditorCargado {...props} libroInicial={carga.libro} avisosIniciales={carga.avisos} servidor={carga.servidor} />;
}

interface Portapapeles {
  tsv: string;
  bloque: Bloque;
  cortar: boolean;
  hoja: number;
  rango: Rango;
}

/** Lo que se guarda o descarga siempre es un .xlsx (un .xlsm pierde las macros). */
const nombreXlsx = (nombre: string) =>
  /\.xlsx$/i.test(nombre) ? nombre : /\.xlsm$/i.test(nombre) ? nombre.replace(/\.xlsm$/i, ".xlsx") : `${nombre}.xlsx`;

const normalizarTsv = (t: string) => t.replace(/\r\n/g, "\n").replace(/\n$/, "");

// Logo completo (los tres chevrones encendidos) para la barra de título.
const LOGO_COMPLETO = [{ visible: true }, { visible: true }, { visible: true }];

type EstadoArchivo = "Solo lectura" | "Vista de ejemplo" | "Guardando…" | "Sin guardar" | "Guardado";

const ESTILO_CHIP: Record<EstadoArchivo, { clase: string; icono: React.ReactNode }> = {
  "Solo lectura": { clase: "bg-white/10 text-sidebar-foreground", icono: <Lock size={11} /> },
  "Vista de ejemplo": { clase: "bg-amber-400/15 text-amber-200", icono: <Eye size={11} /> },
  "Guardando…": { clase: "bg-white/10 text-sidebar-foreground", icono: <Loader2 size={11} className="animate-spin" /> },
  "Sin guardar": { clase: "bg-amber-400/15 text-amber-200", icono: <PencilLine size={11} /> },
  Guardado: { clase: "bg-emerald-400/15 text-emerald-300", icono: <CheckCircle2 size={11} /> },
};

function ChipEstado({ estado }: { estado: EstadoArchivo }) {
  const { clase, icono } = ESTILO_CHIP[estado];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${clase}`} data-testid="hoja-estado-archivo">
      {icono}
      {estado}
    </span>
  );
}

function BotonTitulo({ etiqueta, onClick, deshabilitado, peligro, children }: { etiqueta: string; onClick: () => void; deshabilitado?: boolean; peligro?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta.replace(/ \(.*\)$/, "")}
      title={etiqueta}
      disabled={deshabilitado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-md text-sidebar-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-35 disabled:hover:bg-transparent ${
        peligro ? "hover:bg-red-500/90 hover:text-white" : "hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EditorCargado({
  filename,
  evidenciaId,
  soloLectura = false,
  onClose,
  onGuardado,
  libroInicial,
  avisosIniciales,
  servidor,
}: PropsEditorHoja & { libroInicial: Libro; avisosIniciales: string[]; servidor: boolean }) {
  const vm = useHojaCalculo(libroInicial, soloLectura);
  const { estado, despachar, hoja, rango, rangoUtil, usada, aplicar, alternar } = vm;
  const idx = estado.hojaActiva;
  const sucio = haySinGuardar(estado);
  const puedeGuardar = servidor && !soloLectura && !!evidenciaId;

  const entradaRef = useRef<HTMLTextAreaElement>(null);
  const barraRef = useRef<HTMLInputElement>(null);
  const vistaRef = useRef<VistaCuadricula>({ filasVisibles: 20, filas: 100, columnas: 26 });
  const portapapeles = useRef<Portapapeles | null>(null);

  const [avisos, setAvisos] = useState(avisosIniciales);
  const [guardando, setGuardando] = useState(false);
  const [dialogo, setDialogo] = useState<"sinGuardar" | "version" | null>(null);
  const [comentario, setComentario] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [historial, setHistorial] = useState<{ abierto: boolean; versiones?: VersionEvidencia[]; error?: string }>({ abierto: false });
  const [ayudaAtajos, setAyudaAtajos] = useState(false);

  // ─── Autocompletado de fórmulas ────────────────────────────────────────────
  const [cursor, setCursor] = useState(0);
  const [indiceSugerencia, setIndiceSugerencia] = useState(0);
  const [sugerenciasCerradas, setSugerenciasCerradas] = useState(false);
  const [posicionEditor, setPosicionEditor] = useState<{ x: number; y: number } | null>(null);
  const textoEdicion = estado.edicion?.texto;
  const sugerencia = useMemo(() => {
    if (textoEdicion === undefined || sugerenciasCerradas) return null;
    return sugerirFormula(textoEdicion, Math.min(cursor, textoEdicion.length));
  }, [textoEdicion, cursor, sugerenciasCerradas]);
  const listaSugerencias = sugerencia?.tipo === "funciones" ? sugerencia : null;
  useEffect(() => setIndiceSugerencia(0), [listaSugerencias?.prefijo]);
  useEffect(() => {
    // Al escribir de nuevo la lista vuelve a aparecer aunque se haya cerrado con Esc.
    setSugerenciasCerradas(false);
    if (textoEdicion !== undefined) setCursor(textoEdicion.length);
  }, [textoEdicion]);

  const elegirFuncion = (funcion: FuncionCatalogo) => {
    if (!listaSugerencias || textoEdicion === undefined) return;
    const { texto, cursor: nuevoCursor } = aplicarSugerencia(textoEdicion, listaSugerencias, funcion, Math.min(cursor, textoEdicion.length));
    despachar({ tipo: "textoEdicion", texto });
    requestAnimationFrame(() => {
      const t = entradaRef.current;
      if (t) t.selectionStart = t.selectionEnd = nuevoCursor;
      setCursor(nuevoCursor);
    });
  };

  // ─── Buscar ────────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState<{ abierta: boolean; texto: string; actual: number }>({ abierta: false, texto: "", actual: -1 });
  const coincidencias = useMemo<Coincidencia[]>(
    () => (busqueda.abierta ? buscarEnLibro(estado.libro, idx, busqueda.texto, vm.textoCelda) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busqueda.abierta, busqueda.texto, estado.libro, idx],
  );
  const irACoincidencia = (i: number) => {
    const m = coincidencias[i];
    if (!m) return;
    setBusqueda((b) => ({ ...b, actual: i }));
    if (m.hoja !== idx) despachar({ tipo: "cambiarHoja", idx: m.hoja });
    despachar({ tipo: "seleccionar", pos: { f: m.f, c: m.c } });
  };
  const abrirBusqueda = () => {
    if (estado.edicion) despachar({ tipo: "confirmarEdicion", df: 0, dc: 0 });
    setBusqueda((b) => ({ ...b, abierta: true, actual: -1 }));
  };
  const cerrarBusqueda = () => {
    setBusqueda((b) => ({ ...b, abierta: false, actual: -1 }));
    enfocar();
  };
  const siguienteCoincidencia = (direccion: 1 | -1) => {
    if (!coincidencias.length) return;
    if (busqueda.actual === -1) {
      const desde = coincidenciaDesde(coincidencias, idx, estado.sel.activa.f, estado.sel.activa.c);
      return irACoincidencia(direccion === 1 ? desde : (desde - 1 + coincidencias.length) % coincidencias.length);
    }
    irACoincidencia((busqueda.actual + direccion + coincidencias.length) % coincidencias.length);
  };
  const resaltados = useMemo(
    () => ({
      lista: coincidencias.filter((m) => m.hoja === idx).map((m) => ({ f: m.f, c: m.c })),
      activa: busqueda.actual >= 0 && coincidencias[busqueda.actual]?.hoja === idx ? { f: coincidencias[busqueda.actual].f, c: coincidencias[busqueda.actual].c } : null,
    }),
    [coincidencias, idx, busqueda.actual],
  );

  const enfocar = useCallback(() => entradaRef.current?.focus({ preventScroll: true }), []);
  useEffect(() => enfocar(), [enfocar]);

  // Aviso del navegador al salir con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [sucio]);

  // ─── Guardar y descargar ───────────────────────────────────────────────────
  const descargar = async () => {
    try {
      const blob = await escribirXlsx(estado.libro);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreXlsx(filename);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const hash = await hashSha256(blob);
      toast.success(`Copia descargada · SHA-256 ${hash.slice(0, 8)}…${hash.slice(-8)}`);
    } catch {
      toast.error("No se pudo generar el archivo .xlsx.");
    }
  };

  const guardar = async (texto = ""): Promise<boolean> => {
    if (!puedeGuardar || !evidenciaId) {
      await descargar();
      return true;
    }
    if (guardando) return false;
    if (estado.edicion) despachar({ tipo: "confirmarEdicion", df: 0, dc: 0 });
    setGuardando(true);
    const libro = estado.libro;
    try {
      const version = await guardarVersionEvidencia(evidenciaId, await escribirXlsx(libro), nombreXlsx(filename), texto);
      despachar({ tipo: "guardado", libro });
      toast.success(`Versión ${version.version} guardada · SHA-256 ${version.hash.slice(0, 8)}…${version.hash.slice(-8)}`);
      onGuardado?.(version);
      if (historial.abierto) cargarHistorial();
      return true;
    } catch (error) {
      toast.error(
        error instanceof ErrorApi && error.status === 404
          ? "El servidor todavía no permite guardar versiones. Descarga una copia para no perder los cambios."
          : error instanceof ErrorApi
            ? error.message
            : "No se pudo guardar el archivo.",
      );
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const cargarHistorial = () => {
    if (!evidenciaId || !servidor) {
      setHistorial({ abierto: true, error: "El historial de versiones solo está disponible para evidencias guardadas en el servidor." });
      return;
    }
    setHistorial({ abierto: true });
    listarVersionesEvidencia(evidenciaId)
      .then((versiones) => setHistorial({ abierto: true, versiones }))
      .catch((e) => setHistorial({ abierto: true, error: e instanceof ErrorApi && e.status !== 404 ? e.message : "El historial de versiones aún no está disponible." }));
  };

  const cerrar = () => {
    if (estado.edicion) despachar({ tipo: "cancelarEdicion" });
    if (sucio && !soloLectura) setDialogo("sinGuardar");
    else onClose();
  };

  // ─── Portapapeles ──────────────────────────────────────────────────────────
  const rangoCopia = (): Rango => ({
    ...rango,
    f2: Math.max(rango.f1, Math.min(rango.f2, usada.f)),
    c2: Math.max(rango.c1, Math.min(rango.c2, usada.c)),
  });

  const prepararCopia = (cortar: boolean) => {
    const r = rangoCopia();
    const matriz: string[][] = [];
    for (let f = r.f1; f <= r.f2; f++) {
      const fila: string[] = [];
      for (let c = r.c1; c <= r.c2; c++) fila.push(vm.textoCelda(idx, f, c));
      matriz.push(fila);
    }
    const tsv = aTsv(matriz);
    portapapeles.current = { tsv, bloque: copiarBloque(hoja, r), cortar, hoja: idx, rango: r };
    despachar({ tipo: "marcarCopia", rango: r, cortar });
    return { tsv, html: aHtml(matriz) };
  };

  const alCopiar = (e: React.ClipboardEvent, cortar = false) => {
    if (estado.edicion) return;
    e.preventDefault();
    if (cortar && soloLectura) return;
    const { tsv, html } = prepararCopia(cortar);
    e.clipboardData.setData("text/plain", tsv);
    e.clipboardData.setData("text/html", html);
  };

  const pegar = (texto: string) => {
    if (soloLectura) return;
    const interno = portapapeles.current;
    let resultado: { libro: Libro; rango: Rango };
    if (interno && normalizarTsv(texto) === normalizarTsv(interno.tsv)) {
      // Copia hecha en Expedite: conserva fórmulas (desplazadas) y formato.
      let libro = estado.libro;
      if (interno.cortar) libro = limpiarRango(libro, interno.hoja, interno.rango, true);
      resultado = pegarBloque(libro, idx, rango, interno.bloque);
      if (interno.cortar) {
        portapapeles.current = null;
        despachar({ tipo: "marcarCopia", rango: null });
      }
    } else {
      if (!texto) return;
      resultado = pegarTexto(estado.libro, idx, rango.f1, rango.c1, desdeTsv(texto));
    }
    const r = resultado.rango;
    despachar({ tipo: "aplicar", libro: resultado.libro, sel: { activa: { f: r.f1, c: r.c1 }, ancla: { f: r.f1, c: r.c1 }, extremo: { f: r.f2, c: r.c2 } } });
  };

  const alPegar = (e: React.ClipboardEvent) => {
    if (estado.edicion) return;
    e.preventDefault();
    pegar(e.clipboardData.getData("text/plain"));
  };

  const copiarDesdeCinta = (cortar: boolean) => {
    enfocar();
    // execCommand dispara el evento copy/cut en la entrada enfocada (permite text/html).
    const ok = document.execCommand(cortar ? "cut" : "copy");
    if (!ok) {
      const { tsv } = prepararCopia(cortar);
      navigator.clipboard?.writeText(tsv).catch(() => undefined);
    }
  };

  const pegarDesdeCinta = async () => {
    try {
      pegar(await navigator.clipboard.readText());
    } catch {
      if (portapapeles.current) pegar(portapapeles.current.tsv);
      else toast.info("Usa Ctrl+V para pegar desde otra aplicación.");
    }
    enfocar();
  };

  // ─── Acciones ──────────────────────────────────────────────────────────────
  const columnasCompletas = rango.f1 === 0 && rango.f2 >= MAX_FILAS - 1;
  const filasCompletas = rango.c1 === 0 && rango.c2 >= MAX_COLUMNAS - 1;

  const insertar = (eje: "fila" | "columna") => {
    const cantidad = eje === "fila" ? Math.min(rango.f2 - rango.f1 + 1, 1000) : Math.min(rango.c2 - rango.c1 + 1, 100);
    aplicar((l, i) => cambiarEstructura(l, i, eje, eje === "fila" ? rango.f1 : rango.c1, columnasCompletas && eje === "fila" ? 1 : filasCompletas && eje === "columna" ? 1 : cantidad));
  };

  const eliminar = (eje: "fila" | "columna") => {
    const cantidad = eje === "fila" ? rangoUtil.f2 - rango.f1 + 1 : rangoUtil.c2 - rango.c1 + 1;
    aplicar((l, i) => cambiarEstructura(l, i, eje, eje === "fila" ? rango.f1 : rango.c1, -cantidad), celdaUnica({ f: rango.f1, c: rango.c1 }));
  };

  const autosuma = () => {
    if (soloLectura) return;
    const numerico = (f: number, c: number) => typeof vm.calc.valor(idx, f, c) === "number";
    const unica = rango.f1 === rango.f2 && rango.c1 === rango.c2;
    if (unica) {
      const { f, c } = estado.sel.activa;
      const vacia = (ff: number, cc: number) => vm.calc.valor(idx, ff, cc) === null;
      // Como Excel: salta los vacíos inmediatos y toma el bloque de números más cercano
      // (primero hacia arriba, luego hacia la izquierda); el rango incluye los vacíos del medio.
      const bloque = (lejos: (k: number) => [number, number], limite: number) => {
        let k = limite;
        while (k >= 0 && vacia(...lejos(k))) k--;
        if (k < 0 || !numerico(...lejos(k))) return -1;
        while (k >= 0 && numerico(...lejos(k))) k--;
        return k + 1;
      };
      let propuesta = "";
      const arriba = bloque((k) => [k, c], f - 1);
      if (arriba >= 0) propuesta = nombreRango({ f1: arriba, c1: c, f2: f - 1, c2: c });
      else {
        const izquierda = bloque((k) => [f, k], c - 1);
        if (izquierda >= 0) propuesta = nombreRango({ f1: f, c1: izquierda, f2: f, c2: c - 1 });
      }
      despachar({ tipo: "iniciarEdicion", modo: "escribir", texto: `=SUMA(${propuesta})` });
      if (!propuesta) {
        requestAnimationFrame(() => {
          const t = entradaRef.current;
          if (t) t.selectionStart = t.selectionEnd = t.value.length - 1;
        });
      }
      return;
    }
    // Con un rango: suma de cada columna debajo de la selección.
    const r = rangoUtil;
    aplicar((l, i) => {
      let libro = l;
      for (let c = r.c1; c <= r.c2; c++) {
        libro = pegarTexto(libro, i, r.f2 + 1, c, [[`=SUMA(${nombreRango({ f1: r.f1, c1: c, f2: r.f2, c2: c })})`]]).libro;
      }
      return libro;
    });
  };

  const ordenar = (ascendente: boolean) => {
    let r = rangoUtil;
    let col = estado.sel.activa.c;
    if (rango.f1 === rango.f2 && rango.c1 === rango.c2) {
      // Una sola celda: ordena la región de datos suponiendo encabezados en la fila 1.
      r = { f1: 1, c1: 0, f2: usada.f, c2: usada.c };
      if (r.f2 < r.f1) return;
      toast.info(`Se ordenó ${nombreRango(r)} por la columna ${nombreRango({ f1: 0, c1: col, f2: 0, c2: col }).replace(/\d+/, "")}.`);
    }
    aplicar((l, i) => ordenarRango(l, i, r, col, ascendente));
  };

  const fijarPaneles = (tipo: "panel" | "fila" | "columna" | "ninguno") => {
    const { f, c } = estado.sel.activa;
    const [filas, columnas] = tipo === "panel" ? [f, c] : tipo === "fila" ? [1, 0] : tipo === "columna" ? [0, 1] : [0, 0];
    if (tipo === "panel" && !f && !c) {
      toast.info("Selecciona la celda debajo y a la derecha de lo que quieres inmovilizar.");
      return;
    }
    aplicar((l, i) => inmovilizar(l, i, filas, columnas));
  };

  const borrar = (que: "todo" | "contenido" | "formato") =>
    aplicar((l, i, r) => (que === "formato" ? aplicarEstilo(l, i, r, () => ({})) : limpiarRango(l, i, r, que === "todo")));

  const irA = (texto: string): boolean => {
    const limpio = texto.trim();
    const bang = limpio.lastIndexOf("!");
    let destino = idx;
    let ref = limpio;
    if (bang > 0) {
      const nombre = limpio.slice(0, bang).replace(/^'|'$/g, "").replace(/''/g, "'");
      destino = estado.libro.hojas.findIndex((h) => h.nombre.toLowerCase() === nombre.toLowerCase());
      ref = limpio.slice(bang + 1);
    }
    const r = parsearRango(ref);
    if (!r || destino < 0) {
      toast.error("La referencia no es válida.");
      return false;
    }
    if (destino !== idx) despachar({ tipo: "cambiarHoja", idx: destino });
    despachar({ tipo: "seleccionarRango", activa: { f: r.f1, c: r.c1 }, extremo: { f: r.f2, c: r.c2 } });
    return true;
  };

  const llenarHacia = (eje: "abajo" | "derecha") => {
    let origen: Rango;
    let destino: Rango = rangoUtil;
    if (eje === "abajo") {
      origen = { ...rangoUtil, f2: rangoUtil.f1 };
      if (rango.f1 === rango.f2) {
        if (rango.f1 === 0) return;
        origen = { ...rangoUtil, f1: rango.f1 - 1, f2: rango.f1 - 1 };
        destino = { ...rangoUtil, f1: rango.f1 - 1 };
      }
    } else {
      origen = { ...rangoUtil, c2: rangoUtil.c1 };
      if (rango.c1 === rango.c2) {
        if (rango.c1 === 0) return;
        origen = { ...rangoUtil, c1: rango.c1 - 1, c2: rango.c1 - 1 };
        destino = { ...rangoUtil, c1: rango.c1 - 1 };
      }
    }
    // Ctrl+D / Ctrl+R copian (no continúan series), como Excel.
    aplicar((l, i) => {
      let libro = l;
      const pasos = eje === "abajo" ? destino.f2 - origen.f2 : destino.c2 - origen.c2;
      for (let k = 1; k <= pasos; k++) {
        const o = origen;
        const d = eje === "abajo" ? { ...o, f1: o.f1 + k, f2: o.f2 + k } : { ...o, c1: o.c1 + k, c2: o.c2 + k };
        libro = pegarBloque(libro, i, d, { ...copiarBloque(libro.hojas[i], o), origen: { f: o.f1, c: o.c1 } }).libro;
      }
      return libro;
    });
  };

  const accionesCinta: AccionesCinta = {
    guardar: () => void guardar(),
    guardarVersion: () => (puedeGuardar ? setDialogo("version") : void descargar()),
    descargar: () => void descargar(),
    cerrar,
    verHistorial: () => (historial.abierto ? setHistorial({ abierto: false }) : cargarHistorial()),
    buscar: abrirBusqueda,
    eliminarHoja: () => aplicar((l) => eliminarHoja(l, idx), celdaUnica({ f: 0, c: 0 }), Math.max(0, Math.min(idx, estado.libro.hojas.length - 2))),
    copiar: () => copiarDesdeCinta(false),
    cortar: () => copiarDesdeCinta(true),
    pegar: () => void pegarDesdeCinta(),
    autosuma,
    borrar,
    insertar: (eje) => insertar(columnasCompletas ? "columna" : filasCompletas ? "fila" : eje),
    eliminar: (eje) => eliminar(columnasCompletas ? "columna" : filasCompletas ? "fila" : eje),
    insertarHoja: () => aplicar((l) => agregarHoja(l, idx), celdaUnica({ f: 0, c: 0 }), idx + 1),
    ordenar,
    inmovilizar: fijarPaneles,
  };

  // ─── Teclado ───────────────────────────────────────────────────────────────
  const alTeclear = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const ed = estado.edicion;
    const flechas: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

    if (ed) {
      if (listaSugerencias) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const n = listaSugerencias.lista.length;
          setIndiceSugerencia((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && !e.altKey)) {
          e.preventDefault();
          elegirFuncion(listaSugerencias.lista[indiceSugerencia]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSugerenciasCerradas(true);
          return;
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.altKey) {
          // Alt+Enter: salto de línea dentro de la celda.
          const t = e.currentTarget;
          const inicio = t.selectionStart;
          despachar({ tipo: "textoEdicion", texto: ed.texto.slice(0, inicio) + "\n" + ed.texto.slice(t.selectionEnd) });
          requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = inicio + 1));
          return;
        }
        despachar({ tipo: "confirmarEdicion", df: mod ? 0 : e.shiftKey ? -1 : 1, dc: 0, enRango: mod });
      } else if (e.key === "Tab") {
        e.preventDefault();
        despachar({ tipo: "confirmarEdicion", df: 0, dc: e.shiftKey ? -1 : 1 });
      } else if (e.key === "Escape") {
        e.preventDefault();
        despachar({ tipo: "cancelarEdicion" });
      } else if (e.key === "F2") {
        e.preventDefault();
        despachar({ tipo: "iniciarEdicion", modo: ed.modo === "editar" ? "escribir" : "editar", texto: ed.texto });
      } else if (flechas[e.key]) {
        const [df, dc] = flechas[e.key];
        if (puedeSenalar(ed)) {
          e.preventDefault();
          despachar({ tipo: "senalarMover", df, dc, extender: e.shiftKey });
        } else if (ed.modo === "escribir") {
          e.preventDefault();
          despachar({ tipo: "confirmarEdicion", df, dc });
        }
      }
      return;
    }

    const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const manejar = (fn: () => void) => {
      e.preventDefault();
      fn();
    };

    if (mod) {
      if (flechas[e.key]) {
        const [df, dc] = flechas[e.key];
        return manejar(() => despachar({ tipo: "mover", df, dc, salto: true, extender: e.shiftKey }));
      }
      switch (tecla) {
        case "z": return manejar(() => despachar({ tipo: e.shiftKey ? "rehacer" : "deshacer" }));
        case "y": return manejar(() => despachar({ tipo: "rehacer" }));
        case "b":
        case "n": return manejar(() => !soloLectura && alternar("negrita"));
        case "i":
        case "k": return manejar(() => !soloLectura && alternar("cursiva"));
        case "u": return manejar(() => !soloLectura && alternar("subrayado"));
        case "s":
        case "g": return manejar(() => void guardar());
        case "f": return manejar(abrirBusqueda);
        case "a": return manejar(() => despachar({ tipo: "seleccionarRango", activa: { f: 0, c: 0 }, extremo: { f: MAX_FILAS - 1, c: MAX_COLUMNAS - 1 } }));
        case "d": return manejar(() => !soloLectura && llenarHacia("abajo"));
        case "r": return manejar(() => !soloLectura && llenarHacia("derecha"));
        case ";":
          return manejar(() => {
            const hoy = new Date();
            despachar({ tipo: "iniciarEdicion", modo: "escribir", texto: formatearValor(fechaASerial(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()), { formato: "fecha" }) });
          });
        case " ": return manejar(() => despachar({ tipo: "seleccionarRango", activa: { f: 0, c: rango.c1 }, extremo: { f: MAX_FILAS - 1, c: rango.c2 } }));
        case "Home": return manejar(() => despachar({ tipo: "inicio", ctrl: true, extender: e.shiftKey }));
        case "End": return manejar(() => despachar({ tipo: "fin" }));
      }
      return; // Ctrl+C/X/V siguen su curso: los atienden los eventos copy/cut/paste.
    }

    if (flechas[e.key]) {
      const [df, dc] = flechas[e.key];
      return manejar(() => despachar({ tipo: "mover", df, dc, extender: e.shiftKey }));
    }
    if (e.altKey && (e.key === "=" || e.code === "Equal")) return manejar(autosuma);
    switch (e.key) {
      case "Enter": return manejar(() => despachar({ tipo: "confirmarEdicion", df: e.shiftKey ? -1 : 1, dc: 0 }));
      case "Tab": return manejar(() => despachar({ tipo: "confirmarEdicion", df: 0, dc: e.shiftKey ? -1 : 1 }));
      case "Home": return manejar(() => despachar({ tipo: "inicio", ctrl: false, extender: e.shiftKey }));
      case "PageDown": return manejar(() => despachar({ tipo: "mover", df: vistaRef.current.filasVisibles, dc: 0, extender: e.shiftKey }));
      case "PageUp": return manejar(() => despachar({ tipo: "mover", df: -vistaRef.current.filasVisibles, dc: 0, extender: e.shiftKey }));
      case "F2":
        return manejar(() => {
          despachar({ tipo: "iniciarEdicion", modo: "editar" });
          requestAnimationFrame(() => {
            const t = entradaRef.current;
            if (t) t.selectionStart = t.selectionEnd = t.value.length;
          });
        });
      case "F11": return e.shiftKey ? manejar(accionesCinta.insertarHoja) : undefined;
      case "Delete": return manejar(() => !soloLectura && borrar("contenido"));
      case "Backspace":
        return manejar(() => {
          if (soloLectura) return;
          despachar({ tipo: "iniciarEdicion", modo: "escribir", texto: "" });
        });
      case "Escape": return manejar(() => despachar({ tipo: "marcarCopia", rango: null }));
      case " ":
        if (e.shiftKey) return manejar(() => despachar({ tipo: "seleccionarRango", activa: { f: rango.f1, c: 0 }, extremo: { f: rango.f2, c: MAX_COLUMNAS - 1 } }));
    }
    if (soloLectura && e.key.length === 1) e.preventDefault();
  };

  // ─── Menú contextual de la cuadrícula ──────────────────────────────────────
  const n = (eje: "fila" | "columna") => (eje === "fila" ? rangoUtil.f2 - rango.f1 + 1 : rangoUtil.c2 - rango.c1 + 1);
  const opcionesMenu: OpcionMenu[] = [
    { etiqueta: "Cortar", icono: <Scissors size={13} />, atajo: "Ctrl+X", accion: () => copiarDesdeCinta(true), deshabilitada: soloLectura },
    { etiqueta: "Copiar", icono: <Copy size={13} />, atajo: "Ctrl+C", accion: () => copiarDesdeCinta(false) },
    { etiqueta: "Pegar", icono: <ClipboardPaste size={13} />, atajo: "Ctrl+V", accion: () => void pegarDesdeCinta(), deshabilitada: soloLectura },
    null,
    { icono: <BetweenHorizontalStart size={13} />, etiqueta: n("fila") > 1 ? `Insertar ${n("fila")} filas` : "Insertar fila", accion: () => insertar("fila"), deshabilitada: soloLectura || columnasCompletas },
    { icono: <BetweenVerticalStart size={13} />, etiqueta: n("columna") > 1 ? `Insertar ${n("columna")} columnas` : "Insertar columna", accion: () => insertar("columna"), deshabilitada: soloLectura || filasCompletas },
    { etiqueta: "Eliminar filas", icono: <Trash2 size={13} />, accion: () => eliminar("fila"), deshabilitada: soloLectura || columnasCompletas, peligro: true },
    { etiqueta: "Eliminar columnas", icono: <Trash2 size={13} />, accion: () => eliminar("columna"), deshabilitada: soloLectura || filasCompletas, peligro: true },
    null,
    { etiqueta: "Borrar contenido", icono: <Eraser size={13} />, atajo: "Supr", accion: () => borrar("contenido"), deshabilitada: soloLectura },
    { etiqueta: "Borrar formatos", accion: () => borrar("formato"), deshabilitada: soloLectura },
    null,
    { etiqueta: "Ordenar de A a Z", icono: <ArrowDownAZ size={13} />, accion: () => ordenar(true), deshabilitada: soloLectura },
    { etiqueta: "Ordenar de Z a A", icono: <ArrowDownZA size={13} />, accion: () => ordenar(false), deshabilitada: soloLectura },
  ];

  const titulo = filename.replace(/\.xlsx$/i, "");
  const estadoArchivo: EstadoArchivo = soloLectura ? "Solo lectura" : !servidor ? "Vista de ejemplo" : guardando ? "Guardando…" : sucio ? "Sin guardar" : "Guardado";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-background text-foreground"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      role="dialog"
      aria-label={`Editor de hoja de cálculo: ${filename}`}
    >
      {/* ── Barra de título (cromo de Expedite) ── */}
      <header className="flex items-center h-12 pl-3 pr-2 gap-2 bg-sidebar text-sidebar-foreground flex-shrink-0 select-none border-b border-sidebar-border">
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-white/10">
          <LogoExpedite className="w-5 h-5 text-white" chevrones={LOGO_COMPLETO} />
          <span className="text-[13px] font-bold text-white tracking-tight">Expedite</span>
        </div>
        <FileSpreadsheet size={16} className="text-emerald-400 flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white truncate" title={filename}>{titulo}</span>
          <ChipEstado estado={estadoArchivo} />
        </div>
        <div className="flex items-center gap-0.5 ml-2">
          <BotonTitulo etiqueta="Deshacer (Ctrl+Z)" deshabilitado={!estado.pasado.length} onClick={() => despachar({ tipo: "deshacer" })}>
            <Undo2 size={15} />
          </BotonTitulo>
          <BotonTitulo etiqueta="Rehacer (Ctrl+Y)" deshabilitado={!estado.futuro.length} onClick={() => despachar({ tipo: "rehacer" })}>
            <Redo2 size={15} />
          </BotonTitulo>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          aria-pressed={historial.abierto}
          onMouseDown={(e) => e.preventDefault()}
          onClick={accionesCinta.verHistorial}
          className={`flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-md border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
            historial.abierto ? "bg-white/15 border-white/25 text-white" : "border-white/15 text-sidebar-foreground hover:bg-white/10 hover:text-white"
          }`}
        >
          <History size={14} /> Historial
        </button>
        <button
          type="button"
          aria-label={puedeGuardar ? "Guardar" : "Descargar copia"}
          title={puedeGuardar ? "Guardar versión (Ctrl+S)" : "Descargar copia (Ctrl+S)"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void guardar()}
          disabled={guardando}
          className="flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" /> : puedeGuardar ? <Save size={14} /> : <Download size={14} />}
          {puedeGuardar ? "Guardar" : "Descargar"}
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <BotonTitulo etiqueta="Cerrar" onClick={cerrar} peligro>
          <X size={16} />
        </BotonTitulo>
      </header>

      <CintaOpciones vm={vm} acciones={accionesCinta} puedeGuardar={puedeGuardar} />
      <BarraFormulas vm={vm} barraRef={barraRef} onIrA={irA} enfocarCuadricula={enfocar} />

      {avisos.length > 0 && (
        <div className="px-3 py-2 bg-card border-b border-border flex-shrink-0">
          <div className="flex items-start gap-2.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900" role="alert">
            <AlertTriangle size={14} className="text-amber-600 mt-px flex-shrink-0" />
            <div className="flex-1 space-y-0.5 leading-relaxed">
              {avisos.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setAvisos([])} className="p-1 -m-0.5 rounded-md text-amber-700 hover:bg-amber-100 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="relative flex flex-col flex-1 min-w-0">
          {busqueda.abierta && (
            <BarraBuscar
              texto={busqueda.texto}
              total={coincidencias.length}
              actual={busqueda.actual}
              onTexto={(texto) => setBusqueda((b) => ({ ...b, texto, actual: -1 }))}
              onSiguiente={() => siguienteCoincidencia(1)}
              onAnterior={() => siguienteCoincidencia(-1)}
              onCerrar={cerrarBusqueda}
            />
          )}
          <CuadriculaHoja
            vm={vm}
            entradaRef={entradaRef}
            onTecla={alTeclear}
            onCopiar={(e) => alCopiar(e)}
            onCortar={(e) => alCopiar(e, true)}
            onPegar={alPegar}
            onMenu={(x, y) => setMenu({ x, y })}
            vistaRef={vistaRef}
            resaltados={busqueda.abierta ? resaltados : undefined}
            onPosicionEditor={setPosicionEditor}
            onCursor={setCursor}
          />
          <PestanasHojas vm={vm} enfocarCuadricula={enfocar} />
        </div>
        {historial.abierto && (
          <aside className="w-80 border-l border-border bg-card flex flex-col flex-shrink-0" aria-label="Historial de versiones">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground tracking-tight">
                <History size={15} className="text-primary" /> Historial de versiones
              </div>
              <button type="button" aria-label="Cerrar historial" onClick={() => setHistorial({ abierto: false })} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {historial.error ? (
                <div className="text-center px-4 py-8 text-muted-foreground bg-secondary/30 rounded-lg border-2 border-dashed border-border">
                  <History size={20} className="mx-auto mb-2 text-muted-foreground/50" />
                  {historial.error}
                </div>
              ) : !historial.versiones ? (
                [0, 1, 2].map((i) => <div key={i} className="h-[74px] rounded-lg bg-secondary/60 motion-safe:animate-pulse" />)
              ) : historial.versiones.length === 0 ? (
                <div className="text-center px-4 py-8 text-muted-foreground bg-secondary/30 rounded-lg border-2 border-dashed border-border">
                  Aún no hay versiones guardadas desde Expedite. Usa Guardar para crear la primera.
                </div>
              ) : (
                [...historial.versiones].reverse().map((v, i) => (
                  <div key={v.version} className={`p-3 border rounded-lg ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/20"}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-primary">v{v.version}</span>
                      {i === 0 && <span className="text-[10px] px-1.5 py-px bg-primary text-primary-foreground rounded-full font-semibold">Actual</span>}
                    </div>
                    <div className="text-muted-foreground">{v.autor}{v.fecha ? ` · ${new Date(v.fecha).toLocaleString("es-MX")}` : ""}</div>
                    {v.comentario && <div className="italic mt-0.5">"{v.comentario}"</div>}
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate" title={v.hash}>SHA-256 {v.hash}</div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      <BarraEstado vm={vm} aviso={estado.copia && !estado.edicion ? "Seleccione el destino y presione Entrar o elija Pegar." : undefined} onAtajos={() => setAyudaAtajos(true)} />

      {sugerencia && posicionEditor && estado.edicion?.origen === "celda" && (
        <AutocompletadoFormula
          sugerencia={sugerencia}
          indice={indiceSugerencia}
          x={posicionEditor.x}
          y={posicionEditor.y}
          onElegir={elegirFuncion}
          onSenalar={setIndiceSugerencia}
        />
      )}
      {ayudaAtajos && <AyudaAtajos onCerrar={() => { setAyudaAtajos(false); enfocar(); }} />}

      {menu && <MenuContextual x={menu.x} y={menu.y} opciones={opcionesMenu} onCerrar={() => setMenu(null)} />}

      {dialogo && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-sidebar/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-[460px] border border-border" role="alertdialog" aria-label={dialogo === "version" ? "Guardar como nueva versión" : "Cambios sin guardar"}>
            {dialogo === "sinGuardar" ? (
              <div className="p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0"><AlertTriangle size={16} className="text-amber-600" /></div>
                  <div>
                    <div className="text-sm font-bold text-foreground mb-1">Cambios sin guardar</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Tienes cambios sin guardar en <strong className="text-foreground">{filename}</strong>.{" "}
                      {puedeGuardar ? "Se guardará una versión nueva con su propio hash de integridad." : "Esta vista no se guarda en el servidor; puedes descargar una copia."}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    autoFocus
                    disabled={guardando}
                    onClick={async () => {
                      if (await guardar()) {
                        setDialogo(null);
                        onClose();
                      }
                    }}
                    className="whitespace-nowrap px-4 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                  >
                    {puedeGuardar ? "Guardar" : "Descargar copia"}
                  </button>
                  <button type="button" onClick={() => { setDialogo(null); onClose(); }} className="whitespace-nowrap px-4 h-9 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                    No guardar
                  </button>
                  <button type="button" onClick={() => { setDialogo(null); enfocar(); }} className="whitespace-nowrap px-4 h-9 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="text-sm font-bold text-foreground mb-1">Guardar como nueva versión</div>
                <p className="text-xs text-muted-foreground mb-4">El archivo original se conserva; esta versión tendrá su propio hash.</p>
                <label htmlFor="hoja-comentario-version" className="block text-xs font-semibold text-foreground mb-1.5">Comentario (opcional)</label>
                <textarea
                  id="hoja-comentario-version"
                  autoFocus
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Ej. Ajuste de saldos del cierre del tercer trimestre"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-input-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary mb-5"
                />
                <div className="flex justify-end gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={async () => {
                      if (await guardar(comentario.trim())) {
                        setDialogo(null);
                        setComentario("");
                        enfocar();
                      }
                    }}
                    className="whitespace-nowrap px-4 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                  >
                    Guardar versión
                  </button>
                  <button type="button" onClick={() => { setDialogo(null); enfocar(); }} className="whitespace-nowrap px-4 h-9 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
