import { useEffect, useMemo, useState } from "react";
import { Headphones, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

function spokenText(markdown: string) {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/[#*_>`]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
}

export function AudioReader({ text, label = "Listen" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [supported, setSupported] = useState(true);
  const clean = useMemo(() => spokenText(text), [text]);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); };
  }, []);
  if (!supported || !clean) return null;
  const stop = () => { window.speechSynthesis.cancel(); setState("idle"); };
  const play = () => {
    if (state === "paused") { window.speechSynthesis.resume(); setState("playing"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const matureEnglishVoice = voices.find(voice => /en-US|en-GB/i.test(voice.lang) && /david|daniel|alex|george|mark|mature|male/i.test(voice.name))
      ?? voices.find(voice => /en-US|en-GB/i.test(voice.lang));
    if (matureEnglishVoice) utterance.voice = matureEnglishVoice;
    // A grounded, unhurried delivery for the non-identifying guardian narrator.
    // The browser voice itself varies by device; we do not imitate a named person.
    utterance.rate = 0.84;
    utterance.pitch = 0.82;
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    window.speechSynthesis.speak(utterance);
    setState("playing");
  };
  const pause = () => { window.speechSynthesis.pause(); setState("paused"); };
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-200/10 bg-cyan-100/[0.04] px-3 py-2"><Headphones className="h-4 w-4 text-cyan-300"/><span className="mr-1 text-xs text-slate-400">{state === "playing" ? "Reading aloud" : state === "paused" ? "Paused" : label}</span>{state === "playing" ? <Button type="button" size="sm" variant="outline" onClick={pause} className="h-8 border-white/10 bg-transparent text-slate-200"><Pause className="mr-1.5 h-3.5 w-3.5"/>Pause</Button> : <Button type="button" size="sm" variant="outline" onClick={play} className="h-8 border-cyan-200/20 bg-cyan-100/5 text-cyan-100"><Play className="mr-1.5 h-3.5 w-3.5"/>{state === "paused" ? "Resume" : "Play"}</Button>}{state !== "idle" && <Button type="button" size="sm" variant="ghost" onClick={stop} className="h-8 text-slate-400 hover:text-white"><Square className="mr-1.5 h-3.5 w-3.5"/>Stop</Button>}</div>;
}
