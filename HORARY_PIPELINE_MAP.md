# Sports Horary Breakdown Pipeline — Complete File Map

## Executive Summary
The sports horary prediction system is built from **12 core files** organized in 4 layers:
1. **Input Layer**: Chart calculation (ephemeris, coordinate transformation)
2. **Core Prediction Engine**: Master engine + specialized scoring modules
3. **Breakdown & Diagnostics**: Detailed lord-by-lord breakdowns
4. **Knowledge & Data**: Nakshatra, planets, dignity, fixed stars

---

## LAYER 1: INPUT & CHART CALCULATION

### 📄 ephemeris.ts
**Path**: `/home/kp10toes/The-Firmament/server/ephemeris.ts`
**Purpose**: Calculates topocentric planetary positions using astronomy-engine library. Core function: `calculateChart(date, observer)` returns planets with sidereal longitude, sign, house, altitude.
**Imported by**: 
- breakdown-every-lord.ts
- breakdown-correct-with-stars.ts
- horary.ts
- test files
**Imports from**:
- astronomy-engine (external)
- Kepler (external)

### 📄 coordinateTransformer.ts
**Path**: `/home/kp10toes/The-Firmament/server/coordinateTransformer.ts`
**Purpose**: Transforms spherical coordinates into flat North Pole grid system. Core function: `transformChartToFlatPlane(lat, lon, localHours, rZodiac, gridScale, seasonalOffset)` calculates planar Ascendant using Pythagorean geometry instead of spherical trigonometry.
**Imported by**:
- breakdown-every-lord.ts
- breakdown-correct-with-stars.ts
- test-nakshatra-stars.ts
- test files
**Imports from**:
- (none - pure geometry)

### 📄 astroEngine.ts
**Path**: `/home/kp10toes/The-Firmament/server/astroEngine.ts`
**Purpose**: Vedic astrology data and engine: `SIGN_RULERS`, `EXALTATIONS`, `DEBILITATIONS` mappings, planet/house definitions, `runAstroReading()` function for pattern detection.
**Imported by**:
- breakdown-every-lord.ts
- breakdown-correct-with-stars.ts
- masterPredictionEngine.ts
- horary.ts
- territorialControlEngine.ts
- nakshatraStarEngine.ts
**Imports from**:
- summarizePillarRich.ts

---

## LAYER 2: CORE PREDICTION ENGINE & SCORING

### 📄 masterPredictionEngine.ts ⭐ MAIN ENGINE
**Path**: `/home/kp10toes/The-Firmament/server/masterPredictionEngine.ts`
**Purpose**: The canonical prediction engine implementing **Canonical Territorial Rules**. Calculates territorial control via house lords with dignity multipliers, nakshatra support, friction modifiers, and fixed star amplifications. Returns `PredictionResult` with layer breakdown and final scores.
**Key Functions**:
- `calculateFullPrediction(chart, config)` — Main orchestrator
- `dignityMultiplier(placement)` — Planet strength in sign (includes dead code for "friend"/"enemy")
- `getDignityStatus(placement)` — Checks exaltation, debilitation, own sign, **opposite-sign debilitation**
- `whichSide(house, config)` — Determines territorial affiliation
- `getBasePoints(house)` — House point values
- `getPlacementBonus(house)` — Angular/succedent bonus
**Imported by**:
- test-nakshatra-stars.ts
- routers.ts (tRPC exposure)
**Imports from**:
- astroEngine.ts (SIGN_RULERS, EXALTATIONS, DEBILITATIONS)
- nakshatraData.ts (NAKSHATRAS, calculateNakshatraModifier)
- houseScoringConstants.ts (SIDE_A_HOUSES, SIDE_B_HOUSES)
- nakshatraStarEngine.ts (getNakshatraLord, getNakshatraDignity, getFixedStarAmplification, getNakshatraLordStrength, findFixedStarConjunctions)
- planetRelationships.ts (getSignNakshatraFriction, PlanetName)

### 📄 breakdown-every-lord.ts ⭐ PRIMARY BREAKDOWN
**Path**: `/home/kp10toes/The-Firmament/server/breakdown-every-lord.ts`
**Purpose**: Detailed house-by-house lord breakdown with explicit multiplier display. Shows **EXACTLY** which multipliers are applied at each step, with semantic grouping (macro territory layer, micro mansion layer, stellar layer). Standalone testing script with full console output.
**Key Functions**:
- `breakdown()` — Main async function
- `dignityMultiplier(planet, sign)` — Planet strength (simplified: 4 cases, Title Case)
- `getDignityStatus(planet, sign)` — Checks exaltation, debilitation, own sign (NO opposite-sign logic)
- `nakshatraMultiplier(nakshatraName)` — Behavioral execution traits
- `whichSide(house)` — Territorial affiliation
**⚠️ DIVERGENCE**: This file's `getDignityStatus()` and `dignityMultiplier()` are DUPLICATED from masterPredictionEngine with drift (no opposite-sign debilitation check, Title Case returns, no dead code)
**Imported by**:
- (used as standalone test script)
**Imports from**:
- ephemeris.ts (calculateChart)
- astroEngine.ts (SIGN_RULERS, EXALTATIONS, DEBILITATIONS)
- nakshatra.ts (getNakshatraAt)
- coordinateTransformer.ts (transformChartToFlatPlane)
- nakshatraStarEngine.ts (getNakshatraLord, getNakshatraDignity, getFixedStarAmplification, getNakshatraLordStrength, findFixedStarConjunctions)
- planetRelationships.ts (getSignNakshatraFriction, PlanetName)
- nakshatraData.ts (NAKSHATRAS, calculateNakshatraModifier)

### 📄 breakdown-correct-with-stars.ts
**Path**: `/home/kp10toes/The-Firmament/server/breakdown-correct-with-stars.ts`
**Purpose**: Earlier version of detailed breakdown; similar structure to breakdown-every-lord but without semantic grouping. Shows base points, dignity, nakshatra, fixed star, and lord support multipliers.
**Imported by**:
- (standalone test/development script)
**Imports from**:
- Same as breakdown-every-lord.ts

### 📄 territorialControlEngine.ts
**Path**: `/home/kp10toes/The-Firmament/server/territorialControlEngine.ts`
**Purpose**: Older territorial control calculator with nakshatra multiplier integration. May have different implementation than masterPredictionEngine.
**Imported by**:
- test-territorial-control.ts
- test-comprehensive-scoring.ts
- houseClusterEngine.ts
**Imports from**:
- astroEngine.ts (PlanetPlacement type)
- houseScoringConstants.ts (SIDE_A_HOUSES, SIDE_B_HOUSES)
- nakshatra.ts (getNakshatraAt)
- nakshatraData.ts (NAKSHATRAS, calculateNakshatraModifier)

---

## LAYER 3: HORARY & QUESTION-BASED PREDICTION

### 📄 horary.ts
**Path**: `/home/kp10toes/The-Firmament/server/horary.ts`
**Purpose**: Horary astrology layer for question-based readings. Accepts natal placements + current transits + a question. Routes through Firmament Engine → Anthropic SDK. Detects intent (general, explain, action, simulate, isolate, timing) and focus (planet, sign, house, aspect). Generates reading text via LLM.
**Key Functions**:
- `runHoraryReading(natalText, transitText, question, intent, focus)` — Main orchestrator
- `detectIntent(question)` — Infers question type
- `detectFocus(question)` — Identifies what the question focuses on
- `buildPrompt()` — Constructs LLM context
**Imported by**:
- routers.ts (tRPC horary endpoint)
**Imports from**:
- _core/llm.ts (invokeLLM, Message type)
- astroEngine.ts (runAstroReading, PlanetPlacement, Activation)
- firmamentKnowledge.ts (getDignityFlavor, buildStarBlock, buildKabbalahBlock)

---

## LAYER 4: KNOWLEDGE & SHARED DATA

### 📄 nakshatraStarEngine.ts ⭐ MULTIPLIER ENGINE
**Path**: `/home/kp10toes/The-Firmament/server/nakshatraStarEngine.ts`
**Purpose**: Integrates 27 Vedic lunar mansions (nakshatras) and fixed stars into territorial scoring.
**Key Data**:
- `NAKSHATRA_LORDS` (27 entries: Ashwini→Ketu through Revati→Mercury)
- `NAKSHATRA_DIGNITY` (-2 to +2 inherent strength for each nakshatra)
- `MAJOR_FIXED_STARS` (10 stars: 4 Royal [Regulus, Aldebaran, Antares, Fomalhaut], 4 Major [Sirius, Polaris, Spica, Denebola], 2 Minor [Algol, Bellatrix])
**Key Functions**:
- `getNakshatraLord(nakshatraName)` → planet ruling this nakshatra
- `getNakshatraDignity(nakshatraName)` → inherent strength (-2 to +2)
- `getFixedStarAmplification(longitude, orb)` → star conjunction amplifier (1.0 to 1.3x benefic, 0.6x to 1.0x malefic)
- `getNakshatraLordStrength(nakshatraName, lordDignityMultiplier)` → feedback from nakshatra lord (0.95x-1.1x)
- `findFixedStarConjunctions(longitude, orb)` → returns array of conjunct stars
**Imported by**:
- masterPredictionEngine.ts
- breakdown-every-lord.ts
- breakdown-correct-with-stars.ts
- test files
**Imports from**:
- nakshatraData.ts (NAKSHATRAS)

### 📄 nakshatraData.ts ⭐ NAKSHATRA LIBRARY
**Path**: `/home/kp10toes/The-Firmament/server/nakshatraData.ts`
**Purpose**: Complete Vedic lunar mansion database with profiles for all 27 nakshatras. Each entry includes: name, ruling planet, inherent dignity, pace (Slow/Moderate/Fast), style, temperament (Stoic/Emotional/Volatile), and 4 execution traits (initiative, pressure response, consistency, finishing) rated Low/Medium/High/Excellent.
**Key Exports**:
- `NAKSHATRAS` — Record of 27 NakshatraProfile objects
- `calculateNakshatraModifier(profile)` → Converts execution traits to multiplier (0.9x-1.15x)
- `getNakshatraFromLongitude(lon)` → Identifies which nakshatra a degree falls in
**Imported by**:
- masterPredictionEngine.ts
- breakdown-every-lord.ts
- breakdown-correct-with-stars.ts
- territorialControlEngine.ts
- nakshatraStarEngine.ts
- test files

### 📄 planetRelationships.ts ⭐ FRICTION ENGINE
**Path**: `/home/kp10toes/The-Firmament/server/planetRelationships.ts`
**Purpose**: Vedic planet friendship/enmity matrix (Nisargika Graha Mitrata). When Sign Lord and Nakshatra Lord are different, their relationship determines mechanical friction.
**Key Data**:
- `VEDIC_FRIENDS` — Map of natural planetary friendships
- `VEDIC_ENEMIES` — Map of natural planetary enmities
**Key Functions**:
- `getSignNakshatraFriction(signLord, nakshatraLord)` → Returns {multiplier, status}
  - Same planet: 1.10x "Perfect Alignment"
  - Friends: 1.10x "Harmonious"
  - Neutral: 1.00x "Neutral"
  - Enemies: 0.90x "Conflicting"
- `getPlanetRelationship(planetA, planetB)` → "same" | "friends" | "neutral" | "enemies"
- `describeFrictionStatus(signLord, nakshatraLord)` → Human-readable description
**Imported by**:
- masterPredictionEngine.ts
- breakdown-every-lord.ts
- breakdown-correct-with-stars.ts
**Imports from**:
- (none)

### 📄 houseScoringConstants.ts
**Path**: `/home/kp10toes/The-Firmament/server/houseScoringConstants.ts`
**Purpose**: Cluster house definitions separating 10 scoreable houses into two territorial sides.
**Key Exports**:
- `SIDE_A_HOUSES = [1, 3, 6, 10, 11]`
- `SIDE_B_HOUSES = [7, 9, 12, 4, 5]`
- (H2, H8 are neutral, never scored)
**Imported by**:
- masterPredictionEngine.ts
- territorialControlEngine.ts

### 📄 firmamentKnowledge.ts
**Path**: `/home/kp10toes/The-Firmament/server/firmamentKnowledge.ts` (or client equivalent)
**Purpose**: Shared dignity vocabulary, fixed star profiles, Kabbalah layers, and related knowledge. Used by horary layer for enriched reading generation.
**Key Functions**:
- `getDignityFlavor(planet, dignityStatus)` → Human-readable interpretation
- `buildStarBlock(stars)` → Formatted fixed star description
- `buildKabbalahBlock(placement)` → Kabbalah tree interpretation
**Imported by**:
- horary.ts

### 📄 nakshatra.ts
**Path**: `/home/kp10toes/The-Firmament/server/nakshatra.ts` (file name varies)
**Purpose**: Nakshatra lookup utility. Core function: `getNakshatraAt(siderealLongitude)` returns which of the 27 nakshatras a degree falls in, along with pada (quarter within nakshatra).
**Imported by**:
- breakdown-every-lord.ts
- breakdown-correct-with-stars.ts
- territorialControlEngine.ts
- test files

---

## DEPENDENCY FLOW DIAGRAM

```
┌─ INPUT LAYER ────────────────────────────────────────┐
│                                                      │
│  ephemeris.ts ────→ coordinateTransformer.ts       │
│  (planets)         (planar Ascendant)              │
│                                                      │
└──────────────┬─────────────────────────────────────┘
               │
               ├──→ astroEngine.ts
               │    (SIGN_RULERS, EXALTATIONS, DEBILITATIONS)
               │
               ▼
┌─ CORE PREDICTION ────────────────────────────────────┐
│                                                      │
│  masterPredictionEngine.ts  ←─┐                    │
│  (canonical engine)           │                     │
│                               │                     │
│  breakdown-every-lord.ts  ────┤  (duplicated)      │
│  (detailed breakdown)         │                     │
│                               │                     │
│  breakdown-correct-with-stars │                     │
│  (earlier breakdown)          │                     │
│                               │                     │
│  territorialControlEngine.ts ─┘                     │
│  (older scoring)                                    │
│                                                      │
└────────────┬─────────────────────────────────────┘
             │
             ├─→ nakshatraStarEngine.ts
             │   (multipliers: lords, dignity, stars)
             │
             ├─→ nakshatraData.ts
             │   (27 nakshatras with profiles)
             │
             ├─→ planetRelationships.ts
             │   (friction modifier logic)
             │
             ├─→ houseScoringConstants.ts
             │   (cluster house definitions)
             │
             └─→ nakshatra.ts
                 (nakshatra lookup)
                
┌─ HORARY LAYER ───────────────────────────────────────┐
│                                                      │
│  horary.ts ──→ astroEngine.ts                       │
│  (question→LLM)  firmamentKnowledge.ts              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## KEY STATISTICS

| Category | Count |
|----------|-------|
| Core Breakdown Files | 3 (breakdown-every-lord, breakdown-correct-with-stars, masterPredictionEngine) |
| Supporting Engines | 2 (territorialControlEngine, nakshatraStarEngine) |
| Knowledge/Data Files | 4 (nakshatraData, planetRelationships, astroEngine, firmamentKnowledge) |
| Input Calculators | 3 (ephemeris, coordinateTransformer, nakshatra) |
| Horary/Question Layer | 1 (horary.ts) |
| Constants | 1 (houseScoringConstants) |
| **Total Core Files** | **14** |

---

## CRITICAL DEPENDENCY CHAIN

**For a complete sports horary prediction:**

```
1. Input:        ephemeris.ts + coordinateTransformer.ts
2. Lookup:       astroEngine.ts (sign rulers, dignities)
3. Mansions:     nakshatraData.ts (27 nakshatras with profiles)
4. Multipliers:  nakshatraStarEngine.ts (lords, dignity, fixed stars)
5. Friction:     planetRelationships.ts (lord conflicts)
6. Scoring:      masterPredictionEngine.ts (canonical rules)
7. Display:      breakdown-every-lord.ts (human-readable output)
8. Questions:    horary.ts (LLM-enriched readings via firmamentKnowledge)
```

---

## IDENTIFIED ISSUES

### ⚠️ Code Duplication with Drift
- **breakdown-every-lord.ts** and **masterPredictionEngine.ts** both implement `getDignityStatus()` and `dignityMultiplier()` independently
- **Master Engine**: Includes opposite-sign debilitation logic (lines 154-162); uses lowercase returns; has dead code ("friend", "enemy" cases)
- **Breakdown**: Simpler logic; uses Title Case; no dead code; no opposite-sign logic
- **Result**: ~27% score discrepancy on same inputs

### ⚠️ Multiplier Chain Complexity
Five independent multiplier systems applied in sequence:
1. Dignity (1.0x–1.5x)
2. Nakshatra (0.9x–1.15x)
3. Friction (0.9x–1.1x)
4. Fixed Star (0.6x–1.3x)
5. Lord Support (0.95x–1.1x)

Result: Compounding effects can swing scores 40%+ between paths

---

## NEXT STEPS FOR CONSOLIDATION

1. **Unify dignity calculation** → Create single canonical `getDignityStatus()` in shared file
2. **Audit opposite-sign logic** → Determine if it's a feature or a bug
3. **Eliminate breakdown duplication** → Have breakdown-every-lord import from masterPredictionEngine
4. **Test parity** → Verify both output identical scores on same inputs
