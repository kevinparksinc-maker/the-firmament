import re

with open('server/routers.ts', 'r') as f:
    content = f.read()

# Add calculateAspects function if missing
if 'function calculateAspects' not in content:
    aspect_calc = '''

// ─── Aspect Calculator ─────────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

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
    # Insert after COSMOLOGY_PREAMBLE
    content = content.replace('const COSMOLOGY_PREAMBLE', aspect_calc + '\nconst COSMOLOGY_PREAMBLE')

# Find the ephemerisRouter.calculate function and add crisis detection
# Look for the line after enrichedText
pattern = r'(const enrichedText = enrichChartData\([^;]*\);)(.*?)(return \{)'
replacement = r'\1\n\n  // ─── CRISIS DETECTION ─────────────────────────────────────────────────────────\n  const transitAspects = calculateAspects(result.planets, result.planets);\n  const crisisResult = crisisEngine.analyze(transitAspects);\n\3'

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Add crisis to the return object
content = re.sub(
    r'(return \{)(.*?)(readingText,)(.*?)(\n  \})',
    r'\1\2\3\4\n  crisis: crisisResult,\5',
    content,
    flags=re.DOTALL
)

with open('server/routers.ts', 'w') as f:
    f.write(content)

print("✅ Crisis detection added to routers.ts!")
