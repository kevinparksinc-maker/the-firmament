/**
 * RANDOM GAME: Yankees (69-28, Favorite) vs Red Sox (51-45, Underdog)
 * July 16, 2026, 7:00 PM ET, Boston
 */

import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { calculateCompositeScore } from "./sportsHorary";
import type { SportsHoraryChart } from "./sportsHorary";

const chart: SportsHoraryChart = {
  l1: {
    planet: "Sun",
    house: 1,
    longitude: 88.2,
    dignity: "neutral",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: true,
    fixedStar: null,
  },
  l7: {
    planet: "Saturn",
    house: 7,
    longitude: 348.5,
    dignity: "own",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: true,
    beneficAspect: false,
    fixedStar: null,
  },
  voidOfCourseMoon: false,
  l1l7MutualReception: false,
  l1l10MutualReception: false,
  l7l4MutualReception: false,
  favBeneficStrongInH1orH10: true,
  challBeneficStrongInH4orH7: false,
  moon: { phase: "waning", house: 8 },
  maleficsInFavUpachaya: 0,
  maleficsInChallUpachaya: 1,
  l6FavStrongMaleficFree: true,
  l12ChallStrongMaleficFree: false,
  l1l7SameHouseOrDegree: false,
  l1l7Opposition: true,
  partOfFortune: null,
  l4AspectsL1TrineSextile: true,
  l4AspectsL7TrineSextile: false,
  translationOfLight: null,
  planetaryHour: null,
  lordAspect: { applying: null, type: "opposition", fasterSide: null },
  frustration: false,
  prohibition: false,
  refranation: false,
};

async function runRandomGame() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("RANDOM GAME: YANKEES vs RED SOX");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("EVENT: MLB Regular Season");
  console.log("DATE: July 16, 2026");
  console.log("TIME: 7:00 PM ET");
  console.log("LOCATION: Boston (Fenway Park)\n");

  console.log("FAVORITE (H1/L1):    New York Yankees (69-28, dominating)");
  console.log("UNDERDOG (H7/L7):    Boston Red Sox (51-45, struggling)\n");

  console.log("════════════════════════════════════════════════════════════════\n");

  const v2Results = calculateSportsHoraryV2(chart);
  const v2Report = generateSportsHoraryV2Report(v2Results, {
    favoriteTeam: "Yankees",
    challengerTeam: "Red Sox",
  });

  console.log(v2Report);
  console.log("\n");

  const v1Score = calculateCompositeScore(chart);

  console.log("════════════════════════════════════════════════════════════════\n");
  console.log("ENGINE CALL:\n");
  console.log(`  Verdict: ${v2Results.prediction.winner}`);
  console.log(`  Confidence: ${v2Results.prediction.winProbability}%`);
  console.log(`  Dominance: ${v2Results.dominance.classification}`);
  console.log(`  Score: ${v1Score.score}\n`);

  if (v2Results.prediction.upsetWarning) {
    console.log("  ⚠️  UPSET WARNING: Low confidence or close match");
  } else {
    console.log("  ✓ Strong conviction on this pick");
  }

  console.log("\nTop reasons:");
  if (v2Results.prediction.topStrengths.length > 0) {
    console.log("  Strengths:");
    v2Results.prediction.topStrengths.slice(0, 3).forEach(s => console.log(`    • ${s}`));
  }

  if (v2Results.prediction.topWeaknesses.length > 0) {
    console.log("  Weaknesses:");
    v2Results.prediction.topWeaknesses.slice(0, 3).forEach(w => console.log(`    • ${w}`));
  }

  console.log("\n════════════════════════════════════════════════════════════════");
}

runRandomGame();
