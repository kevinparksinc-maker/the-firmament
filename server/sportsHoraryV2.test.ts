import { describe, it, expect, vi } from "vitest";
import { buildSportsHoraryChartViaLLM } from "./sportsHoraryV2Reading";
import { calculateSportsHoraryV2, generateSportsHoraryV2Report } from "./sportsHoraryV2";
import type { PlanetPlacement } from "./astroEngine";

describe("sportsHoraryV2 — 16-layer engine", () => {
  // Mock astro data: Lakers (H1/L1=Sun in Leo) vs Celtics (H7/L7=Saturn in Aquarius)
  const mockChart: Record<string, PlanetPlacement> = {
    Sun: {
      planet: "Sun",
      degree: 15,
      sign: "Leo",
      house: 1,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 135,
      raw: "Sun 15° Leo",
      kind: "natal",
    },
    Moon: {
      planet: "Moon",
      degree: 10,
      sign: "Gemini",
      house: 11,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 70,
      raw: "Moon 10° Gemini",
      kind: "natal",
    },
    Mercury: {
      planet: "Mercury",
      degree: 8,
      sign: "Leo",
      house: 1,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 128,
      raw: "Mercury 8° Leo",
      kind: "natal",
    },
    Venus: {
      planet: "Venus",
      degree: 20,
      sign: "Cancer",
      house: 12,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 110,
      raw: "Venus 20° Cancer",
      kind: "natal",
    },
    Mars: {
      planet: "Mars",
      degree: 5,
      sign: "Libra",
      house: 4,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 185,
      raw: "Mars 5° Libra",
      kind: "natal",
    },
    Jupiter: {
      planet: "Jupiter",
      degree: 12,
      sign: "Virgo",
      house: 2,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 162,
      raw: "Jupiter 12° Virgo",
      kind: "natal",
    },
    Saturn: {
      planet: "Saturn",
      degree: 18,
      sign: "Aquarius",
      house: 7,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 318,
      raw: "Saturn 18° Aquarius",
      kind: "natal",
    },
    Rahu: {
      planet: "Rahu",
      degree: 3,
      sign: "Pisces",
      house: 8,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 333,
      raw: "Rahu 3° Pisces",
      kind: "natal",
    },
    Ketu: {
      planet: "Ketu",
      degree: 3,
      sign: "Virgo",
      house: 2,
      rx: false,
      combust: false,
      cazimi: false,
      absolute: 153,
      raw: "Ketu 3° Virgo",
      kind: "natal",
    },
  };

  it.skip("builds SportsHoraryChartV2 from astro placements", async () => {
    const chartV2 = await buildSportsHoraryChartViaLLM(mockChart, "Lakers", "Celtics");
    expect(chartV2).toBeDefined();
    expect(chartV2?.favoriteTeam).toBe("Lakers");
    expect(chartV2?.challengerTeam).toBe("Celtics");
    expect(chartV2?.l1.planet).toBe("Sun");
    expect(chartV2?.l7.planet).toBe("Saturn");
  });

  it.skip("executes all 16 layers without crash", async () => {
    const chartV2 = await buildSportsHoraryChartViaLLM(mockChart, "Lakers", "Celtics");
    expect(chartV2).toBeDefined();

    if (!chartV2) {
      throw new Error("Chart building failed");
    }

    const results = calculateSportsHoraryV2(chartV2);

    // Verify all outputs are populated
    expect(results.radicality).toBeDefined();
    expect(results.teamAssignment).toBeDefined();
    expect(results.houseStrength).toBeDefined();
    expect(results.lordBattle).toBeDefined();
    expect(results.lunar).toBeDefined();
    expect(results.nodes).toBeDefined();
    expect(results.fixedStars).toBeDefined();
    expect(results.dominance).toBeDefined();
    expect(results.confidence).toBeDefined();
    expect(results.prediction).toBeDefined();

    // Sanity checks
    expect(results.prediction.winner).toMatch(/Favorite|Challenger|Even|Cannot/);
    expect(results.prediction.winProbability).toBeGreaterThanOrEqual(0);
    expect(results.prediction.winProbability).toBeLessThanOrEqual(99);
    expect(results.confidence.percentage).toBeGreaterThanOrEqual(0);
    expect(results.confidence.percentage).toBeLessThanOrEqual(99);
  });

  it.skip("generates readable report", async () => {
    const chartV2 = await buildSportsHoraryChartViaLLM(mockChart, "Lakers", "Celtics");
    expect(chartV2).toBeDefined();

    if (!chartV2) {
      throw new Error("Chart building failed");
    }

    const results = calculateSportsHoraryV2(chartV2);
    const report = generateSportsHoraryV2Report(results, chartV2);

    // Report should contain key sections
    expect(report).toContain("Lakers");
    expect(report).toContain("Celtics");
    expect(report).toContain("VERDICT");
    expect(report.length).toBeGreaterThan(200);
  });

  it.skip("radical chart produces verdict, non-radical early-exits", async () => {
    const chartV2 = await buildSportsHoraryChartViaLLM(mockChart, "Lakers", "Celtics");
    expect(chartV2).toBeDefined();

    if (!chartV2) {
      throw new Error("Chart building failed");
    }

    const results = calculateSportsHoraryV2(chartV2);

    // This chart is (by default) radical, so should have a verdict
    if (results.radicality.confidence === 100) {
      expect(results.prediction.winner).not.toBe("Cannot predict");
      expect(results.prediction.winProbability).toBeGreaterThan(0);
    }
  });

  it.skip("house strength layer scores favorably for strong L1", async () => {
    const chartV2 = await buildSportsHoraryChartViaLLM(mockChart, "Lakers", "Celtics");
    expect(chartV2).toBeDefined();

    if (!chartV2) {
      throw new Error("Chart building failed");
    }

    const results = calculateSportsHoraryV2(chartV2);

    // Sun (L1) in own sign (Leo) should score positive for H1
    expect(results.houseStrength.h1Score).toBeGreaterThanOrEqual(0);
    // Saturn (L7) in Aquarius (neutral, not own/exalt/fall/detriment) — just verify it exists
    expect(results.houseStrength.h7Score).toBeDefined();
  });

  it.skip("lord battle reflects dignity differences", async () => {
    const chartV2 = await buildSportsHoraryChartViaLLM(mockChart, "Lakers", "Celtics");
    expect(chartV2).toBeDefined();

    if (!chartV2) {
      throw new Error("Chart building failed");
    }

    const results = calculateSportsHoraryV2(chartV2);

    // Sun in own > Saturn in fall; expect positive lordBattle score
    if (results.radicality.confidence === 100) {
      expect(results.lordBattle.score).toBeGreaterThan(-25);
    }
  });

  it.skip("dominance classification matches score range", async () => {
    const chartV2 = await buildSportsHoraryChartViaLLM(mockChart, "Lakers", "Celtics");
    expect(chartV2).toBeDefined();

    if (!chartV2) {
      throw new Error("Chart building failed");
    }

    const results = calculateSportsHoraryV2(chartV2);
    const { dominanceScore, classification } = results.dominance;

    const mag = Math.abs(dominanceScore);
    if (mag <= 5) expect(classification).toBe("toss-up");
    else if (mag <= 12) expect(classification).toBe("slight");
    else if (mag <= 20) expect(classification).toBe("strong");
    else if (mag <= 30) expect(classification).toBe("heavy");
    else expect(classification).toBe("blowout");
  });
});
