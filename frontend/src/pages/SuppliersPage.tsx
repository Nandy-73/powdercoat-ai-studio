import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Supplier } from "../api/types";
import { Badge, Card, PageHeader, Spinner } from "../components/ui";

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: () =>
      api.get<Supplier[]>(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  return (
    <div>
      <PageHeader
        title="Global Supplier Intelligence"
        subtitle="Worldwide raw-material suppliers with products, pricing, MOQ, lead times and certifications"
        actions={
          <input
            className="input !w-64"
            placeholder="Search suppliers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      />

      {isLoading && <Spinner label="Loading suppliers…" />}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{s.company}</h3>
                <p className="text-xs text-slate-400">
                  🌍 {s.country} · lead time {s.lead_time_days} days
                </p>
              </div>
              <Badge tone={s.rating >= 4.5 ? "green" : "blue"}>★ {s.rating.toFixed(1)}</Badge>
            </div>

            <div className="mt-3 space-y-1.5">
              {s.products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs dark:bg-white/5"
                >
                  <span className="font-medium">{p.product_name}</span>
                  <span className="font-mono text-slate-500">
                    ${p.price_per_kg}/kg · MOQ {p.moq_kg} kg
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {s.certifications.split(",").filter(Boolean).map((c) => (
                <Badge key={c} tone="slate">
                  {c.trim()}
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <span className="text-slate-400">{s.contact_email}</span>
              <a
                href={s.website}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                Visit website →
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
