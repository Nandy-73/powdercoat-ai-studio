import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { SimilarFormulation, Trial } from "../api/types";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, PageHeader, ScoreBar, Spinner, statusTone } from "../components/ui";

interface Version {
  id: number;
  version: number;
  snapshot: string;
  note: string;
  created_at: string;
}

export default function KnowledgePage() {
  const [fid, setFid] = useState<number | null>(null);

  const { data: similar, isLoading: similarLoading } = useQuery({
    queryKey: ["similar", fid],
    queryFn: () => api.get<SimilarFormulation[]>(`/formulations/${fid}/similar`),
    enabled: fid != null,
  });
  const { data: versions } = useQuery({
    queryKey: ["versions", fid],
    queryFn: () => api.get<Version[]>(`/formulations/${fid}/versions`),
    enabled: fid != null,
  });
  const { data: trials } = useQuery({
    queryKey: ["trials", fid],
    queryFn: () => api.get<Trial[]>(`/formulations/${fid}/trials`),
    enabled: fid != null,
  });

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        subtitle="Version history, trial records and AI similarity search over every stored formulation"
      />

      <div className="mb-6 max-w-xl">
        <FormulationPicker value={fid} onChange={setFid} label="Reference formulation" />
      </div>

      {fid == null && (
        <Card>
          <p className="py-16 text-center text-sm text-slate-400">
            Select a formulation to explore its history and find the closest previous work.
          </p>
        </Card>
      )}

      {fid != null && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card
            title="Closest Previous Formulations"
            subtitle="AI similarity by composition profile, PVC and chemistry system"
          >
            {similarLoading && <Spinner />}
            {similar && similar.length === 0 && (
              <p className="text-sm text-slate-400">No other formulations to compare yet.</p>
            )}
            <div className="space-y-3">
              {similar?.map((s) => (
                <Link key={s.id} to={`/formulations/${s.id}`} className="block">
                  <div className="rounded-xl border border-slate-200 p-3 transition hover:border-brand-400 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">
                          {s.code} — {s.name}
                        </p>
                        <div className="mt-1 flex gap-2">
                          <Badge tone="violet">{s.system}</Badge>
                          <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                          <span className="text-xs text-slate-400">${s.cost_per_kg}/kg</span>
                        </div>
                      </div>
                      <div className="w-28">
                        <ScoreBar score={s.similarity_pct} label="match" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <div className="space-y-6">
            <Card title="Version History" subtitle="Every composition change is snapshotted">
              {versions && versions.length === 0 && (
                <p className="text-sm text-slate-400">No versions recorded.</p>
              )}
              <div className="space-y-2">
                {versions?.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                  >
                    <Badge tone="blue">v{v.version}</Badge>
                    <span className="flex-1 text-sm">{v.note}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Trial History">
              {trials && trials.length === 0 && (
                <p className="text-sm text-slate-400">No trials recorded.</p>
              )}
              <div className="space-y-2">
                {trials?.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-700"
                  >
                    <Badge tone={statusTone(t.result)}>{t.result}</Badge>
                    {t.gloss_measured != null && <span className="font-mono text-xs">{t.gloss_measured} GU</span>}
                    <span className="flex-1 text-xs text-slate-500">{t.notes}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
