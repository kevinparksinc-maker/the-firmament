#!/usr/bin/env python3
"""
KP Sub‑Lord Integration Script
Adds K.P. Astrology sub‑lord layer to your TypeScript codebase.
Run: python3 add_kp_sublords.py
"""

import os
import re
from pathlib import Path

# ------------------------------------------------------------
# 1. CREATE server/kp/subLords.ts
# ------------------------------------------------------------
KP_SUBLORD_FILE = """// server/kp/subLords.ts
// KP Sub-Lord System — Each nakshatra is divided into 9 parts,
// each ruled by a planet in a fixed sequence.
// No offset needed — nakshatras are already fixed in the dome.

const SUB_LORD_SEQUENCE = [
  'Ketu',    // 1
  'Sun',     // 2
  'Moon',    // 3
  'Mars',    // 4
  'Rahu',    // 5
  'Jupiter', // 6
  'Saturn',  // 7
  'Mercury', // 8
  'Venus'    // 9
] as const;

const NAKSHATRA_SIZE = 360 / 27; // 13.3333333333°
const SUB_LORD_SIZE = NAKSHATRA_SIZE / 9; // 1.48148148148° (~1°28′53″)

export interface SubLordResult {
  lord: string;
  index: number;          // 0-8
  startDegree: number;    // Absolute degree where this sub-lord starts
  endDegree: number;      // Absolute degree where this sub-lord ends
  nakshatraIndex: number; // 0-26
  subLordNumber: number;  // 1-9 (human-readable)
}

/**
 * Get the sub-lord for a given ecliptic longitude (sidereal, 0-360°)
 * No offset needed — nakshatras are already fixed in the dome.
 */
export function getSubLord(eclipticLon: number): SubLordResult {
  const deg = ((eclipticLon % 360) + 360) % 360;
  
  const nakshatraIndex = Math.floor(deg / NAKSHATRA_SIZE);
  const offsetInNakshatra = deg % NAKSHATRA_SIZE;
  const subLordIndex = Math.floor(offsetInNakshatra / SUB_LORD_SIZE);
  const index = Math.min(subLordIndex, 8);
  
  const startDegree = (nakshatraIndex * NAKSHATRA_SIZE) + (index * SUB_LORD_SIZE);
  const endDegree = startDegree + SUB_LORD_SIZE;
  
  return {
    lord: SUB_LORD_SEQUENCE[index],
    index: index,
    startDegree: startDegree,
    endDegree: endDegree,
    nakshatraIndex: nakshatraIndex,
    subLordNumber: index + 1
  };
}

/**
 * Get sub-lord for a specific planet position
 * Extends the existing nakshatra data
 */
export function getSubLordForPlanet(
  planetName: string,
  eclipticLon: number,
  nakshatraName: string
): SubLordResult & { planetName: string; nakshatraName: string } {
  const subLord = getSubLord(eclipticLon);
  return {
    ...subLord,
    planetName,
    nakshatraName
  };
}
"""

# ------------------------------------------------------------
# 2. MODIFY server/nakshatra.ts
# ------------------------------------------------------------
def modify_nakshatra():
    path = Path('server/nakshatra.ts')
    if not path.exists():
        print("⚠️ server/nakshatra.ts not found — skipping modification")
        return False

    with open(path, 'r') as f:
        content = f.read()

    # Check if already modified
    if 'getNakshatraAndSubLordAt' in content:
        print("ℹ️ server/nakshatra.ts already has sub-lord support — skipping")
        return True

    # Add import for getSubLord
    import_line = "import { getSubLord } from './kp/subLords';"
    # Insert after the last import (we'll find first line that's not import)
    lines = content.split('\n')
    insert_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import ') or line.startswith('//'):
            insert_idx = i + 1
        else:
            break
    lines.insert(insert_idx, import_line)
    lines.insert(insert_idx + 1, '')

    # Add the new function after the existing getNakshatraAt
    # Find the end of getNakshatraAt function
    func_end = None
    for i, line in enumerate(lines):
        if 'export function getNakshatraAt' in line:
            # find closing brace of function
            brace_count = 0
            for j in range(i, len(lines)):
                if '{' in lines[j]:
                    brace_count += lines[j].count('{')
                if '}' in lines[j]:
                    brace_count -= lines[j].count('}')
                    if brace_count == 0:
                        func_end = j
                        break
            break

    if func_end is None:
        print("⚠️ Could not find getNakshatraAt function in nakshatra.ts — manual intervention needed")
        return False

    # Insert new interface and function after that
    new_code = '''

export interface NakshatraWithSubLord extends Nakshatra {
  subLord: string;
  subLordIndex: number;
}

export function getNakshatraAndSubLordAt(absDeg: number): {
  nakshatra: Nakshatra;
  pada: number;
  subLord: string;
  subLordIndex: number;
} {
  const result = getNakshatraAt(absDeg);
  const subLordData = getSubLord(absDeg);
  return {
    ...result,
    subLord: subLordData.lord,
    subLordIndex: subLordData.index,
  };
}
'''
    lines.insert(func_end + 1, new_code)

    # Write back
    with open(path, 'w') as f:
        f.write('\n'.join(lines))
    print("✅ Modified server/nakshatra.ts")
    return True

# ------------------------------------------------------------
# 3. MODIFY server/nakshatraStarEngine.ts
# ------------------------------------------------------------
def modify_nakshatra_star_engine():
    path = Path('server/nakshatraStarEngine.ts')
    if not path.exists():
        print("⚠️ server/nakshatraStarEngine.ts not found — skipping modification")
        return False

    with open(path, 'r') as f:
        content = f.read()

    # Check if already has sub-lord functions
    if 'getSubLordMultiplier' in content:
        print("ℹ️ server/nakshatraStarEngine.ts already has sub-lord scoring — skipping")
        return True

    # Add import for getSubLord at top
    import_line = "import { getSubLord } from './kp/subLords';"
    if 'import { getSubLord }' not in content:
        lines = content.split('\n')
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('//'):
                insert_idx = i + 1
            else:
                break
        lines.insert(insert_idx, import_line)
        lines.insert(insert_idx + 1, '')
        content = '\n'.join(lines)

    # Append new functions at the end (before any export if present, else at end)
    new_functions = '''

// ─────────────────────────────────────────────────────────────────────────
// KP SUB-LORD SCORING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sub-lord strength multiplier for sports predictions
 * Each sub-lord has a different effect depending on the house/context
 */
export function getSubLordMultiplier(
  subLord: string,
  house: number,
  context: 'offensive' | 'defensive' | 'execution'
): number {
  // Offensive strength (scoring, attacking)
  const offensive: Record<string, number> = {
    'Sun': 1.3,
    'Mars': 1.4,
    'Jupiter': 1.2,
    'Venus': 1.1,
    'Ketu': 0.9,
    'Moon': 1.0,
    'Mercury': 1.0,
    'Rahu': 0.8,
    'Saturn': 0.7,
  };
  
  // Defensive strength (blocking, resisting)
  const defensive: Record<string, number> = {
    'Saturn': 1.4,
    'Rahu': 1.3,
    'Ketu': 1.2,
    'Sun': 1.1,
    'Moon': 1.0,
    'Mars': 0.9,
    'Jupiter': 0.9,
    'Venus': 0.8,
    'Mercury': 0.8,
  };
  
  // Execution (finishing, consistency)
  const execution: Record<string, number> = {
    'Mars': 1.4,
    'Sun': 1.3,
    'Saturn': 1.2,
    'Jupiter': 1.1,
    'Mercury': 1.0,
    'Venus': 1.0,
    'Moon': 0.9,
    'Ketu': 0.8,
    'Rahu': 0.7,
  };
  
  const map = context === 'offensive' ? offensive : context === 'defensive' ? defensive : execution;
  return map[subLord] || 1.0;
}

/**
 * Get the sub-lord for a planet and its context-specific multiplier
 */
export function getPlanetSubLordStrength(
  planetName: string,
  eclipticLon: number,
  house: number,
  context: 'offensive' | 'defensive' | 'execution'
): {
  subLord: string;
  subLordIndex: number;
  multiplier: number;
} {
  const subLordData = getSubLord(eclipticLon);
  const multiplier = getSubLordMultiplier(subLordData.lord, house, context);
  return {
    subLord: subLordData.lord,
    subLordIndex: subLordData.index,
    multiplier,
  };
}
'''
    # Append at end of file
    with open(path, 'a') as f:
        f.write(new_functions)
    print("✅ Modified server/nakshatraStarEngine.ts")
    return True

# ------------------------------------------------------------
# 4. (Optional) Add integration hint in sportsHoraryV2Reading.ts
# ------------------------------------------------------------
def modify_sports_reading():
    path = Path('server/sportsHoraryV2Reading.ts')
    if not path.exists():
        print("ℹ️ server/sportsHoraryV2Reading.ts not found — skipping integration hint")
        return

    with open(path, 'r') as f:
        content = f.read()

    # If it already contains a comment about sub-lords, skip
    if '// SUB-LORD INTEGRATION' in content:
        print("ℹ️ sportsHoraryV2Reading.ts already has sub-lord integration — skipping")
        return

    # Add a comment at the top to remind integration
    lines = content.split('\n')
    lines.insert(0, '// SUB-LORD INTEGRATION: To use sub-lord multipliers, import getPlanetSubLordStrength from nakshatraStarEngine and apply to scoring.')
    with open(path, 'w') as f:
        f.write('\n'.join(lines))
    print("✅ Added integration hint to server/sportsHoraryV2Reading.ts")

# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------
def main():
    print("🔄 Applying KP Sub-Lord integration...\n")

    # Create kp directory
    os.makedirs('server/kp', exist_ok=True)

    # Write subLords.ts
    with open('server/kp/subLords.ts', 'w') as f:
        f.write(KP_SUBLORD_FILE)
    print("✅ Created server/kp/subLords.ts")

    # Modify other files
    modify_nakshatra()
    modify_nakshatra_star_engine()
    modify_sports_reading()

    print("\n🎉 All changes applied! Your app now has KP sub-lord support.")
    print("📝 Next steps:")
    print("  1. In your sports prediction engine, call getPlanetSubLordStrength()")
    print("     to get multipliers for each planet.")
    print("  2. Use sub-lord strengths in your scoring logic.")
    print("  3. Run `pnpm run build` to verify TypeScript compilation.")

if __name__ == '__main__':
    main()