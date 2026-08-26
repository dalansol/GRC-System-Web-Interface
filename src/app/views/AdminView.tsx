import { useState } from "react";
import {
  Users, Settings, Calendar, Shield, Building2, Book,
  Search, Plus, Check, X, ChevronDown, ChevronUp, Save,
  Eye, EyeOff, Clock, FileText, AlertTriangle, Filter
} from "lucide-react";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  StatusBadge, ProgressBar, FONT_STYLE
} from "../components/shared/SharedComponents";

// ─── Data ─────────────────────────────────────────────────────────────────────
type AdminTab = "roles" | "periods" | "risk_model" | "org" | "competencies" | "audit_log";

const ROLES = [
  { id: "R1", name: "Director de Auditoría", permissions: ["all"],             users: 1 },
  { id: "R2", name: "Gerente de Auditoría",  permissions: ["execute","report"], users: 2 },
  { id: "R3", name: "Jefe de Auditoría",     permissions: ["execute","report"], users: 3 },
  { id: "R4", name: "Auditor Senior",         permissions: ["execute"],          users: 5 },
  { id: "R5", name: "Auditor",               permissions: ["execute"],          users: 12 },
  { id: "R6", name: "Auditado (Negocio)",    permissions: ["view","respond"],   users: 85 },
  { id: "R7", name: "Solo Lectura",          permissions: ["view"],             users: 15 },
];

const PERMISSION_LABELS: Record<string, { label: string; color: string }> = {
  all:     { label: "Administración Total", color: "bg-red-50 text-red-700 border border-red-200" },
  execute: { label: "Ejecutar Auditorías",  color: "bg-blue-50 text-blue-700 border border-blue-200" },
  report:  { label: "Generar Reportes",     color: "bg-violet-50 text-violet-700 border border-violet-200" },
  view:    { label: "Solo Lectura",         color: "bg-slate-50 text-slate-600 border border-slate-200" },
  respond: { label: "Responder Req.",       color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

const USERS_TABLE = [
  { name: "D. Villanueva", email: "d.villanueva@femsa.com", role: "Director de Auditoría", status: "active", lastLogin: "2025-07-21 09:42" },
  { name: "R. Sánchez",    email: "r.sanchez@femsa.com",    role: "Gerente de Auditoría",  status: "active", lastLogin: "2025-07-21 08:15" },
  { name: "M. García",     email: "m.garcia@femsa.com",     role: "Jefe de Auditoría",     status: "active", lastLogin: "2025-07-21 09:00" },
  { name: "L. Herrera",    email: "l.herrera@femsa.com",    role: "Auditor Senior",        status: "active", lastLogin: "2025-07-20 17:30" },
  { name: "P. Morales",    email: "p.morales@femsa.com",    role: "Auditor Senior",        status: "active", lastLogin: "2025-07-21 10:05" },
  { name: "A. Costa",      email: "a.costa@femsa.com",      role: "Auditor",               status: "active", lastLogin: "2025-07-19 16:00" },
  { name: "R. Jiménez",    email: "r.jimenez@femsa.com",    role: "Auditor",               status: "inactive", lastLogin: "2025-07-15 12:00" },
];

const PERIODS = [
  { id: "P2025", name: "Período 2025", start: "2025-01-01", end: "2025-12-31", status: "open",   audits: 9  },
  { id: "P2024", name: "Período 2024", start: "2024-01-01", end: "2024-12-31", status: "closed", audits: 22 },
  { id: "P2023", name: "Período 2023", start: "2023-01-01", end: "2023-12-31", status: "closed", audits: 18 },
];

const AUDIT_LOG_ENTRIES = [
  { user: "M. García",   action: "Aprobó plan de acción PA-001",             entity: "AUD-2025-041", time: "2025-07-21 09:45", type: "approval" },
  { user: "L. Herrera",  action: "Adjuntó evidencia CTR-1041",               entity: "AUD-2025-041", time: "2025-07-21 09:12", type: "document" },
  { user: "D. Villanueva",action: "Modificó modelo de riesgo residual",     entity: "Configuración", time: "2025-07-20 18:30", type: "config"   },
  { user: "A. Costa",    action: "Creó hallazgo HAL-2025-002",               entity: "AUD-2025-041", time: "2025-07-20 15:00", type: "create"   },
  { user: "Sistema",     action: "Notificación enviada: PA-003 vencido",     entity: "PA-003",        time: "2025-07-20 08:00", type: "system"   },
  { user: "R. Sánchez",  action: "Rechazó cierre parcial AUD-2025-038",      entity: "AUD-2025-038", time: "2025-07-19 17:45", type: "approval" },
  { user: "P. Morales",  action: "Actualizó walkthrough WT-02",              entity: "AUD-2025-041", time: "2025-07-19 14:20", type: "edit"     },
];

const LOG_TYPE_COLORS: Record<string, string> = {
  approval: "bg-emerald-50 text-emerald-700",
  document: "bg-blue-50 text-blue-700",
  config:   "bg-violet-50 text-violet-700",
  create:   "bg-amber-50 text-amber-700",
  system:   "bg-slate-50 text-slate-600",
  edit:     "bg-cyan-50 text-cyan-700",
};

const CERTS = ["CIA","CPA","CISA","CFE","CRMA","CISSP","CMA"];

const AUDITORS_COMP = [
  { name: "M. García",  role: "Jefe",    certs: ["CIA","CPA"],      trainings: 3, hoursYTD: 240, targetHours: 250 },
  { name: "L. Herrera", role: "Sr.",     certs: ["CISA","CIA"],     trainings: 2, hoursYTD: 310, targetHours: 300 },
  { name: "P. Morales", role: "Sr.",     certs: ["CIA"],            trainings: 1, hoursYTD: 190, targetHours: 250 },
  { name: "A. Costa",   role: "Sr.",     certs: ["CFE"],            trainings: 2, hoursYTD: 220, targetHours: 250 },
  { name: "R. Jiménez", role: "Jr.",     certs: ["CPA"],            trainings: 4, hoursYTD: 140, targetHours: 200 },
];

const ADMIN_TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: "roles",        label: "Roles & Accesos",    icon: <Users size={14} /> },
  { id: "periods",      label: "Períodos",            icon: <Calendar size={14} /> },
  { id: "risk_model",  label: "Modelo de Riesgo",    icon: <Shield size={14} /> },
  { id: "org",          label: "Estructura Org.",    icon: <Building2 size={14} /> },
  { id: "competencies", label: "Competencias",       icon: <Book size={14} /> },
  { id: "audit_log",   label: "Bitácora",            icon: <FileText size={14} /> },
];

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<AdminTab>("roles");
  const [searchUsers, setSearchUsers] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [savedModel, setSavedModel] = useState(false);
  const [probWeight, setProbWeight] = useState(50);
  const [impactWeight, setImpactWeight] = useState(50);
  const [logFilter, setLogFilter] = useState("all");

  const filteredUsers = USERS_TABLE.filter(u =>
    !searchUsers || u.name.toLowerCase().includes(searchUsers.toLowerCase()) || u.email.toLowerCase().includes(searchUsers.toLowerCase())
  );

  const saveModel = () => {
    setSavedModel(true);
    setTimeout(() => setSavedModel(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Inicio", "Administración"]} />
      <PageHeader
        title="Administración de la Plataforma"
        subtitle="Configuración de accesos, períodos, modelos de riesgo y bitácora del sistema"
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-5 w-fit flex-wrap">
        {ADMIN_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${activeTab === t.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── ROLES & ACCESS ── */}
      {activeTab === "roles" && (
        <div className="grid grid-cols-3 gap-4">
          {/* Role list */}
          <div className="space-y-3">
            <SectionCard title="Roles del Sistema" count={ROLES.length} icon={<Shield size={14} />}
              action={<PrimaryBtn small icon={<Plus size={11} />}>Nuevo Rol</PrimaryBtn>}>
              <div className="divide-y divide-border">
                {ROLES.map(role => (
                  <div key={role.id} className="px-4 py-3 hover:bg-secondary/20 cursor-pointer group transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{role.name}</div>
                      <span className="text-xs font-mono text-muted-foreground">{role.users} usu.</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map(perm => {
                        const pl = PERMISSION_LABELS[perm];
                        return (
                          <span key={perm} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pl.color}`}>{pl.label}</span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Users table */}
          <div className="col-span-2">
            <SectionCard title="Usuarios" count={USERS_TABLE.length} icon={<Users size={14} />}
              action={
                <div className="flex gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={searchUsers} onChange={e => setSearchUsers(e.target.value)}
                      placeholder="Buscar usuario…"
                      className="text-xs bg-input-background border border-border rounded-md pl-7 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 w-40" />
                  </div>
                  <PrimaryBtn small icon={<Plus size={11} />} onClick={() => setShowAddUser(true)}>Agregar</PrimaryBtn>
                </div>
              }>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Nombre", "Email", "Rol", "Último acceso", "Estado", ""].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map(u => (
                      <tr key={u.email} className="hover:bg-secondary/20 group transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                              {u.name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <span className="text-sm font-medium text-foreground">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.email}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.role}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{u.lastLogin}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-500 border border-slate-200"}`}>
                            {u.status === "active" ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button className="text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                            <Settings size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── PERIODS ── */}
      {activeTab === "periods" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Gestión de períodos de auditoría — apertura y cierre</div>
            <PrimaryBtn small icon={<Plus size={12} />}>Crear Período</PrimaryBtn>
          </div>
          {PERIODS.map(p => (
            <Card key={p.id} className="p-4 flex items-center gap-4">
              <div className={`w-3 h-14 rounded-full flex-shrink-0 ${p.status === "open" ? "bg-emerald-500" : "bg-slate-300"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <div className="text-base font-bold text-foreground">{p.name}</div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === "open" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-500 border border-slate-200"}`}>
                    {p.status === "open" ? "Abierto" : "Cerrado"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{p.start} — {p.end} · {p.audits} auditorías</div>
              </div>
              <div className="flex gap-2">
                {p.status === "open" ? (
                  <button className="text-xs px-3 py-1.5 rounded-md font-semibold border border-red-300 text-red-700 hover:bg-red-50 transition-colors">
                    Cerrar Período
                  </button>
                ) : (
                  <GhostBtn small><Eye size={12} />Ver</GhostBtn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── RISK MODEL ── */}
      {activeTab === "risk_model" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield size={14} className="text-primary" /> Modelo de Cálculo de Riesgo Residual
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                    Fórmula Base
                  </label>
                  <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                    <option>Probabilidad × Impacto (matricial)</option>
                    <option>Weighted Average (ponderado)</option>
                    <option>ISO 31000 (cualitativo)</option>
                    <option>COSO ERM (mixto)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                    Peso: Probabilidad — {probWeight}%
                  </label>
                  <input type="range" min={10} max={90} value={probWeight}
                    onChange={e => { setProbWeight(Number(e.target.value)); setImpactWeight(100 - Number(e.target.value)); }}
                    className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Probabilidad {probWeight}%</span>
                    <span>Impacto {impactWeight}%</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Escala de Calificación</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["1 - Muy Baja / Muy Bajo", "2 - Baja / Bajo", "3 - Media / Moderado", "4 - Alta / Alto", "5 - Muy Alta / Muy Alto"].map(s => (
                      <div key={s} className="text-xs bg-muted/40 rounded px-2 py-1.5 text-muted-foreground">{s}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Umbrales de Nivel</label>
                  <div className="space-y-1.5">
                    {[
                      { level: "Crítico", range: "20–25", color: "text-red-700 bg-red-50 border-red-200" },
                      { level: "Alto",    range: "12–19", color: "text-orange-700 bg-orange-50 border-orange-200" },
                      { level: "Medio",   range: "6–11",  color: "text-amber-700 bg-amber-50 border-amber-200" },
                      { level: "Bajo",    range: "1–5",   color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    ].map(t => (
                      <div key={t.level} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${t.color}`}>
                        <span className="text-xs font-semibold">{t.level}</span>
                        <span className="text-xs font-mono">{t.range}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={saveModel}
                  className={`w-full py-2 rounded-md font-semibold text-sm transition-all ${savedModel ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                  {savedModel ? <><Check size={14} className="inline mr-1.5" />Guardado</> : <><Save size={14} className="inline mr-1.5" />Guardar Configuración</>}
                </button>
              </div>
            </Card>
          </div>

          {/* Preview matrix */}
          <Card className="p-5">
            <div className="text-sm font-semibold text-foreground mb-4">Vista Previa — Matriz de Riesgo 5×5</div>
            <div className="overflow-auto">
              <table className="text-center text-xs w-full">
                <thead>
                  <tr>
                    <th className="p-1 text-muted-foreground">P\I</th>
                    {[1,2,3,4,5].map(n => <th key={n} className="p-2 font-semibold text-muted-foreground">{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[5,4,3,2,1].map(prob => (
                    <tr key={prob}>
                      <td className="p-1 font-semibold text-muted-foreground">{prob}</td>
                      {[1,2,3,4,5].map(impact => {
                        const score = prob * impact;
                        const color = score >= 20 ? "bg-red-500 text-white" : score >= 12 ? "bg-orange-400 text-white" : score >= 6 ? "bg-amber-300 text-amber-900" : "bg-emerald-200 text-emerald-800";
                        return (
                          <td key={impact} className={`p-2 rounded font-bold ${color}`}>{score}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── COMPETENCIES ── */}
      {activeTab === "competencies" && (
        <div className="space-y-4">
          <SectionCard title="Gestión de Competencias" icon={<Book size={14} />} count={AUDITORS_COMP.length}>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Auditor", "Rol", "Certificaciones", "Capacitaciones YTD", "Horas Formación", "Acciones"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {AUDITORS_COMP.map(a => (
                    <tr key={a.name} className="hover:bg-secondary/20 group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                            {a.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <span className="text-sm font-medium text-foreground">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.role}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {a.certs.map(c => (
                            <span key={c} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">{c}</span>
                          ))}
                          <button className="text-[10px] text-accent hover:underline flex items-center gap-0.5"><Plus size={9} />Agregar</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-foreground">{a.trainings}</span>
                        <span className="text-xs text-muted-foreground ml-1">cap.</span>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <ProgressBar value={a.hoursYTD} max={a.targetHours}
                          color={a.hoursYTD >= a.targetHours ? "#16a34a" : "#1A4FA0"} />
                        <div className="text-[10px] text-muted-foreground mt-0.5">{a.hoursYTD}h / {a.targetHours}h</div>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100">
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {activeTab === "audit_log" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input placeholder="Buscar en bitácora…"
                className="w-full text-sm bg-card border border-border rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
            </div>
            <div className="flex gap-1">
              <Filter size={13} className="text-muted-foreground" />
              {["all","approval","document","config","create","system","edit"].map(t => (
                <button key={t} onClick={() => setLogFilter(t)}
                  className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors capitalize ${logFilter === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                  {t === "all" ? "Todos" : t}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <div className="px-4 pt-4 pb-2 border-b border-border flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Bitácora de Actividad</span>
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium ml-1">{AUDIT_LOG_ENTRIES.length} entradas (últimas 24h)</span>
            </div>
            <div className="divide-y divide-border">
              {AUDIT_LOG_ENTRIES.filter(e => logFilter === "all" || e.type === logFilter).map((entry, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0 mt-0.5">
                    {entry.user === "Sistema" ? "SY" : entry.user.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{entry.user}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize ${LOG_TYPE_COLORS[entry.type] ?? ""}`}>{entry.type}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{entry.action}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                      {entry.entity} · {entry.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── ORG STRUCTURE ── */}
      {activeTab === "org" && (
        <Card className="p-5">
          <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 size={14} className="text-primary" />Estructura Organizacional
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-4 mb-4">
            Configuración de la jerarquía organizacional utilizada en el Catálogo de Auditorías y asignación de riesgos.
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["Negocio", "Unidad de Negocio", "División", "Área", "País", "Proceso"].map(level => (
              <div key={level} className="bg-muted/30 rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-foreground mb-1">{level}</div>
                <div className="text-xs text-muted-foreground">Configurable · {level === "Negocio" ? "3" : level === "Unidad de Negocio" ? "6" : level === "División" ? "11" : level === "Área" ? "24" : level === "País" ? "8" : "47"} registros</div>
                <button className="text-xs text-accent hover:underline mt-2 flex items-center gap-1"><Plus size={9} />Agregar</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card rounded-xl shadow-2xl w-[440px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-base font-bold text-foreground">Agregar Usuario</div>
              <button onClick={() => setShowAddUser(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: "Nombre Completo", type: "text", placeholder: "Ej. Ana Martínez" },
                { label: "Correo Corporativo", type: "email", placeholder: "a.martinez@femsa.com" },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Rol</label>
                <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                  {ROLES.map(r => <option key={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <GhostBtn onClick={() => setShowAddUser(false)}>Cancelar</GhostBtn>
              <PrimaryBtn icon={<Save size={14} />} onClick={() => setShowAddUser(false)}>Crear Usuario</PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
