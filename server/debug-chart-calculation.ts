/**
 * TEST: Chart Calculation with Birth Data
 * Shows how ascendant and houses are calculated from user input
 */

import { calculateChart } from "./ephemeris";
import { fromZonedTime } from "date-fns-tz";
import tzLookup from "tz-lookup";

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

async function testChart(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  latitude: number,
  longitude: number,
  location: string
) {
  console.log("\n" + "=".repeat(80));
  console.log(`BIRTH DATA: ${location}`);
  console.log("=".repeat(80));
  console.log(`Date: ${month}/${day}/${year} at ${hour}:${minute.toString().padStart(2, "0")}`);
  console.log(`Location: ${latitude}°${latitude > 0 ? "N" : "S"}, ${longitude}°${longitude > 0 ? "E" : "W"}`);

  // Step 1: Lookup timezone and convert local time to UTC
  const timezone = tzLookup(latitude, longitude);
  const localTimeString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const date = fromZonedTime(localTimeString, timezone);

  console.log(`\nTimezone: ${timezone}`);
  console.log(`Local Time: ${localTimeString}`);
  console.log(`UTC Time: ${date.toISOString()}`);

  // Step 2: Calculate chart
  const result = await calculateChart(date, {
    latitude,
    longitude,
    altitude: 0,
  });

  // Step 3: Display results
  console.log("\n" + "─".repeat(80));
  console.log("ANGLES & HOUSES");
  console.log("─".repeat(80));

  const asc = result.houses.ascendant;
  const mc = result.houses.mc;
  const desc = (asc + 180) % 360;
  const ic = (mc + 180) % 360;

  const degToSign = (deg: number) => {
    const signIdx = Math.floor((deg % 360) / 30);
    const degInSign = ((deg % 360) % 30).toFixed(2);
    return `${degInSign}° ${ZODIAC_SIGNS[signIdx]}`;
  };

  console.log(`Ascendant (H1):  ${asc.toFixed(2)}° = ${degToSign(asc)}`);
  console.log(`MC (Midheaven):  ${mc.toFixed(2)}° = ${degToSign(mc)}`);
  console.log(`Descendant:      ${desc.toFixed(2)}° = ${degToSign(desc)}`);
  console.log(`IC:              ${ic.toFixed(2)}° = ${degToSign(ic)}`);

  console.log("\n" + "─".repeat(80));
  console.log("HOUSE CUSPS (Equal House — each 30° wide)");
  console.log("─".repeat(80));

  for (let i = 0; i < 12; i++) {
    const cusp = result.houses.cusps[i];
    const nextCusp = result.houses.cusps[(i + 1) % 12];
    console.log(
      `House ${(i + 1).toString().padStart(2, " ")}: ${cusp.toFixed(2)}° = ${degToSign(cusp)}`
    );
  }

  console.log("\n" + "─".repeat(80));
  console.log("PLANET POSITIONS & HOUSE PLACEMENTS");
  console.log("─".repeat(80));

  for (const planet of result.planets) {
    const sign = ZODIAC_SIGNS[ZODIAC_SIGNS.indexOf(planet.sign)];
    const rx = planet.retrograde ? " Rx" : "";
    console.log(
      `${planet.name.padEnd(9)} ${planet.eclipticLon.toFixed(2)}°${rx.padEnd(4)} = ${planet.degreeInSign.toFixed(2)}° ${sign} | House ${planet.house}`
    );
  }

  console.log("\n" + "═".repeat(80) + "\n");
}

// Test 3 different birth charts
(async () => {
  // Example 1: New York, Jan 1, 2000, Noon EST
  await testChart(2000, 1, 1, 12, 0, 40.7128, -74.0060, "New York");

  // Example 2: London, July 4, 1990, 3:30 PM GMT
  await testChart(1990, 7, 4, 15, 30, 51.5074, -0.1278, "London");

  // Example 3: Tokyo, Dec 25, 2015, 10:45 AM JST
  await testChart(2015, 12, 25, 10, 45, 35.6762, 139.6503, "Tokyo");
})();
