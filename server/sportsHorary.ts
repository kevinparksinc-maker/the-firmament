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
  breakdown: string[]; // How points were calculated
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
  const breakdown: string[] = [];
  const add = (pts: number, reason: string = "") => {
    score += pts;
    // Always log, even if no explicit reason provided
    if (reason) {
      breakdown.push(`${pts > 0 ? "+" : ""}${pts} — ${reason}`);
    } else if (pts !== 0) {
      breakdown.push(`${pts > 0 ? "+" : ""}${pts} — (automatic)`);
    }
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
    add(-2, "VOC Moon penalty to Favorite");
    add(+2, "VOC Moon penalty to Challenger (mirrored)");
  }

  // ══ §IX STEP 2 — Circuit Breaker: L1/L7 Mutual Reception ═══════════════════
  // Zero out §III, flag it, then proceed through §V–§X.
  const mutualReception = chart.l1l7MutualReception;
  if (mutualReception) pushFlag("mutual_reception_override");

  // ══ §IX STEP 3 — §III Placement & Dignity (skip if VOC or Mutual Reception) ═
  if (!voc && !mutualReception) {
    // Destruction (house behind Asc/Desc = undoing)
    if (l1.house === 12) add(-3, "Destruction (L1 in H12, house of undoing)");
    if (l7.house === 6) add(+3, "Destruction (L7 in H6, house of undoing, mirrored)");
    // Offensive Combat
    if (l1.house === 6) add(+4, "Offensive Combat (L1 in H6)");
    if (l7.house === 12) add(-4, "Offensive Combat (L7 in H12, mirrored)");
    // Invasion
    if (l1.house === 7) add(-4, "Invasion (L1 in H7)");
    if (l7.house === 1) add(+4, "Invasion (L7 in H1, mirrored)");
    // Clutch Mutual Reception (L1↔L10 / L7↔L4)
    if (chart.l1l10MutualReception) add(+3, "Clutch Mutual Reception (L1↔L10)");
    if (chart.l7l4MutualReception) add(-3, "Clutch Mutual Reception (L7↔L4, mirrored)");
    // Combustion — Cazimi overrides the combustion penalty
    if (l1.cazimi) add(+5, "Cazimi (L1 within 17' of Sun)");
    else if (l1.combust) add(-5, "Combust (L1 burned by Sun)");
    if (l7.cazimi) add(-5, "Cazimi (L7 within 17' of Sun, mirrored)");
    else if (l7.combust) add(+5, "Combust (L7 burned by Sun, mirrored)");
    // Affliction (malefic aspect from H6/H8)
    if (l1.maleficFromDeathHouses) add(-3, "Affliction (L1 aspected by malefic from H6/H8)");
    if (l7.maleficFromDeathHouses) add(+3, "Affliction (L7 aspected by malefic from H6/H8, mirrored)");
    // 8th House Chaos
    if (l1.house === 8) add(-2, "8th House (L1 in house of death)");
    if (l7.house === 8) add(+2, "8th House (L7 in house of death, mirrored)");
    // Benefic Support
    if (l1.beneficAspect) add(+2, "Benefic Support (L1 receives benefic aspect)");
    if (l7.beneficAspect) add(-2, "Benefic Support (L7 receives benefic aspect, mirrored)");
    // Kendra Power Boost
    if (chart.favBeneficStrongInH1orH10) add(+3, "Kendra Power Boost (strong benefic in H1 or H10)");
    if (chart.challBeneficStrongInH4orH7) add(-3, "Kendra Power Boost (strong benefic in H4 or H7, mirrored)");
    // Baseline Dignity
    if (l1.dignity === "own" || l1.dignity === "exaltation") add(+3, `L1 in ${l1.dignity}`);
    if (l1.dignity === "debilitation") add(-3, "L1 in debilitation");
    if (l7.dignity === "own" || l7.dignity === "exaltation") add(-3, `L7 in ${l7.dignity} (mirrored)`);
    if (l7.dignity === "debilitation") add(+3, "L7 in debilitation (mirrored)");
    // Upachaya Growth (malefics: +1 each Fav side, −1 each Chall side)
    if (chart.maleficsInFavUpachaya > 0) add(+1 * chart.maleficsInFavUpachaya, `Upachaya Growth (${chart.maleficsInFavUpachaya} malefic(s) in Fav houses 3/6/10/11)`);
    if (chart.maleficsInChallUpachaya > 0) add(-1 * chart.maleficsInChallUpachaya, `Upachaya Growth (${chart.maleficsInChallUpachaya} malefic(s) in Chall houses 9/12/4/5, mirrored)`);
    // Moon Momentum
    add(chart.moon.phase === "waxing" ? +2 : -2, `Moon ${chart.moon.phase}`);
    if (chart.moon.house === 1) add(+3, "Moon in H1");
    if (chart.moon.house === 7) add(-3, "Moon in H7");
    // Point-Zero (Turnovers)
    if (chart.l6FavStrongMaleficFree) add(+3, "Point-Zero (L6 strong & malefic-free for Favorite)");
    if (chart.l12ChallStrongMaleficFree) add(-3, "Point-Zero (L12 strong & malefic-free for Challenger, mirrored)");
    // Besiegement
    if (l1.besieged) {
      add(-4, "Besieged (L1 hemmed between Saturn & Mars)");
      pushFlag("besieged");
    }
    if (l7.besieged) {
      add(+4, "Besieged (L7 hemmed between Saturn & Mars, mirrored)");
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
    if (chart.partOfFortune === "H1_or_conjL1") add(+4, "Secret 1: Part of Fortune in H1 or conjunct L1");
    else if (chart.partOfFortune === "H7_or_conjL7") add(-4, "Secret 1: Part of Fortune in H7 or conjunct L7 (mirrored)");
    // Secret 3 — End of Matter (L4 trine/sextile a lord)
    if (chart.l4AspectsL1TrineSextile) add(+5, "Secret 3: End of Matter (L4 trine/sextile to L1)");
    if (chart.l4AspectsL7TrineSextile) add(-5, "Secret 3: End of Matter (L4 trine/sextile to L7, mirrored)");
    // Secret 4 — Translation of Light (±3 to the receiving side)
    if (chart.translationOfLight) {
      const t = chart.translationOfLight;
      const magnitude = t.translator === "benefic" ? 3 : -3;
      const side = t.receiving === "fav" ? "Favorite" : "Challenger";
      const translator = t.translator === "benefic" ? "benefic" : "malefic";
      add(t.receiving === "fav" ? magnitude : -magnitude, `Secret 4: Translation of Light (${translator}) to ${side}`);
    }
    // Secret 5 — Planetary Hour
    if (chart.planetaryHour === "L1_or_H1") add(+3, "Secret 5: Planetary Hour favors Favorite");
    else if (chart.planetaryHour === "L7_or_H7") add(-3, "Secret 5: Planetary Hour favors Challenger (mirrored)");
    // Secret 6 — Peregrine (both peregrine → CHAOS flag, no net points)
    if (bothPeregrine) {
      pushFlag("chaos");
    } else {
      if (l1.dignity === "peregrine") add(-4, "Secret 6: L1 peregrine (zero essential dignity)");
      if (l7.dignity === "peregrine") add(+4, "Secret 6: L7 peregrine (zero essential dignity, mirrored)");
    }
    // Secret 7 — Via Combusta (major override)
    if (inViaCombusta(l1.longitude)) add(-5, "Secret 7: L1 in Via Combusta (15° Libra—15° Scorpio, debilitating)");
    if (inViaCombusta(l7.longitude)) add(+5, "Secret 7: L7 in Via Combusta (15° Libra—15° Scorpio, debilitating, mirrored)");
  }

  // ══ §IX STEP 5 — §VII Western Applying/Separating Aspects ══════════════════
  const la = chart.lordAspect;
  if (la.applying === "fav") {
    add(+2, "L1 applying to L7 (Favorite initiating)");
    pushFlag("fav_initiating");
  } else if (la.applying === "chall") {
    add(-2, "L7 applying to L1 (Challenger initiating, mirrored)");
    pushFlag("chall_initiating");
  }
  if (la.applying && la.type) {
    // Applying trine/sextile → smooth resolution to the applying side
    if (la.type === "trine" || la.type === "sextile") {
      add(la.applying === "fav" ? +3 : -3, `L1/L7 ${la.type} — smooth resolution for applying side`);
    }
    // Applying square/opposition → contested; resolved by the faster planet
    if (la.type === "square" || la.type === "opposition") {
      pushFlag("contested_finish");
    }
    // Faster planet "gets there first" → +3 to the faster side
    if (la.fasterSide) {
      add(la.fasterSide === "fav" ? +3 : -3, `${la.fasterSide === "fav" ? "L1" : "L7"} faster planet (reaches perfection first)`);
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
    if (l1.fixedStar.name === "Spica") add(+5, `L1 conjunct Spica (${l1.fixedStar.influence})`);
    else if (l1.fixedStar.name === "Aldebaran") add(+4, `L1 conjunct Aldebaran (${l1.fixedStar.influence})`);
    else if (l1.fixedStar.name === "Antares") add(-3, `L1 conjunct Antares (${l1.fixedStar.influence})`);
    else if (l1.fixedStar.name === "Algol") {
      add(-8, `L1 conjunct Algol (${l1.fixedStar.influence}) — DOOMED`);
      pushFlag("doomed");
    }
    else if (l1.fixedStar.name === "Sirius") add(+3, `L1 conjunct Sirius (${l1.fixedStar.influence})`);
    else if (l1.fixedStar.name === "Regulus") add(+6, `L1 conjunct Regulus (${l1.fixedStar.influence}) — OVERRIDE`);
    else if (l1.fixedStar.influence?.includes("benefic")) add(+2, `L1 conjunct ${l1.fixedStar.name} (benefic)`);
    else if (l1.fixedStar.influence?.includes("malefic")) add(-2, `L1 conjunct ${l1.fixedStar.name} (malefic)`);
  }
  if (l7.fixedStar) {
    if (l7.fixedStar.name === "Spica") add(-5, `L7 conjunct Spica (${l7.fixedStar.influence})`);
    else if (l7.fixedStar.name === "Aldebaran") add(-4, `L7 conjunct Aldebaran (${l7.fixedStar.influence})`);
    else if (l7.fixedStar.name === "Antares") add(+3, `L7 conjunct Antares (${l7.fixedStar.influence})`);
    else if (l7.fixedStar.name === "Algol") {
      add(+8, `L7 conjunct Algol (${l7.fixedStar.influence}) — DOOMED`);
      pushFlag("doomed_challenger");
    }
    else if (l7.fixedStar.name === "Sirius") add(-3, `L7 conjunct Sirius (${l7.fixedStar.influence})`);
    else if (l7.fixedStar.name === "Regulus") add(-6, `L7 conjunct Regulus (${l7.fixedStar.influence}) — OVERRIDE`);
    else if (l7.fixedStar.influence?.includes("benefic")) add(-2, `L7 conjunct ${l7.fixedStar.name} (benefic)`);
    else if (l7.fixedStar.influence?.includes("malefic")) add(+2, `L7 conjunct ${l7.fixedStar.name} (malefic)`);
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

  return { score, verdict, flags, breakdown };
}
