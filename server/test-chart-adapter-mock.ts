/**
 * Test: Chart adapter flow with mocked Claude response
 * Shows what the adapter would return and how it feeds into the 16-layer engine
 */

import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import { calculateCompositeScore } from "./sportsHorary";
import type { SportsHoraryChart } from "./sportsHorary";

// Real chart: Lakers vs Celtics, June 18, 2024, 7:30 PM PDT, Los Angeles
const realChart = {
  Sun: "Gemini 27.5° H9",
  Moon: "Libra 8.2° H12",
  Mercury: "Cancer 15.1° H10",
  Venus: "Gemini 19.8° H9",
  Mars: "Aries 5.3° H6",
  Jupiter: "Gemini 12.7° H9",
  Saturn: "Pisces 21.4° H4",
  Rahu: "Pisces 3.6° H4",
  Ketu: "Virgo 3.6° H11",
};

// What Claude would return (mocked analysis result)
const mockClaudeResponse: SportsHoraryChart = {
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
  voidOfCourseMoon: true,
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

async function testChartAdapterMock() {
  console.log("════════════════════════════════════════════════════════════════");
  console.log("TESTING CHART ADAPTER FLOW (MOCKED CLAUDE RESPONSE)");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("QUESTION: Will the Lakers (Favorite) beat the Celtics (Challenger)?");
  console.log("CHART TIME: June 18, 2024, 7:30 PM PDT, Los Angeles\n");

  console.log("Raw chart placements:");
  Object.entries(realChart).forEach(([name, pos]) => {
    console.log(`  ${name.padEnd(10)} ${pos}`);
  });
  console.log("\n");

  console.log("════════════════════════════════════════════════════════════════\n");
  console.log("STEP 1: Claude analyzes chart (via buildSportsHoraryChartViaLLM)\n");

  console.log("Claude's analysis findings:");
  console.log(`  ✓ H1 sign ruler (L1): ${mockClaudeResponse.l1.planet} (${mockClaudeResponse.l1.dignity})`);
  console.log(`  ✓ H7 sign ruler (L7): ${mockClaudeResponse.l7.planet} (${mockClaudeResponse.l7.dignity})`);
  console.log(`  ✓ Moon: H${mockClaudeResponse.moon.house} (${mockClaudeResponse.moon.phase})`);
  console.log(`  ✓ VOC Moon: ${mockClaudeResponse.voidOfCourseMoon}`);
  console.log(`  ✓ L1↔L7 aspect: ${mockClaudeResponse.lordAspect.type || "none"}`);
  console.log(`  ✓ Benefic in Favorite's angular house: ${mockClaudeResponse.favBeneficStrongInH1orH10}`);
  console.log(`\n  (All other conditions calculated and passed to scoring engine)\n`);

  console.log("════════════════════════════════════════════════════════════════\n");
  console.log("STEP 2: Feed to 16-layer engine...\n");

  const v2Results = calculateSportsHoraryV2(mockClaudeResponse);
  const v2Report = generateSportsHoraryV2Report(v2Results, {
    favoriteTeam: "Lakers",
    challengerTeam: "Celtics",
  });

  console.log(v2Report);
  console.log("\n");

  console.log("════════════════════════════════════════════════════════════════\n");

  // Also run V1 for comparison
  const v1Score = calculateCompositeScore(mockClaudeResponse);
  console.log("V1 MASTER RULEBOOK (for comparison):\n");
  console.log(`  Score: ${v1Score.score}`);
  console.log(`  Verdict: ${v1Score.verdict}`);
  console.log(`  Flags: ${v1Score.flags.join(", ") || "(none)"}`);
  console.log(`\n  Breakdown (`);
  v1Score.breakdown.slice(0, 10).forEach(line => console.log(`    ${line}`));
  if (v1Score.breakdown.length > 10) {
    console.log(`    ... +${v1Score.breakdown.length - 10} more`);
  }
  console.log("  )");

  console.log("\n════════════════════════════════════════════════════════════════\n");
  console.log("ARCHITECTURE SUMMARY:\n");
  console.log("  Raw Chart → buildSportsHoraryChartViaLLM() → [Claude]");
  console.log("       ↓");
  console.log("  Fully populated SportsHoraryChart");
  console.log("       ↓");
  console.log("  calculateSportsHoraryV2() → 16 layers");
  console.log("       ↓");
  console.log("  Dominance + Confidence + Prediction");
  console.log("       ↓");
  console.log("  generateSportsHoraryV2Report() → Human-readable breakdown");
  console.log("\n✓ Chart discovery is now AI-powered, not hardcoded");
}

testChartAdapterMock();
