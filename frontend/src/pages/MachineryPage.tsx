import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Machine } from "../api/types";
import { Badge, Card, PageHeader, Spinner } from "../components/ui";

const TYPE_LABELS: Record<string, string> = {
  mixer: "Mixers",
  extruder: "Extruders",
  cooling_system: "Cooling Systems",
  crusher: "Crushers",
  grinding: "Grinding Machines",
  sieving: "Sieving Machines",
  packaging: "Packaging",
  laboratory: "Laboratory Equipment",
};

export default function MachineryPage() {
  const [type, setType] = useState("");
  const { data: types } = useQuery({
    queryKey: ["machine-types"],
    queryFn: () => api.get<string[]>("/machinery/types"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["machines", type],
    queryFn: () => api.get<Machine[]>(`/machinery${type ? `?machine_type=${type}` : ""}`),
  });

  return (
    <div>
      <PageHeader
        title="Machinery Intelligence"
        subtitle="Production line and laboratory equipment database with capacity, pricing and energy data"
        actions={
          <select className="input !w-56" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All equipment</option>
            {types?.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        }
      />

      {isLoading && <Spinner label="Loading machinery…" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((m) => {
          let specs: Record<string, unknown> = {};
          try {
            specs = JSON.parse(m.specs);
          } catch {
            /* ignore malformed specs */
          }
          return (
            <Card key={m.id}>
              <div className="flex items-start justify-between">
                <div>
                  <Badge tone="violet">{TYPE_LABELS[m.machine_type] ?? m.machine_type}</Badge>
                  <h3 className="mt-2 font-bold">{m.name}</h3>
                  <p className="text-xs text-slate-400">
                    {m.manufacturer} · {m.country}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Info label="Capacity" value={m.capacity} />
                <Info label="Est. price" value={m.estimated_price_usd > 0 ? `$${m.estimated_price_usd.toLocaleString()}` : "on request"} />
                <Info label="Energy" value={m.energy_kw > 0 ? `${m.energy_kw} kW` : "—"} />
                <Info label="Warranty" value={`${m.warranty_years} yr`} />
              </div>
              {Object.keys(specs).length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {Object.entries(specs).map(([k, v]) => (
                    <p key={k}>
                      <span className="font-semibold">{k.replace(/_/g, " ")}:</span> {String(v)}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-white/5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
