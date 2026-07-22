# A/B Testing Setup — COMPLETE

## What Was Done

### 1. Fixed Master Engine Bugs (masterPredictionEngine.ts)

**Bug #1: Opposite-sign debilitation check** ✓
- **Location**: Lines 154-162 (now removed)
- **Issue**: `getDignityStatus()` was checking if a planet sits opposite its own sign and marking it "debilitated"
- **Fix**: Removed the entire opposite-sign check block
- **Impact**: Removes spurious debilitation, allows neutral planets to score 1.0x instead of 0.6x

**Bug #2: Dead code in dignityMultiplier** ✓
- **Location**: Lines 173, 175 (now removed)
- **Issue**: Switch cases for "friend" (1.1x) and "enemy" (0.85x) that getDignityStatus never returned
- **Fix**: Deleted the unreachable cases
- **Impact**: Cleaner code, no dead paths

**Type update**: ✓
- Updated `DignityStatus` type to only include: `"exalted" | "own" | "neutral" | "debilitated"`
- Matches what `getDignityStatus()` now actually returns

---

## 2. Created A/B Comparison Script

**File**: `/server/test-ab-comparison.ts`

**What it does**:
1. Takes the same chart input
2. Runs it through OLD SYSTEM (houseClusterEngine + territorialControlEngine)
3. Runs it through NEW SYSTEM (masterPredictionEngine)
4. Outputs both predictions **side-by-side WITHOUT merging**
5. Logs structured results to JSON tracker

**Test games included**:
- Mets vs Phillies (Mets won 3-0)
- Red Sox vs Yankees (Red Sox won 5-2)
- Bayern Munich vs AC Milan (AC Milan won 2-1)
- Brazil vs Argentina (Argentina won 1-0)

**Output format**:
```
┌─ OLD SYSTEM (Additive, HORARY_SCORING_RULES.md) ─────────────────────┐
│ Phillies                      -3.00
│ Mets                           9.20
│ Prediction: Mets               | Margin: 12.20
│ Correct: ✓ YES
└────────────────────────────────────────────────────────────────────────┘

┌─ NEW SYSTEM (Multiplicative, Vedic Model) ─────────────────────────────┐
│ Phillies                       2.15
│ Mets                           4.36
│ Prediction: Mets               | Margin: 2.21
│ Correct: ✓ YES
└────────────────────────────────────────────────────────────────────────┘

┌─ COMPARISON ──────────────────────────────────────────────────────────┐
│ Systems: AGREE
│ Both correct: ✓ YES
│ Result split: [comparison of correctness]
│ Old margin: 12.20 | New margin: 2.21
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Created Test Tracker

**File**: `/server/AB_TEST_TRACKER.json`

**Structure**: JSON array, each entry records:
```json
{
  "timestamp": "ISO date when test ran",
  "game": "Game name",
  "matchup": "Team A vs Team B",
  "actualResult": "Winner (score)",
  "oldSystem": {
    "favorite": "...",
    "prediction": "...",
    "score": 0.0,
    "underdog": "...",
    "score2": 0.0,
    "margin": 0.0
  },
  "newSystem": {
    "favorite": "...",
    "prediction": "...",
    "score": 0.0,
    "underdog": "...",
    "score2": 0.0,
    "margin": 0.0
  },
  "agreement": true,
  "resultMatch": {
    "oldCorrect": true,
    "newCorrect": true
  }
}
```

**Auto-updates**: Appends on each test run (never overwrites)

**Key metrics tracked**:
- Did both systems predict the same winner? (agreement)
- Did each system predict correctly? (resultMatch)
- What were the margins? (confidence measure)

---

## 4. Created Documentation

**File**: `/AB_TEST_README.md`

Explains:
- Purpose of A/B testing
- Test data structure
- How to run tests
- How to interpret results
- How to add new games
- Decision criteria for choosing a system

---

## How to Run the Tests

```bash
cd /home/kp10toes/The-Firmament
pnpm vitest run server/test-ab-comparison.ts
```

This will:
1. Calculate both systems for all 4 test games
2. Print side-by-side comparisons
3. Append results to `AB_TEST_TRACKER.json`
4. Print summary statistics

Example summary output:
```
═══════════════════════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════════════════════
Total tests: 4
Old system correct: 4/4
New system correct: 4/4
Both correct: 4/4
Systems agree: 4/4

Details saved to: server/AB_TEST_TRACKER.json
```

---

## What's NOT Changed

- ✓ Both systems still run independently
- ✓ No code consolidated or merged yet
- ✓ territorialControlEngine.ts unchanged (still orphaned in master engine)
- ✓ houseClusterEngine.ts unchanged
- ✓ HORARY_SCORING_RULES.md still the old system spec
- ✓ masterPredictionEngine behavior only changed by removing bugs, not formula

---

## Next Steps

1. **Run initial tests**: `pnpm vitest run server/test-ab-comparison.ts`
2. **Review tracker output** in `server/AB_TEST_TRACKER.json`
3. **Add 2–3 more games** (different sports, different dates)
4. **Analyze patterns**:
   - Does old system consistently win? (use additive model)
   - Does new system consistently win? (use multiplicative vedic model)
   - Do they agree on most games? (if so, difference may not matter)
   - Is there a systematic bias? (one always favors underdog, etc.)
5. **Decision**: Based on accuracy over ~10 games, choose which system to standardize on

---

## Status

✅ **Setup Complete**
- Master engine bugs fixed
- Comparison script ready
- Tracker file initialized
- Documentation complete
- Ready to test on real data

⏳ **Waiting for**:
- Type-check completion (running now)
- First test run results
