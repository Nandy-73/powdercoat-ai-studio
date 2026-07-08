import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useState } from "react";
import { SpatialBackground } from "../ui";

const NAV = [
  {
    section: "Overview",
    items: [{ to: "/", label: "Executive Dashboard", icon: "📊" }],
  },
  {
    section: "R&D",
    items: [
      { to: "/formulations", label: "Formulation Builder", icon: "🧪" },
      { to: "/materials", label: "Material Database", icon: "🧱" },
      { to: "/knowledge", label: "Knowledge Base", icon: "📚" },
    ],
  },
  {
    section: "AI Studio",
    items: [
      { to: "/color-matching", label: "Color Matching", icon: "🎨" },
      { to: "/predictions", label: "Property Prediction", icon: "🔮" },
      { to: "/optimizer", label: "Optimization Engine", icon: "⚙️" },
      { to: "/assistant", label: "AI Assistant", icon: "🤖" },
    ],
  },
  {
    section: "Operations",
    items: [
      { to: "/batches", label: "Production & QC", icon: "🏭" },
      { to: "/batch-calculator", label: "Batch Calculator", icon: "🧮" },
      { to: "/cost", label: "Cost Intelligence", icon: "💰" },
      { to: "/manufacturing", label: "Manufacturing Intel", icon: "🛠️" },
    ],
  },
  {
    section: "Procurement",
    items: [
      { to: "/suppliers", label: "Supplier Intelligence", icon: "🌐" },
      { to: "/prices", label: "Price Intelligence", icon: "📈" },
      { to: "/machinery", label: "Machinery", icon: "🦾" },
      { to: "/market", label: "Market Intelligence", icon: "🛰️" },
    ],
  },
  {
    section: "Administration",
    items: [
      { to: "/reports", label: "Reports", icon: "📄" },
      { to: "/users", label: "Users & Roles", icon: "👥" },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrator",
  senior_rd_manager: "Senior R&D Manager",
  rd_engineer: "R&D Engineer",
  color_matching_engineer: "Color Matching Engineer",
  production_manager: "Production Manager",
  qc_engineer: "QC Engineer",
  procurement_manager: "Procurement Manager",
  sales_manager: "Sales Manager",
  viewer: "Viewer",
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen">
      <SpatialBackground />
      {/* Sidebar — floating spatial glass rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/40 bg-white/60 backdrop-blur-3xl transition-transform dark:border-white/10 dark:bg-slate-950/60 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200/60 px-5 dark:border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg shadow">
            🎨
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-slate-900 dark:text-white">
              PowderCoat <span className="text-brand-600 dark:text-brand-400">AI</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Studio</p>
          </div>
        </div>
        <nav className="h-[calc(100vh-4rem)] space-y-5 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "border border-brand-400/30 bg-brand-500/15 text-brand-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_0_20px_-6px_rgba(51,128,252,0.6)] dark:text-brand-200"
                          : "border border-transparent text-slate-600 hover:bg-white/50 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                      }`
                    }
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/30 bg-white/50 px-4 backdrop-blur-3xl dark:border-white/10 dark:bg-slate-950/50 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <p className="hidden text-xs font-medium text-slate-400 md:block">
              Enterprise AI Platform for Powder Coating R&D
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              title="Toggle theme"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            {user && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                  {user.full_name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-100">
                    {user.full_name}
                  </p>
                  <p className="text-[10px] text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 p-4 lg:p-6"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
