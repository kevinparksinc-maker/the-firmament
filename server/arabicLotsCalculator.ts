/**
 * Arabic Lots Calculator
 *
 * Traditional formulas for sports horary.
 * Day/Night formulas adjust based on whether Sun is above/below horizon.
 */

import type { PlanetPosition } from "./ephemeris";

export interface ArabicLot {
  name: string;
  longitude: number;
  sign: string;
  degree: number;
  meaning: string;
  formula: string;
}

const ZODIAC = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function lonToSign(lon: number): { sign: string; degree: number } {
  const signIdx = Math.floor(lon / 30);
  const degree = Math.floor(lon % 30);
  return { sign: ZODIAC[signIdx] ?? "Aries", degree };
}

function normalizeLon(lon: number): number {
  while (lon < 0) lon += 360;
  while (lon >= 360) lon -= 360;
  return lon;
}

export function calculateArabicLots(
  planets: Record<string, any>,
  ascendant: number,
  isNight: boolean
): ArabicLot[] {
  const sun = planets.Sun;
  const moon = planets.Moon;
  const mars = planets.Mars;
  const venus = planets.Venus;
  const jupiter = planets.Jupiter;
  const saturn = planets.Saturn;

  if (!sun || !moon || !mars || !venus || !jupiter || !saturn) {
    return [];
  }

  // Use tropicalLon (current system) or fallback to siderealLon (legacy)
  const getSunLon = () => sun.eclipticLon ?? sun.eclipticLon ?? 0;
  const getMoonLon = () => moon.eclipticLon ?? moon.eclipticLon ?? 0;
  const getMarsLon = () => mars.eclipticLon ?? mars.eclipticLon ?? 0;
  const getVenusLon = () => venus.eclipticLon ?? venus.eclipticLon ?? 0;
  const getJupiterLon = () => jupiter.eclipticLon ?? jupiter.eclipticLon ?? 0;
  const getSaturnLon = () => saturn.eclipticLon ?? saturn.eclipticLon ?? 0;

  const lots: ArabicLot[] = [];

  // 1. Lot of Fortune
  // Day: Asc + Moon - Sun | Night: Asc + Sun - Moon
  const fortuneLon = isNight
    ? normalizeLon(ascendant + getSunLon() - getMoonLon())
    : normalizeLon(ascendant + getMoonLon() - getSunLon());
  const fortuneSign = lonToSign(fortuneLon);
  lots.push({
    name: "Lot of Fortune",
    longitude: fortuneLon,
    sign: fortuneSign.sign,
    degree: fortuneSign.degree,
    meaning: "Overall luck and favorable outcomes",
    formula: isNight ? "Asc + Sun - Moon" : "Asc + Moon - Sun",
  });

  // 2. Lot of Spirit
  // Day: Asc + Sun - Moon | Night: Asc + Moon - Sun (opposite of Fortune)
  const spiritLon = isNight
    ? normalizeLon(ascendant + getMoonLon() - getSunLon())
    : normalizeLon(ascendant + getSunLon() - getMoonLon());
  const spiritSign = lonToSign(spiritLon);
  lots.push({
    name: "Lot of Spirit",
    longitude: spiritLon,
    sign: spiritSign.sign,
    degree: spiritSign.degree,
    meaning: "Willpower, execution, competitive drive",
    formula: isNight ? "Asc + Moon - Sun" : "Asc + Sun - Moon",
  });

  // 3. Lot of Victory
  // Asc + Mars - Saturn
  const victoryLon = normalizeLon(ascendant + getMarsLon() - getSaturnLon());
  const victorySign = lonToSign(victoryLon);
  lots.push({
    name: "Lot of Victory",
    longitude: victoryLon,
    sign: victorySign.sign,
    degree: victorySign.degree,
    meaning: "Winning the contest",
    formula: "Asc + Mars - Saturn",
  });

  // 4. Lot of Success
  // Asc + Jupiter - Saturn
  const successLon = normalizeLon(ascendant + getJupiterLon() - getSaturnLon());
  const successSign = lonToSign(successLon);
  lots.push({
    name: "Lot of Success",
    longitude: successLon,
    sign: successSign.sign,
    degree: successSign.degree,
    meaning: "Achieving objectives",
    formula: "Asc + Jupiter - Saturn",
  });

  // 5. Lot of Courage
  // Asc + Mars - Sun
  const courageLon = normalizeLon(ascendant + getMarsLon() - getSunLon());
  const courageSign = lonToSign(courageLon);
  lots.push({
    name: "Lot of Courage",
    longitude: courageLon,
    sign: courageSign.sign,
    degree: courageSign.degree,
    meaning: "Fighting spirit under pressure",
    formula: "Asc + Mars - Sun",
  });

  // 6. Lot of Triumph
  // Asc + Venus - Saturn
  const triumphLon = normalizeLon(ascendant + getVenusLon() - getSaturnLon());
  const triumphSign = lonToSign(triumphLon);
  lots.push({
    name: "Lot of Triumph",
    longitude: triumphLon,
    sign: triumphSign.sign,
    degree: triumphSign.degree,
    meaning: "Decisive victories",
    formula: "Asc + Venus - Saturn",
  });

  // 7. Lot of Glory
  // Asc + Sun - Saturn
  const gloryLon = normalizeLon(ascendant + getSunLon() - getSaturnLon());
  const glorySign = lonToSign(gloryLon);
  lots.push({
    name: "Lot of Glory",
    longitude: gloryLon,
    sign: glorySign.sign,
    degree: glorySign.degree,
    meaning: "Recognition, standout performances",
    formula: "Asc + Sun - Saturn",
  });

  // 8. Lot of Nemesis
  // Asc + Saturn - Sun (where obstacles/downfall manifest)
  const nemesisLon = normalizeLon(ascendant + getSaturnLon() - getSunLon());
  const nemesisSign = lonToSign(nemesisLon);
  lots.push({
    name: "Lot of Nemesis",
    longitude: nemesisLon,
    sign: nemesisSign.sign,
    degree: nemesisSign.degree,
    meaning: "Obstacles, self-sabotage, bad breaks",
    formula: "Asc + Saturn - Sun",
  });

  return lots;
}
