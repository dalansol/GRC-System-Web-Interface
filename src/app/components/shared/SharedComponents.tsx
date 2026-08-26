import { ChevronRight } from "lucide-react";
import React from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
export type View =
  | "dashboard" | "planning" | "audits" | "execution" | "findings"
  | "closure" | "reports" | "follow_up"
  | "record" | "editor" | "hierarchy" | "admin";

export type StatusKey = "completed" | "in_progress" | "overdue" | "pending";

export interface Task {
  id: string; name: string; status: StatusKey;
  dueDate: string; owner: string; type: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<StatusKey, { label: string; color: string; bg: string; dot: string }> = {
  completed:   { label: "Completado",   color: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-200", dot: "bg-emerald-500" },
  in_progress: { label: "En Progreso",  color: "text-amber-700",   bg: "bg-amber-50 border border-amber-200",     dot: "bg-amber-500"   },
  overdue:     { label: "Vencido",      color: "text-red-700",     bg: "bg-red-50 border border-red-200",          dot: "bg-red-500"     },
  pending:     { label: "Pendiente",    color: "text-slate-600",   bg: "bg-slate-50 border border-slate-200",     dot: "bg-slate-400"   },
};

export const NIVEL_COLOR: Record<string, string> = {
  Crítico: "text-red-700 bg-red-50 border border-red-200",
  Alto:    "text-orange-700 bg-orange-50 border border-orange-200",
  Medio:   "text-amber-700 bg-amber-50 border border-amber-200",
  Bajo:    "text-emerald-700 bg-emerald-50 border border-emerald-200",
};

// ─── Shared Components ───────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: StatusKey }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function NivelBadge({ nivel }: { nivel: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${NIVEL_COLOR[nivel] ?? "bg-slate-100 text-slate-600"}`}>
      {nivel}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={12} className="text-muted-foreground/50" />}
          <span className={i === items.length - 1 ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer transition-colors"}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-lg border border-border shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionCard({ title, count, icon, children, action }: {
  title: string; count?: number; icon?: React.ReactNode;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {count !== undefined && (
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">{count}</span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </Card>
  );
}

export function PrimaryBtn({ children, onClick, icon, small, type = "button" }: {
  children: React.ReactNode; onClick?: () => void;
  icon?: React.ReactNode; small?: boolean; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors active:scale-[0.98] ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      {icon}{children}
    </button>
  );
}

export function GhostBtn({ children, onClick, icon, small }: {
  children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-transparent text-foreground border border-border font-medium rounded-md hover:bg-secondary transition-colors ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      {icon}{children}
    </button>
  );
}

export function DangerBtn({ children, onClick, small }: {
  children: React.ReactNode; onClick?: () => void; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, subtitle, action }: {
  icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-muted-foreground/30 mb-4">{icon}</div>
      <div className="text-base font-bold text-foreground mb-1">{title}</div>
      {subtitle && <div className="text-sm text-muted-foreground max-w-xs">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StepIndicator({ steps, current }: {
  steps: { label: string; sublabel?: string }[];
  current: number;
}) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                done ? "bg-emerald-500 text-white" : active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                {done ? "✓" : i + 1}
              </div>
              <div className={`text-xs font-medium mt-1 text-center ${active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
                {step.label}
              </div>
              {step.sublabel && <div className="text-[10px] text-muted-foreground/70 text-center">{step.sublabel}</div>}
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${i < current ? "bg-emerald-500" : "bg-border"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function RiskGauge({ value, max = 25, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 20 ? "#C8271C" : value >= 12 ? "#d97706" : value >= 6 ? "#eab308" : "#16a34a";
  const levelLabel = value >= 20 ? "Crítico" : value >= 12 ? "Alto" : value >= 6 ? "Medio" : "Bajo";
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F3" strokeWidth="12" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={`${pct * 2.513} 251.3`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold text-foreground" style={{ color }}>{value}</div>
          <div className="text-[9px] text-muted-foreground">/{max}</div>
        </div>
      </div>
      <div className="text-xs font-semibold mt-1" style={{ color }}>{levelLabel}</div>
      {label && <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, color = "#1A4FA0", showLabel = true }: {
  value: number; max: number; color?: string; showLabel?: boolean;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{value} / {max}</span>
          <span className="font-semibold" style={{ color }}>{pct}%</span>
        </div>
      )}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export const FONT_STYLE = { fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" };
