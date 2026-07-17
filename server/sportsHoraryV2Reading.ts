/**
 * SPORTS HORARY V2 READING — The Firmament
 * ============================================================================
 * Uses the proven V1 engine (calculateCompositeScore) with full rulebook logic.
 * Builds SportsHoraryChart from astro data and runs the authoritative engine.
 * ============================================================================
 */

import { invokeLLM, type Message } from "./_core/llm";
import {
  runAstroReading,
  type PlanetPlacement,
} from "./astroEngine";
import { calculateCompositeScore, type SportsScore } from "./sportsHorary";
import { buildSportsHoraryChartViaLLM } from "./sportsHoraryReading";
import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { runHybridPrediction, formatHybridReport } from "./sportsHoraryHybrid";

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
}

function buildReadingPrompt(
  input: SportsHoraryV2Input,
  score: SportsScore,
  factsSummary: string,
): string {
  const fav = input.favoriteName || "the Favorite (Ascendant / H1)";
  const chall = input.challengerName || "the Challenger (Descendant / H7)";
  const winner =
    score.verdict === "Favorite"
      ? fav
      : score.verdict === "Challenger"
        ? chall
        : "Neither cleanly — it reads Even / too close to call";

  return `You are the Firmament sports oracle, reading a horary chart cast for a contest through the sidereal, traditional-Vedic framework (fixed dome sky, Vedic rulers, fixed stars, no precession).

The SPORTS HORARY MASTER RULEBOOK engine has already judged this chart. Its verdict is AUTHORITATIVE — your job is to NARRATE and EXPLAIN that call, not to overturn it.

CONTEST:
- FAVORITE (Ascendant / H1 / L1): ${fav}
- CHALLENGER (Descendant / H7 / L7): ${chall}
- QUESTION: ${input.question}

ENGINE VERDICT (authoritative):
- Composite score: ${score.score}  (positive favors ${fav}, negative favors ${chall}; |score| ≥ 5 is a call, otherwise Even)
- VERDICT: ${score.verdict}  →  ${winner}
- Flags: ${score.flags.length ? score.flags.join(", ") : "(none)"}

SCORE BREAKDOWN (how points were calculated):
${score.breakdown.length ? score.breakdown.map(b => `  ${b}`).join("\n") : "  (no points awarded)"}

CHART FACTORS THE ENGINE READ:
${factsSummary}

WRITE THE READING:
1. Open with the CALL — who wins (or that it's Even/too close), stated plainly, tied to the score.
2. Explain the mechanics: which lord (L1 vs L7) is stronger and why, citing the specific placements/dignities/aspects above.
3. If any override flag fired (Regulus force, Algol doom, via combusta, VOC stalemate), lead with it.
4. End with a confidence read: a score far from 0 is a strong call; a score near 0 (Even) means genuinely too close.

VOICE: A master of the ancient sky sitting across the table. Direct, specific, no hedging. Every claim traces to a named placement. Use Markdown headers.`;
}

/** Render the key engine inputs as readable lines for the prompt. */
function summarizeFacts(c: any): string {
  const lordLine = (label: string, l: any) => {
    let line = `${label}: ${l.planet} in H${l.house}` +
      ` (${l.dignity}` +
      `${l.combust ? ", combust" : ""}${l.cazimi ? ", cazimi" : ""}` +
      `${l.besieged ? ", besieged" : ""}` +
      `${l.maleficFromDeathHouses ? ", afflicted from H6/H8" : ""}` +
      `${l.beneficAspect ? ", benefic support" : ""}`;

    if (l.fixedStar) {
      line += `, conjunct ${l.fixedStar.name} (${l.fixedStar.influence})`;
    }
    line += ")";
    return line;
  };
  return [
    lordLine("Favorite lord (L1)", c.l1),
    lordLine("Challenger lord (L7)", c.l7),
    `Moon: ${c.moon.phase}, in H${c.moon.house}`,
    `Lord-to-lord aspect: ${c.lordAspect.type ?? "none"}`,
    c.l1l7MutualReception ? "L1/L7 in mutual reception" : null,
    c.maleficsInFavUpachaya ? `${c.maleficsInFavUpachaya} malefic(s) in Favorite upachaya` : null,
    c.maleficsInChallUpachaya ? `${c.maleficsInChallUpachaya} malefic(s) in Challenger upachaya` : null,
  ]
    .filter(Boolean)
    .join("\n");
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
    };
  }

  // Use V2 engine (layered) instead of flat V1
  const v2Results = calculateSportsHoraryV2(chartFacts);
  const v2Report = generateSportsHoraryV2Report(
    v2Results,
    {
      favoriteTeam: input.favoriteName || "Favorite",
      challengerTeam: input.challengerName || "Challenger",
    },
    chartFacts
  );

  // Try to also run hybrid system (10-house cluster + V2)
  let hybridReport = "";
  try {
    const rawChart = usedChart === "transit" ? transits : natal;
    // Extract house cusps from result if available
    const houseCusps: Record<number, { sign: string; degree: number }> = {};
    if (result?.houseCusps) {
      Object.assign(houseCusps, result.houseCusps);
    }

    if (Object.keys(houseCusps).length >= 10) {
      const hybridResult = runHybridPrediction(
        chartFacts,
        rawChart,
        houseCusps,
        input.favoriteName || "Favorite",
        input.challengerName || "Challenger"
      );
      hybridReport = formatHybridReport(hybridResult, "", v2Report, input.favoriteName, input.challengerName);
    }
  } catch (e) {
    // If hybrid system fails, just continue with V2
    // console.error("Hybrid system error:", e);
  }

  const systemPrompt = buildReadingPrompt(input, calculateCompositeScore(chartFacts), summarizeFacts(chartFacts));

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
    verdict: v2Results.prediction.winner,
    score: v2Results.dominance.dominanceScore,
    flags: [],
    usedChart,
  };
}
