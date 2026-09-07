import { describe, expect, it } from "vitest";
import { FIXED_STARS, overlay, formatLongitude } from "../shared/hybrid";
import { calculateChart } from "./astronomy";

describe("Hybrid Zodiac constants and overlays", () => {
  it("keeps the prescribed Hamal and Antares constants frozen", () => {
    expect(FIXED_STARS.find(([name]) => name === "Hamal")?.[1]).toBe(12.9333);
    expect(FIXED_STARS.find(([name]) => name === "Antares")?.[1]).toBe(225.0167);
  });
  it("starts the overlay wheel at tropical Aries", () => {
    expect(overlay(0)).toMatchObject({ nakshatra: "Ashwini", pada: 1, manzil: "Al-Sharatain", decan: "Mars (Aries 1st)" });
    expect(formatLongitude(12.9333)).toBe("Aries 12°56′");
  });
  it("marks the documented Dallas profile as the validation case", async () => {
    const result = await calculateChart({ location: "Dallas, Texas, USA", latitude: 32.7767, longitude: -96.797, timezone: "America/Chicago", date: "1986-11-20", time: "10:06" });
    expect(result.validation.passed).toBe(true);
    expect(result.frozenStars.find(row => row.name === "Hamal")?.display).toBe("Aries 12°56′");
  });
});
