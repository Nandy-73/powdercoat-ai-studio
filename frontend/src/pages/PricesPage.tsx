import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import type { CountryRank } from "../api/types";
import { Badge, Card, PageHeader, Spinner } from "../components/ui";

const CRITERIA = [
  { key: "overall", label: "Best overall" },
  { key: "price", label: "Lowest price" },
  { key: "quality", label: "Best quality" },
  { key: "delivery", label: "Fastest delivery" },
  { key: "rating", label: "Best supplier ratings" },
];

export default function PricesPage() {
  const [material, setMaterial] = useState("Titanium Dioxide Rutile");
  const [criterion, setCriterion] = useState("overall");

  const { data: materials } = useQuery({
    queryKey: ["price-materials"],
    queryFn: () => api.get<string[]>("/prices/materials"),
  });

  const { data: ranks, isLoading } = useQuery({
    queryKey: ["price-rank", material, criterion],
    queryFn: () =>
      api.get<CountryRank[]>(
        `/prices/rank?material=${encodeURIComponent(material)}&criterion=${criterion}`
      ),
    enabled: !!material,
  });

  const { data: compare } = useQuery({
    queryKey: ["price-compare"],
    queryFn: () =>
      api.get<{ country: string; avg_price_per_kg: number; avg_quality: number; avg_delivery_days: number; materials_tracked: number }[]>(
        "/prices/compare"
      ),
  });

  return (
    <div>
      <PageHeader
        title="Global Price Intelligence"
        subtitle="Country-level raw material benchmarks ranked by price, quality, delivery and supplier rating"
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <select className="input !w-72" value={material} onChange={(e) => setMaterial(e.target.value)}>
          {materials?.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          {CRITERIA.map((c) => (
            <button
              key={c.key}
              onClick={() => setCriterion(c.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                criterion === c.key
                  ? "bg-brand-600 text-white"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Country Ranking — ${material}`} subtitle={`Ranked by: ${CRITERIA.find((c) => c.key === criterion)?.label}`}>
          {isLoading && <Spinner />}
          {ranks && (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Country</th>
                    <th className="text-right">Price/kg</th>
                    <th className="text-right">Quality</th>
                    <th className="text-right">Delivery</th>
                    <th className="text-right">Rating</th>
                    <th className="text-right">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {ranks.map((r) => (
                    <tr key={r.country}>
                      <td>
                        <Badge tone={r.rank === 1 ? "green" : r.rank <= 3 ? "blue" : "slate"}>#{r.rank}</Badge>
                      </td>
                      <td className="font-medium">{r.country}</td>
                      <td className="text-right font-mono">${r.price_per_kg}</td>
                      <td className="text-right font-mono">{r.quality_score}/5</td>
                      <td className="text-right font-mono">{r.delivery_days}d</td>
                      <td className="text-right font-mono">★{r.supplier_rating}</td>
                      <td className="text-right font-mono font-bold text-brand-600 dark:text-brand-400">
                        {r.overall_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Price Level by Country" subtitle="Average benchmarked price across all tracked materials">
          {compare && (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={compare} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="$" />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: number) => [`$${v}/kg avg`, "Price level"]} />
                <Bar dataKey="avg_price_per_kg" radius={[0, 6, 6, 0]}>
                  {compare.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#10b981" : "#3380fc"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
