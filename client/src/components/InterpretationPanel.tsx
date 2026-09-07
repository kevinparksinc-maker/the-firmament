import { useState } from "react";
import { Brain, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import type { ChartResult } from "../../../server/astronomy";

type ReadingMode = "natal" | "transit" | "combined";
type Interpretation = { intelligence: string; reading: string; generatedAt: string };
const modes: Array<{ value: ReadingMode; label: string; description: string }> = [
  { value: "natal", label: "Natal only", description: "Your enduring birth-chart story" },
  { value: "transit", label: "Transit only", description: "What the current/selected moment is activating" },
  { value: "combined", label: "Natal + transit", description: "The enduring pattern and present chapter together" },
];

export function InterpretationPanel({ chart }: { chart: ChartResult }) {
  const [mode, setMode] = useState<ReadingMode>("combined");
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const generate = trpc.interpretation.generate.useMutation({ onSuccess: data => { setInterpretation(data); setMessages([{ role: "assistant", content: `The ${mode === "natal" ? "natal" : mode === "transit" ? "transit" : "combined"} reading is ready. Ask me to unpack any placement, contact, pattern, or conclusion.` }]); } });
  const chat = trpc.interpretation.followUp.useMutation({ onSuccess: answer => setMessages(current => [...current, { role: "assistant", content: answer }]) });
  const run = () => { setInterpretation(null); setMessages([]); generate.mutate({ chart, mode }); };
  const send = (question: string) => { if (!interpretation) return; const next = [...messages, { role: "user" as const, content: question }]; setMessages(next); chat.mutate({ chart, interpretation, mode, history: next.filter((message): message is Extract<Message, { role: "user" | "assistant" }> => message.role !== "system"), question }); };
  const selected = modes.find(item => item.value === mode)!;

  return <section className="space-y-6 border-t border-white/10 pt-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-300"><Brain className="h-4 w-4"/> Understand</div><h2 className="font-serif text-4xl text-white">The interpretation layer</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Choose which layer you want to read. Natal, transit, and combined interpretations are separate readings—not one blended checklist.</p></div>
      {interpretation && <Button variant="outline" onClick={run} disabled={generate.isPending} className="shrink-0 border-cyan-200/20 bg-white/5 text-cyan-100 hover:bg-cyan-100/10">{generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}Read {selected.label} again</Button>}
    </div>
    <Card className="border-cyan-200/10 bg-cyan-100/[0.035] text-slate-100"><CardContent className="grid gap-2 p-3 md:grid-cols-3">{modes.map(item => <button key={item.value} type="button" onClick={() => { setMode(item.value); setInterpretation(null); setMessages([]); }} className={`rounded-xl border p-4 text-left transition-colors ${mode === item.value ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}><div className="font-medium text-white">{item.label}</div><div className="mt-1 text-xs leading-5 text-slate-400">{item.description}</div></button>)}</CardContent></Card>
    {!interpretation && <Button onClick={run} disabled={generate.isPending} className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-300">{generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}{generate.isPending ? "Building reading…" : `Build ${selected.label}`}</Button>}
    {generate.error && <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-200"><div>{generate.error.message}</div><Button variant="outline" onClick={run} className="mt-3 border-rose-200/30 bg-transparent text-rose-100 hover:bg-rose-100/10">Retry reading</Button></div>}
    {interpretation ? <>
      <Card className="border-cyan-200/10 bg-cyan-100/[0.035] text-slate-100"><CardHeader className="border-b border-cyan-200/10"><CardTitle className="text-base">{selected.label} intelligence</CardTitle></CardHeader><CardContent className="p-5"><Streamdown>{interpretation.intelligence}</Streamdown></CardContent></Card>
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader className="border-b border-white/10"><CardTitle className="text-base">{selected.label} reading</CardTitle></CardHeader><CardContent className="p-6 prose prose-invert max-w-none prose-headings:font-serif prose-headings:text-white prose-strong:text-cyan-200 prose-p:text-slate-300"><Streamdown>{interpretation.reading}</Streamdown></CardContent></Card>
      <Card className="border-violet-200/10 bg-violet-100/[0.035] text-slate-100"><CardHeader className="border-b border-violet-200/10"><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-violet-300"/> Ask the Oracle · {selected.label}</CardTitle></CardHeader><CardContent className="p-0"><AIChatBox messages={messages} onSendMessage={send} isLoading={chat.isPending} height="420px" placeholder="Break that down more…" emptyStateMessage="Ask about this reading" suggestedPrompts={["Break the strongest theme down more.", "How could this show up in relationships?", "What is the honest lesson here?", "What would the shadow version look like?"]}/></CardContent></Card>
      {chat.error && <p className="text-sm text-rose-300">{chat.error.message}</p>}
    </> : <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-cyan-100/[0.02] p-8 text-center text-sm leading-6 text-slate-400">Choose a layer, then build its staged reading: intelligence → behavioral interpretation → synthesis → Mirror → follow-up questions.</div>}
  </section>;
}
