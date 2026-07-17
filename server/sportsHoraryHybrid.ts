/**
 * sportsHoraryHybrid.ts
 *
 * Runs BOTH prediction systems in parallel:
 * 1. Existing 16-layer engine (V1 rulebook)
 * 2. New 10-house cluster engine
 *
 * Outputs both predictions so you can compare approaches.
 */

import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { calculateCompositeScore } from "./sportsHorary";
import { evaluateCluster, formatClusterReport } from "./houseClusterEngine";
import type { SportsHoraryChart } from "./sportsHorary";
import type { PlanetPlacement } from "./astroEngine";

type Chart = Record<string, PlanetPlacement>;

export interface HybridPredictionResult {
  v2Prediction: {
    winner: string;
    score: number;
    confidence: number;
    dominance: string;
  };
  clusterPrediction: {
    prediction: string;
    margin: number;
    confidence: number;
    sideATotal: number;
    sideBTotal: number;
  };
  agreement: boolean;
  recommendedCall: string;
}

/**
 * Run both engines on the same chart
 */
export function runHybridPrediction(
  chart: SportsHoraryChart,
  rawChart: Chart,
  houseCusps: Record<number, { sign: string; degree: number }>,
  sideAName: string = "Favorite",
  sideBName: string = "Challenger"
): HybridPredictionResult {
  // RUN V2 ENGINE (16-layer)
  const v2Results = calculateSportsHoraryV2(chart);
  const v1Score = calculateCompositeScore(chart);

  // RUN CLUSTER ENGINE (10-house)
  const clusterResults = evaluateCluster(rawChart, houseCusps, sideAName, sideBName);

  // Map predictions to comparable format
  const v2Winner = v2Results.prediction.winner;
  const clusterWinner = clusterResults.prediction;

  const agree =
    (v2Winner === "Favorite" && clusterWinner === "Side A") ||
    (v2Winner === "Challenger" && clusterWinner === "Side B") ||
    (v2Winner === "Even" && clusterWinner === "Too close to call");

  let recommendation = agree
    ? `STRONG CALL: Both engines agree on ${v2Winner === "Favorite" ? sideAName : sideBName}`
    : `DISAGREEMENT: V2 says ${v2Winner}, Cluster says ${clusterWinner}. Caution advised.`;

  return {
    v2Prediction: {
      winner: v2Results.prediction.winner,
      score: v2Results.dominance.dominanceScore,
      confidence: v2Results.prediction.winProbability,
      dominance: v2Results.dominance.classification,
    },
    clusterPrediction: {
      prediction: clusterResults.prediction,
      margin: clusterResults.margin,
      confidence: clusterResults.confidence,
      sideATotal: clusterResults.sideATotal,
      sideBTotal: clusterResults.sideBTotal,
    },
    agreement: agree,
    recommendedCall: recommendation,
  };
}

/**
 * Format hybrid results as readable report
 */
export function formatHybridReport(
  result: HybridPredictionResult,
  clusterReport: string,
  v2Report: string,
  sideAName: string = "Favorite",
  sideBName: string = "Challenger"
): string {
  const lines: string[] = [];

  lines.push("════════════════════════════════════════════════════════════════");
  lines.push("HYBRID PREDICTION — TWO ENGINES, ONE VERDICT");
  lines.push("════════════════════════════════════════════════════════════════\n");

  lines.push(result.recommendedCall);
  lines.push("");

  if (result.agreement) {
    lines.push("✓ CONSENSUS");
  } else {
    lines.push("⚠️  CONFLICT — Engines disagree");
  }

  lines.push("\n" + "════════════════════════════════════════════════════════════════");
  lines.push("SYSTEM 1: 10-HOUSE CLUSTER ENGINE");
  lines.push("════════════════════════════════════════════════════════════════\n");
  lines.push(clusterReport);

  lines.push("\n" + "════════════════════════════════════════════════════════════════");
  lines.push("SYSTEM 2: 16-LAYER V2 ENGINE (Master Rulebook)");
  lines.push("════════════════════════════════════════════════════════════════\n");
  lines.push(v2Report);

  lines.push("\n" + "════════════════════════════════════════════════════════════════");
  lines.push("COMPARISON");
  lines.push("════════════════════════════════════════════════════════════════");
  lines.push(`Cluster Winner:      ${result.clusterPrediction.prediction} (margin: ${result.clusterPrediction.margin}, conf: ${result.clusterPrediction.confidence}%)`);
  lines.push(`V2 Winner:           ${result.v2Prediction.winner} (score: ${result.v2Prediction.score}, conf: ${result.v2Prediction.confidence}%)`);
  lines.push(`Agreement:           ${result.agreement ? "YES" : "NO"}`);
  lines.push("");
  lines.push(result.recommendedCall);
  lines.push("════════════════════════════════════════════════════════════════");

  return lines.join("\n");
}
