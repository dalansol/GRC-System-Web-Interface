
import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  FileSpreadsheet,
  Plus,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";

type CellFormat = "general" | "moneda" | "porcentaje";
type CellAlign  = "left" | "center" | "right";
interface XlsxCell { value: string; bold: boolean; italic: boolean; align: CellAlign; format: CellFormat; }
interface XlsxSheet { name: string; grid: XlsxCell[][]; }
interface XlsxVersionEntry { version: number; author: string; date: string; comment: string; }

// ─── Spreadsheet Editor ──────────────────────────────────────────────────────
const XLSX_COLS = 10;
const XLSX_ROWS = 22;
const XLSX_COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function makeXlsxCell(value = "", opts: Partial<XlsxCell> = {}): XlsxCell {
  return { value, bold: false, italic: false, align: "left", format: "general", ...opts };
}
function makeEmptyXlsxGrid(rows = XLSX_ROWS, cols = XLSX_COLS): XlsxCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => makeXlsxCell()));
}

function getInitialSheets(filename: string): XlsxSheet[] {
  const lower = filename.toLowerCase();
  if (lower.includes("concilia") || lower.includes("bancaria") || lower.includes("banco") || lower.includes("tesor")) {
    const grid = makeEmptyXlsxGrid(17, 6);
    ["Fecha","Concepto","Cargo","Abono","Saldo","Referencia"].forEach((h, c) => { grid[0][c] = makeXlsxCell(h, { bold: true, align: "center" }); });
    [
      ["01/06/2025","Saldo inicial",           "",           "125,000.00","125,000.00","REF-0601"],
      ["03/06/2025","Pago proveedor A",        "12,500.00",  "",          "112,500.00","CHQ-1042"],
      ["05/06/2025","Cobro cliente B",         "",           "38,200.00", "150,700.00","TRF-2208"],
      ["07/06/2025","Nómina quincenal",        "45,000.00",  "",          "105,700.00","NOM-0615"],
      ["10/06/2025","Pago servicios TI",       "8,750.00",   "",          "96,950.00", "CHQ-1043"],
      ["12/06/2025","Cobro factura 4412",      "",           "22,400.00", "119,350.00","TRF-2209"],
      ["15/06/2025","Impuestos ISR",           "31,200.00",  "",          "88,150.00", "SAT-0615"],
      ["17/06/2025","Cobro anticipo",          "",           "15,000.00", "103,150.00","TRF-2211"],
      ["20/06/2025","Pago renta oficinas",     "18,500.00",  "",          "84,650.00", "CHQ-1044"],
      ["22/06/2025","Venta activo fijo",       "",           "9,800.00",  "94,450.00", "TRF-2213"],
      ["24/06/2025","Pago seguros",            "4,200.00",   "",          "90,250.00", "CHQ-1045"],
      ["26/06/2025","Cobro cliente D",         "",           "55,000.00", "145,250.00","TRF-2215"],
      ["28/06/2025","Pago mantenimiento",      "3,100.00",   "",          "142,150.00","CHQ-1046"],
      ["30/06/2025","Cierre de mes",           "",           "",          "142,150.00","CIE-0630"],
      ["30/06/2025","TOTAL",                   "123,250.00", "265,400.00","142,150.00",""],
    ].forEach((r, i) => r.forEach((v, c) => { grid[i+1][c] = makeXlsxCell(v, { align: c >= 2 && c <= 4 ? "right" : "left", bold: i === 14 }); }));
    return [
      { name: "Conciliación", grid },
      { name: "Detalle",      grid: makeEmptyXlsxGrid() },
      { name: "Resumen",      grid: makeEmptyXlsxGrid() },
    ];
  }
  if (lower.includes("riesgo") || lower.includes("matriz") || lower.includes("control")) {
    const grid = makeEmptyXlsxGrid(10, 7);
    ["ID","Riesgo","Probabilidad","Impacto","Nivel","Control","Estado"].forEach((h, c) => { grid[0][c] = makeXlsxCell(h, { bold: true, align: "center" }); });
    [
      ["RIE-001","Fraude financiero",         "Alta", "Crítico","Crítico","CTR-001","Activo"],
      ["RIE-002","Acceso no autorizado",       "Media","Alto",   "Alto",  "CTR-002","Activo"],
      ["RIE-003","Error en nómina",            "Baja", "Medio",  "Medio", "CTR-003","Revisión"],
      ["RIE-004","Incumplimiento regulatorio", "Media","Alto",   "Alto",  "CTR-004","Activo"],
      ["RIE-005","Pérdida de datos",           "Baja", "Crítico","Alto",  "CTR-005","Activo"],
    ].forEach((r, i) => r.forEach((v, c) => { grid[i+1][c] = makeXlsxCell(v); }));
    return [{ name: "Matriz", grid }, { name: "Controles", grid: makeEmptyXlsxGrid() }, { name: "Seguimiento", grid: makeEmptyXlsxGrid() }];
  }
  const grid = makeEmptyXlsxGrid();
  ["Referencia","Descripción","Monto","Fecha","Responsable"].forEach((h, c) => { grid[0][c] = makeXlsxCell(h, { bold: true }); });
  return [{ name: "Hoja1", grid }, { name: "Hoja2", grid: makeEmptyXlsxGrid() }];
}

function formatXlsxCell(cell: XlsxCell): string {
  if (!cell.value) return "";
  if (cell.format === "moneda") {
    const n = parseFloat(cell.value.replace(/,/g, ""));
    if (!isNaN(n)) return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  }
  if (cell.format === "porcentaje") {
    const n = parseFloat(cell.value.replace(/%/g, ""));
    if (!isNaN(n)) return `${n}%`;
  }
  return cell.value;
}

function XlsxToolBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors select-none ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
      {children}
    </button>
  );
}

interface SpreadsheetEditorProps {
  filename: string;
  fileVersion?: number;
  entityId: string;
  onClose: () => void;
  onHashUpdate?: (newHash: string, newVersion: number) => void;
}

export default function SpreadsheetEditor({ filename, fileVersion = 3, onClose, onHashUpdate }: SpreadsheetEditorProps) {
  const [sheets, setSheets] = useState<XlsxSheet[]>(() => getInitialSheets(filename));
  const [activeIdx, setActiveIdx] = useState(0);
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editVal, setEditVal] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [version, setVersion] = useState(fileVersion);
  const [showHistory, setShowHistory] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [showVerComment, setShowVerComment] = useState(false);
  const [verComment, setVerComment] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<XlsxVersionEntry | null>(null);
  const [history, setHistory] = useState<XlsxVersionEntry[]>([
    { version: 1, author: "A. Rodríguez", date: "2025-06-10 09:15", comment: "Versión inicial" },
    { version: 2, author: "C. Morales",   date: "2025-07-02 14:30", comment: "Ajuste saldos Q2" },
    { version: 3, author: "M. García",    date: "2025-07-20 11:45", comment: "Revisión cierre mes" },
  ]);
  const editRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const grid = sheets[activeIdx].grid;
  const selCell = grid[sel.r]?.[sel.c] ?? makeXlsxCell();
  const cellId = `${XLSX_COL_LETTERS[sel.c] ?? "?"}${sel.r + 1}`;

  useEffect(() => { if (editing && editRef.current) { editRef.current.focus(); editRef.current.select(); } }, [editing]);

  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [ctxMenu]);

  const patchCell = (r: number, c: number, patch: Partial<XlsxCell>) => {
    setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : {
      ...sh,
      grid: sh.grid.map((row, ri) => ri !== r ? row : row.map((cell, ci) => ci !== c ? cell : { ...cell, ...patch }))
    }));
    setIsDirty(true);
  };

  const commitEdit = () => {
    if (!editing) return;
    patchCell(editing.r, editing.c, { value: editVal });
    setEditing(null);
  };

  const startEdit = (r: number, c: number) => {
    setSel({ r, c });
    setEditing({ r, c });
    setEditVal(grid[r]?.[c]?.value ?? "");
  };

  const moveSel = (dr: number, dc: number) => {
    const maxR = grid.length - 1;
    const maxC = (grid[0]?.length ?? XLSX_COLS) - 1;
    setSel(p => ({ r: Math.max(0, Math.min(maxR, p.r + dr)), c: Math.max(0, Math.min(maxC, p.c + dc)) }));
  };

  const handleGridKey = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter")  { e.preventDefault(); commitEdit(); moveSel(1, 0); }
      else if (e.key === "Tab")    { e.preventDefault(); commitEdit(); moveSel(0, e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") { setEditing(null); }
    } else {
      const nav: Record<string, () => void> = {
        ArrowUp:    () => moveSel(-1, 0),
        ArrowDown:  () => moveSel(1, 0),
        ArrowLeft:  () => moveSel(0, -1),
        ArrowRight: () => moveSel(0, 1),
        Enter: () => startEdit(sel.r, sel.c),
        F2:    () => startEdit(sel.r, sel.c),
        Delete:    () => patchCell(sel.r, sel.c, { value: "" }),
        Backspace:  () => patchCell(sel.r, sel.c, { value: "" }),
      };
      if (nav[e.key]) { e.preventDefault(); nav[e.key](); }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setEditVal(e.key);
        setEditing(sel);
      }
    }
  };

  const doSave = (comment = "") => {
    const newVer = version + 1;
    setVersion(newVer);
    setIsDirty(false);
    const newHash = "sha256:" + Math.random().toString(36).slice(2,10) + "…" + Math.random().toString(36).slice(2,10);
    setHistory(prev => [...prev, { version: newVer, author: "M. García", date: new Date().toLocaleString("es-MX"), comment: comment || "Guardado" }]);
    onHashUpdate?.(newHash, newVer);
    toast.success(`Versión ${newVer} guardada · hash actualizado`);
  };

  const handleClose = () => { if (isDirty) setShowUnsaved(true); else onClose(); };

  const addRow = () => setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: [...sh.grid, Array.from({ length: sh.grid[0]?.length ?? XLSX_COLS }, () => makeXlsxCell())] }));
  const addCol = () => setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.map(row => [...row, makeXlsxCell()]) }));
  const insertRowAt = (r: number, below = false) => {
    const pos = below ? r + 1 : r;
    setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: [...sh.grid.slice(0, pos), Array.from({ length: sh.grid[0]?.length ?? XLSX_COLS }, () => makeXlsxCell()), ...sh.grid.slice(pos)] }));
    setIsDirty(true); setCtxMenu(null);
  };
  const deleteRow = (r: number) => { if (grid.length <= 1) return; setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.filter((_, ri) => ri !== r) })); setIsDirty(true); setCtxMenu(null); };
  const insertColAt = (c: number) => { setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.map(row => [...row.slice(0, c), makeXlsxCell(), ...row.slice(c)]) })); setIsDirty(true); setCtxMenu(null); };
  const deleteCol = (c: number) => { if (grid[0]?.length <= 1) return; setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.map(row => row.filter((_, ci) => ci !== c)) })); setIsDirty(true); setCtxMenu(null); };

  const COL_W = 110; const ROW_H = 28; const HDR_W = 44;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#f4f5f7]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 h-12 bg-[#1a2e4a] text-white flex-shrink-0 shadow-md">
        <FileSpreadsheet size={16} className="text-emerald-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{filename}</span>
            {isDirty && <span className="text-[10px] bg-amber-500/90 text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">Sin guardar</span>}
          </div>
          <div className="text-[10px] text-white/50 leading-none mt-0.5">v{version} · editado por M. García hace 2 h</div>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded text-[10px] text-white/60 border border-white/15 flex-shrink-0">
          <span>Editando con Excel Online (Microsoft 365)</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => doSave()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors">
            <Save size={12} /> Guardar
          </button>
          <button onClick={() => setShowVerComment(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md transition-colors border border-white/20">
            <Plus size={12} /> Nueva versión
          </button>
          <button onClick={() => setShowHistory(h => !h)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border border-white/20 ${showHistory ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
            <Activity size={12} /> Historial
          </button>
          <button onClick={handleClose} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md transition-colors border border-white/20 ml-1">
            <X size={12} /> Cerrar
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 px-3 h-9 bg-white border-b border-border flex-shrink-0">
        <XlsxToolBtn active={selCell.bold}   onClick={() => patchCell(sel.r, sel.c, { bold: !selCell.bold })}   title="Negrita (Ctrl+B)"><span className="font-bold text-xs leading-none">N</span></XlsxToolBtn>
        <XlsxToolBtn active={selCell.italic} onClick={() => patchCell(sel.r, sel.c, { italic: !selCell.italic })} title="Cursiva (Ctrl+I)"><span className="italic text-xs leading-none">K</span></XlsxToolBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <XlsxToolBtn active={selCell.align === "left"}   onClick={() => patchCell(sel.r, sel.c, { align: "left" })}   title="Izquierda"><AlignLeft   size={13} /></XlsxToolBtn>
        <XlsxToolBtn active={selCell.align === "center"} onClick={() => patchCell(sel.r, sel.c, { align: "center" })} title="Centrar"><AlignCenter size={13} /></XlsxToolBtn>
        <XlsxToolBtn active={selCell.align === "right"}  onClick={() => patchCell(sel.r, sel.c, { align: "right" })}  title="Derecha"><AlignRight  size={13} /></XlsxToolBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <select value={selCell.format} onChange={e => patchCell(sel.r, sel.c, { format: e.target.value as CellFormat })}
          className="text-xs border border-border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground h-6">
          <option value="general">General</option>
          <option value="moneda">Moneda</option>
          <option value="porcentaje">Porcentaje</option>
        </select>
        <div className="w-px h-5 bg-border mx-1" />
        <button onClick={addRow} className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><Plus size={11} />Fila</button>
        <button onClick={addCol} className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><Plus size={11} />Columna</button>
      </div>

      {/* ── Formula bar ── */}
      <div className="flex items-center gap-2 px-3 h-8 bg-white border-b border-border flex-shrink-0">
        <div className="w-14 flex-shrink-0 text-xs font-mono font-bold text-primary bg-primary/8 px-2 py-0.5 rounded text-center select-none">{cellId}</div>
        <div className="w-px h-5 bg-border flex-shrink-0" />
        <input
          value={editing ? editVal : selCell.value}
          onChange={e => { if (editing) setEditVal(e.target.value); else { setEditing(sel); setEditVal(e.target.value); } }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } else if (e.key === "Escape") setEditing(null); }}
          placeholder="Contenido de la celda…"
          className="flex-1 text-xs focus:outline-none bg-transparent font-mono text-foreground placeholder:text-muted-foreground/40"
        />
      </div>

      {/* ── Grid + optional history panel ── */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={gridRef} className="flex-1 overflow-auto" onKeyDown={handleGridKey} tabIndex={0} style={{ outline: "none" }}>
          <table className="border-collapse" style={{ tableLayout: "fixed", minWidth: HDR_W + (grid[0]?.length ?? XLSX_COLS) * COL_W }}>
            <thead>
              <tr>
                <th style={{ width: HDR_W, minWidth: HDR_W }} className="bg-[#f0f1f3] border border-[#d0d3d8] text-[10px] text-muted-foreground sticky top-0 z-10" />
                {(grid[0] ?? []).map((_, c) => (
                  <th key={c} style={{ width: COL_W, minWidth: 64 }} className={`bg-[#f0f1f3] border border-[#d0d3d8] text-[10px] font-semibold text-center sticky top-0 z-10 select-none transition-colors ${sel.c === c ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                    {XLSX_COL_LETTERS[c] ?? String(c + 1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => (
                <tr key={r}>
                  <td className={`bg-[#f0f1f3] border border-[#d0d3d8] text-[10px] text-center select-none sticky left-0 z-10 transition-colors ${sel.r === r ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground"}`} style={{ width: HDR_W, height: ROW_H }}>{r + 1}</td>
                  {row.map((cell, c) => {
                    const isSelected = sel.r === r && sel.c === c;
                    const isEditing  = editing?.r === r && editing?.c === c;
                    return (
                      <td key={c}
                        style={{ width: COL_W, height: ROW_H, position: "relative" }}
                        className={`border border-[#d0d3d8] px-1.5 text-xs overflow-hidden select-none cursor-cell ${isSelected ? "outline outline-2 outline-primary outline-offset-[-2px] bg-primary/[0.04] z-10" : "hover:bg-blue-50/40"}`}
                        onClick={() => { commitEdit(); setSel({ r, c }); setEditing(null); }}
                        onDoubleClick={() => startEdit(r, c)}
                        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, r, c }); setSel({ r, c }); }}
                      >
                        {isEditing ? (
                          <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); moveSel(1,0); } else if (e.key === "Tab") { e.preventDefault(); commitEdit(); moveSel(0, e.shiftKey ? -1 : 1); } else if (e.key === "Escape") setEditing(null); }}
                            onBlur={commitEdit}
                            className="absolute inset-0 w-full h-full px-1.5 text-xs border-none bg-white z-20 font-mono focus:outline-none shadow-[0_0_0_2px_#0F4FFF]"
                            style={{ textAlign: cell.align }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center overflow-hidden" style={{ fontWeight: cell.bold ? 700 : 400, fontStyle: cell.italic ? "italic" : "normal", justifyContent: cell.align === "center" ? "center" : cell.align === "right" ? "flex-end" : "flex-start" }}>
                            <span className="truncate text-foreground">{formatXlsxCell(cell)}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* History panel */}
        {showHistory && (
          <div className="w-72 border-l border-border bg-white flex-shrink-0 flex flex-col shadow-inner">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-primary" />
                <div className="text-sm font-bold text-foreground">Historial</div>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"><X size={13} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {[...history].reverse().map(v => (
                <div key={v.version} className={`p-3 rounded-lg border ${v.version === version ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/20"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-bold text-primary">v{v.version}</span>
                        {v.version === version && <span className="text-[10px] bg-primary text-white px-1 rounded font-bold">Actual</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{v.author}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{v.date}</div>
                      {v.comment && <div className="text-xs text-foreground mt-1 italic truncate">"{v.comment}"</div>}
                    </div>
                    {v.version !== version && (
                      <button onClick={() => setConfirmRestore(v)} className="flex-shrink-0 text-[10px] px-2 py-1 border border-border rounded text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                        Restaurar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sheet tabs ── */}
      <div className="flex items-center gap-0 h-8 bg-white border-t border-border flex-shrink-0 overflow-x-auto">
        {sheets.map((sh, i) => (
          <button key={i} onClick={() => setActiveIdx(i)}
            className={`px-4 h-full text-xs font-medium border-r border-border whitespace-nowrap transition-colors ${i === activeIdx ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {sh.name}
          </button>
        ))}
        <button onClick={() => { setSheets(p => [...p, { name: `Hoja${sheets.length + 1}`, grid: makeEmptyXlsxGrid() }]); setActiveIdx(sheets.length); }}
          className="px-3 h-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Plus size={12} />
        </button>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div className="fixed bg-white border border-border rounded-lg shadow-xl py-1 z-[80] w-52" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          {([
            { label: "Insertar fila arriba",  fn: () => insertRowAt(ctxMenu.r, false) },
            { label: "Insertar fila abajo",   fn: () => insertRowAt(ctxMenu.r, true) },
            { label: "Eliminar fila",          fn: () => deleteRow(ctxMenu.r), danger: true },
            null,
            { label: "Insertar columna aquí", fn: () => insertColAt(ctxMenu.c) },
            { label: "Eliminar columna",       fn: () => deleteCol(ctxMenu.c), danger: true },
          ] as (null | { label: string; fn: () => void; danger?: boolean })[]).map((item, i) =>
            item ? (
              <button key={i} onClick={item.fn}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${item.danger ? "text-red-600 hover:bg-red-50" : "text-foreground hover:bg-secondary"}`}>
                {item.label}
              </button>
            ) : <div key={i} className="h-px bg-border my-1" />
          )}
        </div>
      )}

      {/* ── Unsaved changes dialog ── */}
      {showUnsaved && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[75]" />
          <div className="fixed inset-0 z-[76] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle size={16} className="text-amber-600" /></div>
                <div className="text-sm font-bold text-foreground">Cambios sin guardar</div>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Tienes cambios sin guardar en <strong className="text-foreground">{filename}</strong>. ¿Qué deseas hacer?</p>
              <div className="flex gap-2">
                <button onClick={() => { doSave(); setShowUnsaved(false); onClose(); }} className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">Guardar</button>
                <button onClick={() => { setShowUnsaved(false); onClose(); }} className="px-3 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary transition-colors">Descartar</button>
                <button onClick={() => setShowUnsaved(false)} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Nueva versión: comentario ── */}
      {showVerComment && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[75]" />
          <div className="fixed inset-0 z-[76] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="text-sm font-bold text-foreground mb-1">Guardar como nueva versión</div>
              <div className="text-xs text-muted-foreground mb-4">Agrega un comentario opcional para identificar esta versión.</div>
              <textarea value={verComment} onChange={e => setVerComment(e.target.value)}
                placeholder="Ej. Ajuste de saldos cierre Q3…" rows={3}
                className="w-full text-xs px-3 py-2 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white mb-4" />
              <div className="flex gap-2">
                <button onClick={() => { doSave(verComment); setShowVerComment(false); setVerComment(""); }}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                  Guardar versión
                </button>
                <button onClick={() => { setShowVerComment(false); setVerComment(""); }}
                  className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Restaurar confirmación ── */}
      {confirmRestore && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[75]" />
          <div className="fixed inset-0 z-[76] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="text-sm font-bold text-foreground mb-1">Restaurar versión {confirmRestore.version}</div>
              <p className="text-xs text-muted-foreground mb-5">
                ¿Confirmas restaurar <strong>v{confirmRestore.version}</strong>{confirmRestore.comment ? ` — "${confirmRestore.comment}"` : ""}?
                Los cambios actuales sin guardar se perderán.
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setSheets(getInitialSheets(filename)); setVersion(confirmRestore.version); setIsDirty(false); setConfirmRestore(null); toast.success(`Versión ${confirmRestore.version} restaurada correctamente`); }}
                  className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground text-xs font-semibold rounded-lg hover:bg-destructive/90 transition-colors">
                  Restaurar
                </button>
                <button onClick={() => setConfirmRestore(null)} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}