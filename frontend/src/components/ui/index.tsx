import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Animated ambient light orbs — the spatial depth layer behind all content. */
export function SpatialBackground() {
  return (
    <div className="spatial-orbs" aria-hidden>
      <span className="h-[42vw] w-[42vw] animate-aurora-slow bg-brand-500/40" style={{ top: "-12%", left: "-8%" }} />
      <span className="h-[38vw] w-[38vw] animate-aurora-slower bg-violet-500/35" style={{ top: "-6%", right: "-10%" }} />
      <span className="h-[40vw] w-[40vw] animate-aurora-slow bg-emerald-500/25" style={{ bottom: "-18%", left: "30%" }} />
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  subtitle,
  actions,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  hover?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hover ? { y: -4 } : undefined}
      className={`glass relative overflow-hidden p-5 ${
        hover ? "cursor-pointer transition-shadow duration-300 hover:shadow-spatial-lg dark:hover:shadow-spatial-dark-lg" : ""
      } ${className}`}
    >
      <div className="relative z-10">
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
      </div>
    </motion.section>
  );
}

const badgeStyles: Record<string, string> = {
  green: "bg-emerald-400/15 text-emerald-600 ring-1 ring-emerald-400/30 dark:text-emerald-300",
  red: "bg-rose-400/15 text-rose-600 ring-1 ring-rose-400/30 dark:text-rose-300",
  amber: "bg-amber-400/15 text-amber-600 ring-1 ring-amber-400/30 dark:text-amber-300",
  blue: "bg-brand-400/15 text-brand-600 ring-1 ring-brand-400/30 dark:text-brand-300",
  slate: "bg-slate-400/15 text-slate-600 ring-1 ring-slate-400/25 dark:text-slate-300",
  violet: "bg-violet-400/15 text-violet-600 ring-1 ring-violet-400/30 dark:text-violet-300",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${
        badgeStyles[tone] ?? badgeStyles.slate
      }`}
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
    blue: "from-brand-500/25 to-brand-500/5 text-brand-600 dark:text-brand-300",
    green: "from-emerald-500/25 to-emerald-500/5 text-emerald-600 dark:text-emerald-300",
    red: "from-rose-500/25 to-rose-500/5 text-rose-600 dark:text-rose-300",
    amber: "from-amber-500/25 to-amber-500/5 text-amber-600 dark:text-amber-300",
    violet: "from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-300",
  };
  const glow: Record<string, string> = {
    blue: "bg-brand-500/20",
    green: "bg-emerald-500/20",
    red: "bg-rose-500/20",
    amber: "bg-amber-500/20",
    violet: "bg-violet-500/20",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="glass group relative overflow-hidden p-4 transition-shadow duration-300 hover:shadow-spatial-lg dark:hover:shadow-spatial-dark-lg"
    >
      {/* ambient glow that intensifies on hover */}
      <div
        className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 ${glow[tone] ?? glow.blue} opacity-60 group-hover:opacity-100`}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {icon && (
            <div className={`rounded-2xl bg-gradient-to-br p-2 shadow-inner ${tones[tone] ?? tones.blue}`}>{icon}</div>
          )}
        </div>
        <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
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
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ease: [0.22, 1, 0.36, 1] }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-white dark:via-slate-100 dark:to-brand-300"
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
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
        <div className="absolute inset-2 animate-glow-pulse rounded-full bg-brand-500/30 blur-md" />
      </div>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-300/50 bg-rose-400/10 p-4 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/30 dark:text-rose-300">
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
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`glass-strong relative z-10 max-h-[85vh] w-full overflow-y-auto p-6 ${wide ? "max-w-4xl" : "max-w-lg"}`}
      >
        <div className="relative z-10 mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-white/40 hover:text-slate-600 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="relative z-10">{children}</div>
      </motion.div>
    </div>
  );
}

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 85
      ? "from-emerald-400 to-emerald-600"
      : score >= 70
        ? "from-brand-400 to-brand-600"
        : score >= 50
          ? "from-amber-400 to-amber-600"
          : "from-rose-400 to-rose-600";
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium capitalize text-slate-600 dark:text-slate-300">{label}</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{score.toFixed(0)}</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-300/40 dark:bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${tone} shadow-[0_0_12px_-2px_currentColor]`}
        />
      </div>
    </div>
  );
}
