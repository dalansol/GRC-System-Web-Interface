import { esFormula } from "./calculo";
import { escribir, saltoCtrl, ultimaCeldaUsada } from "./operaciones";
import { nombreCelda, nombreRango } from "./referencias";
import { desplazarFormula, normalizarFormula } from "./reescritura";
import { prefijoHoja } from "./tokens";
import { claveCelda, normalizarRango, type Libro, type Posicion, type Rango } from "./tipos";

// Estado del editor como reducer puro (ViewModel). La vista solo despacha acciones.

export interface Seleccion {
  /** Celda activa (donde se escribe); siempre dentro del rango. */
  activa: Posicion;
  /** Esquinas del rango: `ancla` queda fija al extender con Mayús y `extremo` se mueve. */
  ancla: Posicion;
  extremo: Posicion;
}

export interface Edicion {
  texto: string;
  /** "escribir": las flechas confirman o señalan; "editar" (F2): las flechas mueven el cursor. */
  modo: "escribir" | "editar";
  origen: "celda" | "barra";
  /** Referencia que se está señalando con flechas o ratón dentro de la fórmula. */
  punto?: { inicio: number; activa: Posicion; extremo: Posicion; hoja: number };
  /** Hoja donde se empezó a editar (al señalar en otra hoja se vuelve a ella al confirmar). */
  hoja: number;
}

interface Instantanea {
  libro: Libro;
  hojaActiva: number;
  sel: Seleccion;
}

export interface EstadoHoja {
  libro: Libro;
  hojaActiva: number;
  sel: Seleccion;
  edicion: Edicion | null;
  copia: { hoja: number; rango: Rango; cortar: boolean } | null;
  pasado: Instantanea[];
  futuro: Instantanea[];
  libroGuardado: Libro;
  zoom: number;
  cuadricula: boolean;
  soloLectura: boolean;
}

export type AccionHoja =
  | { tipo: "seleccionar"; pos: Posicion; extender?: boolean }
  | { tipo: "seleccionarRango"; activa: Posicion; extremo: Posicion }
  | { tipo: "mover"; df: number; dc: number; extender?: boolean; salto?: boolean }
  | { tipo: "moverEnRango"; df: number; dc: number }
  | { tipo: "inicio"; ctrl: boolean; extender?: boolean }
  | { tipo: "fin" }
  | { tipo: "cambiarHoja"; idx: number }
  | { tipo: "iniciarEdicion"; modo: Edicion["modo"]; texto?: string; origen?: Edicion["origen"] }
  | { tipo: "textoEdicion"; texto: string }
  | { tipo: "confirmarEdicion"; df: number; dc: number; enRango?: boolean }
  | { tipo: "cancelarEdicion" }
  | { tipo: "senalar"; pos: Posicion; extender?: boolean }
  | { tipo: "senalarMover"; df: number; dc: number; extender?: boolean }
  | { tipo: "aplicar"; libro: Libro; sel?: Seleccion; hojaActiva?: number }
  | { tipo: "deshacer" }
  | { tipo: "rehacer" }
  | { tipo: "marcarCopia"; rango: Rango | null; cortar?: boolean }
  | { tipo: "zoom"; valor: number }
  | { tipo: "cuadricula"; visible: boolean }
  | { tipo: "guardado"; libro?: Libro };

const LIMITE_HISTORIAL = 100;

export function estadoInicial(libro: Libro, soloLectura = false): EstadoHoja {
  const origen = { f: 0, c: 0 };
  return {
    libro,
    hojaActiva: 0,
    sel: celdaUnica(origen),
    edicion: null,
    copia: null,
    pasado: [],
    futuro: [],
    libroGuardado: libro,
    zoom: 1,
    cuadricula: true,
    soloLectura,
  };
}

export function celdaUnica(pos: Posicion): Seleccion {
  return { activa: pos, ancla: pos, extremo: pos };
}

export function rangoSeleccion(sel: Seleccion): Rango {
  return normalizarRango(sel.ancla, sel.extremo);
}

function extenderA(sel: Seleccion, pos: Posicion): Seleccion {
  // Al extender, la celda activa vuelve al ancla (como Excel con Mayús+flechas).
  return { activa: sel.ancla, ancla: sel.ancla, extremo: pos };
}

export function haySinGuardar(e: EstadoHoja): boolean {
  return e.libro !== e.libroGuardado;
}

/** ¿El texto de edición admite insertar una referencia al final (modo Señalar)? */
export function puedeSenalar(ed: Edicion | null, conRaton = false): boolean {
  // Con flechas solo se señala en modo Escribir; con el ratón también desde la barra de fórmulas.
  if (!ed || (!conRaton && ed.modo !== "escribir") || !ed.texto.startsWith("=")) return false;
  if (ed.punto) return true;
  const ultimo = ed.texto.trimEnd().slice(-1);
  return "=(+-*/^&,;<>:".includes(ultimo);
}

// Límites de Excel; la vista crece conforme el usuario se desplaza o selecciona.
export const MAX_FILAS = 1_048_576;
export const MAX_COLUMNAS = 16_384;

function limitar(_e: EstadoHoja, p: Posicion): Posicion {
  return { f: Math.max(0, Math.min(MAX_FILAS - 1, p.f)), c: Math.max(0, Math.min(MAX_COLUMNAS - 1, p.c)) };
}

function conHistorial(e: EstadoHoja, libro: Libro, cambios: Partial<EstadoHoja> = {}): EstadoHoja {
  if (libro === e.libro) return { ...e, ...cambios };
  const pasado = [...e.pasado, { libro: e.libro, hojaActiva: e.hojaActiva, sel: e.sel }].slice(-LIMITE_HISTORIAL);
  return { ...e, ...cambios, libro, pasado, futuro: [] };
}

function textoReferencia(e: EstadoHoja, ed: Edicion, punto: NonNullable<Edicion["punto"]>): string {
  const r = normalizarRango(punto.activa, punto.extremo);
  const prefijo = punto.hoja !== ed.hoja ? prefijoHoja(e.libro.hojas[punto.hoja].nombre) : "";
  return prefijo + nombreRango(r);
}

function senalar(e: EstadoHoja, activa: Posicion, extremo: Posicion): EstadoHoja {
  const ed = e.edicion!;
  const inicio = ed.punto?.inicio ?? ed.texto.length;
  const punto = { inicio, activa, extremo, hoja: e.hojaActiva };
  const texto = ed.texto.slice(0, inicio) + textoReferencia(e, ed, punto);
  return { ...e, edicion: { ...ed, texto, punto } };
}

export function reducirHoja(e: EstadoHoja, a: AccionHoja): EstadoHoja {
  const hoja = e.libro.hojas[e.hojaActiva];
  switch (a.tipo) {
    case "seleccionar": {
      const pos = limitar(e, a.pos);
      return { ...e, sel: a.extender ? extenderA(e.sel, pos) : celdaUnica(pos) };
    }
    case "seleccionarRango": {
      const activa = limitar(e, a.activa);
      return { ...e, sel: { activa, ancla: activa, extremo: limitar(e, a.extremo) } };
    }

    case "mover": {
      const desde = a.extender ? e.sel.extremo : e.sel.activa;
      const destino = a.salto ? saltoCtrl(hoja, desde.f, desde.c, Math.sign(a.df), Math.sign(a.dc)) : { f: desde.f + a.df, c: desde.c + a.dc };
      const pos = limitar(e, destino);
      return { ...e, sel: a.extender ? extenderA(e.sel, pos) : celdaUnica(pos) };
    }

    case "moverEnRango": {
      // Enter/Tab con varias celdas seleccionadas recorren el rango sin perderlo, como Excel.
      const r = rangoSeleccion(e.sel);
      if (r.f1 === r.f2 && r.c1 === r.c2) return reducirHoja(e, { tipo: "mover", df: a.df, dc: a.dc });
      let { f, c } = e.sel.activa;
      if (a.df !== 0) {
        f += a.df;
        if (f > r.f2) { f = r.f1; c = c + 1 > r.c2 ? r.c1 : c + 1; }
        if (f < r.f1) { f = r.f2; c = c - 1 < r.c1 ? r.c2 : c - 1; }
      } else {
        c += a.dc;
        if (c > r.c2) { c = r.c1; f = f + 1 > r.f2 ? r.f1 : f + 1; }
        if (c < r.c1) { c = r.c2; f = f - 1 < r.f1 ? r.f2 : f - 1; }
      }
      return { ...e, sel: { ...e.sel, activa: { f, c } } };
    }

    case "inicio": {
      const desde = a.extender ? e.sel.extremo : e.sel.activa;
      const pos = { f: a.ctrl ? 0 : desde.f, c: 0 };
      return { ...e, sel: a.extender ? extenderA(e.sel, pos) : celdaUnica(pos) };
    }
    case "fin": {
      return { ...e, sel: celdaUnica(ultimaCeldaUsada(hoja)) };
    }

    case "cambiarHoja": {
      if (a.idx === e.hojaActiva || !e.libro.hojas[a.idx]) return e;
      // Señalando una fórmula se puede ir a otra hoja sin perder la edición.
      if (e.edicion && puedeSenalar(e.edicion, true)) return { ...e, hojaActiva: a.idx };
      const base = e.edicion ? reducirHoja(e, { tipo: "confirmarEdicion", df: 0, dc: 0 }) : e;
      return { ...base, hojaActiva: a.idx, sel: celdaUnica({ f: 0, c: 0 }) };
    }

    case "iniciarEdicion": {
      if (e.soloLectura) return e;
      const actual = hoja.celdas[claveCelda(e.sel.activa.f, e.sel.activa.c)]?.entrada ?? "";
      return {
        ...e,
        edicion: { texto: a.texto ?? actual, modo: a.modo, origen: a.origen ?? "celda", hoja: e.hojaActiva },
      };
    }

    case "textoEdicion":
      if (!e.edicion) return e;
      // Escribir algo después de señalar fija la referencia.
      return { ...e, edicion: { ...e.edicion, texto: a.texto, punto: undefined } };

    case "cancelarEdicion":
      return e.edicion ? { ...e, edicion: null, hojaActiva: e.edicion.hoja } : e;

    case "confirmarEdicion": {
      const ed = e.edicion;
      if (!ed) return reducirHoja(e, { tipo: "moverEnRango", df: a.df, dc: a.dc });
      const idx = ed.hoja;
      const texto = esFormula(ed.texto) ? normalizarFormula(ed.texto) : ed.texto;
      const { activa } = e.sel;
      let libro = e.libro;
      const r = rangoSeleccion(e.sel);
      if (a.enRango) {
        // Ctrl+Enter: escribe en todo el rango desplazando la fórmula a cada celda.
        for (let f = r.f1; f <= r.f2; f++) {
          for (let c = r.c1; c <= r.c2; c++) libro = escribir(libro, idx, f, c, desplazarFormula(texto, f - activa.f, c - activa.c));
        }
      } else {
        const actual = e.libro.hojas[idx].celdas[claveCelda(activa.f, activa.c)]?.entrada ?? "";
        if (texto !== actual) libro = escribir(libro, idx, activa.f, activa.c, texto);
      }
      // Como en Excel, escribir en una celda termina el modo copiar (desaparece el marco).
      const confirmado = conHistorial({ ...e, hojaActiva: idx }, libro, {
        edicion: null,
        ...(libro !== e.libro ? { copia: null } : {}),
      });
      if (a.enRango || (a.df === 0 && a.dc === 0)) return confirmado;
      return reducirHoja(confirmado, { tipo: "moverEnRango", df: a.df, dc: a.dc });
    }

    case "senalar": {
      if (!puedeSenalar(e.edicion, true)) return e;
      const pos = limitar(e, a.pos);
      const punto = e.edicion!.punto;
      if (a.extender && punto) return senalar(e, punto.activa, pos);
      return senalar(e, pos, pos);
    }

    case "senalarMover": {
      if (!puedeSenalar(e.edicion)) return e;
      const ed = e.edicion!;
      const base = ed.punto ?? { activa: e.sel.activa, extremo: e.sel.activa };
      if (a.extender) {
        const extremo = limitar(e, { f: base.extremo.f + a.df, c: base.extremo.c + a.dc });
        return senalar(e, base.activa, extremo);
      }
      const pos = limitar(e, { f: base.activa.f + a.df, c: base.activa.c + a.dc });
      return senalar(e, pos, pos);
    }

    case "aplicar":
      if (e.soloLectura) return e;
      return conHistorial(e, a.libro, {
        ...(a.sel ? { sel: a.sel } : {}),
        ...(a.hojaActiva !== undefined ? { hojaActiva: a.hojaActiva } : {}),
      });

    case "deshacer": {
      const previo = e.pasado[e.pasado.length - 1];
      if (!previo) return e;
      return {
        ...e,
        ...previo,
        edicion: null,
        pasado: e.pasado.slice(0, -1),
        futuro: [{ libro: e.libro, hojaActiva: e.hojaActiva, sel: e.sel }, ...e.futuro],
      };
    }
    case "rehacer": {
      const [siguiente, ...resto] = e.futuro;
      if (!siguiente) return e;
      return {
        ...e,
        ...siguiente,
        edicion: null,
        futuro: resto,
        pasado: [...e.pasado, { libro: e.libro, hojaActiva: e.hojaActiva, sel: e.sel }],
      };
    }

    case "marcarCopia":
      return { ...e, copia: a.rango ? { hoja: e.hojaActiva, rango: a.rango, cortar: !!a.cortar } : null };
    case "zoom":
      return { ...e, zoom: Math.max(0.5, Math.min(2, Math.round(a.valor * 100) / 100)) };
    case "cuadricula":
      return { ...e, cuadricula: a.visible };
    case "guardado":
      // Se marca como guardado el libro que se serializó (pudo cambiar mientras se subía).
      return { ...e, libroGuardado: a.libro ?? e.libro };
  }
}

export function nombreCeldaActiva(e: EstadoHoja): string {
  return nombreCelda(e.sel.activa.f, e.sel.activa.c);
}
