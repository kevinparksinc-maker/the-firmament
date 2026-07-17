/**
 * houseClusterEngine.ts
 *
 * Full 10-house evaluation for sports prediction.
 * Evaluates all 5 houses per side using the same logic loop.
 * Returns per-house breakdown + cluster totals + prediction.
 */

import { SIGN_RULERS, EXALTATIONS, DEBILITATIONS, SIGN_ORDER, type PlanetPlacement } from "./astroEngine";
import {
  SIDE_A_HOUSES,
  SIDE_B_HOUSES,
  DIGNITY_POINTS,
  CONDITION_PENALTIES,
  COMBUSTION_ORBS,
  PLACEMENT_POINTS,
  ANGULAR_HOUSES,
  SUCCEDENT_HOUSES,
  CADENT_HOUSES,
  ASPECT_POINTS,
  BENEFIC_PLANETS,
  MALEFIC_PLANETS,
  ASPECT_ORBS,
  TOO_CLOSE_TO_CALL_MARGIN,
} from "./houseScoringConstants";

type Chart = Record<string, PlanetPlacement>;

interface HouseEvaluation {
  houseNumber: number;
  side: "A" | "B";
  lordPlanet: string;
  lordSign: string;
  lordHouse: number | null;
  dignityPoints: number;
  dignityStatus: string;
  combustPoints: number;
  retrogradePoints: number;
  placementPoints: number;
  placementStatus: string;
  aspectPoints: number;
  aspectDetails: string[];
  totalPoints: number;
  reasoning: string;
}

interface ClusterResult {
  sideAHouses: HouseEvaluation[];
  sideBHouses: HouseEvaluation[];
  sideATotal: number;
  sideBTotal: number;
  margin: number;
  prediction: "Side A" | "Side B" | "Too close to call";
  confidence: number;
}

/**
 * Calculate longitude from placement (or use absolute if available)
 */
function getLongitude(p: PlanetPlacement): number {
  if (p.absolute != null) return ((p.absolute % 360) + 360) % 360;
  const idx = SIGN_ORDER.indexOf(p.sign);
  return idx >= 0 ? idx * 30 + p.degree : 0;
}

/**
 * Angular separation 0..180
 */
function angularSep(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Evaluate a single house
 */
function evaluateHouse(
  houseNumber: number,
  side: "A" | "B",
  chart: Chart,
  houseCusps: Record<number, { sign: string; degree: number }>
): HouseEvaluation {
  const cusp = houseCusps[houseNumber];
  if (!cusp) {
    return {
      houseNumber,
      side,
      lordPlanet: "Unknown",
      lordSign: "Unknown",
      lordHouse: null,
      dignityPoints: 0,
      dignityStatus: "Unknown",
      combustPoints: 0,
      retrogradePoints: 0,
      placementPoints: 0,
      placementStatus: "Unknown",
      aspectPoints: 0,
      aspectDetails: [],
      totalPoints: 0,
      reasoning: "House cusp not found",
    };
  }

  // 1. Identify house lord
  const lordName = SIGN_RULERS[cusp.sign];
  const lordPlacement = chart[lordName];

  if (!lordPlacement) {
    return {
      houseNumber,
      side,
      lordPlanet: lordName || "Unknown",
      lordSign: cusp.sign,
      lordHouse: null,
      dignityPoints: 0,
      dignityStatus: "Unknown",
      combustPoints: 0,
      retrogradePoints: 0,
      placementPoints: 0,
      placementStatus: "Unknown",
      aspectPoints: 0,
      aspectDetails: [],
      totalPoints: 0,
      reasoning: "Lord not in chart",
    };
  }

  let points = 0;
  const reasons: string[] = [];

  // 2. Dignity points
  let dignityStatus = "neutral";
  let dignityPts = 0;

  if (EXALTATIONS[lordName] === lordPlacement.sign) {
    dignityStatus = "exalted";
    dignityPts = DIGNITY_POINTS.EXALTED;
  } else if (DEBILITATIONS[lordName] === lordPlacement.sign) {
    dignityStatus = "fall";
    dignityPts = DIGNITY_POINTS.FALL;
  } else if (SIGN_RULERS[lordPlacement.sign] === lordName) {
    dignityStatus = "own";
    dignityPts = DIGNITY_POINTS.OWN_SIGN;
  } else {
    // Check for detriment (opposite of own)
    const ownSigns = Object.entries(SIGN_RULERS)
      .filter(([_, ruler]) => ruler === lordName)
      .map(([sign, _]) => sign);
    if (ownSigns.length > 0) {
      const ownIdx = SIGN_ORDER.indexOf(ownSigns[0]);
      const oppositeIdx = (ownIdx + 6) % 12;
      if (SIGN_ORDER[oppositeIdx] === lordPlacement.sign) {
        dignityStatus = "detriment";
        dignityPts = DIGNITY_POINTS.DETRIMENT;
      }
    }
  }

  points += dignityPts;
  if (dignityPts !== 0) {
    reasons.push(`${dignityStatus} sign: ${dignityPts > 0 ? "+" : ""}${dignityPts}`);
  }

  // 3. Combustion check
  let combustPts = 0;
  const sun = chart["Sun"];
  if (sun && lordPlacement.planet !== "Sun") {
    const dist = angularSep(getLongitude(sun), getLongitude(lordPlacement));
    const orb = COMBUSTION_ORBS[lordPlacement.planet as keyof typeof COMBUSTION_ORBS] || COMBUSTION_ORBS.DEFAULT;
    if (dist <= orb) {
      combustPts = CONDITION_PENALTIES.COMBUST;
      points += combustPts;
      reasons.push(`combust: ${combustPts}`);
    }
  }

  // 4. Retrograde check
  let retroPts = 0;
  if (lordPlacement.rx) {
    retroPts = CONDITION_PENALTIES.RETROGRADE;
    points += retroPts;
    reasons.push(`retrograde: ${retroPts}`);
  }

  // 5. Placement bonus
  let placementStatus = "cadent";
  let placementPts = PLACEMENT_POINTS.CADENT;

  if (ANGULAR_HOUSES.includes(lordPlacement.house || 0)) {
    placementStatus = "angular";
    placementPts = PLACEMENT_POINTS.ANGULAR;
  } else if (SUCCEDENT_HOUSES.includes(lordPlacement.house || 0)) {
    placementStatus = "succedent";
    placementPts = PLACEMENT_POINTS.SUCCEDENT;
  }

  points += placementPts;
  if (placementPts !== 0) {
    reasons.push(`${placementStatus} house (H${lordPlacement.house}): ${placementPts > 0 ? "+" : ""}${placementPts}`);
  }

  // 6. Aspects to the lord
  let aspectPts = 0;
  const aspectDetails: string[] = [];

  const planets = Object.values(chart);
  for (const planet of planets) {
    if (planet.planet === lordName) continue;

    const dist = angularSep(getLongitude(lordPlacement), getLongitude(planet));

    // Check each aspect type
    for (const [aspectName, orb] of Object.entries(ASPECT_ORBS)) {
      const angle = aspectName === "CONJUNCTION" ? 0 :
                    aspectName === "SEXTILE" ? 60 :
                    aspectName === "SQUARE" ? 90 :
                    aspectName === "TRINE" ? 120 :
                    aspectName === "OPPOSITION" ? 180 : null;

      if (angle === null) continue;

      if (Math.abs(dist - angle) <= orb) {
        const isBenefic = BENEFIC_PLANETS.includes(planet.planet);
        const isMalefic = MALEFIC_PLANETS.includes(planet.planet);

        let pointKey: keyof typeof ASPECT_POINTS | null = null;

        if (aspectName === "CONJUNCTION") {
          pointKey = isBenefic ? "CONJUNCTION_BENEFIC" : isMalefic ? "CONJUNCTION_MALEFIC" : null;
        } else if (aspectName === "TRINE" && isBenefic) {
          pointKey = "TRINE_BENEFIC";
        } else if (aspectName === "SEXTILE" && isBenefic) {
          pointKey = "SEXTILE_BENEFIC";
        } else if (aspectName === "SQUARE" && isMalefic) {
          pointKey = "SQUARE_MALEFIC";
        } else if (aspectName === "OPPOSITION" && isMalefic) {
          pointKey = "OPPOSITION_MALEFIC";
        }

        if (pointKey && ASPECT_POINTS[pointKey]) {
          const aspectPtsValue = ASPECT_POINTS[pointKey];
          aspectPts += aspectPtsValue;
          aspectDetails.push(`${aspectName} ${planet.planet}: ${aspectPtsValue > 0 ? "+" : ""}${aspectPtsValue}`);
        }
      }
    }
  }

  points += aspectPts;
  if (aspectPts !== 0) {
    reasons.push(`aspects: ${aspectPts > 0 ? "+" : ""}${aspectPts}`);
  }

  return {
    houseNumber,
    side,
    lordPlanet: lordName,
    lordSign: lordPlacement.sign,
    lordHouse: lordPlacement.house || null,
    dignityPoints: dignityPts,
    dignityStatus,
    combustPoints: combustPts,
    retrogradePoints: retroPts,
    placementPoints: placementPts,
    placementStatus,
    aspectPoints: aspectPts,
    aspectDetails,
    totalPoints: points,
    reasoning: reasons.join(", ") || "Neutral",
  };
}

/**
 * Main engine: evaluate all 10 houses and generate prediction
 */
export function evaluateCluster(
  chart: Chart,
  houseCusps: Record<number, { sign: string; degree: number }>,
  sideAName: string = "Side A",
  sideBName: string = "Side B"
): ClusterResult {
  const allHouses = [...SIDE_A_HOUSES, ...SIDE_B_HOUSES];
  const evaluations = allHouses.map((house) => {
    const side = SIDE_A_HOUSES.includes(house) ? "A" : "B";
    return evaluateHouse(house, side, chart, houseCusps);
  });

  const sideAEvals = evaluations.filter((e) => e.side === "A").sort((a, b) => a.houseNumber - b.houseNumber);
  const sideBEvals = evaluations.filter((e) => e.side === "B").sort((a, b) => a.houseNumber - b.houseNumber);

  const sideATotal = sideAEvals.reduce((sum, e) => sum + e.totalPoints, 0);
  const sideBTotal = sideBEvals.reduce((sum, e) => sum + e.totalPoints, 0);

  const margin = Math.abs(sideATotal - sideBTotal);
  let prediction: "Side A" | "Side B" | "Too close to call";
  if (margin < TOO_CLOSE_TO_CALL_MARGIN) {
    prediction = "Too close to call";
  } else {
    prediction = sideATotal > sideBTotal ? "Side A" : "Side B";
  }

  const confidence = margin < TOO_CLOSE_TO_CALL_MARGIN ? 30 : Math.min(95, 50 + margin * 5);

  return {
    sideAHouses: sideAEvals,
    sideBHouses: sideBEvals,
    sideATotal,
    sideBTotal,
    margin,
    prediction,
    confidence,
  };
}

/**
 * Format cluster result as readable report
 */
export function formatClusterReport(
  result: ClusterResult,
  sideAName: string = "Side A",
  sideBName: string = "Side B"
): string {
  const lines: string[] = [];

  lines.push("════════════════════════════════════════════════════════════════");
  lines.push("HOUSE CLUSTER EVALUATION — 10-HOUSE ANALYSIS");
  lines.push("════════════════════════════════════════════════════════════════\n");

  lines.push(`${sideAName.padEnd(20)} vs ${sideBName}\n`);

  // Side A houses
  lines.push(`${sideAName} CLUSTER (H1, H3, H6, H10, H11):`);
  result.sideAHouses.forEach((e) => {
    lines.push(
      `  H${e.houseNumber}  ${e.lordPlanet.padEnd(8)} in ${e.lordSign} (H${e.lordHouse}) ${e.totalPoints > 0 ? "+" : ""}${e.totalPoints.toString().padStart(2)}  [${e.reasoning}]`
    );
  });
  lines.push(`  TOTAL: ${result.sideATotal > 0 ? "+" : ""}${result.sideATotal}\n`);

  // Side B houses
  lines.push(`${sideBName} CLUSTER (H7, H9, H12, H4, H5):`);
  result.sideBHouses.forEach((e) => {
    lines.push(
      `  H${e.houseNumber}  ${e.lordPlanet.padEnd(8)} in ${e.lordSign} (H${e.lordHouse}) ${e.totalPoints > 0 ? "+" : ""}${e.totalPoints.toString().padStart(2)}  [${e.reasoning}]`
    );
  });
  lines.push(`  TOTAL: ${result.sideBTotal > 0 ? "+" : ""}${result.sideBTotal}\n`);

  lines.push("════════════════════════════════════════════════════════════════");
  lines.push(`MARGIN: ${result.margin} points`);
  lines.push(`PREDICTION: ${result.prediction}`);
  lines.push(`CONFIDENCE: ${result.confidence}%`);
  lines.push("════════════════════════════════════════════════════════════════");

  return lines.join("\n");
}
