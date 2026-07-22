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
  type PlanetPlacement,
} from "./astroEngine";
import { calculateFullPrediction, type ChartData, type ClusterConfig } from "./masterPredictionEngine";
import { getNakshatraAt } from "./nakshatra";

type Chart = Record<string, PlanetPlacement>;

export interface SportsHoraryOutput {
  answer: string;
  score: { score: number; verdict: string; flags: string[]; breakdown: string[] };
  usedChart: "transit" | "natal";
}

function buildChartData(chart: Chart): ChartData {
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

  return {
    houseLords,
    planetsInHouses,
    lots: [],
    fixedStars: [],
    aspects: [],
    moon: {
      phase: "waxing",
      isVoidOfCourse: false,
      nakshatra: "Ashwini",
    },
  };
}

export async function buildSportsHoraryChartViaLLM(
  chart: Chart,
  _favoriteTeam: string,
  _challengerTeam: string,
): Promise<ChartData | null> {
  const placementCount = Object.keys(chart).length;
  if (placementCount < 5) {
    return null;
  }
  return buildChartData(chart);
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

  return `You are the Firmament oracle — master of the fixed dome, Vedic rulers, territorial control, and fixed stars.

The MASTER PREDICTION ENGINE has judged this chart by analyzing all 10 cluster houses (both sides). Its verdict is FINAL. Your role is to EXPLAIN and NARRATE that call.

CONTEST:
- FAVORITE: ${fav}
- CHALLENGER: ${chall}
- QUESTION: ${input.question}

ENGINE VERDICT:
- Side A (${fav}) Total: ${prediction.sideATotal}
- Side B (${chall}) Total: ${prediction.sideBTotal}
- Margin: ${prediction.margin} points
- Confidence: ${prediction.confidence}%
- WINNER: ${winner}

TERRITORIAL SCORING LAYERS:
${breakdown}

WRITE THE READING:
1. START with the verdict plainly — who wins or if it's too close to call.
2. EXPLAIN the territorial advantage — which cluster dominates and why.
3. Highlight any major reversals (displaced lords, territorial invasions, friction multipliers).
4. CONFIDENCE: a wide margin means a strong call; a narrow margin means genuine uncertainty.

TONE: Wise, direct oracle. No hedging. Every word traces to a house lord position and territorial control. Use Markdown headers.`;
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
  const chartData = await buildSportsHoraryChartViaLLM(
    chart,
    input.favoriteName || "Favorite",
    input.challengerName || "Challenger"
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
