/**
 * LIVE TEST: Phillies vs Mets (CORRECTED POSITIONS)
 * July 16, 2026, 6:30 PM ET, New York
 *
 * Phillies (54-43, FAVORITE/L1) vs Mets (40-57, UNDERDOG/L7)
 * ACTUAL RESULT: Mets won 3-0
 */

import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { calculateCompositeScore } from "./sportsHorary";
import type { SportsHoraryChart } from "./sportsHorary";

// Horary chart for Phillies (Favorite) vs Mets (Underdog)
// Same positions, but swapped L1/L7 assignment
const chart: SportsHoraryChart = {
  l1: {
    planet: "Venus",
    house: 1,
    longitude: 78.3,
    dignity: "own",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: false,
    fixedStar: null,
  },
  l7: {
    planet: "Mercury",
    house: 7,
    longitude: 112.5,
    dignity: "own",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: true,
    fixedStar: null,
  },
  voidOfCourseMoon: false,
  l1l7MutualReception: false,
  l1l10MutualReception: false,
  l7l4MutualReception: false,
  favBeneficStrongInH1orH10: false,
  challBeneficStrongInH4orH7: true,
  moon: { phase: "waxing", house: 5 },
  maleficsInFavUpachaya: 2,
  maleficsInChallUpachaya: 1,
  l6FavStrongMaleficFree: false,
  l12ChallStrongMaleficFree: true,
  l1l7SameHouseOrDegree: false,
  l1l7Opposition: false,
  partOfFortune: null,
  l4AspectsL1TrineSextile: false,
  l4AspectsL7TrineSextile: true,
  translationOfLight: null,
  planetaryHour: null,
  lordAspect: { applying: null, type: "trine", fasterSide: null },
  frustration: false,
  prohibition: false,
  refranation: false,
};

async function runPhilliesMets() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("SPORTS HORARY: PHILLIES vs METS (CORRECTED)");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("EVENT: MLB Baseball");
  console.log("DATE: July 16, 2026");
  console.log("TIME: 6:30 PM ET");
  console.log("LOCATION: New York (Citi Field)\n");

  console.log("FAVORITE (H1/L1):    Philadelphia Phillies (54-43, better record)");
  console.log("UNDERDOG (H7/L7):    New York Mets (40-57, worse record)\n");

  console.log("ACTUAL RESULT: Mets won 3-0 (UPSET)\n");

  console.log("════════════════════════════════════════════════════════════════\n");

  const v2Results = calculateSportsHoraryV2(chart);
  const v2Report = generateSportsHoraryV2Report(v2Results, {
    favoriteTeam: "Phillies",
    challengerTeam: "Mets",
  });

  console.log(v2Report);
  console.log("\n");

  const v1Score = calculateCompositeScore(chart);

  console.log("════════════════════════════════════════════════════════════════\n");
  console.log("PREDICTION:\n");
  console.log(`  Winner: ${v2Results.prediction.winner}`);
  console.log(`  Confidence: ${v2Results.prediction.winProbability}%`);
  console.log(`  Dominance: ${v2Results.dominance.classification}`);
  console.log(`  Score: ${v1Score.score}\n`);

  console.log("VALIDATION:\n");
  const correct = v1Score.verdict === "Challenger" ? "Mets (Challenger)" :
                  v1Score.verdict === "Favorite" ? "Phillies (Favorite)" :
                  "Even";
  const actual = "Mets";
  const match = (v1Score.verdict === "Challenger");

  console.log(`  Engine predicted: ${v2Results.prediction.winner}`);
  console.log(`  Actual result: ${actual} won`);
  console.log(`  ${match ? "✓ CORRECT - Engine predicted the UPSET" : "✗ WRONG - Engine missed the upset"}\n`);

  if (v2Results.prediction.upsetWarning) {
    console.log("  ⚠️  UPSET WARNING TRIGGERED: Engine flagged uncertainty");
  }

  console.log("\n════════════════════════════════════════════════════════════════");
}

runPhilliesMets();
