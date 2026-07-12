import { describe, it, expect } from "vitest";
import { runAstroReading } from "./astroEngine";
import { buildSportsHoraryChart } from "./sportsHoraryReading";
import { calculateCompositeScore } from "./sportsHorary";

// Whole-sign chart, Aries rising (Mars in Aries H1 anchors the ascendant).
const CHART = `
Sun: 15.00° Leo, 5th house
Moon: 10.00° Cancer, 4th house
Mars: 5.00° Aries, 1st house
Mercury: 20.00° Leo, 5th house
Jupiter: 8.00° Sagittarius, 9th house
Venus: 12.00° Libra, 7th house
Saturn: 25.00° Capricorn, 10th house
`.trim();

describe("sports horary adapter (chart text → engine)", () => {
  it("resolves whole-sign house lords and scores the chart", () => {
    const { result } = runAstroReading("", CHART, "");
    expect(result).toBeTruthy();

    const facts = buildSportsHoraryChart(result!.transits);
    expect(facts).toBeTruthy();

    // Aries rising → L1 = Mars (Favorite), L7 = ruler of Libra = Venus (Challenger)
    expect(facts!.l1.planet).toBe("Mars");
    expect(facts!.l7.planet).toBe("Venus");
    // Mars in own sign, Venus in own sign
    expect(facts!.l1.dignity).toBe("own");
    expect(facts!.l7.dignity).toBe("own");

    const score = calculateCompositeScore(facts!);
    expect(typeof score.score).toBe("number");
    expect(["Favorite", "Challenger", "Even"]).toContain(score.verdict);
    // Mars (5° Aries) opposes Venus (12° Libra) within orb → seesaw flag
    expect(score.flags).toContain("seesaw");
  });
});
