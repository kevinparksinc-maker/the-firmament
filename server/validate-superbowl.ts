/**
 * VALIDATION TEST: Super Bowl XLII
 * Patriots (18-1, heavily favored) vs Giants (10-6, massive underdog)
 * February 4, 2007, 6:30 PM EST, University of Phoenix Stadium, Glendale AZ
 *
 * ACTUAL RESULT: Giants upset Patriots 17-14
 *
 * Question: Can the engine predict this upset?
 */

import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { calculateCompositeScore } from "./sportsHorary";
import type { SportsHoraryChart } from "./sportsHorary";

// Horary chart for Super Bowl XLII kickoff
// Feb 4, 2007, 6:30 PM EST, Glendale AZ (Phoenix area)
// Sidereal positions (Fagan-Bradley epoch)
const superbowlChart: SportsHoraryChart = {
  l1: {
    planet: "Sun",
    house: 7,
    longitude: 315.5,
    dignity: "peregrine",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: false,
    fixedStar: null,
  },
  l7: {
    planet: "Mars",
    house: 1,
    longitude: 65.2,
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
  favBeneficStrongInH1orH10: false,
  challBeneficStrongInH4orH7: true,
  moon: { phase: "waning", house: 4 },
  maleficsInFavUpachaya: 2,
  maleficsInChallUpachaya: 0,
  l6FavStrongMaleficFree: false,
  l12ChallStrongMaleficFree: true,
  l1l7SameHouseOrDegree: false,
  l1l7Opposition: true,
  partOfFortune: null,
  l4AspectsL1TrineSextile: false,
  l4AspectsL7TrineSextile: true,
  translationOfLight: null,
  planetaryHour: null,
  lordAspect: { applying: null, type: "opposition", fasterSide: null },
  frustration: false,
  prohibition: false,
  refranation: false,
};

async function validateSuperBowl() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("VALIDATION: SUPER BOWL XLII");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("EVENT: Super Bowl XLII");
  console.log("DATE: February 4, 2007, 6:30 PM EST");
  console.log("LOCATION: University of Phoenix Stadium, Glendale, Arizona\n");

  console.log("FAVORITE (Ascendant):   New England Patriots (18-1 record, 12-point favorites)");
  console.log("CHALLENGER (Descendant): New York Giants (10-6 record, massive underdog)\n");

  console.log("ACTUAL RESULT: Giants upset Patriots 17-14 ✓\n");

  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("HORARY CHART ANALYSIS:");
  console.log(`  L1 (Patriots): ${superbowlChart.l1.planet} in H${superbowlChart.l1.house} (${superbowlChart.l1.dignity})`);
  console.log(`  L7 (Giants): ${superbowlChart.l7.planet} in H${superbowlChart.l7.house} (${superbowlChart.l7.dignity})`);
  console.log(`  Aspect: ${superbowlChart.lordAspect.type || "none"}`);
  console.log(`  Moon: H${superbowlChart.moon.house} (${superbowlChart.moon.phase})`);
  console.log(`  L7 (Giants) benefic in angular house: ${superbowlChart.challBeneficStrongInH4orH7}`);
  console.log(`  L12 (Giants weakness handler) strong: ${superbowlChart.l12ChallStrongMaleficFree}\n`);

  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("RUNNING ENGINE...\n");

  const v2Results = calculateSportsHoraryV2(superbowlChart);
  const v2Report = generateSportsHoraryV2Report(v2Results, {
    favoriteTeam: "Patriots",
    challengerTeam: "Giants",
  });

  console.log(v2Report);
  console.log("\n");

  // V1 for comparison
  const v1Score = calculateCompositeScore(superbowlChart);

  console.log("════════════════════════════════════════════════════════════════\n");
  console.log("VALIDATION RESULT:\n");
  console.log(`  Engine prediction: ${v2Results.prediction.winner}`);
  console.log(`  Confidence: ${v2Results.prediction.winProbability}%`);
  console.log(`  Dominance: ${v2Results.dominance.classification} (score: ${v2Results.dominance.dominanceScore})`);
  console.log(`\n  V1 Score: ${v1Score.score} → ${v1Score.verdict}`);

  const correct =
    (v1Score.verdict === "Challenger" && "Giants") ||
    (v1Score.verdict === "Favorite" && "Patriots") ||
    (v1Score.verdict === "Even" && "Even");

  const actual = "Giants";
  const match = correct === actual;

  console.log(`\n  ✓ ACTUAL OUTCOME: ${actual} won`);
  console.log(`  ${match ? "✓ CORRECT PREDICTION" : "✗ INCORRECT PREDICTION"}`);

  if (v1Score.breakdown.length > 0) {
    console.log(`\n  Top factors:`);
    v1Score.breakdown.slice(0, 5).forEach(line => console.log(`    ${line}`));
  }
}

validateSuperBowl();
