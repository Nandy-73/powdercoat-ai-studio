import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  { label: "Administrator", email: "admin@powdercoat.ai", password: "admin123" },
  { label: "Senior R&D Manager", email: "rd.manager@powdercoat.ai", password: "manager123" },
  { label: "Color Engineer", email: "color@powdercoat.ai", password: "color123" },
  { label: "Viewer", email: "viewer@powdercoat.ai", password: "viewer123" },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, setValue } = useForm<LoginForm>({
    defaultValues: { email: "admin@powdercoat.ai", password: "admin123" },
  });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (data: LoginForm) => {
    setBusy(true);
    setError(null);
    try {
      await login(data.email, data.password);
      navigate("/");
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Ambient gradient backdrop */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-950 via-slate-950 to-slate-900" />
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-2xl shadow-lg">
            🎨
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            PowderCoat <span className="text-brand-400">AI</span> Studio
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            Enterprise AI Platform for Powder Coating R&D, Color Matching & Manufacturing
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Email
            </label>
            <input
              type="email"
              autoComplete="username"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/40"
              {...register("email", { required: true })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/40"
              {...register("password", { required: true })}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-medium text-rose-200">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Demo accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setValue("email", acc.email);
                  setValue("password", acc.password);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/10"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
