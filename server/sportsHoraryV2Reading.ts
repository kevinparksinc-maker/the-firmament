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

  // Calculate Arabic Lots if we have Ascendant
  let lots: ChartData["lots"] = [];
  if (ascendant !== undefined) {
    const rawLots = calculateArabicLots(chart, ascendant, false);
    lots = rawLots.map((lot) => ({
      name: lot.name,
      house: 1,
      sign: lot.sign,
      degree: lot.degree,
      longitude: lot.longitude,
      meaning: lot.meaning,
      formula: lot.formula,
    }));
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

  return `You are the Firmament sports oracle, reading a horary chart cast for a contest through the sidereal, traditional-Vedic framework (fixed dome sky, Vedic rulers, fixed stars, territorial control).

The MASTER PREDICTION ENGINE has judged this chart by analyzing all 10 cluster houses (both sides), territorial control, dignity multipliers, nakshatra influences, and planet relationship friction.

CONTEST:
- FAVORITE: ${fav}
- CHALLENGER: ${chall}
- QUESTION: ${input.question}

ENGINE VERDICT (authoritative):
- Side A (Favorite) Total: ${result.sideATotal}
- Side B (Challenger) Total: ${result.sideBTotal}
- Margin: ${result.margin}
- Confidence: ${result.confidence}%
- WINNER: ${winner}

TERRITORIAL SCORING LAYERS:
${breakdown}

WRITE THE READING:
1. Open with the CALL — who wins or that it's too close, tied to the territorial margin.
2. Explain which cluster (Favorite or Challenger) dominates and why.
3. Highlight any major reversals (displaced lords, territorial invasions).
4. Confidence: a wide margin means a strong call; a narrow margin means genuine suspense.

VOICE: A master of the ancient sky. Direct, specific, no hedging. Every claim traces to house lord positions and dignity. Use Markdown headers.`;
}

export async function sportsHoraryV2Layer(
  input: SportsHoraryV2Input,
): Promise<SportsHoraryV2Output> {
  const { result } = runAstroReading(input.natalText, input.transitText, "");

  const transits = result?.transits ?? {};
  const natal = result?.natal ?? {};
  const usedChart: "transit" | "natal" =
    Object.keys(transits).length >= 5 ? "transit" : "natal";

  const chartFacts = await buildSportsHoraryChartViaLLM(
    usedChart === "transit" ? transits : natal,
    input.favoriteName || "Favorite",
    input.challengerName || "Challenger"
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
  const chartData = buildChartData(chart);

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
