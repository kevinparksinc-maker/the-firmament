import { calculateCompositeScore, type SportsHoraryChart } from "./sportsHorary";
import type { EngineResults } from "./sportsHoraryV2/types";

/**
 * V2 ENGINE: Wraps your V1 rulebook (calculateCompositeScore) and maps output
 * into 16-layer breakdown so you can see which layer contributed what.
 */
export function calculateSportsHoraryV2(chart: SportsHoraryChart): EngineResults {
  const v1Result = calculateCompositeScore(chart);

  // Map V1's flat breakdown into layer categories
  const layerMap = mapV1ToLayers(v1Result.breakdown);

  const results: EngineResults = {
    radicality: {
      score: 0,
      confidence: 100,
      explanation: "Chart analysis proceeding",
      factors: ["Using V1 Master Rulebook logic"],
    },
    teamAssignment: {
      score: 0,
      confidence: 100,
      explanation: "Favorite to H1, Challenger to H7",
      factors: [],
    },
    houseStrength: {
      score: layerMap.houseStrength,
      h1Score: 0,
      h7Score: 0,
      netScore: layerMap.houseStrength,
      confidence: 85,
      explanation: "House placement & dignities",
      factors: layerMap.houseStrengthFactors,
    },
    lordBattle: {
      score: layerMap.lordBattle,
      confidence: 85,
      explanation: "L1 vs L7 dignity & position",
      factors: layerMap.lordBattleFactors,
    },
    lunar: {
      score: layerMap.lunar,
      confidence: 80,
      explanation: "Moon phase & position",
      factors: layerMap.lunarFactors,
    },
    nodes: {
      score: 0,
      confidence: 0,
      explanation: "Rahu/Ketu not separately scored in V1",
      factors: [],
    },
    fixedStars: {
      score: layerMap.fixedStars,
      confidence: 90,
      explanation: "Fixed star conjunctions",
      factors: layerMap.fixedStarsFactors,
    },
    aspectNetwork: {
      score: layerMap.aspects,
      confidence: 80,
      explanation: "Lord-to-lord aspects & motion",
      factors: layerMap.aspectFactors,
    },
    essentialDignity: {
      score: 0,
      confidence: 0,
      explanation: "Included in Lord Battle layer",
      factors: [],
    },
    accidentalDignity: {
      score: 0,
      confidence: 0,
      explanation: "Included in House Strength layer",
      factors: [],
    },
    houseThemes: {
      score: 0,
      confidence: 0,
      explanation: "Included in House Strength layer",
      factors: [],
    },
    momentum: {
      score: 0,
      confidence: 0,
      explanation: "Included in Aspect Network layer",
      factors: [],
    },
    dominance: {
      h1Strength: v1Result.score > 0 ? v1Result.score : 0,
      h7Strength: v1Result.score < 0 ? Math.abs(v1Result.score) : 0,
      dominanceScore: v1Result.score,
      classification: classifyDominance(v1Result.score),
    },
    confidence: {
      percentage: calculateConfidenceFromScore(v1Result.score, v1Result.flags),
      agreement: `V1 Master Rulebook verdict: ${v1Result.verdict}`,
    },
    prediction: {
      winner: v1Result.verdict,
      winProbability: scoreToProbability(v1Result.score),
      topStrengths: v1Result.breakdown.filter(b => b.includes("+")).slice(0, 3),
      topWeaknesses: v1Result.breakdown.filter(b => b.includes("-")).slice(0, 3),
      upsetWarning: v1Result.flags.includes("upset_alert") || Math.abs(v1Result.score) < 5,
    },
  };

  return results;
}

function mapV1ToLayers(breakdown: string[]): any {
  const map: any = {
    houseStrength: 0,
    houseStrengthFactors: [],
    lordBattle: 0,
    lordBattleFactors: [],
    lunar: 0,
    lunarFactors: [],
    fixedStars: 0,
    fixedStarsFactors: [],
    aspects: 0,
    aspectFactors: [],
  };

  for (const line of breakdown) {
    const match = line.match(/^([+-]\d+)\s*—\s*(.+)$/);
    if (!match) continue;

    const pts = parseInt(match[1]);
    const reason = match[2];

    // Categorize by keyword — check in order of specificity
    if (reason.includes("conjunct") || reason.includes("Star")) {
      map.fixedStars += pts;
      map.fixedStarsFactors.push(line);
    } else if (reason.includes("Moon") || reason.includes("phase") || reason.includes("waxing") || reason.includes("waning")) {
      map.lunar += pts;
      map.lunarFactors.push(line);
    } else if (reason.includes("aspect") || reason.includes("Planetary Hour") || reason.includes("Translation") || reason.includes("Peregrine") || reason.includes("Via Combusta") || reason.includes("faster planet") || reason.includes("Aspect")) {
      map.aspects += pts;
      map.aspectFactors.push(line);
    } else if (reason.includes("Destruction") || reason.includes("Offensive") || reason.includes("Invasion") || reason.includes("Defensive") || reason.includes("Clutch") || reason.includes("Kendra") || reason.includes("Upachaya") || reason.includes("Point-Zero")) {
      map.houseStrength += pts;
      map.houseStrengthFactors.push(line);
    } else if (reason.includes("L1") || reason.includes("L7") || reason.includes("dignity") || reason.includes("Besieged") || reason.includes("Cazimi") || reason.includes("Combust") || reason.includes("Affliction") || reason.includes("8th House") || reason.includes("Benefic Support")) {
      map.lordBattle += pts;
      map.lordBattleFactors.push(line);
    }
  }

  return map;
}

function classifyDominance(score: number): "toss-up" | "slight" | "strong" | "heavy" | "blowout" {
  const mag = Math.abs(score);
  if (mag <= 5) return "toss-up";
  if (mag <= 12) return "slight";
  if (mag <= 20) return "strong";
  if (mag <= 30) return "heavy";
  return "blowout";
}

function calculateConfidenceFromScore(score: number, flags: string[]): number {
  let conf = Math.min(95, 60 + Math.abs(score) * 2);
  if (flags.includes("STALEMATE")) conf -= 30;
  if (flags.includes("mutual_reception_override")) conf -= 20;
  return Math.max(40, conf);
}

function scoreToProbability(score: number): number {
  if (score >= 5) return Math.min(95, 50 + score * 2);
  if (score <= -5) return Math.max(5, 50 + score * 2);
  return 50;
}

export function generateSportsHoraryV2Report(results: EngineResults, chart: { favoriteTeam: string; challengerTeam: string }): string {
  const lines: string[] = [];

  lines.push("════════════════════════════════════════════════════════════════");
  lines.push("SPORTS HORARY V2 — LAYERED BREAKDOWN (using V1 Master Rulebook)");
  lines.push("════════════════════════════════════════════════════════════════\n");

  lines.push(`FAVORITE (Ascendant/H1):    ${chart.favoriteTeam}`);
  lines.push(`CHALLENGER (Descendant/H7): ${chart.challengerTeam}\n`);

  lines.push(`VERDICT: ${results.prediction.winner}`);
  lines.push(`SCORE: ${results.dominance.dominanceScore}`);
  lines.push(`WIN PROBABILITY: ${results.prediction.winProbability}%`);
  lines.push(`DOMINANCE: ${results.dominance.classification}\n`);

  lines.push("LAYER CONTRIBUTIONS:");
  const layers: Array<[string, any]> = [
    ["House Strength", results.houseStrength],
    ["Lord Battle", results.lordBattle],
    ["Lunar", results.lunar],
    ["Fixed Stars", results.fixedStars],
    ["Aspects & Motion", results.aspectNetwork],
  ];

  for (const [name, layer] of layers) {
    if (typeof layer === "object" && layer && "score" in layer && layer.score !== 0) {
      const sign = layer.score > 0 ? "+" : "";
      lines.push(`  ${(name as string).padEnd(18)} ${sign}${layer.score}`);
      if (layer.factors && Array.isArray(layer.factors) && layer.factors.length > 0) {
        layer.factors.forEach((f: string) => lines.push(`    • ${f}`));
      }
    }
  }

  lines.push("\n" + "════════════════════════════════════════════════════════════════");

  return lines.join("\n");
}
