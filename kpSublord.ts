/**
 * kpSubLord.ts
 *
 * KP (Krishnamurti Paddhati) sub-lord calculation — the 9-fold subdivision
 * of each of the 27 nakshatras (243 segments total) using Vimshottari
 * dasha-year proportions, starting from each nakshatra's own ruling lord.
 *
 * FOUNDATIONAL LAYER: this operates directly on the same fixed-star-anchored
 * longitude every other module in the app already computes (the same value
 * fed into getNakshatraFromLongitude / getNakshatraLord elsewhere) — not a
 * separate ayanamsa or coordinate system. That's what makes it safe to share
 * across the sports engine, natal readings, horary, and the Oracle, rather
 * than being sports-specific.
 */

import { NAKSHATRAS } from "./nakshatraData";

// ─────────────────────────────────────────────────────────────────────────
// VIMSHOTTARI CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

export type KPPlanet =
  | "Ketu" | "Venus" | "Sun" | "Moon" | "Mars"
  | "Rahu" | "Jupiter" | "Saturn" | "Mercury";

/** Standard Vimshottari dasha-lord cycle order (also the nakshatra-lord cycle). */
const VIMSHOTTARI_ORDER: KPPlanet[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars",
  "Rahu", "Jupiter", "Saturn", "Mercury",
];

/** Dasha years per lord — total sums to 120. */
const DASHA_YEARS: Record<KPPlanet, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

const TOTAL_DASHA_YEARS = 120;

/** Each nakshatra spans 13°20' = 13.3333...° (360° / 27). */
const NAKSHATRA_SPAN = 360 / 27;

// ─────────────────────────────────────────────────────────────────────────
// SUB-LORD SEGMENT TABLE (per nakshatra, in degrees, cumulative)
// ─────────────────────────────────────────────────────────────────────────

export interface SubLordSegment {
  lord: KPPlanet;
  startOffsetDeg: number; // offset from the start of the nakshatra, in degrees
  endOffsetDeg: number;
  spanDeg: number;
}

/**
 * Builds the 9 sub-lord segments for a nakshatra, given its ruling lord.
 * The cycle starts at that lord and proceeds through the standard
 * Vimshottari order, wrapping around, until all 9 lords are placed —
 * this is the standard KP construction.
 */
function buildSegmentsForNakshatra(startingLord: KPPlanet): SubLordSegment[] {
  const startIndex = VIMSHOTTARI_ORDER.indexOf(startingLord);
  const segments: SubLordSegment[] = [];
  let cursor = 0;

  for (let i = 0; i < 9; i++) {
    const lord = VIMSHOTTARI_ORDER[(startIndex + i) % 9];
    const span = (DASHA_YEARS[lord] / TOTAL_DASHA_YEARS) * NAKSHATRA_SPAN;
    segments.push({
      lord,
      startOffsetDeg: cursor,
      endOffsetDeg: cursor + span,
      spanDeg: span,
    });
    cursor += span;
  }

  return segments;
}

// Cache: nakshatra name -> its 9 sub-lord segments (built lazily, once)
const segmentCache = new Map<string, SubLordSegment[]>();

function getSegmentsForNakshatra(nakshatraName: string, rulingLord: KPPlanet): SubLordSegment[] {
  const cached = segmentCache.get(nakshatraName);
  if (cached) return cached;
  const segments = buildSegmentsForNakshatra(rulingLord);
  segmentCache.set(nakshatraName, segments);
  return segments;
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────

export interface KPResult {
  nakshatra: string;
  nakshatraLord: KPPlanet;
  subLord: KPPlanet;
  subLordIndex: number; // 0-8, position within the 9 segments
  degreeIntoNakshatra: number; // how far into the 13°20' span
  segments: SubLordSegment[]; // full 9-segment breakdown, for display/debugging
}

/**
 * Given a fixed-star-anchored ecliptic longitude, returns the nakshatra,
 * its ruling lord, and the KP sub-lord — the same 243-segment (27 × 9)
 * system used throughout Krishnamurti Paddhati.
 */
export function getSubLord(longitude: number): KPResult {
  const normalizedLon = ((longitude % 360) + 360) % 360;

  const nakshatraNames = Object.keys(NAKSHATRAS);
  const nakshatraIndex = Math.floor(normalizedLon / NAKSHATRA_SPAN);
  const nakshatraName = nakshatraNames[nakshatraIndex] || "Ashwini";

  const nakshatraStart = nakshatraIndex * NAKSHATRA_SPAN;
  const degreeIntoNakshatra = normalizedLon - nakshatraStart;

  // Nakshatra lord cycle repeats every 9 nakshatras in the standard order.
  const nakshatraLord = VIMSHOTTARI_ORDER[nakshatraIndex % 9];

  const segments = getSegmentsForNakshatra(nakshatraName, nakshatraLord);

  let subLordIndex = segments.findIndex(
    (seg) => degreeIntoNakshatra >= seg.startOffsetDeg && degreeIntoNakshatra < seg.endOffsetDeg
  );
  // Guard against floating point landing exactly on the final boundary.
  if (subLordIndex === -1) subLordIndex = 8;

  return {
    nakshatra: nakshatraName,
    nakshatraLord,
    subLord: segments[subLordIndex].lord,
    subLordIndex,
    degreeIntoNakshatra,
    segments,
  };
}

/**
 * Convenience: just the sub-lord planet name, when that's all a caller needs.
 */
export function getSubLordName(longitude: number): KPPlanet {
  return getSubLord(longitude).subLord;
}