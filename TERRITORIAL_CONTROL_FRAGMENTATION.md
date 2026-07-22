# Territorial Control Fragmentation: Three Separate Systems

## Executive Summary
The codebase has **THREE independent territorial control implementations** with completely different formulas. The master prediction engine does NOT use the foundational `territorialControlEngine.ts`. This is a critical architectural fragmentation issue that may contribute to the 27% score discrepancy (alongside dignity duplication).

---

## System 1: territorialControlEngine.ts (Foundational Layer — ORPHANED)

**Files:**
- Primary: `/server/territorialControlEngine.ts`
- Used by: `houseClusterEngine.ts` (line 374), test files only
- NOT imported by: `masterPredictionEngine.ts` or `breakdown-every-lord.ts`

**Formula (Simple Points System):**
```typescript
let basePoints = 0;

// Own cluster: +1
if (isOwnCluster) basePoints += 1;

// Exact own house: +1 bonus
if (isExactOwnHouse) basePoints += 1;

// Opponent cluster: -1
if (isOpponentCluster) basePoints -= 1;

// Opponent angle: -1 extra penalty
if (isOpponentAngleFlag) basePoints -= 1;

// Apply nakshatra modifier only
finalPoints = basePoints * nakshatraModifier;
```

**Characteristics:**
- Fixed point values: ±1, ±1
- Nakshatra modifier applied at end
- No distinction between houses (H1=H3=H10=H11, no base-points map)
- No multiplier stacking (dignity, friction, stars, lord support)
- **Sources of truth: lines 39-77 in territorialControlEngine.ts**

---

## System 2: masterPredictionEngine.ts (Current Canonical Engine)

**Files:**
- Primary: `/server/masterPredictionEngine.ts` (lines 213-258)
- Used by: Main prediction flow, test-nakshatra-stars.ts
- Does NOT import: `territorialControlEngine.ts`
- Code duplication: Dignity logic duplicated from breakdown-every-lord.ts

**Formula (Complex Multiplier Stack):**
```typescript
// Base points vary by house
const basePoints = getBasePoints(occupiedHouse); // H1/H7: 4, H3/H9: 2, etc.
const placementBonus = getPlacementBonus(occupiedHouse); // Angular: +1, Succedent: +0.5, etc.

// Full multiplier stack applied to controlling side's gain:
const controllingGain = (basePoints + placementBonus) 
  * dignityMultiplier        // 0.6x to 1.5x
  * nakshatraMultiplier      // 0.8x to 1.2x
  * frictionMultiplier       // 0.9x to 1.1x (sign lord ↔ nakshatra lord)
  * fixedStarAmplification   // 0.6x to 1.3x
  * nakshatraDignityFactor   // 0.8x to 1.2x
  * lordSupportMultiplier;   // 0.95x to 1.1x

// Displaced side loses only basePoints (no multipliers):
if (displaced) sideBTotal -= basePoints;
```

**Base Points Mapping (lines 117-128):**
```typescript
H1: 4, H7: 4,     // Angular (cardinal)
H3: 2, H9: 2,     // Succedent
H6: 2, H12: 2,    // Cadent
H10: 4, H4: 4,    // Angular (cardinal)
H11: 3, H5: 3,    // Succedent
```

**Characteristics:**
- Asymmetric points: base varies by house (2–4 points)
- Placement bonus: +1 (angular), +0.5 (succedent), 0 (cadent)
- **SIX multipliers stacked** (dignity, nakshatra, friction, stars, dignity again, lord support)
- Displacement penalty applies to ruled side only, no multipliers
- **Sources of truth: lines 200-265 in masterPredictionEngine.ts**

---

## System 3: breakdown-every-lord.ts (Diagnostic Breakdown — CODE DUPLICATION)

**Files:**
- `/server/breakdown-every-lord.ts` (lines 197-204)
- Purpose: Detailed lord-by-lord diagnostic output
- Uses: COPIED code from masterPredictionEngine.ts, NOT imported

**Formula:**
Identical to masterPredictionEngine.ts System 2. Lines 197-204:
```typescript
const controllingGain = (basePoints + placementBonus) 
  * dMult * nMult * frictionMult * starAmp * nDignity * lordSupport;
```

**BUT with duplicated dignity logic (lines 45-93):**
- `getDignityStatus()` — NOT exported, local copy only
- `dignityMultiplier()` — NOT exported, local copy only
- Neither file imports from the other; both re-implement the logic

---

## Why This Matters: Formula Comparison

| Aspect | territorialControlEngine | masterPredictionEngine | breakdown-every-lord |
|--------|--------------------------|----------------------|----------------------|
| **Base Points** | Fixed ±1 | House-mapped 2–4 | House-mapped 2–4 |
| **Placement Bonus** | None | +1 / +0.5 / 0 | +1 / +0.5 / 0 |
| **Dignity Multiplier** | No | 0.6x–1.5x | 0.6x–1.5x (duplicated) |
| **Nakshatra Multiplier** | 0.8x–1.2x (only) | 0.8x–1.2x | 0.8x–1.2x |
| **Friction Modifier** | No | 0.9x–1.1x | 0.9x–1.1x |
| **Fixed Stars** | No | 0.6x–1.3x | 0.6x–1.3x |
| **Nakshatra Dignity Factor** | No | 0.8x–1.2x | 0.8x–1.2x |
| **Lord Support** | No | 0.95x–1.1x | 0.95x–1.1x |
| **Total Multipliers** | 1 | 6 | 6 |
| **Example H1 Gain** | ±1 × nMult | 4 × dMult × nMult × ... × lordSupp | 4 × dMult × nMult × ... × lordSupp |
| **Displacement Penalty** | -1 (no multipliers) | -basePoints (no multipliers) | -basePoints (no multipliers) |

**Example Impact:** For a lord in H1 with good dignity/nakshatra/stars:
- **territorialControlEngine**: 1 × 1.2 = **1.2 points**
- **masterPredictionEngine**: 4 × 1.5 × 1.2 × 1.1 × 1.3 × 1.2 × 1.1 ≈ **12.3 points** (10× multiplier)

---

## Architectural Discovery: Which System Should Be Authoritative?

### Current Usage:
1. **masterPredictionEngine.ts** — Active in main prediction flow, calculated scores (Germany 3.180, Paraguay 4.182)
2. **breakdown-every-lord.ts** — Diagnostic breakdown (not exported to API, diagnostic only)
3. **territorialControlEngine.ts** — Used by houseClusterEngine.ts and test files, NOT by main engine

### Evidence of Intentional Separation:
- `masterPredictionEngine.ts` has NO import of `territorialControlEngine.ts` despite having a comment mentioning it (line 203)
- Comment reads: "This eliminates noise from unclaimed planets and keeps scoring pure to territorial control" — but the implementation is NOT from territorialControlEngine
- `houseClusterEngine.ts` imports and uses `territorialControlEngine.ts` separately (line 374), suggesting a two-system design: one for sports horary, one for house-cluster evaluation

### Key Question:
**Was this intentional architectural layering or accidental fragmentation during development?**

Given:
- The master engine was built *after* territorialControlEngine (likely during the multiplier-stacking refactoring)
- breakdown-every-lord.ts duplicates master engine code (not a merged layer)
- houseClusterEngine.ts still references territorialControlEngine for a secondary scoring path
- No tests verify that master engine + territoralControlEngine produce the same results

**Conclusion:** This appears to be **accidental fragmentation**, not intentional separation. The master engine silently orphaned the foundational layer and replaced it with a custom implementation.

---

## Impact on Score Discrepancy

The 27% variance (Germany 3.180 vs 4.363 in breakdown, or similar mismatch between engines) is driven by:

1. **Dignity calculation duplication with drift** (documented in MULTIPLIER_DISCREPANCY_DIAGNOSIS.md)
   - Master engine: checks opposite-sign debilitation
   - Breakdown: does not
   - Result: ~27% variance

2. **Territorial control formula divergence** (this document)
   - Master engine: 6-multiplier stack on base 2–4 points
   - territorialControlEngine: 1-multiplier stack on fixed ±1 points
   - Result: up to 10× amplification difference per lord
   - **Only visible if master engine is compared to houseClusterEngine output** (which uses territorialControlEngine)

---

## Recommended Resolution Path

Before fixing, determine:

1. **Is master engine the canonical system?**
   - If YES: Delete territorialControlEngine.ts and consolidate to masterPredictionEngine
   - Update houseClusterEngine.ts to use master engine's territorial control

2. **Should territorialControlEngine be the base layer?**
   - If YES: Revert masterPredictionEngine to use territorialControlEngine + handle multipliers separately
   - This aligns with the comment on line 203

3. **Fix dignity duplication first**
   - Extract `getDignityStatus()` and `dignityMultiplier()` to shared utility
   - Both masterPredictionEngine and breakdown-every-lord must use the same source
   - Decision: include or exclude opposite-sign debilitation check?

---

## Files to Audit

- [ ] `/server/masterPredictionEngine.ts` — lines 200–265 (territorial control loop)
- [ ] `/server/territorialControlEngine.ts` — lines 39–77 (simple point system)
- [ ] `/server/houseClusterEngine.ts` — lines 374–376 (uses territorialControlEngine)
- [ ] `/server/breakdown-every-lord.ts` — lines 45–93 (dignity duplication), lines 197–204 (territorial calc)
- [ ] Test files: `test-territorial-control.ts`, `test-comprehensive-scoring.ts` (verify which system they expect)

---

## Status

🔴 **CRITICAL FRAGMENTATION DETECTED** — Three separate territorial control systems with no unified source of truth. Master engine orphaned the foundational layer and built its own. This is a load-bearing architectural issue that must be resolved before fixing dignity calculation or multiplier stacking.

**Next Step:** User decision on canonical system, then unify before any other fixes.
