/**
 * LIVE TEST: Mets vs Phillies
 * July 16, 2026, 6:30 PM ET, New York
 * Mets (Favorite) vs Phillies (Challenger/Underdog)
 */

import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { calculateCompositeScore } from "./sportsHorary";
import type { SportsHoraryChart } from "./sportsHorary";

// Horary chart for Mets vs Phillies
// July 16, 2026, 6:30 PM EDT (18:30 UTC), New York
// Constructed sidereal positions
const chart: SportsHoraryChart = {
  l1: {
    planet: "Mercury",
    house: 1,
    longitude: 112.5,
    dignity: "own",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: true,
    fixedStar: null,
  },
  l7: {
    planet: "Venus",
    house: 7,
    longitude: 78.3,
    dignity: "own",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: false,
    fixedStar: null,
  },
  voidOfCourseMoon: false,
  l1l7MutualReception: false,
  l1l10MutualReception: false,
  l7l4MutualReception: false,
  favBeneficStrongInH1orH10: true,
  challBeneficStrongInH4orH7: false,
  moon: { phase: "waxing", house: 5 },
  maleficsInFavUpachaya: 1,
  maleficsInChallUpachaya: 2,
  l6FavStrongMaleficFree: true,
  l12ChallStrongMaleficFree: false,
  l1l7SameHouseOrDegree: false,
  l1l7Opposition: false,
  partOfFortune: null,
  l4AspectsL1TrineSextile: true,
  l4AspectsL7TrineSextile: false,
  translationOfLight: null,
  planetaryHour: null,
  lordAspect: { applying: null, type: "trine", fasterSide: null },
  frustration: false,
  prohibition: false,
  refranation: false,
};

async function runMetsPhillies() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("SPORTS HORARY: METS vs PHILLIES");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("EVENT: MLB Baseball");
  console.log("DATE: July 16, 2026");
  console.log("TIME: 6:30 PM ET");
  console.log("LOCATION: New York (Citi Field)\n");

  console.log("FAVORITE (H1):    New York Mets");
  console.log("CHALLENGER (H7):  Philadelphia Phillies\n");

  console.log("════════════════════════════════════════════════════════════════\n");

  const v2Results = calculateSportsHoraryV2(chart);
  const v2Report = generateSportsHoraryV2Report(v2Results, {
    favoriteTeam: "Mets",
    challengerTeam: "Phillies",
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

  if (v2Results.prediction.topStrengths.length > 0) {
    console.log("  Top Strengths:");
    v2Results.prediction.topStrengths.slice(0, 3).forEach(s => console.log(`    • ${s}`));
  }

  if (v2Results.prediction.topWeaknesses.length > 0) {
    console.log("\n  Top Weaknesses:");
    v2Results.prediction.topWeaknesses.slice(0, 3).forEach(w => console.log(`    • ${w}`));
  }

  if (v2Results.prediction.upsetWarning) {
    console.log("\n  ⚠️  UPSET WARNING: Low confidence or very close match");
  }

  console.log("\n════════════════════════════════════════════════════════════════");
}

runMetsPhillies();
