import { useState } from "react";
import { Brain, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import type { ChartResult } from "../../../server/astronomy";

type Interpretation = { intelligence: string; reading: string; generatedAt: string };

export function InterpretationPanel({ chart }: { chart: ChartResult }) {
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const generate = trpc.interpretation.generate.useMutation({ onSuccess: data => { setInterpretation(data); setMessages([{ role: "assistant", content: "The chart is calculated. Ask me to unpack any placement, pattern, or conclusion from the reading." }]); } });
  const chat = trpc.interpretation.followUp.useMutation({ onSuccess: answer => setMessages(current => [...current, { role: "assistant", content: answer }]) });
  const run = () => generate.mutate({ chart });
  const send = (question: string) => { if (!interpretation) return; const next = [...messages, { role: "user" as const, content: question }]; setMessages(next); chat.mutate({ chart, interpretation, history: next.filter((message): message is Extract<Message, { role: "user" | "assistant" }> => message.role !== "system"), question }); };

  return <section className="space-y-6 border-t border-white/10 pt-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-300"><Brain className="h-4 w-4"/> Understand</div><h2 className="font-serif text-4xl text-white">The interpretation layer</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">The astronomy engine remains the source of truth. The Firmament interpreter explains supplied placements as observable patterns rather than generic horoscope claims.</p></div>
      {!interpretation && <Button onClick={run} disabled={generate.isPending} className="shrink-0 bg-cyan-500 text-slate-950 hover:bg-cyan-300">{generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}{generate.isPending ? "Building reading…" : "Build interpretation"}</Button>}
    </div>
    {generate.error && <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-200">{generate.error.message}</p>}
    {interpretation ? <>
      <Card className="border-cyan-200/10 bg-cyan-100/[0.035] text-slate-100"><CardHeader className="border-b border-cyan-200/10"><CardTitle className="text-base">Chart intelligence</CardTitle></CardHeader><CardContent className="p-5"><Streamdown>{interpretation.intelligence}</Streamdown></CardContent></Card>
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader className="border-b border-white/10"><CardTitle className="text-base">Understand your chart</CardTitle></CardHeader><CardContent className="p-6 prose prose-invert max-w-none prose-headings:font-serif prose-headings:text-white prose-strong:text-cyan-200 prose-p:text-slate-300"><Streamdown>{interpretation.reading}</Streamdown></CardContent></Card>
      <Card className="border-violet-200/10 bg-violet-100/[0.035] text-slate-100"><CardHeader className="border-b border-violet-200/10"><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-violet-300"/> Ask the Oracle</CardTitle></CardHeader><CardContent className="p-0"><AIChatBox messages={messages} onSendMessage={send} isLoading={chat.isPending} height="420px" placeholder="Break that down more…" emptyStateMessage="Ask about a pattern in your chart" suggestedPrompts={["Break the Mirror down more.", "Where do you see the strongest repeated theme?", "How could this show up in relationships?", "What would the shadow version look like?"]}/></CardContent></Card>
      {chat.error && <p className="text-sm text-rose-300">{chat.error.message}</p>}
    </> : <div className="rounded-2xl border border-dashed border-cyan-200/15 bg-cyan-100/[0.02] p-8 text-center text-sm leading-6 text-slate-400">Calculate first, then build a staged reading: intelligence → behavioral interpretation → synthesis → Mirror → follow-up questions.</div>}
  </section>;
}
