/**
 * SPORTS HORARY READING — The Firmament
 * ============================================================================
 * Uses the Master Prediction Engine for territorial cluster scoring.
 * Evaluates all 10 cluster houses per side with multipliers and LLM narration.
 * ============================================================================
 */

import { invokeLLM, type Message } from "./_core/llm";
import {
  runAstroReading,
  SIGN_RULERS,
  SIGN_ORDER,
  buildEqualHouseCusps,
  detectMoonPhase,
  type PlanetPlacement,
} from "./astroEngine";
import { calculateFullPrediction, type ChartData, type ClusterConfig, assignHousesToLots } from "./masterPredictionEngine";
import { getNakshatraAt } from "./nakshatra";
import { calculateArabicLots } from "./arabicLotsCalculator";

type Chart = Record<string, PlanetPlacement>;

export interface SportsHoraryOutput {
  answer: string;
  score: { score: number; verdict: string; flags: string[]; breakdown: string[] };
  usedChart: "transit" | "natal";
}

export function buildChartData(chart: Chart, ascendant?: number): ChartData {
  const houseLords: ChartData["houseLords"] = [];
  const planetsInHouses: ChartData["planetsInHouses"] = [];

  for (const [planetName, placement] of Object.entries(chart)) {
    const siderealLon = SIGN_ORDER.indexOf(placement.sign) * 30 + placement.degree;
    const nakshatra = getNakshatraAt(siderealLon);

    const planetPlacement: PlanetPlacement = {
      planet: planetName,
      house: placement.house,
      sign: placement.sign,
      degree: placement.degree,
      siderealLon,
      isRetrograde: placement.rx || false,
      nakshatra: nakshatra.nakshatra.name,
    };

    planetsInHouses.push(planetPlacement);

    const signLord = SIGN_RULERS[placement.sign];
    if (signLord && planetName === signLord) {
      houseLords.push({
        house: placement.house,
        lordPlanet: planetName,
        placement: planetPlacement,
      });
    }
  }

  // Calculate Arabic Lots if we have a real Ascendant (assumes daytime by default —
  // pass isNight through properly once day/night detection is wired at the caller).
  let lots: ChartData["lots"] = [];
  if (ascendant !== undefined) {
    const rawLots = calculateArabicLots(chart, ascendant, false);
    const cusps = buildEqualHouseCusps(ascendant);
    lots = assignHousesToLots(rawLots, cusps);
  }

  // Real Moon phase from the chart instead of a hardcoded stub.
  // Void-of-course detection isn't implemented yet — flagged false rather than
  // silently faked as a specific state; the Moon layer still fires, just
  // without a VOC penalty until that detection exists.
  const moonTone = detectMoonPhase(chart);
  const moonPhase: ChartData["moon"]["phase"] =
    moonTone?.includes("New Moon") ? "new" :
    moonTone?.includes("Full Moon") ? "full" :
    moonTone?.includes("Waning") ? "waning" : "waxing";

  return {
    houseLords,
    planetsInHouses,
    lots,
    fixedStars: [],
    aspects: [],
    moon: {
      phase: moonPhase,
      isVoidOfCourse: false,
      nakshatra: chart.Moon ? getNakshatraAt(SIGN_ORDER.indexOf(chart.Moon.sign) * 30 + chart.Moon.degree).nakshatra.name : "Ashwini",
    },
  };
}

export async function buildSportsHoraryChartViaLLM(
  chart: Chart,
  _favoriteTeam: string,
  _challengerTeam: string,
  ascendant?: number,
): Promise<ChartData | null> {
  const placementCount = Object.keys(chart).length;
  if (placementCount < 5) {
    return null;
  }
  return buildChartData(chart, ascendant);
}

function buildReadingPrompt(
  input: { question: string; favoriteName?: string; challengerName?: string },
  prediction: ReturnType<typeof calculateFullPrediction>,
  breakdown: string,
): string {
  const fav = input.favoriteName || "Favorite";
  const chall = input.challengerName || "Challenger";
  const winner =
    prediction.predictedWinner === "A"
      ? fav
      : prediction.predictedWinner === "B"
        ? chall
        : "Neither — too close to call";

  const margin = Math.abs(prediction.margin);
  const favTotal = prediction.sideATotal;
  const challTotal = prediction.sideBTotal;
  const isCloseCall = margin < 10;

  return `You are the Firmament oracle — master of territorial control and celestial verdict.

CRITICAL: Do NOT generate template prose. Do NOT say "dead even" or "both hands empty" if the data shows a clear winner.

ACTUAL ENGINE COMPUTED DATA (reference these exact values in your narration):
- ${fav} (Side A) Total: ${favTotal.toFixed(2)} points
- ${chall} (Side B) Total: ${challTotal.toFixed(2)} points
- Margin: ${margin.toFixed(2)} points
- Confidence: ${prediction.confidence}%
- Verdict: ${winner}
- Call Type: ${isCloseCall ? "Close call" : "Clear call"}

SCORING BREAKDOWN (cite these in your reading):
${breakdown}

MANDATORY INSTRUCTIONS:
1. **NEVER say "dead even" if margin is NOT zero.** If margin is ${margin}, explicitly state the gap.
2. **Reference the actual totals.** Example: "${fav} accumulated ${favTotal.toFixed(1)} points across the cluster, while ${chall} registered ${challTotal.toFixed(1)} — a swing of ${margin.toFixed(1)} in favor of ${favTotal > challTotal ? fav : chall}."
3. **If lots are scored, reference them.** Don't say "both hands empty" — say which lots landed where and what side they favor.
4. **Confidence language:** Margin < 5 = "genuine uncertainty"; 5–15 = "moderate edge"; > 15 = "clear advantage"
5. **No generic templates.** Every sentence must trace to the specific numbers above.

STRUCTURE:
- **The Verdict** (state the winner plainly, cite the margin)
- **Why** (which houses/lords dominated, reference the breakdown)
- **Confidence** (tie it to the margin value — don't invent a generic percentage)
- **Final Word** (one sentence oracle wisdom)

TONE: Direct, specific, data-grounded oracle. Every claim is traceable to a named placement or scored layer above.`;
}

export async function sportsHoraryLayer(input: {
  question: string;
  natalText: string;
  transitText: string;
  favoriteName?: string;
  challengerName?: string;
  history?: Message[];
}): Promise<SportsHoraryOutput> {
  const { result } = runAstroReading(input.natalText, input.transitText, "");

  const transits = result?.transits ?? {};
  const natal = result?.natal ?? {};
  const usedChart: "transit" | "natal" =
    Object.keys(transits).length >= 5 ? "transit" : "natal";

  const chart = usedChart === "transit" ? transits : natal;
  // This was the root bug: ascendant was parsed by astroEngine but never
  // retrieved here, so it was always undefined and Arabic Lots were always [].
  const ascendant = result?.ascendant ?? undefined;
  const chartData = await buildSportsHoraryChartViaLLM(
    chart,
    input.favoriteName || "Favorite",
    input.challengerName || "Challenger",
    ascendant
  );

  if (!chartData || chartData.houseLords.length === 0) {
    return {
      answer:
        "I couldn't resolve enough placements to cast the sports chart — I need at least 5+ planets with signs and houses. Paste a full chart and try again.",
      score: { score: 0, verdict: "Even", flags: ["insufficient_data"], breakdown: [] },
      usedChart,
    };
  }

  const config: ClusterConfig = {
    sideAHouses: [1, 3, 6, 10, 11],
    sideBHouses: [7, 9, 12, 4, 5],
    sideALabel: input.favoriteName || "Favorite",
    sideBLabel: input.challengerName || "Challenger",
  };

  const prediction = calculateFullPrediction(chartData, config);

  const breakdown = prediction.breakdown
    .map(layer => `• ${layer.layer}: A=${layer.sideAPoints} B=${layer.sideBPoints}`)
    .join("\n");

  const systemPrompt = buildReadingPrompt(input, prediction, breakdown);

  const messages: Message[] = [
    ...(input.history || []),
    { role: "user", content: input.question },
  ];

  const response = await invokeLLM({
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 2500,
  });

  const verdict = prediction.predictedWinner === "A" ? "Favorite" : prediction.predictedWinner === "B" ? "Challenger" : "Even";

  return {
    answer: (response.choices[0].message.content as string).trim(),
    score: {
      score: prediction.sideATotal - prediction.sideBTotal,
      verdict,
      flags: [],
      breakdown: prediction.breakdown.map(b => `${b.layer}: A=${b.sideAPoints} B=${b.sideBPoints}`)
    },
    usedChart,
  };
}
