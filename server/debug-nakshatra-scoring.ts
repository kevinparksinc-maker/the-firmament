/**
 * DEBUG: Nakshatra Evaluation & Scoring
 * Shows how nakshatras are evaluated and scored in the prediction engine
 */

import { NAKSHATRAS } from "./nakshatraData";

// Replicate the nakshatraScore function from masterPredictionEngine.ts
function nakshatraScore(nakshatraName: string): number {
  const profile = NAKSHATRAS[nakshatraName];
  if (!profile) return 0;

  // Map nakshatra traits to additive points
  const traitToPoints = (trait: string): number => {
    switch (trait) {
      case "Excellent": return 1.5;
      case "High": return 0.75;
      case "Medium": return 0;
      case "Low": return -0.75;
      default: return 0;
    }
  };

  const traits = [profile.initiative, profile.pressureResponse, profile.consistency, profile.finishingAbility];
  const points = traits.map(traitToPoints);
  return points.reduce((a, b) => a + b, 0) / points.length;
}

function temperamentVolatility(nakshatraName: string): number {
  const profile = NAKSHATRAS[nakshatraName];
  if (!profile) return 0;
  switch (profile.temperament) {
    case "Stoic": return 0;
    case "Emotional": return 0.1;
    case "Volatile": return 0.2;
  }
}

console.log("═════════════════════════════════════════════════════════════");
console.log("NAKSHATRA EVALUATION & SCORING BREAKDOWN");
console.log("═════════════════════════════════════════════════════════════\n");

console.log("TRAIT POINT MAPPING:");
console.log("  Excellent  →  +1.5 pts");
console.log("  High       →  +0.75 pts");
console.log("  Medium     →  0 pts");
console.log("  Low        →  -0.75 pts\n");

console.log("TEMPERAMENT VOLATILITY:");
console.log("  Stoic      →  0% volatility");
console.log("  Emotional  →  10% volatility");
console.log("  Volatile   →  20% volatility\n");

console.log("═════════════════════════════════════════════════════════════");
console.log("ALL NAKSHATRAS WITH SCORES\n");

const nakshatraNames = Object.keys(NAKSHATRAS);
const scoredNakshatras = nakshatraNames
  .map((name) => ({
    name,
    score: nakshatraScore(name),
    volatility: temperamentVolatility(name),
    profile: NAKSHATRAS[name],
  }))
  .sort((a, b) => b.score - a.score);

console.log(
  "NAME".padEnd(20) +
    "SCORE".padEnd(10) +
    "VOL%".padEnd(8) +
    "INIT".padEnd(12) +
    "PRESSURE".padEnd(12) +
    "CONSIST".padEnd(12) +
    "FINISH"
);
console.log("─".repeat(96));

for (const nak of scoredNakshatras) {
  console.log(
    nak.name.padEnd(20) +
      nak.score.toFixed(2).padEnd(10) +
      (nak.volatility * 100).toFixed(0).padEnd(8) +
      nak.profile.initiative.padEnd(12) +
      nak.profile.pressureResponse.padEnd(12) +
      nak.profile.consistency.padEnd(12) +
      nak.profile.finishingAbility
  );
}

console.log("\n═════════════════════════════════════════════════════════════");
console.log("DETAILED SCORING FOR EVERY NAKSHATRA:\n");

const traitToPoints = (trait: string): number => {
  switch (trait) {
    case "Excellent": return 1.5;
    case "High": return 0.75;
    case "Medium": return 0;
    case "Low": return -0.75;
    default: return 0;
  }
};

for (let idx = 0; idx < scoredNakshatras.length; idx++) {
  const nak = scoredNakshatras[idx];
  const init = traitToPoints(nak.profile.initiative);
  const pressure = traitToPoints(nak.profile.pressureResponse);
  const consist = traitToPoints(nak.profile.consistency);
  const finish = traitToPoints(nak.profile.finishingAbility);

  console.log(`${(idx + 1).toString().padStart(2)}. ${nak.name.padEnd(20)}`);
  console.log(
    `    Initiative:        ${nak.profile.initiative.padEnd(12)} = ${init.toFixed(2).padStart(5)} pts`
  );
  console.log(
    `    Pressure Response: ${nak.profile.pressureResponse.padEnd(12)} = ${pressure.toFixed(2).padStart(5)} pts`
  );
  console.log(
    `    Consistency:       ${nak.profile.consistency.padEnd(12)} = ${consist.toFixed(2).padStart(5)} pts`
  );
  console.log(
    `    Finishing Ability: ${nak.profile.finishingAbility.padEnd(12)} = ${finish.toFixed(2).padStart(5)} pts`
  );
  console.log(
    `    ─────────────────────────────────────────────────────────────`
  );
  const sum = init + pressure + consist + finish;
  console.log(
    `    SUM: ${sum.toFixed(2).padStart(5)} pts ÷ 4 traits = FINAL SCORE: ${nak.score.toFixed(2).padStart(5)} pts`
  );
  console.log(
    `    Temperament: ${nak.profile.temperament.padEnd(12)} → ${(nak.volatility * 100).toFixed(0)}% volatility penalty\n`
  );
}

console.log("═════════════════════════════════════════════════════════════");
console.log("SCORE DISTRIBUTION:\n");

const scoreRanges = [
  { min: 1.5, max: 2, label: "Excellent (1.5-2.0)" },
  { min: 0.75, max: 1.49, label: "Good (0.75-1.49)" },
  { min: -0.74, max: 0.74, label: "Neutral (-0.74-0.74)" },
  { min: -1.5, max: -0.75, label: "Poor (-1.5 to -0.75)" },
];

for (const range of scoreRanges) {
  const count = scoredNakshatras.filter((n) => n.score >= range.min && n.score <= range.max).length;
  console.log(`${range.label.padEnd(30)} ${count.toString().padEnd(3)} nakshatras`);
}

console.log("\n═════════════════════════════════════════════════════════════");
console.log("HOW SCORES ARE USED IN PREDICTIONS:\n");
console.log(
  `- Each house lord's nakshatra contributes its score to Layer 3.5 (Nakshatra Strength)`
);
console.log(`- Scores are additive per side (A and B each accumulate scores)`);
console.log(`- Volatile temperaments reduce confidence by up to 20% per volatile lord`);
console.log(`- Higher nakshatra scores = higher strength in that house for that side`);
console.log("═════════════════════════════════════════════════════════════\n");
