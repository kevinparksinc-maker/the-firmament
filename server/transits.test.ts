import { describe, expect, it } from "vitest";
import { calculateChart } from "./astronomy";

describe("Transit layer", () => {
  it("adds current transit positions against natal houses", async () => {
    const result = await calculateChart({ location: "Dallas, Texas, USA", latitude: 32.7767, longitude: -96.797, timezone: "America/Chicago", date: "1986-11-20", time: "10:06", transitLocation: "New York, New York, USA", transitLatitude: 40.7128, transitLongitude: -74.006, transitTimezone: "America/New_York", transitDate: "2025-01-15", transitTime: "14:30" });
    expect(result.transitDate).toMatch(/Z$/);
    expect(result.transits).toHaveLength(10);
    expect(result.transits.map(row => row.name)).toContain("Jupiter");
    expect(result.transits.every(row => row.house >= 1 && row.house <= 12)).toBe(true);
    expect(result.transits.every(row => Array.isArray(row.natalContacts))).toBe(true);
    expect(result.input.transitLocation).toBe("New York, New York, USA");
    expect(result.transitDate).toBe("2025-01-15T19:30:00.000Z");
  });
});
