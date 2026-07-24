/**
 * MASTER PREDICTION ENGINE — Canonical Territorial Rules
 *
 * Single source of truth for all scoring. Implements the symmetric,
 * planet-agnostic territorial model per CANONICAL_TERRITORIAL_RULES.md.
 *
 * Core principle: A house lord's credit is determined by WHERE IT PHYSICALLY SITS,
 * never by which house it rules on paper. Dignity scales strength, never decides
 * which side receives credit.
 */

import { SIGN_RULERS, EXALTATIONS, DEBILITATIONS, SIGN_ORDER } from "./astroEngine";
import { NAKSHATRAS, calculateNakshatraModifier } from "./nakshatraData";
import { SIDE_A_HOUSES, SIDE_B_HOUSES } from "./houseScoringConstants";
import {
  getNakshatraLord,
  getNakshatraDignity,
  getFixedStarAmplification,
  getNakshatraLordStrength,
  findFixedStarConjunctions,
} from "./nakshatraStarEngine";
import { getSignNakshatraFriction, PlanetName } from "./planetRelationships";
import { buildPlanarHouseSystem } from "./planarHouseSystem";
import { calculateArabicLots } from "./arabicLotsCalculator";

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

type HouseType = "angular" | "succedent" | "cadent";
type Rating = "Low" | "Medium" | "High" | "Excellent";
type DignityStatus = "exalted" | "own" | "neutral" | "debilitated";

export interface SportsHoraryPlacement {
  planet: string;
  house: number;
  sign: string;
  degree: number;
  eclipticLon: number;
  isRetrograde: boolean;
  nakshatra?: string; // 27 lunar mansions
}

export interface HouseLord {
  house: number;
  lordPlanet: string;
  placement: SportsHoraryPlacement;
}

export interface ArabicLot {
  name: string;
  house: number;
  sign: string;
  degree: number;
  longitude?: number;
  meaning?: string;
  formula?: string;
}

export interface FixedStarConjunction {
  starName: string;
  conjunctPlanet: string;
  orb: number;
  nature: "benefic" | "malefic";
}

export interface AspectData {
  planetA: string;
  planetB: string;
  aspectType: "conjunction" | "sextile" | "square" | "trine" | "opposition";
  applying: boolean;
}

export interface MoonData {
  phase: "new" | "waxing" | "full" | "waning";
  isVoidOfCourse: boolean;
  nakshatra: string;
}

export interface HouseAuditEntry {
  house: number;
  cuspSign: string;
  lordPlanet: string | null;
  lordSign: string | null;
  lordHouse: number | null;
}

export interface ChartData {
  houseLords: HouseLord[];
  houseAudit?: HouseAuditEntry[];
  planetsInHouses: SportsHoraryPlacement[];
  lots: ArabicLot[];
  fixedStars: FixedStarConjunction[];
  aspects: AspectData[];
  moon: MoonData;
}

export interface ClusterConfig {
  sideAHouses: number[];
  sideBHouses: number[];
  sideALabel: string;
  sideBLabel: string;
}

export interface LayerBreakdown {
  layer: string;
  sideAPoints: number;
  sideBPoints: number;
}

export interface PredictionResult {
  breakdown: LayerBreakdown[];
  sideATotal: number;
  sideBTotal: number;
  margin: number;
  predictedWinner: "A" | "B" | "too close to call";
  confidence: number;
  volatilityWarning: string;
}

// ─────────────────────────────────────────────────────────────────────────
// CORE SCORING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

function getHouseType(house: number): HouseType {
  if ([1, 4, 7, 10].includes(house)) return "angular";
  if ([2, 5, 8, 11].includes(house)) return "succedent";
  return "cadent";
}

function getBasePoints(house: number): number {
  // Symmetric point scale: angular houses (cardinal angles) are worth more.
  // Angular (1,4,7,10): 4 pts | Succedent (2,5,8,11): 3 pts | Cadent (3,6,9,12): 2 pts
  // This reflects traditional astro hierarchy: angle > succedent > cadent
  const houseType = getHouseType(house);
  switch (houseType) {
    case "angular": return 4;
    case "succedent": return 3;
    case "cadent": return 2;
  }
}

function getPlacementBonus(house: number): number {
  // Bonus to the side currently occupying the house (beyond base points)
  // Stronger occupation = more advantage
  const type = getHouseType(house);
  switch (type) {
    case "angular": return 1;
    case "succedent": return 0;
    case "cadent": return -1;
  }
}

function whichSide(house: number, config: ClusterConfig): "A" | "B" | "neutral" {
  if (config.sideAHouses.includes(house)) return "A";
  if (config.sideBHouses.includes(house)) return "B";
  return "neutral";
}

/**
 * Assign house numbers to Arabic Lots based on their longitude
 */
export function assignHousesToLots(lots: any[], houseCusps: Record<number, { sign: string; degree: number }>): ArabicLot[] {
  return lots.map((lot) => {
    const lotLon = lot.longitude || 0;
    let house = 1;

    // Find which house the lot falls in
    for (let i = 0; i < 12; i++) {
      const cusp = houseCusps[i + 1];
      const nextCusp = houseCusps[(i + 1) % 12 === 0 ? 12 : (i + 1) % 12 + 1];

      if (cusp && nextCusp) {
        const cuspLon = SIGN_ORDER.indexOf(cusp.sign) * 30 + cusp.degree;
        const nextCuspLon = SIGN_ORDER.indexOf(nextCusp.sign) * 30 + nextCusp.degree;

        if (cuspLon <= nextCuspLon) {
          if (lotLon >= cuspLon && lotLon < nextCuspLon) {
            house = i + 1;
            break;
          }
        } else {
          if (lotLon >= cuspLon || lotLon < nextCuspLon) {
            house = i + 1;
            break;
          }
        }
      }
    }

    return {
      name: lot.name,
      house,
      sign: lot.sign,
      degree: lot.degree,
      longitude: lot.longitude,
      meaning: lot.meaning,
      formula: lot.formula,
    };
  });
}

function getDignityStatus(placement: SportsHoraryPlacement): DignityStatus {
  const planet = placement.planet;
  const sign = placement.sign;

  if (EXALTATIONS[planet] === sign) return "exalted";
  if (DEBILITATIONS[planet] === sign) return "debilitated";
  if (SIGN_RULERS[sign] === planet) return "own";

  return "neutral";
}

function dignityScore(placement: SportsHoraryPlacement): number {
  const status = getDignityStatus(placement);
  switch (status) {
    case "exalted": return 2;
    case "own": return 1;
    case "neutral": return 0;
    case "debilitated": return -2;
  }
}

function nakshatraScore(nakshatraName: string): number {
  const profile = NAKSHATRAS[nakshatraName];
  if (!profile) return 0;
  // Map nakshatra traits to additive points
  const traitToPoints = (trait: string): number => {
    switch (trait) {
      case "Excellent": return 1.5;
      case "High": return 0.75;
      case "Medium": return 0;
      case "Low": return -0.75;
      default: return 0;
    }
  };
  const traits = [profile.initiative, profile.pressureResponse, profile.consistency, profile.finishingAbility];
  const points = traits.map(traitToPoints);
  return points.reduce((a, b) => a + b, 0) / points.length;
}

function temperamentVolatility(nakshatraName: string): number {
  const profile = NAKSHATRAS[nakshatraName];
  if (!profile) return 0;
  switch (profile.temperament) {
    case "Stoic": return 0;
    case "Emotional": return 0.1;
    case "Volatile": return 0.2;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATION — CANONICAL RULES
// ─────────────────────────────────────────────────────────────────────────

export function calculateFullPrediction(chart: ChartData, config: ClusterConfig): PredictionResult {
  const breakdown: LayerBreakdown[] = [];

  // ──── LAYER 1: TERRITORIAL SCORING (Canonical Rules)
  // Per the canonical rules: A lord occupying opponent territory means:
  // - Displaced side loses BASE POINTS (no multipliers on loss)
  // - Controlling side gains BASE+PLACEMENT, multiplied by dignity+nakshatra+stars
  let sideATotal = 0;
  let sideBTotal = 0;

  // Track which lords are displaced for the multiple-displacement penalty
  const displaceCount = { A: new Set<string>(), B: new Set<string>() };

  for (const lord of chart.houseLords) {
    const ruledSide = whichSide(lord.house, config); // Which side this lord RULES
    const occupiedHouse = lord.placement.house;
    const occupiedSide = whichSide(occupiedHouse, config); // Where the lord IS SITTING

    // H2 and H8 are neutral — never scored
    if (ruledSide === "neutral") continue;

    // If sitting in neutral territory, no points
    if (occupiedSide === "neutral") continue;

    const basePoints = getBasePoints(occupiedHouse);
    const placementBonus = getPlacementBonus(occupiedHouse);
    const dScore = dignityScore(lord.placement);
    const nScore = nakshatraScore(lord.placement.nakshatra);

    // Friction Modifier: Sign Lord ↔ Nakshatra Lord relationship
    const signLord = SIGN_RULERS[lord.placement.sign] as PlanetName || "Sun";
    const nakshatraLord = getNakshatraLord(lord.placement.nakshatra) as PlanetName || "Sun";
    const frictionResult = getSignNakshatraFriction(signLord, nakshatraLord);
    const frictionScore = (frictionResult.multiplier - 1) * 2; // Convert 0.9-1.1x to -0.2 to +0.2

    // Additive scoring: base + placement + all modifiers
    const controllingGain = basePoints + placementBonus + dScore + nScore + frictionScore;

    if (occupiedSide === "A") {
      sideATotal += controllingGain;

      if (ruledSide === "B") {
        // Side B lord is displaced into Side A territory
        sideBTotal -= basePoints; // Side B loses BASE POINTS (no multipliers)
        displaceCount.B.add(lord.lordPlanet);
      }
    } else {
      sideBTotal += controllingGain;

      if (ruledSide === "A") {
        // Side A lord is displaced into Side B territory
        sideATotal -= basePoints; // Side A loses BASE POINTS (no multipliers)
        displaceCount.A.add(lord.lordPlanet);
      }
    }
  }

  // ──── MULTIPLE-DISPLACEMENT PENALTY
  // Each additional displaced lord beyond the first: extra -1
  if (displaceCount.A.size > 1) {
    sideATotal -= (displaceCount.A.size - 1);
  }
  if (displaceCount.B.size > 1) {
    sideBTotal -= (displaceCount.B.size - 1);
  }

  breakdown.push({
    layer: "Territorial Control (Canonical Rules)",
    sideAPoints: sideATotal,
    sideBPoints: sideBTotal,
  });

  // ──── LAYER 2: REMOVED
  // Per canonical rules: only house lords are scored. Non-lord planets are not part of the system.
  // This eliminates noise from unclaimed planets and keeps scoring pure to territorial control.

  // ──── LAYER 3: FIXED STAR AMPLIFICATIONS (Separate layer)
  let sideAFixedStars = 0;
  let sideBFixedStars = 0;

  // Track which planets have fixed star conjunctions for explicit scoring
  for (const lord of chart.houseLords) {
    const conjunctions = findFixedStarConjunctions(lord.placement.eclipticLon, 1.0);
    if (conjunctions.length === 0) continue;

    const side = whichSide(lord.placement.house, config);
    if (side === "neutral") continue;

    let starBonus = 0;
    for (const star of conjunctions) {
      if (star.group === "royal") {
        starBonus += star.nature === "benefic" ? 2.0 : -2.5;
      } else if (star.group === "major") {
        starBonus += star.nature === "benefic" ? 1.0 : -1.5;
      } else {
        starBonus += star.nature === "benefic" ? 0.5 : -0.75;
      }
    }

    if (side === "A") sideAFixedStars += starBonus;
    else sideBFixedStars += starBonus;
  }
  breakdown.push({
    layer: "Fixed Stars (Royal & Major)",
    sideAPoints: sideAFixedStars,
    sideBPoints: sideBFixedStars,
  });

  // ──── LAYER 4: ARABIC LOTS
  let sideALots = 0;
  let sideBLots = 0;
  const ADVERSITY_LOTS = new Set(["Nemesis"]);

  for (const lot of chart.lots) {
    const side = whichSide(lot.house, config);
    if (side === "neutral") continue;

    const basePoints = getBasePoints(lot.house);
    const placementBonus = getPlacementBonus(lot.house);
    const points = basePoints + placementBonus;

    if (ADVERSITY_LOTS.has(lot.name)) {
      // Adversity lots penalize the side that owns the house
      if (side === "A") sideALots -= points;
      else sideBLots -= points;
    } else {
      // Benefic lots reward
      if (side === "A") sideALots += points;
      else sideBLots += points;
    }
  }
  breakdown.push({ layer: "Arabic Lots", sideAPoints: sideALots, sideBPoints: sideBLots });

  // ──── LAYER 5: ASPECTS
  let aspectTotal = 0;
  for (const aspect of chart.aspects) {
    const aspectWeight: Record<AspectData["aspectType"], number> = {
      trine: 2,
      sextile: 1,
      conjunction: 0,
      square: -2,
      opposition: -2,
    };
    const base = aspectWeight[aspect.aspectType];
    aspectTotal += aspect.applying ? base : base * 0.5;
  }
  breakdown.push({ layer: "Aspects (chart-wide)", sideAPoints: aspectTotal / 2, sideBPoints: -aspectTotal / 2 });

  // ──── LAYER 6: MOON PHASE
  const moonAdjustment = (() => {
    if (chart.moon.isVoidOfCourse) return -2;
    switch (chart.moon.phase) {
      case "full": return 1.5;
      case "waxing": return 1;
      case "new": return 0;
      case "waning": return -0.5;
    }
  })();
  breakdown.push({ layer: "Moon Phase/VOC (chart-wide)", sideAPoints: moonAdjustment / 2, sideBPoints: moonAdjustment / 2 });

  // ──── TOTAL & CONFIDENCE
  const sideABreakdown = sideATotal + sideAFixedStars + sideALots + (aspectTotal / 2) + (moonAdjustment / 2);
  const sideBBreakdown = sideBTotal + sideBFixedStars + sideBLots + (-aspectTotal / 2) + (moonAdjustment / 2);

  const TOO_CLOSE_THRESHOLD = 2;
  const margin = sideABreakdown - sideBBreakdown;
  const predictedWinner: PredictionResult["predictedWinner"] =
    Math.abs(margin) < TOO_CLOSE_THRESHOLD ? "too close to call" : margin > 0 ? "A" : "B";

  // ──── CONFIDENCE
  // Additive scoring: confidence based on margin size (larger margins = higher confidence)
  // Volatility (Volatile temperaments) reduce confidence proportionally
  const maxPlausibleMargin = 15;
  let baseConfidence = 50 + Math.min(Math.abs(margin) / maxPlausibleMargin, 1) * 45;

  const relevantTemperaments = chart.houseLords
    .filter((l) => whichSide(l.house, config) !== "neutral")
    .map((l) => temperamentVolatility(l.placement.nakshatra));

  const avgVolatility = relevantTemperaments.length ? relevantTemperaments.reduce((a, b) => a + b, 0) / relevantTemperaments.length : 0;
  const confidence = Math.max(50, baseConfidence * (1 - avgVolatility));

  // ──── VOLATILITY WARNING
  const volatileCount = chart.houseLords.filter((l) => {
    const profile = NAKSHATRAS[l.placement.nakshatra];
    return profile?.temperament === "Volatile";
  }).length;
  const volatilityWarning = volatileCount > 2 ? `High volatility (${volatileCount} Volatile lords) — confidence range should widen ±${Math.round(avgVolatility * 30)}%` : "";

  return {
    breakdown,
    sideATotal: sideABreakdown,
    sideBTotal: sideBBreakdown,
    margin,
    predictedWinner,
    confidence: Math.round(confidence * 100) / 100,
    volatilityWarning,
  };
}

/**
 * Calculate prediction using planar equal-house system (date/location based).
 * When you have exact event time and location, use this for accurate house cusps.
 */
export function calculateFullPredictionWithPlanarHouses(
  chart: ChartData,
  config: ClusterConfig,
  date: Date,
  latitude: number,
  longitude: number
): PredictionResult {
  const planarSystem = buildPlanarHouseSystem(date, latitude, longitude);

  // Rebuild house lords using planar houses
  const updatedHouseLords = chart.houseLords.map((lord) => {
    const siderealLon = lord.placement.eclipticLon;
    const planarHouse = getPlanarHouseFromCusps(siderealLon, planarSystem.cusps);

    return {
      ...lord,
      placement: {
        ...lord.placement,
        house: planarHouse,
      },
    };
  });

  const updatedChart: ChartData = {
    ...chart,
    houseLords: updatedHouseLords,
  };

  return calculateFullPrediction(updatedChart, config);
}

/** Helper: get house number from planar cusps */
function getPlanarHouseFromCusps(eclipticLon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    if (start <= end) {
      if (eclipticLon >= start && eclipticLon < end) return i + 1;
    } else {
      if (eclipticLon >= start || eclipticLon < end) return i + 1;
    }
  }
  return 1;
}
