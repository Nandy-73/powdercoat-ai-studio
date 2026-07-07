import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { api } from "../api/client";
import type { DashboardSummary } from "../api/types";
import { Card, ErrorState, PageHeader, Spinner, StatCard } from "../components/ui";

const PIE_COLORS = ["#3380fc", "#8ec4ff", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
  });

  if (isLoading) return <Spinner label="Loading executive dashboard…" />;
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? "Failed to load"} />;

  const k = data.kpis;

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="R&D, production, quality, color and procurement KPIs at a glance"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active Formulations" value={k.active_formulations} tone="blue" icon="🧪" />
        <StatCard label="Approved / Production" value={k.approved_formulations} tone="green" icon="✅" />
        <StatCard label="Production Batches" value={k.production_batches} hint={`${k.batches_in_progress} in progress`} tone="violet" icon="🏭" />
        <StatCard
          label="Trial Success"
          value={`${k.trial_success_rate}%`}
          hint={`${k.passed_trials} passed / ${k.failed_trials} failed`}
          tone={k.trial_success_rate >= 70 ? "green" : "amber"}
          icon="🎯"
        />
        <StatCard
          label="QC Pass Rate"
          value={k.qc_pass_rate != null ? `${k.qc_pass_rate}%` : "—"}
          tone="green"
          icon="🔬"
        />
        <StatCard label="Avg Material Cost" value={`$${k.avg_cost_per_kg}/kg`} tone="amber" icon="💰" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Cost per Formulation" subtitle="Material cost, USD/kg (lowest first)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.cost_by_formulation}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="$" />
              <Tooltip formatter={(v: number) => [`$${v}/kg`, "Cost"]} />
              <Bar dataKey="cost_per_kg" radius={[6, 6, 0, 0]}>
                {data.cost_by_formulation.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Color Matching Trend" subtitle="Delta E (CIEDE2000) of recent color match records — lower is better">
          {data.color_trend.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No color matches yet — run the Color Matching module.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.color_trend}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="delta_e"
                  stroke="#3380fc"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#3380fc" }}
                  name="ΔE2000"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Chemistry Systems" subtitle="Formulation portfolio distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.systems_distribution}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
              >
                {data.systems_distribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Material Consumption" subtitle="Total kg consumed by production batches per category">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.material_consumption} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis type="number" tick={{ fontSize: 11 }} unit=" kg" />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v: number) => [`${v} kg`, "Consumed"]} />
              <Bar dataKey="kg" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Formulation Status" subtitle="R&D pipeline stages">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.status_distribution}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Batch Status" subtitle="Production pipeline">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.batch_status_distribution} dataKey="value" nameKey="name" outerRadius={90}>
                {data.batch_status_distribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
