/**
 * SPORTS HORARY READING — The Firmament
 * ============================================================================
 * Ties the deterministic scoring engine (`calculateCompositeScore`, the
 * SPORTS HORARY MASTER RULEBOOK) to the reading pipeline:
 *
 *   pasted chart (natal / transit text)
 *     → runAstroReading()           (same parser the horary/natal flow uses)
 *     → buildSportsHoraryChart()    (this file — detect rulebook conditions)
 *     → calculateCompositeScore()   (sportsHorary.ts — the pure rulebook engine)
 *     → LLM narration               (Claude explains the engine's verdict)
 *
 * The engine's math is authoritative: the LLM is told the score / verdict /
 * flags and must NARRATE that call, not overturn it.
 *
 * Conditions that require an event TIME + LOCATION (planetary hour, Part of
 * Fortune) or per-planet SPEED (VOC Moon, applying/separating, translation /
 * prohibition / refranation) can't be derived from a bare placement paste, so
 * they're left at safe defaults and marked TODO below — the engine simply
 * doesn't fire those rules until we feed it richer chart data (option "A":
 * timed event charts). Everything derivable from positions + houses IS wired.
 * ============================================================================
 */

import { invokeLLM, type Message } from "./_core/llm";
import {
  runAstroReading,
  SIGN_RULERS,
  EXALTATIONS,
  DEBILITATIONS,
  SIGN_ORDER,
  type PlanetPlacement,
} from "./astroEngine";
import { FIXED_STARS } from "./fixedStars";
import {
  calculateCompositeScore,
  type SportsHoraryChart,
  type SportsScore,
  type LordFacts,
  type Dignity,
  type AspectType,
} from "./sportsHorary";

// ─── SMALL ASTRO HELPERS ─────────────────────────────────────────────────────

const MALEFICS = ["Saturn", "Mars", "Rahu"];
const BENEFICS = ["Jupiter", "Venus", "Mercury"];

type Chart = Record<string, PlanetPlacement>;

function signIdx(sign: string): number {
  return SIGN_ORDER.indexOf(sign);
}

/** Sidereal longitude 0..360, falling back to sign*30+degree if `absolute` is null. */
function lon(p: PlanetPlacement): number {
  if (p.absolute != null) return ((p.absolute % 360) + 360) % 360;
  const i = signIdx(p.sign);
  return i < 0 ? 0 : i * 30 + p.degree;
}

/** Angular separation 0..180. */
function sep(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

const ASPECT_TABLE: { type: AspectType; angle: number; orb: number }[] = [
  { type: "conjunction", angle: 0, orb: 8 },
  { type: "sextile", angle: 60, orb: 4 },
  { type: "square", angle: 90, orb: 6 },
  { type: "trine", angle: 120, orb: 6 },
  { type: "opposition", angle: 180, orb: 8 },
];

function aspectBetween(a: PlanetPlacement, b: PlanetPlacement): AspectType | null {
  const d = sep(lon(a), lon(b));
  for (const asp of ASPECT_TABLE) {
    if (Math.abs(d - asp.angle) <= asp.orb) return asp.type;
  }
  return null;
}

function dignityOf(p: PlanetPlacement): Dignity {
  if (EXALTATIONS[p.planet] === p.sign) return "exaltation";
  if (DEBILITATIONS[p.planet] === p.sign) return "debilitation";
  if (SIGN_RULERS[p.sign] === p.planet) return "own";
  // NOTE: true peregrine (zero dignity incl. triplicity/term/face) needs term &
  // face tables we don't have yet — so we return "neutral" rather than falsely
  // asserting peregrine. §V.6 peregrine rules stay dormant until those land.
  return "neutral";
}

/** Find any fixed star within 2° conjunction (includes all Royal Stars + major navigational stars). */
function fixedStarConjunct(p: PlanetPlacement): { name: string; influence: string } | null {
  const L = lon(p);
  for (const star of FIXED_STARS) {
    const starLon = ((star.sidDegree % 360) + 360) % 360;
    const d = sep(L, starLon);

    // Royal Stars (Aldebaran, Regulus, Antares, Fomalhaut) and major navigational stars get 2° orb
    const isRoyal = ["Aldebaran", "Regulus", "Antares", "Fomalhaut", "Sirius", "Polaris"].includes(star.name);
    const orb = isRoyal ? 2.0 : 1.5;

    if (d <= orb) {
      const influence = star.meaning || (
        star.nature === "benefic" ? "fortunate, protective" :
        star.nature === "malefic" ? "challenging, testing" :
        "neutral"
      );
      return { name: star.name, influence };
    }
  }
  return null;
}

// ─── ADAPTER: chart facts → rulebook input ───────────────────────────────────

export function buildSportsHoraryChart(chart: Chart): SportsHoraryChart | null {
  const planets = Object.values(chart);
  if (!planets.length) return null;

  const byPlanet = (name: string) => planets.find(p => p.planet === name) || null;

  // Whole-sign ascendant: back-shift any placed planet's sign by (house-1).
  const anchor = planets.find(p => p.house != null);
  if (!anchor || anchor.house == null || signIdx(anchor.sign) < 0) return null;
  const ascIdx =
    (((signIdx(anchor.sign) - (anchor.house - 1)) % 12) + 12) % 12;
  const signAt = (offset: number) => SIGN_ORDER[(ascIdx + offset) % 12];

  const l1planet = SIGN_RULERS[signAt(0)]; // Ascendant lord  → Favorite
  const l7planet = SIGN_RULERS[signAt(6)]; // 7th lord        → Challenger
  const l4planet = SIGN_RULERS[signAt(3)];
  const l6planet = SIGN_RULERS[signAt(5)];
  const l10planet = SIGN_RULERS[signAt(9)];
  const l12planet = SIGN_RULERS[signAt(11)];

  const l1p = byPlanet(l1planet);
  const l7p = byPlanet(l7planet);
  if (!l1p || !l7p || l1p.house == null || l7p.house == null) return null;

  const aspectedByFrom = (target: PlanetPlacement, group: string[], houses: number[]) =>
    planets.some(
      p =>
        group.includes(p.planet) &&
        p.house != null &&
        houses.includes(p.house) &&
        aspectBetween(p, target) != null
    );
  const aspectedBy = (target: PlanetPlacement, group: string[]) =>
    planets.some(p => group.includes(p.planet) && p !== target && aspectBetween(p, target) != null);

  const lordFacts = (p: PlanetPlacement): LordFacts => ({
    planet: p.planet,
    house: p.house as number,
    longitude: lon(p),
    dignity: dignityOf(p),
    combust: p.combust,
    cazimi: p.cazimi,
    besieged: besieged(p),
    maleficFromDeathHouses: aspectedByFrom(p, MALEFICS, [6, 8]),
    beneficAspect: aspectedBy(p, BENEFICS),
    fixedStar: fixedStarConjunct(p),
  });

  // Besiegement: Saturn on one side, Mars on the other, within ~15° each.
  function besieged(p: PlanetPlacement): boolean {
    const sat = byPlanet("Saturn");
    const mars = byPlanet("Mars");
    if (!sat || !mars) return false;
    const dSat = sep(lon(p), lon(sat));
    const dMars = sep(lon(p), lon(mars));
    return dSat <= 15 && dMars <= 15;
  }

  // Mutual reception: each planet sits in a sign ruled by the other.
  const mr = (aPlanet: string, bPlanet: string) => {
    const a = byPlanet(aPlanet);
    const b = byPlanet(bPlanet);
    return (
      !!a &&
      !!b &&
      SIGN_RULERS[a.sign] === bPlanet &&
      SIGN_RULERS[b.sign] === aPlanet
    );
  };

  const maleficsInHouses = (houses: number[]) =>
    planets.filter(
      p => MALEFICS.includes(p.planet) && p.house != null && houses.includes(p.house)
    ).length;

  // Kendra power boost: a strong benefic sitting in the relevant angle.
  const strongBeneficInHouses = (houses: number[]) =>
    planets.some(
      p =>
        BENEFICS.includes(p.planet) &&
        p.house != null &&
        houses.includes(p.house) &&
        (dignityOf(p) === "own" || dignityOf(p) === "exaltation")
    );

  // Point-Zero: L6 (fav) / L12 (chall) lord strong and free of malefic aspect.
  const lordStrongMaleficFree = (lordPlanet: string) => {
    const lp = byPlanet(lordPlanet);
    if (!lp) return false;
    const strong = dignityOf(lp) === "own" || dignityOf(lp) === "exaltation";
    return strong && !aspectedBy(lp, MALEFICS);
  };

  // §V.3 End of Matter: L4 lord aspects a lord by trine/sextile.
  const l4p = byPlanet(l4planet);
  const l4Trine = (target: PlanetPlacement) => {
    if (!l4p) return false;
    const a = aspectBetween(l4p, target);
    return a === "trine" || a === "sextile";
  };

  // Moon phase from Sun–Moon elongation.
  const sun = byPlanet("Sun");
  const moon = byPlanet("Moon");
  const phase: "waxing" | "waning" =
    sun && moon && (lon(moon) - lon(sun) + 360) % 360 < 180 ? "waxing" : "waning";

  const lordsOpposition = aspectBetween(l1p, l7p) === "opposition";
  const lordsConjunct = aspectBetween(l1p, l7p) === "conjunction" || l1p.house === l7p.house;

  return {
    l1: lordFacts(l1p),
    l7: lordFacts(l7p),

    // §II — need per-planet speed to detect VOC; dormant until timed charts.
    voidOfCourseMoon: false, // TODO(timed-chart): compute from Moon's applying aspects
    l1l7MutualReception: mr(l1planet, l7planet),

    // §III extras
    l1l10MutualReception: mr(l1planet, l10planet),
    l7l4MutualReception: mr(l7planet, l4planet),
    favBeneficStrongInH1orH10: strongBeneficInHouses([1, 10]),
    challBeneficStrongInH4orH7: strongBeneficInHouses([4, 7]),
    moon: { phase, house: moon?.house ?? 0 },
    maleficsInFavUpachaya: maleficsInHouses([3, 6, 10, 11]),
    maleficsInChallUpachaya: maleficsInHouses([9, 12, 4, 5]),
    l6FavStrongMaleficFree: lordStrongMaleficFree(l6planet),
    l12ChallStrongMaleficFree: lordStrongMaleficFree(l12planet),

    // §IV flags
    l1l7SameHouseOrDegree: lordsConjunct,
    l1l7Opposition: lordsOpposition,

    // §V Seven Secrets
    partOfFortune: null, // TODO(timed-chart): needs ascendant longitude + day/night
    l4AspectsL1TrineSextile: l4Trine(l1p),
    l4AspectsL7TrineSextile: l4Trine(l7p),
    translationOfLight: null, // TODO(speed): needs applying-aspect sequencing
    planetaryHour: null, // TODO(timed-chart): needs date/time + location + sunrise/set

    // §VII — applying/separating needs speed; type is known, direction is not.
    lordAspect: { applying: null, type: aspectBetween(l1p, l7p), fasterSide: null },
    frustration: false, // TODO(speed)
    prohibition: false, // TODO(speed)
    refranation: false, // TODO(speed)
  };
}

// ─── READING LAYER ────────────────────────────────────────────────────────────

export interface SportsHoraryInput {
  question: string; // e.g. "Will the Lakers (favorite) beat the Celtics tonight?"
  natalText: string; // event/horary chart placements (or one team's chart)
  transitText: string; // current sky at game time (the event chart)
  favoriteName?: string; // label for the Ascendant side
  challengerName?: string; // label for the Descendant side
  history?: Message[];
}

export interface SportsHoraryOutput {
  answer: string;
  score: SportsScore; // the engine's authoritative call
  usedChart: "transit" | "natal";
}

function buildReadingPrompt(
  input: SportsHoraryInput,
  score: SportsScore,
  factsSummary: string
): string {
  const fav = input.favoriteName || "the Favorite (Ascendant / H1)";
  const chall = input.challengerName || "the Challenger (Descendant / H7)";
  const winner =
    score.verdict === "Favorite"
      ? fav
      : score.verdict === "Challenger"
        ? chall
        : "Neither cleanly — it reads Even / too close to call";

  return `You are the Firmament sports oracle, reading a horary chart cast for a contest through the sidereal, traditional-Vedic framework (fixed dome sky, Vedic rulers, fixed stars, no precession).

A DETERMINISTIC SCORING ENGINE has already judged this chart using the Sports Horary Master Rulebook. Its verdict is AUTHORITATIVE — your job is to NARRATE and EXPLAIN that call, not to overturn it. Do not invent a different winner than the engine's verdict.

CONTEST:
- FAVORITE (Ascendant / H1 / L1): ${fav}
- CHALLENGER (Descendant / H7 / L7): ${chall}
- QUESTION: ${input.question}

ENGINE VERDICT (authoritative):
- Composite score: ${score.score}  (positive favors ${fav}, negative favors ${chall}; |score| ≥ 5 is a call, otherwise Even)
- VERDICT: ${score.verdict}  →  ${winner}
- Flags: ${score.flags.length ? score.flags.join(", ") : "(none)"}

CHART FACTORS THE ENGINE READ:
${factsSummary}

WRITE THE READING:
1. Open with the CALL — who wins (or that it's Even/too close), stated plainly, tied to the score.
2. Explain the mechanics: which lord (L1 vs L7) is stronger and why, citing the specific placements/dignities/aspects above. Trace it to the flags (e.g. "besieged", "doomed", "contested_finish", "STALEMATE").
3. If any override flag fired (Regulus force, Algol doom, via combusta, VOC stalemate), lead with it — those dominate the read.
4. End with a confidence read: a score far from 0 is a strong call; a score near 0 (Even) means genuinely too close — say so honestly, don't fake certainty.

VOICE: A master of the ancient sky sitting across the table. Direct, specific, no hedging, no astrology-book filler. Every claim traces to a named placement or flag. Use Markdown headers.`;
}

/** Render the key engine inputs as readable lines for the prompt. */
function summarizeFacts(c: SportsHoraryChart): string {
  const lordLine = (label: string, l: LordFacts) =>
    `${label}: ${l.planet} in H${l.house}` +
    ` (${l.dignity}` +
    `${l.combust ? ", combust" : ""}${l.cazimi ? ", cazimi" : ""}` +
    `${l.besieged ? ", besieged" : ""}` +
    `${l.maleficFromDeathHouses ? ", afflicted from H6/H8" : ""}` +
    `${l.beneficAspect ? ", benefic support" : ""}` +
    `${l.fixedStar ? `, conjunct ${l.fixedStar}` : ""})`;
  return [
    lordLine("Favorite lord (L1)", c.l1),
    lordLine("Challenger lord (L7)", c.l7),
    `Moon: ${c.moon.phase}, in H${c.moon.house}`,
    `Lord-to-lord aspect: ${c.lordAspect.type ?? "none"}`,
    c.l1l7MutualReception ? "L1/L7 in mutual reception" : null,
    c.maleficsInFavUpachaya ? `${c.maleficsInFavUpachaya} malefic(s) in Favorite upachaya` : null,
    c.maleficsInChallUpachaya ? `${c.maleficsInChallUpachaya} malefic(s) in Challenger upachaya` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sportsHoraryLayer(
  input: SportsHoraryInput
): Promise<SportsHoraryOutput> {
  const { result } = runAstroReading(input.natalText, input.transitText, "");

  // The event chart is the current sky (transits); fall back to natal.
  const transits = result?.transits ?? {};
  const natal = result?.natal ?? {};
  const usedChart: "transit" | "natal" =
    Object.keys(transits).length >= 5 ? "transit" : "natal";
  const chartFacts = buildSportsHoraryChart(
    usedChart === "transit" ? transits : natal
  );

  if (!chartFacts) {
    return {
      answer:
        "I couldn't resolve enough placements to cast the sports chart — I need at least the seven classical planets with signs and houses. Paste a full chart and try again.",
      score: { score: 0, verdict: "Even", flags: ["insufficient_data"] },
      usedChart,
    };
  }

  const score = calculateCompositeScore(chartFacts);
  const systemPrompt = buildReadingPrompt(input, score, summarizeFacts(chartFacts));

  const messages: Message[] = [
    ...(input.history || []),
    { role: "user", content: input.question },
  ];

  const response = await invokeLLM({
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 2500,
  });

  return {
    answer: (response.choices[0].message.content as string).trim(),
    score,
    usedChart,
  };
}
