import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api/client";
import type { ColorAnalysis } from "../api/types";
import { Badge, Card, ErrorState, PageHeader, Spinner } from "../components/ui";

export default function ColorMatchingPage() {
  const [mode, setMode] = useState<"hex" | "upload">("hex");
  const [targetHex, setTargetHex] = useState("#CC0605");
  const [actualHex, setActualHex] = useState("#7A0C14");
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [labFile, setLabFile] = useState<File | null>(null);

  const match = useMutation({
    mutationFn: async () => {
      if (mode === "hex") {
        return api.post<ColorAnalysis>("/color/match", {
          target_hex: targetHex,
          actual_hex: actualHex,
        });
      }
      const fd = new FormData();
      if (!customerFile || !labFile) throw new Error("Select both sample images");
      fd.append("customer_sample", customerFile);
      fd.append("lab_sample", labFile);
      return api.post<ColorAnalysis>("/color/match/upload", fd);
    },
  });

  const result = match.data;

  return (
    <div>
      <PageHeader
        title="AI Color Matching"
        subtitle="Compare customer and laboratory samples: CIEDE2000 Delta E, LAB analysis, RAL estimation and pigment correction"
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Samples" subtitle="Enter shades or upload panel photos">
          <div className="mb-4 flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            {(["hex", "upload"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  mode === m
                    ? "bg-brand-600 text-white"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {m === "hex" ? "Color values" : "Upload photos"}
              </button>
            ))}
          </div>

          {mode === "hex" ? (
            <div className="space-y-4">
              <ColorInput label="Customer target" value={targetHex} onChange={setTargetHex} />
              <ColorInput label="Laboratory sample" value={actualHex} onChange={setActualHex} />
            </div>
          ) : (
            <div className="space-y-4">
              <FileInput label="Customer sample photo" file={customerFile} onChange={setCustomerFile} />
              <FileInput label="Laboratory sample photo" file={labFile} onChange={setLabFile} />
              <p className="text-[11px] text-slate-400">
                The dominant color of the central panel area is extracted automatically.
              </p>
            </div>
          )}

          {/* Live preview */}
          <div className="mt-5">
            <p className="label">Live preview</p>
            <div className="flex h-24 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div
                className="flex flex-1 items-end p-2 text-[10px] font-bold text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
                style={{ background: mode === "hex" ? targetHex : result?.target.hex ?? "#888" }}
              >
                TARGET
              </div>
              <div
                className="flex flex-1 items-end justify-end p-2 text-[10px] font-bold text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
                style={{ background: mode === "hex" ? actualHex : result?.actual.hex ?? "#555" }}
              >
                ACTUAL
              </div>
            </div>
          </div>

          <button
            className="btn-primary mt-4 w-full"
            onClick={() => match.mutate()}
            disabled={match.isPending}
          >
            {match.isPending ? "Analyzing…" : "🎨 Analyze Color Match"}
          </button>
          {match.error && <p className="mt-2 text-xs text-rose-500">{(match.error as Error).message}</p>}
        </Card>

        <div className="space-y-6 xl:col-span-2">
          {!result && !match.isPending && (
            <Card>
              <p className="py-16 text-center text-sm text-slate-400">
                Run an analysis to see Delta E, LAB deltas, hue diagnosis and quantified pigment
                corrections.
              </p>
            </Card>
          )}
          {match.isPending && (
            <Card>
              <Spinner label="Computing CIEDE2000 and pigment corrections…" />
            </Card>
          )}
          {result && <ResultPanel result={result} />}
        </div>
      </div>

      <HistorySection />
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-700"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input className="input font-mono" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function FileInput({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="file"
        accept="image/*"
        className="input !py-1.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && <p className="mt-1 text-[11px] text-slate-400">{file.name}</p>}
    </div>
  );
}

function ResultPanel({ result }: { result: ColorAnalysis }) {
  const deTone = result.delta_e_2000 < 1 ? "green" : result.delta_e_2000 < 2 ? "blue" : result.delta_e_2000 < 3.5 ? "amber" : "red";
  return (
    <>
      <Card title="Match Result">
        <div className="flex flex-wrap items-center gap-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <p className="label">ΔE₂₀₀₀</p>
            <p
              className={`text-5xl font-extrabold ${
                deTone === "green" ? "text-emerald-500" : deTone === "blue" ? "text-brand-500" : deTone === "amber" ? "text-amber-500" : "text-rose-500"
              }`}
            >
              {result.delta_e_2000}
            </p>
            <Badge tone={deTone}>{result.pass ? "PASS" : "FAIL"}</Badge>
          </motion.div>
          <div className="min-w-[220px] flex-1">
            <p className="mb-3 text-sm font-medium">{result.verdict}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <DeltaChip label="ΔL* (lightness)" value={result.delta_l} pos="lighter" neg="darker" />
              <DeltaChip label="Δa* (red-green)" value={result.delta_a} pos="redder" neg="greener" />
              <DeltaChip label="Δb* (yellow-blue)" value={result.delta_b} pos="yellower" neg="bluer" />
              <DeltaChip label="ΔC (chroma)" value={result.delta_chroma} pos="more vivid" neg="grayer" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ColorCard title="Target (customer)" block={result.target} ral={result.ral_estimate_target} />
          <ColorCard title="Actual (laboratory)" block={result.actual} ral={result.ral_estimate_actual} />
        </div>
      </Card>

      <Card title="AI Diagnosis" subtitle="Why the shades differ and which pigments are responsible">
        {result.issues.length === 0 ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            ✓ The sample is within tolerance in every LAB dimension.
          </p>
        ) : (
          <div className="space-y-3">
            {result.issues.map((issue, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <Badge tone="amber">{issue.direction}</Badge>
                <p className="mt-1.5 text-sm">{issue.diagnosis}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Likely cause:</span> {issue.cause}
                </p>
                <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">→ {issue.action}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Pigment Correction Plan"
        subtitle="Relative loading adjustments predicted before any lab trial"
      >
        <table className="table-base">
          <thead>
            <tr>
              <th>Pigment</th>
              <th>Action</th>
              <th className="text-right">Adjustment (relative)</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {result.corrections.map((c, i) => (
              <tr key={i}>
                <td className="font-medium">{c.pigment}</td>
                <td>
                  <Badge tone={c.action === "increase" ? "green" : c.action === "reduce" ? "red" : "slate"}>
                    {c.action}
                  </Badge>
                </td>
                <td className="text-right font-mono">
                  {c.adjustment_pct_relative > 0 ? "+" : ""}
                  {c.adjustment_pct_relative}%
                </td>
                <td className="text-xs text-slate-500">{c.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function DeltaChip({ label, value, pos, neg }: { label: string; value: number; pos: string; neg: string }) {
  return (
    <div className="rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-white/5">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="font-mono font-bold">
        {value > 0 ? "+" : ""}
        {value}{" "}
        <span className="font-sans text-[10px] font-normal text-slate-400">
          {Math.abs(value) < 0.5 ? "" : value > 0 ? pos : neg}
        </span>
      </p>
    </div>
  );
}

function ColorCard({
  title,
  block,
  ral,
}: {
  title: string;
  block: ColorAnalysis["target"];
  ral?: { code: string; name: string; hex: string; delta_e: number } | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="h-16" style={{ background: block.hex }} />
      <div className="p-3 text-xs">
        <p className="font-bold">{title}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          <span>HEX {block.hex}</span>
          <span>
            RGB {block.rgb.r},{block.rgb.g},{block.rgb.b}
          </span>
          <span className="col-span-2">
            LAB {block.lab.l} / {block.lab.a} / {block.lab.b}
          </span>
        </div>
        {ral && (
          <div className="mt-2 flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-slate-300" style={{ background: ral.hex }} />
            <span className="font-semibold">
              ≈ {ral.code} {ral.name}
            </span>
            <span className="text-slate-400">ΔE {ral.delta_e}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HistorySection() {
  const { data, error } = useQuery({
    queryKey: ["color-history"],
    queryFn: () =>
      api.get<{ id: number; target_hex: string; actual_hex: string; delta_e: number; ral_estimate: string; created_at: string }[]>(
        "/color/history"
      ),
  });
  if (error) return <div className="mt-6"><ErrorState message={(error as Error).message} /></div>;
  if (!data || data.length === 0) return null;
  return (
    <div className="mt-6">
      <Card title="Match History" subtitle="Recent color matching records">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>#</th>
                <th>Target</th>
                <th>Actual</th>
                <th className="text-right">ΔE₂₀₀₀</th>
                <th>RAL est.</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.id}</td>
                  <td>
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      <span className="h-4 w-8 rounded border border-slate-200" style={{ background: r.target_hex }} />
                      {r.target_hex}
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      <span className="h-4 w-8 rounded border border-slate-200" style={{ background: r.actual_hex }} />
                      {r.actual_hex}
                    </span>
                  </td>
                  <td className="text-right font-mono font-bold">{r.delta_e}</td>
                  <td className="text-xs">{r.ral_estimate}</td>
                  <td className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
