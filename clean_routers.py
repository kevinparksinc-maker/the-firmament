import re

# Read the file
with open('server/routers.ts', 'r') as f:
    content = f.read()

# ------------------------------------------------------------------
# 1. Remove all existing CRISIS DETECTION blocks (the broken ones)
# ------------------------------------------------------------------
content = re.sub(
    r'\s*// ─── CRISIS DETECTION ─────────────────────────────────────────────────────────\s*const transitAspects = calculateAspects\(result\.planets, result\.planets\);\s*const crisisResult = crisisEngine\.analyze\(transitAspects\);',
    '',
    content
)

# Remove duplicate crisis: lines (keep only the one inside ephemerisRouter return)
# We'll remove all crisis: lines outside the ephemerisRouter return block
lines = content.split('\n')
new_lines = []
in_ephemeris_return = False
ephemeris_count = 0

for i, line in enumerate(lines):
    # Detect start of ephemerisRouter.calculate
    if 'ephemerisRouter = router({' in line:
        ephemeris_count += 1
    if ephemeris_count == 1 and 'return {' in line:
        in_ephemeris_return = True
    if in_ephemeris_return and 'return {' in line and i > 0:
        # we are inside the return block
        pass
    if in_ephemeris_return and '};' in line and 'return' not in line:
        in_ephemeris_return = False
    # Keep crisis: lines only if inside ephemeris return
    if 'crisis:' in line and not in_ephemeris_return:
        continue
    new_lines.append(line)

content = '\n'.join(new_lines)

# ------------------------------------------------------------------
# 2. Add import if missing
# ------------------------------------------------------------------
if 'import { crisisEngine }' not in content:
    # Insert after the first import (after the initial block)
    insert_pos = content.find('import { invokeLLM }')
    if insert_pos != -1:
        end_of_line = content.find('\n', insert_pos)
        content = content[:end_of_line+1] + 'import { crisisEngine } from "./crisisEngine";\n' + content[end_of_line+1:]

# ------------------------------------------------------------------
# 3. Add calculateAspects if missing
# ------------------------------------------------------------------
if 'function calculateAspects' not in content:
    # Find ZODIAC_SIGNS array and insert after it
    match = re.search(r'(const ZODIAC_SIGNS = \[[^\]]*\];)', content)
    if match:
        aspect_calc = '''

function getAbsoluteDegree(sign: string, degree: number): number {
  const signIndex = ZODIAC_SIGNS.indexOf(sign);
  return signIndex * 30 + degree;
}

function calculateAspects(
  transitPlanets: any[],
  natalPlanets: any[]
): any[] {
  const aspects: any[] = [];
  const aspectTypes = [
    { name: 'conjunction', angle: 0, orb: 8 },
    { name: 'opposition', angle: 180, orb: 8 },
    { name: 'square', angle: 90, orb: 8 },
    { name: 'trine', angle: 120, orb: 8 },
    { name: 'sextile', angle: 60, orb: 6 },
  ];

  for (const t of transitPlanets) {
    if (!t.sign || t.degreeInSign === undefined) continue;
    const tAbs = getAbsoluteDegree(t.sign, t.degreeInSign);
    for (const n of natalPlanets) {
      if (!n.sign || n.degree === undefined) continue;
      const nAbs = getAbsoluteDegree(n.sign, n.degree);
      let diff = Math.abs(tAbs - nAbs) % 360;
      if (diff > 180) diff = 360 - diff;
      for (const aspect of aspectTypes) {
        const orbDiff = Math.abs(diff - aspect.angle);
        if (orbDiff <= aspect.orb) {
          aspects.push({
            planet: t.name,
            aspect: aspect.name,
            orb: orbDiff,
            house: t.house || 0,
            targetPlanet: n.name,
            targetHouse: n.house || 0,
            isRetrograde: t.retrograde || false,
          });
        }
      }
    }
  }
  return aspects;
}
'''
        # Insert after the ZODIAC_SIGNS declaration
        content = content.replace(match.group(0), match.group(0) + aspect_calc)

# ------------------------------------------------------------------
# 4. Add crisis detection inside ephemerisRouter.calculate
# ------------------------------------------------------------------
# Find the line with 'const enrichedText = enrichChartData('
# and insert after the closing ');' of that call
pattern = r'(const enrichedText = enrichChartData\([^;]*\);)(.*?)(return \{)'
replacement = r'\1\n\n  // ─── CRISIS DETECTION ─────────────────────────────────────────────────────────\n  const transitAspects = calculateAspects(result.planets, result.planets);\n  const crisisResult = crisisEngine.analyze(transitAspects);\n\3'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# ------------------------------------------------------------------
# 5. Add crisis to the return object
# ------------------------------------------------------------------
# Find the return object inside ephemerisRouter and add crisis after readingText
# Look for 'readingText,' and add 'crisis: crisisResult,' after it
# We'll use a more precise approach: find the return block
ephemeris_pattern = r'(return \{[\s\S]*?readingText,)([\s\S]*?)(\n  \})'
def add_crisis(match):
    before = match.group(1)
    middle = match.group(2)
    after = match.group(3)
    # If crisis already there, skip
    if 'crisis:' in middle:
        return match.group(0)
    # Insert crisis after readingText
    return before + '\n  crisis: crisisResult,' + middle + after

content = re.sub(ephemeris_pattern, add_crisis, content, flags=re.DOTALL)

# ------------------------------------------------------------------
# 6. Write the file
# ------------------------------------------------------------------
with open('server/routers.ts', 'w') as f:
    f.write(content)

print("✅ routers.ts has been cleaned and crisis detection wired correctly.")
print("Run 'pnpm run build' to test.")
