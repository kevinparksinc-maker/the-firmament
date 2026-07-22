/**
 * SPORTS HORARY MASTER READING — The Firmament
 * ============================================================================
 * Uses the Master Prediction Engine (territorial cluster scoring with all multipliers).
 * Evaluates all 10 cluster houses per side, applies friction multipliers,
 * territorial control, and fixed star influences.
 * ============================================================================
 */

import { invokeLLM, type Message } from "./_core/llm";
import {
  runAstroReading,
  type PlanetPlacement,
  SIGN_RULERS,
} from "./astroEngine";
import { buildSportsHoraryChartViaLLM } from "./sportsHoraryReading";
import { calculateFullPrediction, type ChartData, type ClusterConfig, assignHousesToLots } from "./masterPredictionEngine";
import { getNakshatraAt } from "./nakshatra";
import { SIGN_ORDER } from "./astroEngine";
import { calculateArabicLots } from "./arabicLotsCalculator";

type Chart = Record<string, PlanetPlacement>;

export interface SportsHoraryV2Input {
  question: string;
  natalText: string;
  transitText: string;
  favoriteName?: string;
  challengerName?: string;
  history?: Message[];
}

export interface SportsHoraryV2Output {
  answer: string;
  verdict: string;
  score: number;
  flags: string[];
  usedChart: "transit" | "natal";
  margin: number;
}

function buildEqualHouseCusps(ascendant: number): Record<number, { sign: string; degree: number }> {
  const cusps: Record<number, { sign: string; degree: number }> = {};
  for (let i = 0; i < 12; i++) {
    const lon = (ascendant + i * 30) % 360;
    const signIdx = Math.floor(lon / 30) % 12;
    const degree = Math.floor(lon % 30);
    cusps[i + 1] = { sign: SIGN_ORDER[signIdx], degree };
  }
  return cusps;
}

function buildChartData(chart: Chart, ascendant?: number): ChartData {
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

  // Calculate Arabic Lots with proper house assignment
  let lots: ChartData["lots"] = [];
  if (ascendant !== undefined) {
    const rawLots = calculateArabicLots(chart, ascendant, false);
    const houseCusps = buildEqualHouseCusps(ascendant);
    lots = assignHousesToLots(rawLots, houseCusps);
  }

  return {
    houseLords,
    planetsInHouses,
    lots,
    fixedStars: [],
    aspects: [],
    moon: {
      phase: "waxing",
      isVoidOfCourse: false,
      nakshatra: "Ashwini",
    },
  };
}

function buildReadingPrompt(
  input: SportsHoraryV2Input,
  result: ReturnType<typeof calculateFullPrediction>,
  breakdown: string,
): string {
  const fav = input.favoriteName || "the Favorite";
  const chall = input.challengerName || "the Challenger";
  const winner =
    result.predictedWinner === "A"
      ? fav
      : result.predictedWinner === "B"
        ? chall
        : "Neither — too close to call";

  const margin = Math.abs(result.margin);
  const favTotal = result.sideATotal;
  const challTotal = result.sideBTotal;

  return `You are the Firmament sports oracle, reading a horary chart cast for a contest through the sidereal, traditional-Vedic framework (fixed dome sky, Vedic rulers, fixed stars, territorial control).

CRITICAL: Do NOT generate template prose. Do NOT say territories are "even" if the data shows a clear advantage.

ACTUAL COMPUTED DATA (cite these exact values):
- ${fav} (Side A) Total: ${favTotal.toFixed(2)} points
- ${chall} (Side B) Total: ${challTotal.toFixed(2)} points
- Margin: ${margin.toFixed(2)} points
- Confidence: ${result.confidence}%
- Verdict: ${winner}

CONTEST:
- FAVORITE: ${fav}
- CHALLENGER: ${chall}
- QUESTION: ${input.question}

TERRITORIAL SCORING LAYERS (reference these):
${breakdown}

MANDATORY:
1. **Never say "even territory" if margin ≠ 0.** Cite the actual totals: "${fav} holds ${favTotal.toFixed(1)}, ${chall} holds ${challTotal.toFixed(1)} — a gap of ${margin.toFixed(1)}."
2. **Reference specific lots.** State which lots landed where and their impact, don't generalize.
3. **Confidence tie-in:** Margin < 5 = "too close"; 5–15 = "slight edge"; > 15 = "strong dominion"
4. **Every sentence traces to the data above.** No generic oracle boilerplate.

WRITE THE READING:
1. **The Verdict:** State the winner plainly + cite the margin in points.
2. **Territorial Dominance:** Which side accumulated more, why (lords, lots, friction multipliers).
3. **Major Shifts:** Any reversals or displaced lords that swung the contest.
4. **Confidence Statement:** Tie it directly to the margin—don't invent certainty you don't have.

TONE: Direct, specific, grounded in the data. Every claim is checkable against the layers above.

VOICE: A master of the ancient sky. Direct, specific, no hedging. Every claim traces to house lord positions and dignity. Use Markdown headers.`;
}

export async function sportsHoraryV2Layer(
  input: SportsHoraryV2Input,
): Promise<SportsHoraryV2Output> {
  const { result } = runAstroReading(input.natalText, input.transitText, "");

  const transits = result?.transits ?? {};
  const natal = result?.natal ?? {};
  const ascendant = result?.ascendant ?? undefined;
  const usedChart: "transit" | "natal" =
    Object.keys(transits).length >= 5 ? "transit" : "natal";

  const chartFacts = await buildSportsHoraryChartViaLLM(
    usedChart === "transit" ? transits : natal,
    input.favoriteName || "Favorite",
    input.challengerName || "Challenger",
    ascendant
  );

  if (!chartFacts) {
    return {
      answer: "Could not resolve enough placements to cast the sports chart.",
      verdict: "Even",
      score: 0,
      flags: ["insufficient_data"],
      usedChart,
      margin: 0,
    };
  }

  const chart = usedChart === "transit" ? transits : natal;
  const chartData = buildChartData(chart, ascendant);

  const config: ClusterConfig = {
    sideAHouses: [1, 3, 6, 10, 11],
    sideBHouses: [7, 9, 12, 4, 5],
    sideALabel: input.favoriteName || "Favorite",
    sideBLabel: input.challengerName || "Challenger",
  };

  const prediction = calculateFullPrediction(chartData, config);

  const breakdown = prediction.breakdown
    .map(layer => `  ${layer.layer}: A=${layer.sideAPoints} B=${layer.sideBPoints}`)
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

  return {
    answer: (response.choices[0].message.content as string).trim(),
    verdict: prediction.predictedWinner === "A" ? "Favorite" : prediction.predictedWinner === "B" ? "Challenger" : "Even",
    score: prediction.sideATotal - prediction.sideBTotal,
    flags: [],
    usedChart,
    margin: prediction.margin,
  };
}
