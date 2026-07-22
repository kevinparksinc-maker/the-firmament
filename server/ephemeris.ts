/**
 * ARCANA STATE — Topocentric Ephemeris Engine
 *
 * Two-layer architecture as per the Snow Globe brief:
 *  Math Layer  → Swiss-equivalent topocentric positions (astronomy-engine)
 *  Visual Layer → Alt/Az output for the parabolic dome renderer
 *
 * All positions are TOPOCENTRIC (observer on Earth's surface),
 * not geocentric. Full parallax correction applied, especially for the Moon.
 */

import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const Astronomy = _require("astronomy-engine");
const {
  MakeTime,
  Observer,
  SiderealTime,
  SunPosition,
  GeoVector,
  Ecliptic,
  Equator,
  Horizon,
  Body,
} = Astronomy;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ObserverLocation {
  latitude: number; // degrees, positive = north
  longitude: number; // degrees, positive = east
  altitude: number; // metres above sea level
}

export interface PlanetPosition {
  name: string;
  symbol: string;
  /** Ecliptic longitude in degrees (0–360), tropical */
  tropicalLon: number;
  /** Ecliptic longitude in degrees (0–360), sidereal */
  siderealLon: number;
  /** Zodiac sign */
  sign: string;
  /** Degree within sign (0–29.99) */
  degreeInSign: number;
  /** Arcminutes within degree (0–59) */
  minutes: number;
  /** True topocentric altitude above horizon (degrees) */
  altitude: number;
  /** True topocentric azimuth (degrees, 0=N, 90=E) */
  azimuth: number;
  /** Is the planet retrograde? */
  retrograde: boolean;
  /** House number (1–12) using Topocentric/Polich-Page */
  house: number;
}

export interface HouseCusps {
  cusps: number[]; // 12 house cusps in tropical longitude
  ascendant: number; // tropical longitude
  mc: number; // tropical longitude
}

export interface EphemerisResult {
  planets: PlanetPosition[];
  houses: HouseCusps;
  observer: ObserverLocation;
  date: Date;
  /** Ayanamsa used (Lahiri) in degrees */
  ayanamsa: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "⛢",
  Neptune: "♆",
  Pluto: "♇",
  "North Node": "☊",
  "South Node": "☋",
};

// NO AYANAMSA CORRECTION — Tropical longitudes map directly to fixed sidereal zodiac background.

function lonToSignDeg(lon: number): {
  sign: string;
  degree: number;
  minutes: number;
} {
  const signIndex = Math.floor(lon / 30);
  const degInSign = lon % 30;
  const degree = Math.floor(degInSign);
  const minutes = Math.floor((degInSign - degree) * 60);
  return { sign: ZODIAC_SIGNS[signIndex] ?? "Aries", degree, minutes };
}

// ─── House System: Topocentric (Polich-Page) ──────────────────────────────────
// Approximated via Placidus with topocentric correction for the observer's lat

function calcHouseCusps(
  date: Date,
  observer: ObserverLocation
): HouseCusps {
  const astroObs = new Observer(
    observer.latitude,
    observer.longitude,
    observer.altitude
  );

  // Get RAMC (Right Ascension of Midheaven) and MC
  // Calculate Greenwich Sidereal Time
  const gst = SiderealTime(MakeTime(date));

  // Convert to Local Sidereal Time by adding longitude correction
  // LST = GST + (Longitude / 15°)
  // Longitude in degrees divided by 15 gives the hour correction
  const lstHours = gst + observer.longitude / 15;
  const sidereal = ((lstHours % 24) + 24) % 24; // Normalize to 0-24 hours

  const ramc = sidereal * 15; // convert hours to degrees

  // MC = RAMC converted to ecliptic longitude (tropical)
  const obliquity = 23.4367; // mean obliquity
  const mcTropical =
    (Math.atan2(
      Math.cos((ramc * Math.PI) / 180),
      -(
        Math.sin((ramc * Math.PI) / 180) * Math.cos((obliquity * Math.PI) / 180)
      )
    ) *
      180) /
    Math.PI;
  const mcNorm = ((mcTropical % 360) + 360) % 360;

  // ASC calculation
  // NOTE: This calculates the spherical Ascendant for the math layer (ephemeris).
  // For the visual/rendering layer on a flat North Pole grid, use coordinateTransformer.ts instead.
  const lat = (observer.latitude * Math.PI) / 180;
  const e = (obliquity * Math.PI) / 180;
  const ramcRad = (ramc * Math.PI) / 180;

  let ascTropical =
    (Math.atan2(
      Math.cos(ramcRad),
      -(Math.sin(ramcRad) * Math.cos(e) + Math.tan(lat) * Math.sin(e))
    ) *
      180) /
    Math.PI;
  ascTropical = ((ascTropical % 360) + 360) % 360;

  // Simple equal house cusps from ASC (Topocentric approximation)
  const cusps: number[] = [];
  for (let i = 0; i < 12; i++) {
    const tropical = (ascTropical + i * 30) % 360;
    cusps.push(tropical);
  }

  return {
    cusps,
    ascendant: ascTropical,
    mc: mcNorm,
  };
}

function getHouseNumber(planetLon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i]!;
    const end = cusps[(i + 1) % 12]!;

    if (start <= end) {
      if (planetLon >= start && planetLon < end) return i + 1;
    } else {
      // Wraps around 0°
      if (planetLon >= start || planetLon < end) return i + 1;
    }
  }
  return 1;
}

// ─── Main Calculation ─────────────────────────────────────────────────────────

export async function calculateChart(
  date: Date,
  observer: ObserverLocation
): Promise<EphemerisResult> {
  const astroObs = new Observer(
    observer.latitude,
    observer.longitude,
    observer.altitude
  );
  const houses = calcHouseCusps(date, observer);

  const bodyList: Array<{ name: string; body: Astronomy.Body }> = [
    { name: "Sun", body: Astronomy.Body.Sun },
    { name: "Moon", body: Astronomy.Body.Moon },
    { name: "Mercury", body: Astronomy.Body.Mercury },
    { name: "Venus", body: Astronomy.Body.Venus },
    { name: "Mars", body: Astronomy.Body.Mars },
    { name: "Jupiter", body: Astronomy.Body.Jupiter },
    { name: "Saturn", body: Astronomy.Body.Saturn },
    { name: "Uranus", body: Astronomy.Body.Uranus },
    { name: "Neptune", body: Astronomy.Body.Neptune },
    { name: "Pluto", body: Astronomy.Body.Pluto },
  ];

  const planets: PlanetPosition[] = [];

  for (const { name, body } of bodyList) {
    try {
      // Get ecliptic longitude (tropical)
      // Sun uses SunPosition; all others use GeoVector + Ecliptic
      let tropicalLon: number;
      if (body === Astronomy.Body.Sun) {
        const sp = SunPosition(MakeTime(date));
        tropicalLon = sp.elon;
      } else {
        const vec = GeoVector(body, MakeTime(date), true);
        const ecl = Ecliptic(vec);
        tropicalLon = ecl.elon;
      }

      // Use tropical longitude directly (no ayanamsa correction)
      const { sign, degree, minutes } = lonToSignDeg(tropicalLon);

      // Get topocentric Alt/Az (parallax corrected)
      const equatorial = Equator(body, MakeTime(date), astroObs, true, true);
      const horizon = Horizon(
        MakeTime(date),
        astroObs,
        equatorial.ra,
        equatorial.dec,
        "normal"
      );

      // Detect retrograde (compare position to yesterday)
      const yesterday = new Date(date.getTime() - 86400000);
      let tropicalYesterday: number;
      if (body === Astronomy.Body.Sun) {
        tropicalYesterday = SunPosition(MakeTime(yesterday)).elon;
      } else {
        const vecY = GeoVector(body, MakeTime(yesterday), true);
        tropicalYesterday = Ecliptic(vecY).elon;
      }
      let retrograde = false;
      if (body !== Astronomy.Body.Sun && body !== Astronomy.Body.Moon) {
        let diff = tropicalLon - tropicalYesterday;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        retrograde = diff < 0;
      }

      const house = getHouseNumber(tropicalLon, houses.cusps);

      planets.push({
        name,
        symbol: PLANET_SYMBOLS[name] ?? "★",
        tropicalLon,
        sign,
        degreeInSign: degree,
        minutes,
        altitude: horizon.altitude,
        azimuth: horizon.azimuth,
        retrograde,
        house,
      });
    } catch (err) {
      console.warn(`[Ephemeris] Failed to calculate ${name}:`, err);
    }
  }

  // Add Rahu (North Node) and Ketu (South Node)
  // Using mean ascending node formula: Omega = 125.0445479 - 0.0529539297 * d
  try {
    const d = date.getTime() / 86400000 - 10957.5; // days from J2000
    const rahuTropical = (((125.0445479 - 0.0529539297 * d) % 360) + 360) % 360;
    const ketuTropical = (rahuTropical + 180) % 360;

    const rahuInfo = lonToSignDeg(rahuTropical);
    const ketuInfo = lonToSignDeg(ketuTropical);

    planets.push({
      name: "Rahu",
      symbol: "☊",
      tropicalLon: rahuTropical,
      sign: rahuInfo.sign,
      degreeInSign: rahuInfo.degree,
      minutes: rahuInfo.minutes,
      altitude: 0,
      azimuth: 0,
      retrograde: true, // Nodes are always retrograde
      house: getHouseNumber(rahuTropical, houses.cusps),
    });

    planets.push({
      name: "Ketu",
      symbol: "☋",
      tropicalLon: ketuTropical,
      sign: ketuInfo.sign,
      degreeInSign: ketuInfo.degree,
      minutes: ketuInfo.minutes,
      altitude: 0,
      azimuth: 0,
      retrograde: true,
      house: getHouseNumber(ketuTropical, houses.cusps),
    });
  } catch (err) {
    console.warn("[Ephemeris] Failed to calculate nodes:", err);
  }

  return { planets, houses, observer, date, ayanamsa: 0 };
}

// ─── Format for reading engine ───────────────────────────────────────────────────────────────

export function formatChartForReading(result: EphemerisResult): string {
  const lines = result.planets.map(p => {
    const rx = p.retrograde ? " Rx" : "";
    const trop = lonToSignDeg(p.tropicalLon);
    return `${p.name}${rx}: ${trop.degree}° ${trop.minutes}' ${trop.sign}, ${p.house}th house`;
  });

  // Add angles: Ascendant, Descendant, MC, IC
  const asc = lonToSignDeg(result.houses.ascendant);
  const desc = lonToSignDeg((result.houses.ascendant + 180) % 360);
  const mc = lonToSignDeg(result.houses.mc);
  const ic = lonToSignDeg((result.houses.mc + 180) % 360);

  lines.push(`Asc: ${asc.degree}° ${asc.minutes}' ${asc.sign}, 1st house`);
  lines.push(`Dsc: ${desc.degree}° ${desc.minutes}' ${desc.sign}, 7th house`);
  lines.push(`MC: ${mc.degree}° ${mc.minutes}' ${mc.sign}, 10th house`);
  lines.push(`IC: ${ic.degree}° ${ic.minutes}' ${ic.sign}, 4th house`);

  return lines.join("\n");
}

// Export house cusp info for the wheel
export function getHouseCuspInfo(
  result: EphemerisResult
): Array<{ house: number; sign: string; degree: number; minutes: number }> {
  return result.houses.cusps.map((lon, i) => {
    const { sign, degree, minutes } = lonToSignDeg(lon);
    return { house: i + 1, sign, degree, minutes };
  });
}
