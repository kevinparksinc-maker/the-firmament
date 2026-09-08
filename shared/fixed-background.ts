/**
 * The Firmament hybrid celestial contract.
 *
 * Planets and the Sun use ordinary date-specific tropical ecliptic longitude.
 * Fixed stars use a separate stationary background: no precession and no
 * global ayanamsa is applied to planetary positions. The 27 nakshatras and
 * 28 Arabic mansions are equal-division overlays on the declared 0° Aries
 * wheel, while the Royal Stars remain frozen project anchors.
 */

export const FIRMAMENT_ZODIAC = {
  origin: "0° Aries",
  visualCenter: "Polaris / North Celestial Pole",
  wheelZero: "0° Aries",
  wheelZeroScreenAngle: 0,
  screenAngleDirection: "clockwise",
  planetaryFrame: "tropical",
  fixedStarFrame: "ancient-fixed",
  applyPrecessionToPlanets: true,
  applyPrecessionToFixedStars: false,
  applyAyanamsaToPlanets: false,
  hamalAnchor: {
    star: "Hamal",
    longitude: 12 + 56 / 60,
    roundedOffsets: { start: -13, end: 16 },
    note: "The project preserves the rounded -13°/+16° Hamal frame as metadata; the computational wheel remains 0° Aries–360°.",
  },
  nakshatraCount: 27,
  nakshatraWidth: 360 / 27,
  mansionCount: 28,
  mansionWidth: 360 / 28,
} as const;

export const FIXED_STARS = [
  { name: "Hamal", longitude: 12 + 56 / 60, sign: "Aries", degree: 12, minutes: 56 },
  { name: "Aldebaran", longitude: 15 * 30 + 3 / 60, sign: "Taurus", degree: 15, minutes: 3 },
  { name: "Algol", longitude: 30 + 1 + 26 / 60, sign: "Taurus", degree: 1, minutes: 26 },
  { name: "Rigel", longitude: 60 + 22 + 6 / 60, sign: "Taurus", degree: 22, minutes: 6 },
  { name: "Sirius", longitude: 60 + 19 + 21 / 60, sign: "Gemini", degree: 19, minutes: 21 },
  { name: "Polaris", longitude: 60 + 3 + 50 / 60, sign: "Gemini", degree: 3, minutes: 50 },
  { name: "Regulus", longitude: 120 + 5 + 5 / 60, sign: "Leo", degree: 5, minutes: 5 },
  { name: "Spica", longitude: 150 + 29 + 6 / 60, sign: "Virgo", degree: 29, minutes: 6 },
  { name: "Antares", longitude: 210 + 15 + 1 / 60, sign: "Scorpio", degree: 15, minutes: 1 },
  { name: "Fomalhaut", longitude: 300 + 9 + 7 / 60, sign: "Aquarius", degree: 9, minutes: 7 },
] as const;

export const ROYAL_STARS = [
  { name: "Aldebaran", longitude: 45 + 3 / 60, sign: "Taurus", degree: 15, direction: "East" },
  { name: "Regulus", longitude: 125 + 5 / 60, sign: "Leo", degree: 5, direction: "North" },
  { name: "Antares", longitude: 225 + 1 / 60, sign: "Scorpio", degree: 15, direction: "West" },
  { name: "Fomalhaut", longitude: 309 + 7 / 60, sign: "Aquarius", degree: 9, direction: "South" },
] as const;

export const NAKSHATRA_NAMES = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Svati", "Vishakha", "Anuradha",
  "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
] as const;

export const ARABIC_MANSION_NAMES = [
  "Al-Sharatain", "Al-Butain", "Al-Thurayya", "Al-Dabaran", "Al-Haqa",
  "Al-Hana", "Al-Dhira", "Al-Nathrah", "Al-Tarf", "Al-Jabhah", "Al-Zubrah",
  "Al-Sarfah", "Al-Awwa", "Al-Simak", "Al-Ghafr", "Al-Zubana", "Al-Iklil",
  "Al-Qalb", "Al-Shaulah", "Al-Naim", "Al-Baldah", "Sad al-Dhabih",
  "Sad Bula", "Sad al-Suud", "Sad al-Akhbiya", "Al-Fargh al-Awwal",
  "Al-Fargh al-Thani", "Batn al-Hut",
] as const;

export function normalizeFixedLongitude(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

export function getFixedBackgroundSign(longitude: number): string {
  const signs = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
  return signs[Math.floor(normalizeFixedLongitude(longitude) / 30)] ?? "Aries";
}

export function getNakshatra(longitude: number) {
  const normalized = normalizeFixedLongitude(longitude);
  const index = Math.min(NAKSHATRA_NAMES.length - 1, Math.floor(normalized / FIRMAMENT_ZODIAC.nakshatraWidth));
  const start = index * FIRMAMENT_ZODIAC.nakshatraWidth;
  const pada = Math.min(4, Math.floor((normalized - start) / (FIRMAMENT_ZODIAC.nakshatraWidth / 4)) + 1);
  return { index: index + 1, name: NAKSHATRA_NAMES[index], pada, start, end: start + FIRMAMENT_ZODIAC.nakshatraWidth };
}

export function getArabicMansion(longitude: number) {
  const normalized = normalizeFixedLongitude(longitude);
  const index = Math.min(ARABIC_MANSION_NAMES.length - 1, Math.floor(normalized / FIRMAMENT_ZODIAC.mansionWidth));
  const start = index * FIRMAMENT_ZODIAC.mansionWidth;
  return { index: index + 1, name: ARABIC_MANSION_NAMES[index], start, end: start + FIRMAMENT_ZODIAC.mansionWidth };
}

export function findRoyalStarConjunctions(longitude: number, orb = 1.5): string[] {
  const normalized = normalizeFixedLongitude(longitude);
  return ROYAL_STARS.filter((star) => {
    const difference = Math.abs(((normalized - star.longitude + 180) % 360) - 180);
    return difference <= orb;
  }).map((star) => star.name);
}

export function findFixedStarConjunctions(longitude: number, orb = 1.5): string[] {
  const normalized = normalizeFixedLongitude(longitude);
  return FIXED_STARS.filter((star) => {
    const difference = Math.abs(((normalized - star.longitude + 180) % 360) - 180);
    return difference <= orb;
  }).map((star) => star.name);
}

export function fixedStarHouse(longitude: number, ascendant: number): number {
  const starSign = Math.floor(normalizeFixedLongitude(longitude) / 30);
  const ascSign = Math.floor(normalizeFixedLongitude(ascendant) / 30);
  return ((starSign - ascSign + 12) % 12) + 1;
}

export function fixedStarsForChart(ascendant: number) {
  return FIXED_STARS.map((star) => ({ ...star, house: fixedStarHouse(star.longitude, ascendant) }));
}
