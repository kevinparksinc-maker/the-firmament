import re

with open('server/routers.ts', 'r') as f:
    content = f.read()

# 1. Add import if missing
if 'import { crisisEngine }' not in content:
    content = 'import { crisisEngine } from "./crisisEngine";\n' + content

# 2. Add calculateAspects function (but NOT ZODIAC_SIGNS since it already exists)
if 'function calculateAspects' not in content:
    # Find ZODIAC_SIGNS and insert after it
    insert_point = content.find('const ZODIAC_SIGNS = [')
    if insert_point != -1:
        # Find the end of the array
        end_array = content.find('];', insert_point)
        if end_array != -1:
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
            content = content[:end_array+2] + aspect_calc + content[end_array+2:]

# 3. Add crisis detection in ephemerisRouter
pattern = r'(const enrichedText = enrichChartData\([^;]*\);)(.*?)(return \{)'
replacement = r'\1\n\n  // ─── CRISIS DETECTION ─────────────────────────────────────────────────────────\n  const transitAspects = calculateAspects(result.planets, result.planets);\n  const crisisResult = crisisEngine.analyze(transitAspects);\n\3'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# 4. Add crisis to return
content = re.sub(
    r'(return \{)(.*?)(readingText,)(.*?)(\n  \})',
    r'\1\2\3\4\n  crisis: crisisResult,\5',
    content,
    flags=re.DOTALL
)

with open('server/routers.ts', 'w') as f:
    f.write(content)

print("✅ Fixed! Run pnpm run build")
