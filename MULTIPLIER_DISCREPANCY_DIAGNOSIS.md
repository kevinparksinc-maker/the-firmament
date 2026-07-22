# Multiplier Discrepancy Diagnosis: 27% Gap Root Cause

## Summary
The master prediction engine and detailed breakdown use **two completely separate implementations** of dignity calculation that produce different results. This is a **code duplication with drift** issue.

---

## Location of Diverging Code

### **Path 1: Master Engine**
- **File**: `/home/kp10toes/The-Firmament/server/masterPredictionEngine.ts`
- **Functions**: `getDignityStatus()` (line 144) and `dignityMultiplier()` (line 166)
- **Used by**: `test-nakshatra-stars.ts`, all master engine calculations
- **Territorial Control Calculation**: Line 239

### **Path 2: Detailed Breakdown**  
- **File**: `/home/kp10toes/The-Firmament/server/breakdown-every-lord.ts`
- **Functions**: `getDignityStatus()` (line 45) and `dignityMultiplier()` (line 52)
- **Used by**: `breakdown-every-lord.ts`, detailed debugging output
- **Territorial Control Calculation**: Line 204

---

## The Divergence: Side-by-Side Comparison

### **Issue #1: getDignityStatus() Implementation**

#### Master Engine (masterPredictionEngine.ts:144-164)
```typescript
function getDignityStatus(placement: PlanetPlacement): DignityStatus {
  const planet = placement.planet;
  const sign = placement.sign;

  if (EXALTATIONS[planet] === sign) return "exalted";           // ← lowercase
  if (DEBILITATIONS[planet] === sign) return "debilitated";    // ← lowercase
  if (SIGN_RULERS[sign] === planet) return "own";              // ← lowercase

  const ownSigns = Object.entries(SIGN_RULERS)
    .filter(([_, ruler]) => ruler === planet)
    .map(([s]) => s);

  if (ownSigns.length > 0) {
    const SIGNS = ["Aries", "Taurus", "Gemini", ...];
    const signIndex = SIGNS.indexOf(ownSigns[0]);
    const oppositeIndex = (signIndex + 6) % 12;
    if (SIGNS[oppositeIndex] === sign) return "debilitated";    // ← checks opposite sign
  }

  return "neutral";                                              // ← lowercase
}
```

#### Breakdown (breakdown-every-lord.ts:45-50)
```typescript
function getDignityStatus(planet: string, sign: string): string {
  if (EXALTATIONS[planet] === sign) return "Exalted";           // ← Title Case
  if (DEBILITATIONS[planet] === sign) return "Debilitated";    // ← Title Case
  if (SIGN_RULERS[sign] === planet) return "Own";              // ← Title Case
  return "Neutral";                                              // ← Title Case (NO opposite-sign check)
}
```

**KEY DIFFERENCE #1**: Master engine checks for opposite-sign debilitation, breakdown doesn't.

---

### **Issue #2: dignityMultiplier() Switch Statement**

#### Master Engine (masterPredictionEngine.ts:166-176)
```typescript
function dignityMultiplier(placement: PlanetPlacement): number {
  const status = getDignityStatus(placement);
  switch (status) {
    case "exalted": return 1.5;
    case "own": return 1.25;
    case "friend": return 1.1;           // ← DEAD CODE (never returned by getDignityStatus)
    case "neutral": return 1.0;
    case "enemy": return 0.85;           // ← DEAD CODE (never returned by getDignityStatus)
    case "debilitated": return 0.6;
  }
}
```

#### Breakdown (breakdown-every-lord.ts:52-61)
```typescript
function dignityMultiplier(planet: string, sign: string): number {
  const status = getDignityStatus(planet, sign);
  switch (status) {
    case "Exalted": return 1.5;
    case "Own": return 1.25;
    case "Neutral": return 1.0;
    case "Debilitated": return 0.6;
    default: return 1.0;
  }
}
```

**KEY DIFFERENCE #2**: Master engine has unreachable cases ("friend", "enemy") and uses lowercase. Breakdown uses title case and no dead code.

---

### **Issue #3: Function Signature Difference**

**Master Engine**:
- Takes a `PlanetPlacement` object (which has `.planet`, `.sign`)
- Returns `DignityStatus` type (lowercase)

**Breakdown**:
- Takes separate `planet: string` and `sign: string` parameters
- Returns `string` (could be any case)

---

## Why This Causes a 27% Difference

The **opposite-sign debilitation check** in the master engine:
```typescript
if (SIGNS[oppositeIndex] === sign) return "debilitated";
```

This means:
- **Master Engine**: A planet in the opposite sign of its own sign returns "debilitated" → 0.6x multiplier
- **Breakdown**: The same planet would only check DEBILITATIONS map, potentially returning "neutral" → 1.0x multiplier

For a planet that is in a sign opposite to one of its own signs (but not in the explicit DEBILITATIONS map), the master engine would apply 0.6x while the breakdown applies 1.0x—that's a **40% difference per planet**, compounded across multiple lords.

---

## Example: Saturn in Breakdown

Saturn rules Capricorn (signIndex=9). The opposite sign is Cancer (oppositeIndex=3).
- If Saturn is in Cancer:
  - **Master Engine**: Returns "debilitated" → 1.0 × 0.6 = 0.6x multiplier
  - **Breakdown**: Returns "Neutral" (unless Saturn is in explicit DEBILITATIONS[Saturn]) → 1.0 × 1.0 = 1.0x multiplier
  - **Difference**: 40% swing per Saturn score

With multiple lords experiencing this, the 27% total variance makes sense.

---

## Code Files to Review

### File 1: Master Engine
```
/home/kp10toes/The-Firmament/server/masterPredictionEngine.ts
Lines 144-164: getDignityStatus() function
Lines 166-176: dignityMultiplier() function
Line 239: controllingGain calculation
```

### File 2: Detailed Breakdown
```
/home/kp10toes/The-Firmament/server/breakdown-every-lord.ts
Lines 45-50: getDignityStatus() function
Lines 52-61: dignityMultiplier() function
Line 204: controllingGain calculation
```

---

## Summary Table

| Aspect | Master Engine | Breakdown |
|--------|---------------|-----------|
| **getDignityStatus input** | `PlanetPlacement` object | `planet, sign` strings |
| **Return case format** | lowercase ("exalted") | Title case ("Exalted") |
| **Opposite-sign check** | YES (lines 152-160) | NO |
| **Dead code** | YES ("friend", "enemy" cases) | NO |
| **Multiplier logic** | 6 unreachable cases | 4 cases, clean default |
| **Result** | More debilitations applied | Fewer debilitations applied |
| **Output** | Lower territorial scores | Higher territorial scores |

---

## Next Steps
Before fixing, the decision is:
1. **Merge into master engine**: Remove the opposite-sign logic from master engine to match breakdown (higher scores)?
2. **Merge into breakdown**: Add the opposite-sign logic to breakdown to match master engine (lower scores)?
3. **New unified function**: Create a single, canonical `getDignityStatus()` function in a shared utility file that both use?

Which behavior is the correct canonical one?
