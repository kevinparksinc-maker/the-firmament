/**
 * TEST: Hybrid System on Mets vs Phillies
 * July 16, 2026, 6:30 PM ET, New York
 *
 * Phillies (54-43, Favorite/L1) vs Mets (40-57, Underdog/L7)
 * ACTUAL: Mets won 3-0 (upset)
 */

import { runHybridPrediction, formatHybridReport } from "./sportsHoraryHybrid";
import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { evaluateCluster, formatClusterReport } from "./houseClusterEngine";
import type { SportsHoraryChart } from "./sportsHorary";
import type { PlanetPlacement } from "./astroEngine";

// Raw chart: Phillies vs Mets, July 16, 2026, 6:30 PM ET, New York
const rawChart: Record<string, PlanetPlacement> = {
  Sun: {
    planet: "Sun",
    degree: 27.5,
    sign: "Gemini",
    house: 9,
    rx: false,
    combust: false,
    cazimi: false,
    absolute: 87.5,
    raw: "Sun 27°30' Gemini",
    kind: "natal",
  },
  Moon: {
    planet: "Moon",
    degree: 8.2,
    sign: "Libra",
    house: 12,
    rx: false,
    combust: false,
    cazimi: false,
    absolute: 188.2,
    raw: "Moon 8°12' Libra",
    kind: "natal",
  },
  Mercury: {
    planet: "Mercury",
    degree: 15.1,
    sign: "Cancer",
    house: 10,
    rx: false,
    combust: false,
    cazimi: false,
    absolute: 105.1,
    raw: "Mercury 15°06' Cancer",
    kind: "natal",
  },
  Venus: {
    planet: "Venus",
    degree: 19.8,
    sign: "Gemini",
    house: 9,
    rx: false,
    combust: false,
    cazimi: false,
    absolute: 79.8,
    raw: "Venus 19°48' Gemini",
    kind: "natal",
  },
  Mars: {
    planet: "Mars",
    degree: 5.3,
    sign: "Aries",
    house: 6,
    rx: false,
    combust: false,
    cazimi: false,
    absolute: 5.3,
    raw: "Mars 5°18' Aries",
    kind: "natal",
  },
  Jupiter: {
    planet: "Jupiter",
    degree: 12.7,
    sign: "Gemini",
    house: 9,
    rx: false,
    combust: false,
    cazimi: false,
    absolute: 72.7,
    raw: "Jupiter 12°42' Gemini",
    kind: "natal",
  },
  Saturn: {
    planet: "Saturn",
    degree: 21.4,
    sign: "Pisces",
    house: 4,
    rx: false,
    combust: false,
    cazimi: false,
    absolute: 351.4,
    raw: "Saturn 21°24' Pisces",
    kind: "natal",
  },
};

// House cusps for New York, 6:30 PM ET, July 16, 2026
const houseCusps: Record<number, { sign: string; degree: number }> = {
  1: { sign: "Aries", degree: 12.5 }, // Ascendant
  2: { sign: "Taurus", degree: 18.2 },
  3: { sign: "Gemini", degree: 22.1 },
  4: { sign: "Cancer", degree: 22.8 }, // IC
  5: { sign: "Leo", degree: 20.5 },
  6: { sign: "Virgo", degree: 15.3 },
  7: { sign: "Libra", degree: 12.5 }, // Descendant
  8: { sign: "Scorpio", degree: 18.2 },
  9: { sign: "Sagittarius", degree: 22.1 },
  10: { sign: "Capricorn", degree: 22.8 }, // MC
  11: { sign: "Aquarius", degree: 20.5 },
  12: { sign: "Pisces", degree: 15.3 },
};

// SportsHoraryChart for V2 engine
const sportChart: SportsHoraryChart = {
  l1: {
    planet: "Mercury",
    house: 10,
    longitude: 105.1,
    dignity: "own",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: true,
    fixedStar: null,
  },
  l7: {
    planet: "Saturn",
    house: 4,
    longitude: 351.4,
    dignity: "neutral",
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
  moon: { phase: "waning", house: 12 },
  maleficsInFavUpachaya: 1,
  maleficsInChallUpachaya: 0,
  l6FavStrongMaleficFree: false,
  l12ChallStrongMaleficFree: false,
  l1l7SameHouseOrDegree: false,
  l1l7Opposition: false,
  partOfFortune: null,
  l4AspectsL1TrineSextile: false,
  l4AspectsL7TrineSextile: false,
  translationOfLight: null,
  planetaryHour: null,
  lordAspect: { applying: null, type: "square", fasterSide: null },
  frustration: false,
  prohibition: false,
  refranation: false,
};

async function testHybrid() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("HYBRID ENGINE TEST: PHILLIES vs METS");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("EVENT: MLB Baseball");
  console.log("DATE: July 16, 2026, 6:30 PM ET");
  console.log("LOCATION: New York (Citi Field)\n");

  console.log("FAVORITE (L1): Philadelphia Phillies (54-43)");
  console.log("UNDERDOG (L7): New York Mets (40-57)\n");

  console.log("ACTUAL RESULT: Mets won 3-0 (UPSET)\n");

  console.log("════════════════════════════════════════════════════════════════\n");

  // Run cluster engine directly
  console.log("STEP 1: Running 10-House Cluster Engine...\n");
  const clusterResults = evaluateCluster(rawChart, houseCusps, "Phillies", "Mets");
  const clusterReport = formatClusterReport(clusterResults, "Phillies", "Mets");
  console.log(clusterReport);

  console.log("\n" + "════════════════════════════════════════════════════════════════\n");

  // Run V2 engine directly
  console.log("STEP 2: Running 16-Layer V2 Engine...\n");
  const v2Results = calculateSportsHoraryV2(sportChart);
  const v2Report = generateSportsHoraryV2Report(v2Results, {
    favoriteTeam: "Phillies",
    challengerTeam: "Mets",
  });
  console.log(v2Report);

  console.log("\n" + "════════════════════════════════════════════════════════════════\n");

  // Run hybrid to compare
  console.log("STEP 3: Hybrid Comparison...\n");
  const hybridResult = runHybridPrediction(sportChart, rawChart, houseCusps, "Phillies", "Mets");

  console.log(`Cluster Engine: ${hybridResult.clusterPrediction.prediction}`);
  console.log(`  Margin: ${hybridResult.clusterPrediction.margin} pts | Confidence: ${hybridResult.clusterPrediction.confidence}%`);
  console.log(`  Side A total: ${hybridResult.clusterPrediction.sideATotal} | Side B total: ${hybridResult.clusterPrediction.sideBTotal}\n`);

  console.log(`V2 Engine: ${hybridResult.v2Prediction.winner}`);
  console.log(`  Score: ${hybridResult.v2Prediction.score} | Confidence: ${hybridResult.v2Prediction.confidence}%`);
  console.log(`  Dominance: ${hybridResult.v2Prediction.dominance}\n`);

  console.log(`AGREEMENT: ${hybridResult.agreement ? "YES ✓" : "NO ⚠️"}`);
  console.log(`RECOMMENDATION: ${hybridResult.recommendedCall}\n`);

  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("VALIDATION:\n");
  const clusterCorrect = hybridResult.clusterPrediction.prediction === "Side B";
  const v2Correct = hybridResult.v2Prediction.winner === "Challenger";

  console.log(`Cluster Engine prediction: ${hybridResult.clusterPrediction.prediction}`);
  console.log(`  ${clusterCorrect ? "✓ CORRECT (predicted upset)" : "✗ WRONG"}\n`);

  console.log(`V2 Engine prediction: ${hybridResult.v2Prediction.winner}`);
  console.log(`  ${v2Correct ? "✓ CORRECT (predicted upset)" : "✗ WRONG"}\n`);

  if (clusterCorrect && v2Correct) {
    console.log("🎯 BOTH ENGINES NAILED THE UPSET");
  } else if (clusterCorrect || v2Correct) {
    console.log("⚡ ONE ENGINE GOT IT RIGHT");
  } else {
    console.log("❌ BOTH ENGINES MISSED");
  }

  console.log("\n════════════════════════════════════════════════════════════════");
}

testHybrid();
