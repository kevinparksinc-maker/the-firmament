import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { speak, stopSpeaking, isSpeaking } from "@/lib/textToSpeech";
import { Volume2, Square } from "lucide-react";

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

const MAJOR_CITIES = {
  "New York": { lat: 40.7128, lon: -74.006 },
  "Los Angeles": { lat: 34.0522, lon: -118.2437 },
  "Chicago": { lat: 41.8781, lon: -87.6298 },
  "Houston": { lat: 29.7604, lon: -95.3698 },
  "Phoenix": { lat: 33.4484, lon: -112.074 },
  "Philadelphia": { lat: 39.9526, lon: -75.1652 },
  "San Antonio": { lat: 29.4241, lon: -98.4936 },
  "San Diego": { lat: 32.7157, lon: -117.1611 },
  "Dallas": { lat: 32.7767, lon: -96.797 },
  "San Jose": { lat: 37.3382, lon: -121.8863 },
  "Miami": { lat: 25.7617, lon: -80.1918 },
  "Denver": { lat: 39.7392, lon: -104.9903 },
  "Seattle": { lat: 47.6062, lon: -122.3321 },
  "Boston": { lat: 42.3601, lon: -71.0589 },
  "Las Vegas": { lat: 36.1699, lon: -115.1398 },
  "Atlanta": { lat: 33.749, lon: -84.388 },
  "London": { lat: 51.5074, lon: -0.1278 },
  "Paris": { lat: 48.8566, lon: 2.3522 },
  "Tokyo": { lat: 35.6762, lon: 139.6503 },
  "Sydney": { lat: -33.8688, lon: 151.2093 },
  "Mumbai": { lat: 19.0760, lon: 72.8777 },
  "Dubai": { lat: 25.2048, lon: 55.2708 },
  "Singapore": { lat: 1.3521, lon: 103.8198 },
  "Toronto": { lat: 43.6532, lon: -79.3832 },
  "Mexico City": { lat: 19.4326, lon: -99.1332 },
};

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
  const [eventHour, setEventHour] = useState("");
  const [eventMinute, setEventMinute] = useState("");
  const [selectedCity, setSelectedCity] = useState("New York");
  const [customLocation, setCustomLocation] = useState("");
  const [transitInput, setTransitInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<{
    verdict: Verdict;
    score: number;
    flags: string[];
  } | null>(null);
  const [isSpeakingAnswer, setIsSpeakingAnswer] = useState(false);
  const [calculatedChart, setCalculatedChart] = useState<any>(null);

  const calculateChart = trpc.ephemeris.calculate.useMutation({
    onSuccess: data => {
      // Store the full chart data for territorial control
      setCalculatedChart(data);

      // Use enriched text (with nakshatras, decans, fixed stars) if available, otherwise fall back to basic format
      const chartText = data.enrichedText || Object.entries(data.planets)
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

  const askWithChart = trpc.sportsHorary.askWithChart.useMutation({
    onSuccess: data => {
      const tcReport = data.territorialControl?.fullReport ? `\n\n**TERRITORIAL CONTROL**\n${data.territorialControl.fullReport}` : "";
      setMessages(prev => [...prev, { role: "assistant", content: data.answer + tcReport }]);
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
    if (!eventDate) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "I need the event date to calculate the chart." },
      ]);
      return;
    }

    // Validate date
    if (!eventDate) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "I need the event date to calculate the chart." },
      ]);
      return;
    }

    try {
      const dateParts = eventDate.split("-");
      const year = parseInt(dateParts[0]) || new Date().getFullYear();
      const month = parseInt(dateParts[1]) || 1;
      const day = parseInt(dateParts[2]) || 1;

      // Parse time: default to noon if empty or invalid
      let hours = 12;
      let minutes = 0;
      let timeProvided = false;

      if (eventHour) {
        const h = parseInt(eventHour);
        if (!isNaN(h) && h >= 0 && h <= 23) {
          hours = h;
          timeProvided = true;
        }
      }

      if (eventMinute) {
        const m = parseInt(eventMinute);
        if (!isNaN(m) && m >= 0 && m <= 59) {
          minutes = m;
          timeProvided = true;
        }
      }

      if (!timeProvided) {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: `No event time provided — using noon (12:00 UTC) as default. For better accuracy, enter the actual event time.`,
          },
        ]);
      }

      // Get coordinates
      const city = MAJOR_CITIES[selectedCity as keyof typeof MAJOR_CITIES];
      const coords = city || { lat: 40.7128, lon: -74.006 };

      console.log("[SportsHorary DEBUG] hours type:", typeof hours, "value:", hours);
      console.log("[SportsHorary DEBUG] minutes type:", typeof minutes, "value:", minutes);
      console.log("[SportsHorary DEBUG] eventHour:", eventHour, "eventMinute:", eventMinute);

      const payload = {
        year,
        month,
        day,
        hour: hours,
        minute: minutes,
        latitude: coords.lat,
        longitude: coords.lon,
        altitude: 0,
      };

      console.log("[SportsHorary] Sending calculate-chart payload:", JSON.stringify(payload));
      calculateChart.mutate(payload);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Error with date/time. Try again." },
      ]);
    }
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

    // If we have a calculated chart, use the full territorial control analysis
    if (calculatedChart && calculatedChart.planets && calculatedChart.houses?.cusps) {
      askWithChart.mutate({
        question: content,
        planets: calculatedChart.planets.map((p: any) => ({
          planet: p.name,
          degree: p.degree,
          sign: p.sign,
          house: p.house || null,
          rx: p.retrograde || false,
          absolute: p.absolute || null,
        })),
        houseCusps: calculatedChart.houses.cusps,
        favoriteName: favorite || undefined,
        challengerName: challenger || undefined,
        history: messages,
      });
    } else {
      // Fall back to text-based analysis
      ask.mutate({
        question: content,
        transitPlacements: transitInput,
        favoriteName: favorite || undefined,
        challengerName: challenger || undefined,
        history: messages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      });
    }
  };

  const handleListen = () => {
    const lastAssistantMessage = [...messages]
      .reverse()
      .find(m => m.role === "assistant");

    if (!lastAssistantMessage) return;

    if (isSpeakingAnswer) {
      stopSpeaking();
      setIsSpeakingAnswer(false);
    } else {
      speak(lastAssistantMessage.content, () => {
        setIsSpeakingAnswer(false);
      });
      setIsSpeakingAnswer(true);
    }
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

        <div className="grid grid-cols-4 gap-3 mb-3">
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            placeholder="Event Date"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
          <input
            type="number"
            value={eventHour}
            onChange={e => setEventHour(e.target.value)}
            placeholder="Hour (0–23)"
            min="0"
            max="23"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
          <input
            type="number"
            value={eventMinute}
            onChange={e => setEventMinute(e.target.value)}
            placeholder="Minute"
            min="0"
            max="59"
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          />
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            className="rounded-lg border-2 border-border bg-card p-2 text-sm"
          >
            {Object.keys(MAJOR_CITIES).map(city => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={customLocation}
          onChange={e => setCustomLocation(e.target.value)}
          placeholder="Custom location (optional, overrides city selection)"
          className="w-full rounded-lg border-2 border-border bg-card p-2 text-sm mb-3"
        />

        <button
          onClick={handleCalculateChart}
          disabled={calculateChart.isPending || !eventDate}
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
          <>
            <VerdictBanner
              verdict={result.verdict}
              score={result.score}
              flags={result.flags}
              favorite={favorite}
              challenger={challenger}
            />
            {messages.some(m => m.role === "assistant") && (
              <button
                onClick={handleListen}
                className="w-full mb-4 rounded-lg border-2 border-primary bg-primary/10 text-primary p-2 text-sm font-medium hover:bg-primary/20 transition flex items-center justify-center gap-2"
              >
                {isSpeakingAnswer ? (
                  <>
                    <Square className="size-4" />
                    Stop listening
                  </>
                ) : (
                  <>
                    <Volume2 className="size-4" />
                    Listen to the reading
                  </>
                )}
              </button>
            )}
          </>
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
