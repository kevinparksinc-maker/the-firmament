import { describe, it, expect } from "vitest";
import {
  calculateCompositeScore,
  type SportsHoraryChart,
  type LordFacts,
} from "./sportsHorary";

// Minimal neutral lord — everything off, no dignity, mid-Aries (not via combusta).
function lord(overrides: Partial<LordFacts> = {}): LordFacts {
  return {
    planet: "Mars",
    house: 1,
    longitude: 10, // 10° Aries — not via combusta
    dignity: "neutral",
    combust: false,
    cazimi: false,
    besieged: false,
    maleficFromDeathHouses: false,
    beneficAspect: false,
    fixedStar: null,
    ...overrides,
  };
}

// A fully-neutral chart: every scoring input is off. Baseline score comes only
// from Moon momentum (waxing = +2), so we set it waning-in-a-neutral-house to
// isolate individual rules where needed.
function chart(overrides: Partial<SportsHoraryChart> = {}): SportsHoraryChart {
  return {
    l1: lord({ house: 2 }),
    l7: lord({ house: 5, planet: "Venus" }),
    voidOfCourseMoon: false,
    l1l7MutualReception: false,
    l1l10MutualReception: false,
    l7l4MutualReception: false,
    favBeneficStrongInH1orH10: false,
    challBeneficStrongInH4orH7: false,
    moon: { phase: "waxing", house: 3 },
    maleficsInFavUpachaya: 0,
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
    lordAspect: { applying: null, type: null, fasterSide: null },
    frustration: false,
    prohibition: false,
    refranation: false,
    ...overrides,
  };
}

describe("calculateCompositeScore", () => {
  it("baseline neutral chart: only waxing Moon momentum (+2) → Even", () => {
    const r = calculateCompositeScore(chart());
    expect(r.score).toBe(2);
    expect(r.verdict).toBe("Even");
    expect(r.flags).toEqual([]);
  });

  it("§II VOC Moon forces neutral (net 0), flags STALEMATE, skips §III & §V", () => {
    // Give L1 huge §III/§V bonuses that MUST be skipped under VOC.
    const r = calculateCompositeScore(
      chart({
        voidOfCourseMoon: true,
        l1: lord({ house: 6, dignity: "exaltation" }), // would be +4 +3 if not skipped
        partOfFortune: "H1_or_conjL1", // would be +4 if not skipped
        moon: { phase: "waxing", house: 1 }, // §III skipped so no +2/+3
      })
    );
    expect(r.score).toBe(0); // −2/−2 nets zero; §III & §V skipped
    expect(r.verdict).toBe("Even");
    expect(r.flags).toContain("STALEMATE");
  });

  it("§VI Algol on L1 → −8 and 'doomed'", () => {
    const r = calculateCompositeScore(
      chart({
        l1: lord({ fixedStar: { name: "Algol", influence: "malefic, testing" } }),
        moon: { phase: "waning", house: 3 }, // −2 momentum to isolate
      })
    );
    expect(r.score).toBe(-2 /*moon*/ - 8 /*algol*/);
    expect(r.verdict).toBe("Challenger");
    expect(r.flags).toContain("doomed");
  });

  it("§VI Regulus on L7 forces Challenger regardless of a positive score", () => {
    const r = calculateCompositeScore(
      chart({
        l1: lord({ house: 6, dignity: "exaltation" }), // +4 +3 → strongly Favorite
        l7: lord({ planet: "Venus", fixedStar: { name: "Regulus", influence: "fortunate, protective" } }),
      })
    );
    expect(r.score).toBeGreaterThan(0); // score says Favorite...
    expect(r.verdict).toBe("Challenger"); // ...but Regulus override wins
  });

  it("§VI Regulus on BOTH lords → forced Even (draw)", () => {
    const r = calculateCompositeScore(
      chart({
        l1: lord({ fixedStar: { name: "Regulus", influence: "fortunate, protective" } }),
        l7: lord({ planet: "Venus", fixedStar: { name: "Regulus", influence: "fortunate, protective" } }),
      })
    );
    expect(r.verdict).toBe("Even");
  });

  it("§III cazimi overrides combustion penalty on L1", () => {
    const combustOnly = calculateCompositeScore(
      chart({ l1: lord({ combust: true }), moon: { phase: "waning", house: 3 } })
    );
    const cazimi = calculateCompositeScore(
      chart({
        l1: lord({ combust: true, cazimi: true }),
        moon: { phase: "waning", house: 3 },
      })
    );
    expect(combustOnly.score).toBe(-2 - 5); // moon −2, combust −5
    expect(cazimi.score).toBe(-2 + 5); // moon −2, cazimi +5 (combustion ignored)
  });

  it("§V.7 via combusta: L7 at 20° Libra (210° sidereal) → +5 (mirror)", () => {
    const r = calculateCompositeScore(
      chart({
        l7: lord({ planet: "Venus", house: 5, longitude: 210 }), // inside 195–225; neutral house
        moon: { phase: "waning", house: 3 },
      })
    );
    expect(r.score).toBe(-2 /*moon*/ + 5 /*via combusta mirror*/);
  });

  it("§VII applying trine from Favorite → +2 initiating +3 smooth (+ faster +3)", () => {
    const r = calculateCompositeScore(
      chart({
        moon: { phase: "waning", house: 3 }, // −2 to isolate
        lordAspect: { applying: "fav", type: "trine", fasterSide: "fav" },
      })
    );
    // −2 moon +2 initiating +3 trine +3 faster = +6 → Favorite
    expect(r.score).toBe(6);
    expect(r.verdict).toBe("Favorite");
    expect(r.flags).toContain("fav_initiating");
  });
});
