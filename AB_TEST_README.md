# A/B Testing: Old System vs New System

## Purpose

Compare two prediction engines side-by-side on real game data to determine which is more accurate:

- **OLD SYSTEM**: `houseClusterEngine.ts` + `territorialControlEngine.ts` (Additive, per `HORARY_SCORING_RULES.md`)
- **NEW SYSTEM**: `masterPredictionEngine.ts` (Multiplicative, Vedic model with nakshatras + friction + fixed stars)

## Test Data Structure

Each test records:

```json
{
  "timestamp": "2026-07-19T12:34:56.000Z",
  "game": "Mets vs Phillies",
  "matchup": "Phillies vs Mets",
  "actualResult": "Mets (3-0)",
  "oldSystem": {
    "favorite": "Phillies",
    "prediction": "Mets",
    "score": -3.0,
    "underdog": "Mets",
    "score2": 9.2,
    "margin": 12.2
  },
  "newSystem": {
    "favorite": "Phillies",
    "prediction": "Mets",
    "score": 2.15,
    "underdog": "Mets",
    "score2": 4.36,
    "margin": 2.21
  },
  "agreement": true,
  "resultMatch": {
    "oldCorrect": true,
    "newCorrect": true
  }
}
```

## Running the Tests

```bash
cd /home/kp10toes/The-Firmament
pnpm vitest run server/test-ab-comparison.ts
```

This will:
1. Load test games (4 validated games to start)
2. Run each game through BOTH systems
3. Output side-by-side predictions
4. Append results to `server/AB_TEST_TRACKER.json`
5. Print summary at the end

## Interpreting Results

### Key Metrics

- **Agreement**: Do both systems predict the same winner?
- **Correctness**: Does each system predict the actual winner?
- **Margin**: How confident is the prediction (gap between sides)?
- **Both Correct**: Rare — indicates consistent strength
- **Split Decision**: Old predicts A, new predicts B, but only one is right

### Expected Patterns

**Old System (Additive)**:
- Simpler scoring
- Larger margins (can swing from -8 to +12)
- Based on classical horary rules
- No Vedic nakshatras

**New System (Multiplicative)**:
- More granular multiplier stacking
- Smaller margins (can be 0.5 to 5)
- Includes Vedic layers (nakshatras, friction, fixed stars)
- Theoretically captures more nuance

## Adding New Games

Edit `test-ab-comparison.ts` and add entries to the `games` array:

```typescript
{
  name: "Team A vs Team B",
  date: new Date(Date.UTC(2026, 6, 20, 19, 30, 0)),  // UTC
  location: { lat: 40.7128, lon: -74.0060 },         // NYC
  favorite: "Team A",
  underdog: "Team B",
  actualWinner: "Team B",
  actualScore: "2-1",
},
```

Then run the test again — results append to the tracker.

## Tracker File

- **Location**: `server/AB_TEST_TRACKER.json`
- **Format**: JSON array of test results
- **Auto-updated**: Each test run appends new entries
- **Never overwritten**: Safe to run multiple times on same games (will have duplicates; that's intentional for variance testing)

## Decision Criteria

Once you have 5–10 games:

1. **Count wins**: Old vs New, raw accuracy
2. **Check agreement**: When they disagree, which is right?
3. **Analyze margins**: Does Old's large margin correlate with correctness? Does New's precision?
4. **Look for patterns**: Any systematic bias? (e.g., old always favors one side)

## Constraints

- **Dates must be in the past** (ephemeris data availability)
- **Actual results must be known** (for comparison)
- **Both systems must be compiled** before running (check `pnpm check`)

## Next Steps

1. Run initial 4 games
2. Review results and agreement/correctness stats
3. Add 2–3 more games from different sports/dates
4. Compare accumulated data
5. Based on results, decide: keep both systems, merge, or retire one
