import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { MarketInsight } from "../api/types";
import { Badge, Card, PageHeader, Spinner, statusTone } from "../components/ui";

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  technology: { label: "Technology", icon: "🚀" },
  trend: { label: "Industry Trend", icon: "📈" },
  shortage: { label: "Supply Shortage", icon: "⚠️" },
  price: { label: "Price Movement", icon: "💱" },
  alternative: { label: "Alternative Materials", icon: "🔄" },
  sustainability: { label: "Sustainability", icon: "🌱" },
  regulation: { label: "Regulation", icon: "⚖️" },
};

export default function MarketPage() {
  const [category, setCategory] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["market", category],
    queryFn: () => api.get<MarketInsight[]>(`/market${category ? `?category=${category}` : ""}`),
  });

  return (
    <div>
      <PageHeader
        title="Market Intelligence"
        subtitle="Technologies, trends, shortages, price movements, sustainability and regulatory watch"
        actions={
          <select className="input !w-52" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        }
      />

      {isLoading && <Spinner label="Loading market insights…" />}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((m) => {
          const meta = CATEGORY_META[m.category] ?? { label: m.category, icon: "📌" };
          return (
            <Card key={m.id}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{meta.icon}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{meta.label}</Badge>
                    <Badge tone={statusTone(m.impact)}>{m.impact} impact</Badge>
                    <span className="text-[11px] text-slate-400">{m.region}</span>
                  </div>
                  <h3 className="mt-2 font-bold">{m.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{m.summary}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
