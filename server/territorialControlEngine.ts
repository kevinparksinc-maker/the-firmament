/**
 * TERRITORIAL CONTROL ENGINE
 *
 * Evaluates where each house lord sits relative to its own cluster territory.
 * A lord in its own cluster territory = favorable.
 * A lord in opponent's cluster = compromised/weakened.
 *
 * Two clusters:
 *   - Ascendant (Side A): houses 1, 3, 6, 10, 11 + their lords
 *   - Descendant (Side B): houses 7, 9, 12, 4, 5 + their lords
 *
 * Scoring is fully additive, no multipliers:
 *   score = base + nakshatra_modifier + dignity_modifier + arabic_lots_modifier + planetary_war_modifier
 */

import type { PlanetPlacement } from "./astroEngine";
import { SIGN_RULERS, EXALTATIONS, DEBILITATIONS } from "./astroEngine";
import { getNakshatraAt, type Nakshatra } from "./nakshatra";
import { NAKSHATRAS, type NakshatraProfile } from "./nakshatraData";
import { detectPlanetaryWar, type PlanetaryWar } from "./patternEngine";
import { SIDE_A_HOUSES, SIDE_B_HOUSES, ANGULAR_HOUSES } from "./houseScoringConstants";
import { calculateArabicLots } from "./arabicLotsCalculator";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface HouseLordEvaluation {
  houseNumber: number;
  lord: string;
  lordSign: string;
  lordHouse: number | null;
  baseScore: number;
  nakshatraName: string;
  nakshatraModifier: number;
  dignityScore: number;
  arabicLotsScore: number;
  planetaryWarScore: number;
  totalScore: number;
}

export interface TerritorialControlResult {
  sideAEvals: HouseLordEvaluation[];
  sideBEvals: HouseLordEvaluation[];
  sideATotal: number;
  sideBTotal: number;
  planetaryWars: PlanetaryWar[];
  arabicLots?: Array<{ name: string; sign: string; sideInfluence: "A" | "B" | "neutral" }>;
  summary: string;
}

// ─── HELPER: Determine which side a house belongs to ────────────────────────

function getSide(house: number): "A" | "B" | null {
  if (SIDE_A_HOUSES.includes(house as any)) return "A";
  if (SIDE_B_HOUSES.includes(house as any)) return "B";
  return null;
}

// ─── HELPER: Convert nakshatra profile to additive modifier ─────────────────

function getNakshatraAdditiveModifier(profile: NakshatraProfile): number {
  // Map trait levels to point values
  const traitToPoints = (trait: string): number => {
    switch (trait) {
      case "Excellent":
        return 0.4;
      case "High":
        return 0.2;
      case "Medium":
        return 0;
      case "Low":
        return -0.2;
      default:
        return 0;
    }
  };

  const traits = [
    profile.initiative,
    profile.pressureResponse,
    profile.consistency,
    profile.finishingAbility,
  ];

  const points = traits.map(traitToPoints);
  const average = points.reduce((a, b) => a + b, 0) / points.length;

  return average;
}

// ─── HELPER: Calculate dignity score for a planet in a sign ──────────────────

function getDignityScore(planet: string, sign: string): number {
  if (EXALTATIONS[planet] === sign) return 2;
  if (SIGN_RULERS[sign] === planet) return 1;
  if (DEBILITATIONS[planet] === sign) return -2;
  return 0;
}

// ─── HELPER: Calculate Arabic lots modifier ────────────────────────────────

function getArabicLotsModifier(
  planets: Record<string, PlanetPlacement>,
  ascendant: number,
  houseLordsMap: Map<number, string>,
  evalHouseNumber: number
): number {
  const isNight = planets.Sun && planets.Sun.house ? planets.Sun.house > 6 : false;

  const lots = calculateArabicLots(
    planets as any,
    ascendant,
    isNight
  );

  const evalSide = getSide(evalHouseNumber);
  if (!evalSide || lots.length === 0) return 0;

  let lotsScore = 0;

  for (const lot of lots) {
    // Determine which cluster the lot falls in by its sign
    // Map sign to a house-like concept (simplification: sign index 0-3 = houses 1-4, etc.)
    const zodiac = [
      "Aries",
      "Taurus",
      "Gemini",
      "Cancer",
      "Leo",
      "Virgo",
      "Libra",
      "Scorpio",
      "Sagittarius",
      "Capricorn",
      "Aquarius",
      "Pisces",
    ];
    const signIdx = zodiac.indexOf(lot.sign);

    // For simplicity, map sign index to conceptual house preference
    // This is a heuristic since lots are not literally "in houses"
    // Lots in Side A signs (+) vs Side B signs (-)
    const sideACharcteristicSigns = [
      "Aries",
      "Leo",
      "Sagittarius",
      "Capricorn",
      "Aquarius",
    ]; // Fire/Air/Capricorn (assertive)
    const sideBCharacteristicSigns = [
      "Cancer",
      "Scorpio",
      "Pisces",
      "Taurus",
      "Libra",
    ]; // Water/Venus ruled (receptive)

    if (sideACharcteristicSigns.includes(lot.sign)) {
      lotsScore += evalSide === "A" ? 1 : -1;
    } else if (sideBCharacteristicSigns.includes(lot.sign)) {
      lotsScore += evalSide === "B" ? 1 : -1;
    }
  }

  return lotsScore;
}

// ─── MAIN: Calculate territorial control for all house lords ────────────────

export function calculateTerritorialControl(
  planets: Record<string, PlanetPlacement>,
  houseLords: Map<number, string>
): TerritorialControlResult {
  const sideAEvals: HouseLordEvaluation[] = [];
  const sideBEvals: HouseLordEvaluation[] = [];

  // Get ascendant for Arabic lots calculation (assume it's in house 1 cusp)
  const ascendant = planets.Sun ? planets.Sun.absolute ?? 0 : 0;

  // Calculate Arabic lots
  let arabicLots: Array<{ name: string; sign: string; sideInfluence: "A" | "B" | "neutral" }> = [];
  try {
    const isNight = planets.Sun && planets.Sun.house ? planets.Sun.house > 6 : false;
    const lots = calculateArabicLots(planets as any, ascendant, isNight);

    const zodiac = [
      "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
      "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];

    const sideACharcteristicSigns = [
      "Aries", "Leo", "Sagittarius", "Capricorn", "Aquarius"
    ];
    const sideBCharacteristicSigns = [
      "Cancer", "Scorpio", "Pisces", "Taurus", "Libra"
    ];

    arabicLots = lots.map(lot => ({
      name: lot.name,
      sign: lot.sign,
      sideInfluence: sideACharcteristicSigns.includes(lot.sign)
        ? "A"
        : sideBCharacteristicSigns.includes(lot.sign)
          ? "B"
          : "neutral",
    }));
  } catch (e) {
    // Lots calculation failed, continue without them
  }

  // Detect planetary wars for war modifiers
  const wars = detectPlanetaryWar(planets);
  const warMap = new Map<string, { isWinner: boolean; isLoser: boolean }>();

  for (const war of wars) {
    if (!warMap.has(war.winner)) {
      warMap.set(war.winner, { isWinner: false, isLoser: false });
    }
    if (!warMap.has(war.loser)) {
      warMap.set(war.loser, { isWinner: false, isLoser: false });
    }
    warMap.get(war.winner)!.isWinner = true;
    warMap.get(war.loser)!.isLoser = true;
  }

  // Evaluate each house lord
  for (let house = 1; house <= 12; house++) {
    const lord = houseLords.get(house);
    if (!lord) continue;

    const lordPlacement = planets[lord];
    if (!lordPlacement) continue;

    const houseSide = getSide(house);
    if (!houseSide) continue;

    // ─── BASE SCORE ────────────────────────────────────────────────

    let baseScore = 0;
    const lordHouseSide = lordPlacement.house ? getSide(lordPlacement.house) : null;

    if (lordHouseSide === houseSide) {
      // Lord is in own cluster territory
      baseScore += 1;

      // Bonus: lord in exact own house
      if (lordPlacement.house === house) {
        baseScore += 1;
      }
    } else if (lordHouseSide && lordHouseSide !== houseSide) {
      // Lord is in opponent's cluster territory
      baseScore -= 1;

      // Extra penalty: lord is on opponent's angle
      if (lordPlacement.house && ANGULAR_HOUSES.includes(lordPlacement.house)) {
        baseScore -= 1;
      }
    }

    // ─── NAKSHATRA MODIFIER ────────────────────────────────────────

    const { nakshatra } = getNakshatraAt(
      lordPlacement.absolute ?? 0
    );
    const nakshatraProfile = NAKSHATRAS[nakshatra.name] || NAKSHATRAS[0];
    const nakshatraModifier = getNakshatraAdditiveModifier(nakshatraProfile);

    // ─── DIGNITY MODIFIER ──────────────────────────────────────────

    const dignityScore = getDignityScore(lord, lordPlacement.sign);

    // ─── ARABIC LOTS MODIFIER ─────────────────────────────────────

    const arabicLotsScore = getArabicLotsModifier(
      planets,
      ascendant,
      houseLords,
      house
    );

    // ─── PLANETARY WAR MODIFIER ───────────────────────────────────

    let planetaryWarScore = 0;
    const warStatus = warMap.get(lord);

    if (warStatus?.isWinner) {
      planetaryWarScore += 1;
    } else if (warStatus?.isLoser) {
      planetaryWarScore -= 1;
    }

    // ─── TOTAL SCORE ──────────────────────────────────────────────

    const totalScore =
      baseScore + nakshatraModifier + dignityScore + arabicLotsScore + planetaryWarScore;

    const evaluation: HouseLordEvaluation = {
      houseNumber: house,
      lord,
      lordSign: lordPlacement.sign,
      lordHouse: lordPlacement.house,
      baseScore,
      nakshatraName: nakshatra.name,
      nakshatraModifier,
      dignityScore,
      arabicLotsScore,
      planetaryWarScore,
      totalScore,
    };

    if (houseSide === "A") {
      sideAEvals.push(evaluation);
    } else {
      sideBEvals.push(evaluation);
    }
  }

  const sideATotal = sideAEvals.reduce((sum, e) => sum + e.totalScore, 0);
  const sideBTotal = sideBEvals.reduce((sum, e) => sum + e.totalScore, 0);

  const summary = `Side A (Ascendant): ${sideATotal > 0 ? "+" : ""}${sideATotal} | Side B (Descendant): ${sideBTotal > 0 ? "+" : ""}${sideBTotal}`;

  return {
    sideAEvals,
    sideBEvals,
    sideATotal,
    sideBTotal,
    planetaryWars: wars,
    arabicLots: arabicLots.length > 0 ? arabicLots : undefined,
    summary,
  };
}

// ─── FORMATTING: Human-readable report ────────────────────────────────────

export function formatTerritorialReport(
  result: TerritorialControlResult
): string {
  const lines: string[] = [];

  lines.push("─── ASCENDANT CLUSTER (Side A) ───");
  if (result.sideAEvals.length === 0) {
    lines.push("(no lords in cluster)");
  } else {
    for (const e of result.sideAEvals) {
      const lordHouseStr = e.lordHouse ? `H${e.lordHouse}` : "unhoused";
      const breakdown = [
        `base:${e.baseScore > 0 ? "+" : ""}${e.baseScore}`,
        `nak:${e.nakshatraModifier > 0 ? "+" : ""}${e.nakshatraModifier.toFixed(2)}`,
        `dign:${e.dignityScore > 0 ? "+" : ""}${e.dignityScore}`,
        `lots:${e.arabicLotsScore > 0 ? "+" : ""}${e.arabicLotsScore}`,
        `war:${e.planetaryWarScore > 0 ? "+" : ""}${e.planetaryWarScore}`,
      ].join(" ");
      lines.push(
        `  H${e.houseNumber} → ${e.lord.padEnd(9)} (${e.lordSign} in ${lordHouseStr}) [${breakdown}] = ${e.totalScore > 0 ? "+" : ""}${e.totalScore.toFixed(2)}`
      );
    }
  }

  lines.push("");
  lines.push("─── DESCENDANT CLUSTER (Side B) ───");
  if (result.sideBEvals.length === 0) {
    lines.push("(no lords in cluster)");
  } else {
    for (const e of result.sideBEvals) {
      const lordHouseStr = e.lordHouse ? `H${e.lordHouse}` : "unhoused";
      const breakdown = [
        `base:${e.baseScore > 0 ? "+" : ""}${e.baseScore}`,
        `nak:${e.nakshatraModifier > 0 ? "+" : ""}${e.nakshatraModifier.toFixed(2)}`,
        `dign:${e.dignityScore > 0 ? "+" : ""}${e.dignityScore}`,
        `lots:${e.arabicLotsScore > 0 ? "+" : ""}${e.arabicLotsScore}`,
        `war:${e.planetaryWarScore > 0 ? "+" : ""}${e.planetaryWarScore}`,
      ].join(" ");
      lines.push(
        `  H${e.houseNumber} → ${e.lord.padEnd(9)} (${e.lordSign} in ${lordHouseStr}) [${breakdown}] = ${e.totalScore > 0 ? "+" : ""}${e.totalScore.toFixed(2)}`
      );
    }
  }

  lines.push("");
  lines.push("─── PLANETARY WARS ───");
  if (result.planetaryWars.length === 0) {
    lines.push("(none detected)");
  } else {
    for (const war of result.planetaryWars) {
      lines.push(
        `  ${war.winner} defeats ${war.loser} (${war.degreeDiff.toFixed(2)}°)`
      );
    }
  }

  lines.push("");
  lines.push("─── ARABIC LOTS ───");
  if (result.arabicLots && result.arabicLots.length > 0) {
    for (const lot of result.arabicLots) {
      const influence = lot.sideInfluence === "A" ? "Side A ✓" : lot.sideInfluence === "B" ? "Side B ✓" : "(neutral)";
      lines.push(`  ${lot.name.padEnd(20)} in ${lot.sign.padEnd(11)} → ${influence}`);
    }
  } else {
    lines.push("(none calculated)");
  }

  lines.push("");
  lines.push("═══════════════════════════════════════════");
  lines.push(`TOTAL: Side A = ${result.sideATotal > 0 ? "+" : ""}${result.sideATotal}`);
  lines.push(`TOTAL: Side B = ${result.sideBTotal > 0 ? "+" : ""}${result.sideBTotal}`);
  lines.push(`SWING: ${(result.sideBTotal - result.sideATotal > 0 ? "+" : "")}${(result.sideBTotal - result.sideATotal).toFixed(2)} (Side B favor)`);
  lines.push("═══════════════════════════════════════════");

  return lines.join("\n");
}
