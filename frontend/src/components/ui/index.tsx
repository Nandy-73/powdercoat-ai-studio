import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`glass p-5 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </motion.section>
  );
}

const badgeStyles: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  blue: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeStyles[tone] ?? badgeStyles.slate}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): string {
  const map: Record<string, string> = {
    draft: "slate",
    trial: "amber",
    approved: "green",
    production: "blue",
    rejected: "red",
    archived: "slate",
    planned: "slate",
    in_progress: "amber",
    completed: "green",
    on_hold: "violet",
    failed: "red",
    pass: "green",
    fail: "red",
    pending: "amber",
    error: "red",
    warning: "amber",
    info: "blue",
    high: "red",
    medium: "amber",
    low: "green",
  };
  return map[status] ?? "slate";
}

export function StatCard({
  label,
  value,
  hint,
  tone = "blue",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    blue: "from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-300",
    green: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300",
    red: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-300",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-300",
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="glass p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {icon && (
          <div className={`rounded-xl bg-gradient-to-br p-2 ${tones[tone] ?? tones.blue}`}>{icon}</div>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </motion.div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white"
        >
          {title}
        </motion.h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500 dark:text-slate-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      {message}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className={`glass-strong relative z-10 max-h-[85vh] w-full overflow-y-auto p-6 ${wide ? "max-w-4xl" : "max-w-lg"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const tone = score >= 85 ? "bg-emerald-500" : score >= 70 ? "bg-brand-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{score.toFixed(0)}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${tone}`}
        />
      </div>
    </div>
  );
}
