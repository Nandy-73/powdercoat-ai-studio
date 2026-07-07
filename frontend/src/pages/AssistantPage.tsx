import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import type { AssistantResponse } from "../api/types";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, PageHeader } from "../components/ui";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  payload?: AssistantResponse;
}

const SUGGESTIONS = [
  "Reduce cost by 10%",
  "Increase gloss to 95",
  "Convert smooth finish into fine texture",
  "Improve flexibility",
  "Suggest outdoor polyester formulation",
  "Suggest a low-cost black formulation",
  "Correct this red: target #CC0605 actual #7A0C14",
  "Validate this formulation",
];

export default function AssistantPage() {
  const [fid, setFid] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "I'm your powder coating R&D assistant. Ask me to reduce cost, hit a gloss target, convert finishes, correct colors or suggest starter formulations. Select a formulation for recipe-specific work.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const resp = await api.post<AssistantResponse>("/ai/assistant", {
        question: text,
        formulation_id: fid,
      });
      setMessages((m) => [...m, { role: "assistant", text: resp.answer, payload: resp }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        subtitle="Natural-language R&D requests routed to the platform's optimization, color and costing engines"
      />

      <div className="grid gap-6 xl:grid-cols-4">
        <Card title="Context" className="h-fit">
          <FormulationPicker value={fid} onChange={setFid} label="Active formulation" />
          <p className="mt-3 text-[11px] text-slate-400">
            Cost, gloss, texture, flexibility and validation requests run against the selected
            formulation's real composition.
          </p>
          <p className="label mt-4">Try asking</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex h-[70vh] flex-col xl:col-span-3">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "border border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-white/5"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.payload && <PayloadView payload={m.payload} />}
                </div>
              </motion.div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <input
              className="input flex-1"
              placeholder='e.g. "Reduce cost by 10%" or "Increase gloss to 95"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
            />
            <button className="btn-primary" onClick={() => send(input)} disabled={busy}>
              Send
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PayloadView({ payload }: { payload: AssistantResponse }) {
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200/60 pt-3 text-xs dark:border-slate-700/60">
      {payload.optimization && !payload.optimization.error && (
        <div>
          <p className="mb-1 font-bold">Optimizer changes</p>
          {payload.optimization.changes.length === 0 ? (
            <p className="text-slate-400">No composition changes needed.</p>
          ) : (
            <ul className="space-y-0.5">
              {payload.optimization.changes.map((c) => (
                <li key={c.material}>
                  <Badge tone={c.direction === "increase" ? "green" : "red"}>{c.direction}</Badge>{" "}
                  {c.material}: {c.from_pct}% → <b>{c.to_pct}%</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {payload.alternatives && payload.alternatives.length > 0 && (
        <div>
          <p className="mb-1 font-bold">Cheaper alternatives</p>
          <ul className="space-y-0.5">
            {payload.alternatives.slice(0, 5).map((a, i) => (
              <li key={i}>
                {a.replace} → <b>{a.with}</b> (save ${a.estimated_formulation_saving_per_kg}/kg,{" "}
                {a.same_chemical_family ? "same family" : "needs trial"})
              </li>
            ))}
          </ul>
        </div>
      )}
      {payload.formulation && (
        <div>
          <p className="mb-1 font-bold">Suggested formulation ({payload.formulation.basis})</p>
          <table className="w-full text-left text-[11px]">
            <tbody>
              {payload.formulation.items.map((i) => (
                <tr key={i.name}>
                  <td className="py-0.5 pr-2">{i.name}</td>
                  <td className="py-0.5 pr-2 font-mono">{i.weight_kg} kg</td>
                  <td className="py-0.5 font-mono">{i.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {payload.analysis && (
        <div>
          <p className="font-bold">
            ΔE₂₀₀₀ = {payload.analysis.delta_e_2000} — {payload.analysis.pass ? "PASS" : "FAIL"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {payload.analysis.corrections.map((c, i) => (
              <li key={i}>
                {c.action !== "none" && (
                  <>
                    <b>{c.action}</b> {c.pigment}:{" "}
                    {c.adjustment_pct_relative > 0 ? "+" : ""}
                    {c.adjustment_pct_relative}%
                  </>
                )}
                {c.action === "none" && c.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {payload.validation && (
        <div>
          <p className="font-bold">
            Validation score {payload.validation.score}/100 ({payload.validation.verdict})
          </p>
          <ul className="mt-1 space-y-0.5">
            {payload.validation.issues.slice(0, 6).map((i, idx) => (
              <li key={idx}>
                <Badge tone={i.severity === "error" ? "red" : i.severity === "warning" ? "amber" : "blue"}>
                  {i.severity}
                </Badge>{" "}
                {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {payload.cost && (
        <div>
          <p className="font-bold">
            Material ${payload.cost.material_cost_per_kg}/kg · Production $
            {payload.cost.production_cost_per_kg}/kg
          </p>
          <p className="text-slate-400">
            Top drivers: {payload.cost.lines.slice(0, 3).map((l) => l.material).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
