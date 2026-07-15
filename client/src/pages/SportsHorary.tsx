import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";

/**
 * SPORTS HORARY PAGE  (route: /sports)
 * ----------------------------------------------------------------------------
 * A self-contained layer with its OWN chat box. The deterministic engine
 * (server/sportsHorary.ts) scores the chart; the LLM narrates the verdict.
 * You enter the two sides + the event-chart placements, then ask the oracle.
 */

const TRANSIT_PLACEHOLDER = `Paste the event-chart placements (the sky at game time). One planet per line, e.g.:
Sun: 15° Leo, 5th house
Moon: 10° Cancer, 4th house
Mars: 5° Aries, 1st house
Mercury: 20° Leo, 5th house
Jupiter: 8° Sagittarius, 9th house
Venus: 12° Libra, 7th house
Saturn: 25° Capricorn, 10th house`;

type Verdict = "Favorite" | "Challenger" | "Even";

function VerdictBanner({
  verdict,
  score,
  flags,
  favorite,
  challenger,
}: {
  verdict: Verdict;
  score: number;
  flags: string[];
  favorite: string;
  challenger: string;
}) {
  const winner =
    verdict === "Favorite"
      ? favorite || "Favorite"
      : verdict === "Challenger"
        ? challenger || "Challenger"
        : "Too close to call";
  const color =
    verdict === "Favorite"
      ? "#16a34a"
      : verdict === "Challenger"
        ? "#dc2626"
        : "#d97706";
  return (
    <div
      className="rounded-lg border-2 p-4 mb-4"
      style={{ borderColor: color, background: `${color}1a` }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-70">
            Engine verdict
          </div>
          <div className="text-2xl font-bold" style={{ color }}>
            {winner}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide opacity-70">
            Composite score
          </div>
          <div className="text-2xl font-mono font-bold" style={{ color }}>
            {score > 0 ? `+${score}` : score}
          </div>
        </div>
      </div>
      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {flags.map(f => (
            <span
              key={f}
              className="text-xs px-2 py-0.5 rounded border"
              style={{ borderColor: color, color }}
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SportsHorary() {
  const [favorite, setFavorite] = useState("");
  const [challenger, setChallenger] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [transitInput, setTransitInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<{
    verdict: Verdict;
    score: number;
    flags: string[];
  } | null>(null);

  const calculateChart = trpc.ephemeris.calculate.useMutation({
    onSuccess: data => {
      const chartText = Object.entries(data.planets)
        .map(([planet, info]: [string, any]) => {
          const house = info.house ? `, ${info.house}th house` : "";
          const retrograde = info.retrograde ? " Rx" : "";
          return `${planet}: ${info.degree.toFixed(2)}° ${info.sign}${house}${retrograde}`;
        })
        .join("\n");
      setTransitInput(chartText);
    },
    onError: err => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Could not calculate chart: ${err.message}` },
      ]);
    },
  });

  const ask = trpc.sportsHorary.ask.useMutation({
    onSuccess: data => {
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      setResult({
        verdict: data.verdict as Verdict,
        score: data.score,
        flags: data.flags,
      });
    },
    onError: err => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `The sky is clouded: ${err.message}` },
      ]);
    },
  });

  const handleCalculateChart = () => {
    if (!eventDate || !eventTime) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "I need the event date and time to calculate the chart." },
      ]);
      return;
    }
    const [year, month, day] = eventDate.split("-");
    const [hours, minutes] = eventTime.split(":");
    calculateChart.mutate({
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hours: parseInt(hours),
      minutes: parseInt(minutes),
      seconds: 0,
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "UTC",
      locationName: eventLocation || "Event location",
    });
  };

  const handleSend = (content: string) => {
    if (transitInput.trim().length < 10) {
      setMessages(prev => [
        ...prev,
        { role: "user", content },
        {
          role: "assistant",
          content:
            "I need the event-chart placements first — paste the sky at game time in the box above, then ask.",
        },
      ]);
      return;
    }
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    ask.mutate({
      question: content,
      transitPlacements: transitInput,
      favoriteName: favorite || undefined,
      challengerName: challenger || undefined,
      history: messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-primary hover:opacity-70 transition">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "serif" }}>
            Sports Horary
          </h1>
          <div style={{ width: "120px" }} />
        </div>
        <p className="text-sm opacity-70 text-center mb-6">
          Ascendant (H1) = Favorite · Descendant (H7) = Challenger. The engine
          scores the chart; the oracle explains the call.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            value={favorite}
            onChange={e => setFavorite(e.target.value)}
            placeholder="Favorite (H1)"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
          <input
            value={challenger}
            onChange={e => setChallenger(e.target.value)}
            placeholder="Challenger (H7)"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            placeholder="Event Date"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
          <input
            type="time"
            value={eventTime}
            onChange={e => setEventTime(e.target.value)}
            placeholder="Event Time"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
          <input
            value={eventLocation}
            onChange={e => setEventLocation(e.target.value)}
            placeholder="Location"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
        </div>

        <button
          onClick={handleCalculateChart}
          disabled={calculateChart.isPending || !eventDate || !eventTime}
          className="w-full mb-4 rounded-lg bg-primary text-primary-foreground p-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {calculateChart.isPending ? "Calculating..." : "✦ Calculate Event Chart ✦"}
        </button>

        <textarea
          value={transitInput}
          onChange={e => setTransitInput(e.target.value)}
          placeholder={TRANSIT_PLACEHOLDER}
          className="w-full rounded-lg border-2 border-border bg-card p-3 text-sm min-h-[160px] font-mono mb-4"
        />

        {result && (
          <VerdictBanner
            verdict={result.verdict}
            score={result.score}
            flags={result.flags}
            favorite={favorite}
            challenger={challenger}
          />
        )}

        <AIChatBox
          messages={messages}
          onSendMessage={handleSend}
          isLoading={ask.isPending}
          height="520px"
          placeholder="Ask the oracle: who wins tonight?"
          emptyStateMessage="Enter the chart above, then ask who takes the contest."
          suggestedPrompts={[
            "Who wins this contest?",
            "Is this an upset or does the favorite hold?",
            "How close is it — blowout or nail-biter?",
          ]}
        />
      </div>
    </div>
  );
}
