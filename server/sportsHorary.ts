/**
 * SPORTS HORARY ENGINE — The Firmament
 * ============================================================================
 * Deterministic composite-score engine implementing the SPORTS HORARY MASTER
 * RULEBOOK (Vedic dignity/placement core + the Seven Secrets + Fixed Stars +
 * Western applying-aspect doctrine).
 *
 * This is a PURE FUNCTION. It does not touch the ephemeris, the LLM, tRPC, or
 * the DOM — it consumes an already-resolved set of chart facts and returns a
 * signed score, a verdict, and a flags array. Detecting the raw conditions
 * (VOC Moon, applying/separating motion, translation of light, fixed-star
 * conjunctions, planetary hour, Part of Fortune, house lords, etc.) is the job
 * of an upstream adapter (`buildSportsHoraryChart`, TODO) that reads
 * astroEngine / aspectMotion / fixedStars output. Keeping the scoring pure
 * makes it exhaustively unit-testable against the rulebook's point tables.
 *
 * SIGN CONVENTION: score is signed, POSITIVE favors the Favorite (Ascendant /
 * H1 / L1), NEGATIVE favors the Challenger (Descendant / H7 / L7). Every
 * "mirror" (+6 house) rule in the rulebook flips the sign accordingly.
 *
 * Thresholds (§X):  score >= +5 → Favorite ; <= -5 → Challenger ; else Even.
 * A Fixed-Star override (§VI, Regulus) can force the verdict regardless of score.
 * ============================================================================
 */

// ─── OUTPUT (§X) ────────────────────────────────────────────────────────────

export type Verdict = "Favorite" | "Challenger" | "Even";

export interface SportsScore {
  score: number;
  verdict: Verdict;
  flags: string[];
}

// ─── INPUT CONTRACT ─────────────────────────────────────────────────────────
// Every field maps 1:1 to a condition the rulebook checks. The adapter fills
// these from resolved chart data.

export type Side = "fav" | "chall";

export type Dignity =
  | "own" // domicile / moolatrikona
  | "exaltation"
  | "debilitation"
  | "peregrine" // zero essential dignity
  | "neutral";

export type AspectType =
  | "conjunction"
  | "sextile"
  | "square"
  | "trine"
  | "opposition";

/** Facts about a house lord (L1 = Favorite significator, L7 = Challenger). */
export interface LordFacts {
  planet: string; // e.g. "Mars"
  house: number; // 1..12 — the house this lord OCCUPIES
  longitude: number; // sidereal degrees 0..360 (0 = 0° Aries) — for via combusta
  dignity: Dignity; // baseline essential dignity
  combust: boolean; // combust (wide orb)
  cazimi: boolean; // within 17' of the Sun (overrides combustion)
  besieged: boolean; // hemmed between Saturn and Mars by degree
  maleficFromDeathHouses: boolean; // afflicted by a malefic aspecting from H6/H8
  beneficAspect: boolean; // receives a benefic aspect
  /** 1–2° conjunction with a royal/fixed star, if any (§VI). */
  fixedStar: { name: string; influence: string } | null;
}

export interface SportsHoraryChart {
  l1: LordFacts; // Favorite  (Ascendant lord)
  l7: LordFacts; // Challenger (7th lord)

  // ── §II Circuit Breakers ──
  voidOfCourseMoon: boolean; // Moon makes no exact Ptolemaic aspect before sign change
  l1l7MutualReception: boolean; // L1 & L7 in mutual reception → zero §III

  // ── §III Placement & Dignity extras (beyond the per-lord LordFacts above) ──
  l1l10MutualReception: boolean; // clutch (fav)
  l7l4MutualReception: boolean; // clutch mirror (chall)
  favBeneficStrongInH1orH10: boolean; // Kendra power boost (fav)
  challBeneficStrongInH4orH7: boolean; // Kendra power boost (chall)
  moon: { phase: "waxing" | "waning"; house: number };
  maleficsInFavUpachaya: number; // malefics in Fav upachaya (3,6,10,11)
  maleficsInChallUpachaya: number; // malefics in Chall upachaya (9,12,4,5)
  l6FavStrongMaleficFree: boolean; // Point-Zero turnover (fav)
  l12ChallStrongMaleficFree: boolean; // Point-Zero turnover (chall)

  // ── §IV Flags (qualitative) ──
  l1l7SameHouseOrDegree: boolean; // conjunction → "volatility"
  l1l7Opposition: boolean; // opposition → "seesaw"

  // ── §V The Seven Secrets ──
  /** Secret 1 — Part of Fortune placement. */
  partOfFortune: "H1_or_conjL1" | "H7_or_conjL7" | null;
  l4AspectsL1TrineSextile: boolean; // Secret 3 — End of Matter (fav)
  l4AspectsL7TrineSextile: boolean; // Secret 3 — End of Matter (chall)
  /** Secret 4 — Translation of Light. `receiving` is the side that receives it. */
  translationOfLight: {
    translator: "benefic" | "malefic";
    receiving: Side;
  } | null;
  /** Secret 5 — Planetary Hour ruler. */
  planetaryHour: "L1_or_H1" | "L7_or_H7" | null;
  // Secret 6 (peregrine) is derived from l1.dignity / l7.dignity.
  // Secret 7 (via combusta) is derived from l1.longitude / l7.longitude.

  // ── §VII Western Aspect Doctrine ──
  lordAspect: {
    applying: Side | null; // which lord is applying to the other (null = separating/none)
    type: AspectType | null; // aspect type between the lords
    fasterSide: Side | null; // which lord is the faster planet ("gets there first")
  };
  frustration: boolean; // 3rd planet perfects first → reverses expected advantage
  prohibition: boolean; // faster planet aspects a lord before L1/L7 perfect
  refranation: boolean; // applying planet turns retrograde before perfecting
}

// ─── VIA COMBUSTA (§V.7) ──────────────────────────────────────────────────
// 15° Libra – 15° Scorpio.  Sidereal (0 = 0° Aries): Libra = 180°, so 15° Libra
// = 195°; Scorpio = 210°, so 15° Scorpio = 225°.
function inViaCombusta(longitude: number): boolean {
  const x = ((longitude % 360) + 360) % 360;
  return x >= 195 && x <= 225;
}

// ─── THE ENGINE ─────────────────────────────────────────────────────────────

export function calculateCompositeScore(chart: SportsHoraryChart): SportsScore {
  let score = 0;
  const flags: string[] = [];
  const add = (pts: number) => {
    score += pts;
  };
  const pushFlag = (f: string) => {
    if (!flags.includes(f)) flags.push(f);
  };

  const { l1, l7 } = chart;
  const bothPeregrine =
    l1.dignity === "peregrine" && l7.dignity === "peregrine";

  // ══ §IX STEP 1 — Circuit Breaker: Void-of-Course Moon ══════════════════════
  // Force neutral: −2 to each side (nets to 0), flag STALEMATE, skip §III & §V.
  // Fixed Stars (§VI) and Western aspects (§VII) are STILL checked.
  const voc = chart.voidOfCourseMoon;
  if (voc) {
    pushFlag("STALEMATE");
    // −2 Fav and −2 Chall → net 0 on the signed score.
    add(-2); // −2 to Favorite
    add(+2); // −2 to Challenger (= +2 on a fav-positive score)
  }

  // ══ §IX STEP 2 — Circuit Breaker: L1/L7 Mutual Reception ═══════════════════
  // Zero out §III, flag it, then proceed through §V–§X.
  const mutualReception = chart.l1l7MutualReception;
  if (mutualReception) pushFlag("mutual_reception_override");

  // ══ §IX STEP 3 — §III Placement & Dignity (skip if VOC or Mutual Reception) ═
  if (!voc && !mutualReception) {
    // Defensive Cover
    if (l1.house === 12) add(+3);
    if (l7.house === 6) add(-3); // mirror
    // Offensive Combat
    if (l1.house === 6) add(+4);
    if (l7.house === 12) add(-4); // mirror
    // Invasion
    if (l1.house === 7) add(-4);
    if (l7.house === 1) add(+4); // mirror
    // Clutch Mutual Reception (L1↔L10 / L7↔L4)
    if (chart.l1l10MutualReception) add(+3);
    if (chart.l7l4MutualReception) add(-3); // mirror
    // Combustion — Cazimi overrides the combustion penalty
    if (l1.cazimi) add(+5);
    else if (l1.combust) add(-5);
    if (l7.cazimi) add(-5);
    else if (l7.combust) add(+5); // mirror
    // Affliction (malefic aspect from H6/H8)
    if (l1.maleficFromDeathHouses) add(-3);
    if (l7.maleficFromDeathHouses) add(+3); // mirror
    // 8th House Chaos
    if (l1.house === 8) add(-2);
    if (l7.house === 8) add(+2); // mirror
    // Benefic Support
    if (l1.beneficAspect) add(+2);
    if (l7.beneficAspect) add(-2); // mirror
    // Kendra Power Boost
    if (chart.favBeneficStrongInH1orH10) add(+3);
    if (chart.challBeneficStrongInH4orH7) add(-3); // mirror
    // Baseline Dignity
    if (l1.dignity === "own" || l1.dignity === "exaltation") add(+3);
    if (l1.dignity === "debilitation") add(-3);
    if (l7.dignity === "own" || l7.dignity === "exaltation") add(-3); // mirror
    if (l7.dignity === "debilitation") add(+3); // mirror
    // Upachaya Growth (malefics: +1 each Fav side, −1 each Chall side)
    add(+1 * chart.maleficsInFavUpachaya);
    add(-1 * chart.maleficsInChallUpachaya);
    // Moon Momentum
    add(chart.moon.phase === "waxing" ? +2 : -2);
    if (chart.moon.house === 1) add(+3);
    if (chart.moon.house === 7) add(-3);
    // Point-Zero (Turnovers)
    if (chart.l6FavStrongMaleficFree) add(+3);
    if (chart.l12ChallStrongMaleficFree) add(-3);
    // Besiegement
    if (l1.besieged) {
      add(-4);
      pushFlag("besieged");
    }
    if (l7.besieged) {
      add(+4);
      pushFlag("besieged_chall");
    }
  }

  // ══ §IV Flags (qualitative only — no points) ══════════════════════════════
  if (chart.l1l7SameHouseOrDegree) pushFlag("volatility");
  if (chart.l1l7Opposition) pushFlag("seesaw");
  if (l1.house === 8 || l7.house === 8) pushFlag("upset_alert");
  if (bothPeregrine) pushFlag("chaos");

  // ══ §IX STEP 4 — §V The Seven Secrets (skip if VOC) ═══════════════════════
  if (!voc) {
    // Secret 1 — Part of Fortune
    if (chart.partOfFortune === "H1_or_conjL1") add(+4);
    else if (chart.partOfFortune === "H7_or_conjL7") add(-4);
    // Secret 3 — End of Matter (L4 trine/sextile a lord)
    if (chart.l4AspectsL1TrineSextile) add(+5);
    if (chart.l4AspectsL7TrineSextile) add(-5); // mirror
    // Secret 4 — Translation of Light (±3 to the receiving side)
    if (chart.translationOfLight) {
      const t = chart.translationOfLight;
      const magnitude = t.translator === "benefic" ? 3 : -3;
      add(t.receiving === "fav" ? magnitude : -magnitude);
    }
    // Secret 5 — Planetary Hour
    if (chart.planetaryHour === "L1_or_H1") add(+3);
    else if (chart.planetaryHour === "L7_or_H7") add(-3);
    // Secret 6 — Peregrine (both peregrine → CHAOS flag, no net points)
    if (bothPeregrine) {
      pushFlag("chaos");
    } else {
      if (l1.dignity === "peregrine") add(-4);
      if (l7.dignity === "peregrine") add(+4); // mirror
    }
    // Secret 7 — Via Combusta (major override)
    if (inViaCombusta(l1.longitude)) add(-5);
    if (inViaCombusta(l7.longitude)) add(+5); // mirror
  }

  // ══ §IX STEP 5 — §VII Western Applying/Separating Aspects ══════════════════
  const la = chart.lordAspect;
  if (la.applying === "fav") {
    add(+2);
    pushFlag("fav_initiating");
  } else if (la.applying === "chall") {
    add(-2);
    pushFlag("chall_initiating");
  }
  if (la.applying && la.type) {
    // Applying trine/sextile → smooth resolution to the applying side
    if (la.type === "trine" || la.type === "sextile") {
      add(la.applying === "fav" ? +3 : -3);
    }
    // Applying square/opposition → contested; resolved by the faster planet
    if (la.type === "square" || la.type === "opposition") {
      pushFlag("contested_finish");
    }
    // Faster planet "gets there first" → +3 to the faster side
    if (la.fasterSide) {
      add(la.fasterSide === "fav" ? +3 : -3);
    }
  }
  // Classical motion flags (qualitative — no independent points per §IV/§VII)
  if (chart.frustration) pushFlag("frustration");
  if (chart.prohibition) pushFlag("prohibition");
  if (chart.refranation) pushFlag("refranation");

  // ══ §IX STEP 6 — §VI Fixed Star Override (can override everything above) ═══
  let forcedVerdict: Verdict | null = null;
  const regulusL1 = l1.fixedStar?.name === "Regulus";
  const regulusL7 = l7.fixedStar?.name === "Regulus";
  if (regulusL1 && regulusL7) forcedVerdict = "Even"; // "Draw" if both
  else if (regulusL1) forcedVerdict = "Favorite";
  else if (regulusL7) forcedVerdict = "Challenger";

  // All fixed stars contribute to the score
  if (l1.fixedStar) {
    if (l1.fixedStar.name === "Spica") add(+5);
    else if (l1.fixedStar.name === "Aldebaran") add(+4); // Watcher, protective
    else if (l1.fixedStar.name === "Antares") add(-3); // Challenging
    else if (l1.fixedStar.name === "Algol") {
      add(-8);
      pushFlag("doomed");
    }
    else if (l1.fixedStar.name === "Sirius") add(+3); // fortunate
    else if (l1.fixedStar.influence?.includes("benefic")) add(+2);
    else if (l1.fixedStar.influence?.includes("malefic")) add(-2);
  }
  if (l7.fixedStar) {
    if (l7.fixedStar.name === "Spica") add(-5); // mirror
    else if (l7.fixedStar.name === "Aldebaran") add(-4);
    else if (l7.fixedStar.name === "Antares") add(+3);
    else if (l7.fixedStar.name === "Algol") {
      add(+8); // mirror
      pushFlag("doomed_challenger");
    }
    else if (l7.fixedStar.name === "Sirius") add(-3);
    else if (l7.fixedStar.influence?.includes("benefic")) add(-2);
    else if (l7.fixedStar.influence?.includes("malefic")) add(+2);
  }

  // ══ §IX STEP 7 — Thresholds ════════════════════════════════════════════════
  let verdict: Verdict;
  if (forcedVerdict) {
    verdict = forcedVerdict;
  } else if (score >= 5) {
    verdict = "Favorite";
  } else if (score <= -5) {
    verdict = "Challenger";
  } else {
    verdict = "Even";
  }

  return { score, verdict, flags };
}
