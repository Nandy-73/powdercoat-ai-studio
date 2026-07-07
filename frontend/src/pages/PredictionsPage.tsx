import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { api } from "../api/client";
import type { FinishPrediction, MechanicalPrediction } from "../api/types";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, PageHeader, ScoreBar, Spinner } from "../components/ui";

export default function PredictionsPage() {
  const [fid, setFid] = useState<number | null>(null);

  const finish = useQuery({
    queryKey: ["finish", fid],
    queryFn: () => api.get<FinishPrediction>(`/ai/predict/finish/${fid}`),
    enabled: fid != null,
  });
  const mech = useQuery({
    queryKey: ["mech", fid],
    queryFn: () => api.get<MechanicalPrediction>(`/ai/predict/mechanical/${fid}`),
    enabled: fid != null,
  });

  const radarData = mech.data
    ? [
        { prop: "Hardness", score: mech.data.hardness.score },
        { prop: "Adhesion", score: mech.data.adhesion.score },
        { prop: "Flexibility", score: mech.data.flexibility.score },
        { prop: "Impact", score: mech.data.impact_resistance.score },
        { prop: "Chemical", score: mech.data.chemical_resistance.score },
        { prop: "Weather", score: mech.data.weather_resistance.score },
        { prop: "Salt spray", score: mech.data.salt_spray_resistance.score },
        { prop: "Humidity", score: mech.data.humidity_resistance.score },
        { prop: "Outdoor", score: mech.data.outdoor_durability.score },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Property Prediction"
        subtitle="ML models (XGBoost + gradient boosting) predict finish and mechanical performance before any lab work"
      />

      <div className="mb-6 max-w-xl">
        <FormulationPicker value={fid} onChange={setFid} />
      </div>

      {fid == null && (
        <Card>
          <p className="py-16 text-center text-sm text-slate-400">
            Select a formulation to predict gloss, finish type, texture and the full mechanical panel.
          </p>
        </Card>
      )}

      {fid != null && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Finish Prediction" subtitle="Gloss, texture and film appearance">
            {finish.isLoading && <Spinner label="Predicting finish…" />}
            {finish.data && (
              <div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="label">Gloss 60°</p>
                    <p className="text-5xl font-extrabold text-brand-500">
                      {finish.data.gloss_60deg}
                      <span className="text-lg text-slate-400"> GU</span>
                    </p>
                    <Badge tone="blue">{finish.data.gloss_category}</Badge>
                  </div>
                  <div className="flex-1">
                    <p className="label">Predicted finish type</p>
                    <p className="text-xl font-bold capitalize">
                      {finish.data.finish_type.replace("_", " ")}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {finish.data.film_appearance}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  <p className="label">Finish probabilities</p>
                  {Object.entries(finish.data.finish_probabilities).map(([k, v]) => (
                    <ScoreBar key={k} score={v * 100} label={k.replace("_", " ")} />
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Mechanical Property Panel" subtitle="0–100 performance scores with test estimates">
            {mech.isLoading && <Spinner label="Predicting mechanical properties…" />}
            {mech.data && (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid strokeOpacity={0.2} />
                    <PolarAngleAxis dataKey="prop" tick={{ fontSize: 10 }} />
                    <Radar dataKey="score" stroke="#3380fc" fill="#3380fc" fillOpacity={0.35} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ["Hardness", mech.data.hardness],
                      ["Adhesion", mech.data.adhesion],
                      ["Flexibility", mech.data.flexibility],
                      ["Impact resistance", mech.data.impact_resistance],
                      ["Chemical resistance", mech.data.chemical_resistance],
                      ["Weather resistance", mech.data.weather_resistance],
                      ["Salt spray", mech.data.salt_spray_resistance],
                      ["Humidity", mech.data.humidity_resistance],
                      ["Outdoor durability", mech.data.outdoor_durability],
                    ] as const
                  ).map(([label, p]) => (
                    <div key={label} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{label}</span>
                        <Badge tone={p.rating === "excellent" ? "green" : p.rating === "good" ? "blue" : p.rating === "fair" ? "amber" : "red"}>
                          {p.rating}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-sm font-bold">{p.score}</p>
                      {p.estimate && <p className="text-[10px] text-slate-400">{p.estimate}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
