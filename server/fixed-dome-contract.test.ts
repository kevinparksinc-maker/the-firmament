import { describe, expect, it } from "vitest";
import { calculateChart } from "./ephemeris";
import { ARABIC_MANSION_NAMES, FIRMAMENT_ZODIAC, NAKSHATRA_NAMES, ROYAL_STARS } from "../shared/fixed-background";

describe("strict fixed-dome contract", () => {
  it("keeps planetary dome longitudes fixed while local Ascendant and houses vary", async () => {
    const date = new Date("2026-08-13T23:05:00Z");
    const boston = await calculateChart(date, { latitude: 42.3601, longitude: -71.0589, altitude: 0 });
    const tokyo = await calculateChart(date, { latitude: 35.6762, longitude: 139.6503, altitude: 0 });

    expect(boston.houses.ascendant).not.toBe(tokyo.houses.ascendant);
    expect(boston.houses.cusps).not.toEqual(tokyo.houses.cusps);
    expect(tokyo.planets.map(planet => planet.eclipticLon)).toEqual(boston.planets.map(planet => planet.eclipticLon));
    expect(boston.planets.every(planet => Number.isFinite(planet.dec) && Number.isFinite(planet.altitude) && Number.isFinite(planet.azimuth))).toBe(true);
  });

  it("exposes the fixed wheel, both lunar mansion overlays, and Royal Star anchors", async () => {
    const chart = await calculateChart(new Date("1986-11-20T16:06:00Z"), {
      latitude: 32.7767,
      longitude: -96.7970,
      altitude: 131,
    });
    expect(chart.fixedBackground.nakshatraCount).toBe(27);
    expect(chart.fixedBackground.mansionCount).toBe(28);
    expect(NAKSHATRA_NAMES).toHaveLength(27);
    expect(ARABIC_MANSION_NAMES).toHaveLength(28);
    expect(chart.fixedBackground.royalStars.map((star) => [star.name, star.longitude])).toEqual([
      ["Aldebaran", expect.closeTo(45.05, 5)],
      ["Regulus", expect.closeTo(125.083333, 5)],
      ["Antares", expect.closeTo(225.016667, 5)],
      ["Fomalhaut", expect.closeTo(309.116667, 5)],
    ]);
    expect(FIRMAMENT_ZODIAC.planetaryFrame).toBe("tropical");
    expect(FIRMAMENT_ZODIAC.applyPrecessionToFixedStars).toBe(false);
    expect(FIRMAMENT_ZODIAC.applyAyanamsaToPlanets).toBe(false);

    const sun = chart.planets.find((planet) => planet.name === "Sun");
    expect(sun?.seasonalEclipticLon).toEqual(expect.any(Number));
    expect(sun?.seasonalDeclination).toEqual(expect.any(Number));
    expect(sun?.nakshatra.name).toBeTruthy();
    expect(sun?.arabicMansion.name).toBeTruthy();
  });

  it("keeps the Royal Star constants internally consistent", () => {
    expect(ROYAL_STARS.map((star) => star.longitude)).toEqual([
      expect.closeTo(45.05, 5),
      expect.closeTo(125.083333, 5),
      expect.closeTo(225.016667, 5),
      expect.closeTo(309.116667, 5),
    ]);
  });

  it("changes the local Ascendant with time without changing the dome reference", async () => {
    const observer = { latitude: 42.3601, longitude: -71.0589, altitude: 0 };
    const first = await calculateChart(new Date("2026-08-13T23:05:00Z"), observer);
    const later = await calculateChart(new Date("2026-08-14T05:05:00Z"), observer);
    expect(first.houses.ascendant).not.toBe(later.houses.ascendant);
    expect(first.houses.cusps.every((cusp) => cusp % 30 === 0)).toBe(true);
  });
});

function unused() { return undefined; }
void unused;
