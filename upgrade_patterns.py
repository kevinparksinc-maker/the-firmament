#!/usr/bin/env python3
"""
Upgrades summarizePillarRich.ts pattern detectors (grand trine, stellium,
t-square, grand cross) with modality flavor + house-arena breakdowns.

Usage:
  python3 upgrade_patterns.py /path/to/summarizePillarRich.ts

It edits the file in place (after making a .bak backup) by:
  1. Adding MODALITY map + HOUSE_ARENA helper + modality-flavor text constants
  2. Replacing the `groundedMeaning` lines in detectGrandTrines, detectStelliums,
     detectTSquares, detectGrandCross with versions that pull in modality + houses
  3. Adding `modality` field to the NatalPattern interface
"""
import sys, re, shutil

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 upgrade_patterns.py /path/to/summarizePillarRich.ts")
        sys.exit(1)

    path = sys.argv[1]
    shutil.copy(path, path + ".bak")
    with open(path, "r") as f:
        src = f.read()

    # 1. Add modality map + helpers right after SIGN_ELEMENTS
    modality_block = '''
const SIGN_MODALITY: Record<string, 'cardinal' | 'fixed' | 'mutable'> = {
  Aries:'cardinal', Cancer:'cardinal', Libra:'cardinal', Capricorn:'cardinal',
  Taurus:'fixed', Leo:'fixed', Scorpio:'fixed', Aquarius:'fixed',
  Gemini:'mutable', Virgo:'mutable', Sagittarius:'mutable', Pisces:'mutable',
};

const MODALITY_FLAVOR: Record<'cardinal' | 'fixed' | 'mutable', string> = {
  cardinal: "This runs cardinal — it shows up as constant initiating and re-initiating. You start things, hit a wall, start again. The pressure expresses through action and restlessness rather than sitting still with it.",
  fixed: "This runs fixed — it shows up as immovable obligation. The pressure doesn't move easily once it's set, for better or worse. You can hold this for a long time, but it can also calcify into stubborn endurance past the point it's useful.",
  mutable: "This runs mutable — it shows up as mental and identity scattering more than a hard external block. The tension is less 'wall in front of you' and more 'pulled in too many directions to settle.'",
};

function getPatternModality(natal: Record<string, PlanetPlacement>, planets: string[]): 'cardinal' | 'fixed' | 'mutable' | 'mixed' {
  const modalities = planets.map(name => {
    const p = natal[name];
    return p ? SIGN_MODALITY[p.sign] : undefined;
  }).filter(Boolean) as ('cardinal' | 'fixed' | 'mutable')[];
  if (modalities.length === 0) return 'mixed';
  const first = modalities[0];
  return modalities.every(m => m === first) ? first : 'mixed';
}

function describeHouseArenas(natal: Record<string, PlanetPlacement>, planets: string[]): string {
  const houseList = planets
    .map(name => {
      const p = natal[name];
      if (!p?.house) return null;
      const theme = HOUSE_THEMES[p.house] ?? `the ${p.house}th house`;
      return `${name} (${ordinal(p.house)} house — ${theme})`;
    })
    .filter(Boolean) as string[];
  if (houseList.length < 2) return '';
  return `In real life this lands across: ${houseList.join('; ')}. When one of these planets is activated by transit, the life arena it governs gets pulled into the others — it rarely stays contained to one area.`;
}
'''
    src = src.replace(
        "const SIGN_ELEMENTS: Record<string, string> = {",
        modality_block.strip() + "\n\nconst SIGN_ELEMENTS: Record<string, string> = {",
        1
    )

    # 2. Add `modality` field to NatalPattern interface
    src = src.replace(
        "export interface NatalPattern {\n  type: 'grand-trine' | 'stellium' | 't-square' | 'grand-cross';\n  planets: string[];\n  element?: string;\n  sign?: string;\n  description: string;\n  groundedMeaning: string;\n}",
        "export interface NatalPattern {\n  type: 'grand-trine' | 'stellium' | 't-square' | 'grand-cross';\n  planets: string[];\n  element?: string;\n  sign?: string;\n  modality?: 'cardinal' | 'fixed' | 'mutable' | 'mixed';\n  description: string;\n  groundedMeaning: string;\n}"
    )

    # 3. Upgrade detectGrandTrines groundedMeaning
    old_trine = '''          patterns.push({ type:'grand-trine', planets:[nameA,nameB,nameC], element, description:`Grand ${element} trine: ${nameA} · ${nameB} · ${nameC}`, groundedMeaning:`You have a closed circuit of ${element} energy between your ${nameA}, ${nameB}, and ${nameC}. These three naturally support each other. When something hits one of these planets hard, all three feel it.` });'''
    new_trine = '''          const modality = getPatternModality(natal, [nameA, nameB, nameC]);
          const houseArenas = describeHouseArenas(natal, [nameA, nameB, nameC]);
          const modalityNote = modality !== 'mixed' ? ` ${MODALITY_FLAVOR[modality]}` : '';
          patterns.push({ type:'grand-trine', planets:[nameA,nameB,nameC], element, modality, description:`Grand ${element} trine: ${nameA} · ${nameB} · ${nameC}`, groundedMeaning:`You have a closed circuit of ${element} energy between your ${nameA}, ${nameB}, and ${nameC}. These three naturally support each other — strength in one feeds the others, and this is one of the more stabilizing structures a chart can have.${modalityNote} ${houseArenas} When something hits one of these planets hard, all three feel it; when something supports one, the whole circuit lights up.` });'''
    if old_trine not in src:
        print("WARNING: grand-trine groundedMeaning block not found verbatim — skipping that replacement.")
    else:
        src = src.replace(old_trine, new_trine)

    # 4. Upgrade detectStelliums groundedMeaning
    old_stellium = '''  return Object.entries(bySig).filter(([,planets]) => planets.length >= 3).map(([sign, planets]) => ({
    type: 'stellium' as const, planets, sign, description:`Stellium in ${sign}: ${planets.join(' · ')}`,
    groundedMeaning:`You have ${planets.length} planets concentrated in ${sign}. Everything those planets represent — ${planets.join(', ')} — operates through the lens of ${sign}. When a transit moves through ${sign}, it doesn't hit one planet. It hits all of them at once.`
  }));'''
    new_stellium = '''  return Object.entries(bySig).filter(([,planets]) => planets.length >= 3).map(([sign, planets]) => {
    const modality = SIGN_MODALITY[sign];
    const houseArenas = describeHouseArenas(natal, planets);
    return {
      type: 'stellium' as const, planets, sign, modality, description:`Stellium in ${sign}: ${planets.join(' · ')}`,
      groundedMeaning:`You have ${planets.length} planets concentrated in ${sign}. Everything those planets represent — ${planets.join(', ')} — operates through the lens of ${sign}. ${MODALITY_FLAVOR[modality]} ${houseArenas} When a transit moves through ${sign}, it doesn't hit one planet. It hits all of them at once — this is concentrated, not scattered, intensity.`
    };
  });'''
    if old_stellium not in src:
        print("WARNING: stellium groundedMeaning block not found verbatim — skipping that replacement.")
    else:
        src = src.replace(old_stellium, new_stellium)

    # 5. Upgrade detectTSquares groundedMeaning
    old_tsquare = '''          patterns.push({ type:'t-square', planets:[nameA,nameB,nameC], description:`T-Square: ${nameA} opposition ${nameB}, both square ${nameC}`, groundedMeaning:`${nameA} and ${nameB} are in direct opposition, and both are squaring ${nameC}. ${nameC} is the focal point — it receives pressure from both sides. This produces tremendous drive but friction that seems to come out of nowhere.` });'''
    new_tsquare = '''          const modality = getPatternModality(natal, [nameA, nameB, nameC]);
          const houseArenas = describeHouseArenas(natal, [nameA, nameB, nameC]);
          const modalityNote = modality !== 'mixed' ? ` ${MODALITY_FLAVOR[modality]}` : '';
          patterns.push({ type:'t-square', planets:[nameA,nameB,nameC], modality, description:`T-Square: ${nameA} opposition ${nameB}, both square ${nameC}`, groundedMeaning:`${nameA} and ${nameB} are in direct opposition, and both are squaring ${nameC}. ${nameC} is the focal point — it receives pressure from both sides and is usually where this pattern gets lived out and resolved.${modalityNote} ${houseArenas} This produces tremendous drive but friction that can seem to come out of nowhere if you don't know the structure is there.` });'''
    if old_tsquare not in src:
        print("WARNING: t-square groundedMeaning block not found verbatim — skipping that replacement.")
    else:
        src = src.replace(old_tsquare, new_tsquare)

    # 6. Upgrade detectGrandCross groundedMeaning
    old_gcross = '''            patterns.push({ type:'grand-cross', planets:names, description:`Grand Cross: ${names.join(' · ')}`, groundedMeaning:`Four planets locked in a box of squares and oppositions. Pressure comes from four directions simultaneously. When a transit activates any one of these four points, all four light up.` });'''
    new_gcross = '''            const modality = getPatternModality(natal, names);
            const houseArenas = describeHouseArenas(natal, names);
            const modalityNote = modality !== 'mixed' ? ` ${MODALITY_FLAVOR[modality]}` : ' This one mixes modalities, so the pressure doesn\\'t express in just one way — it can shift character depending on which point is currently being activated.';
            patterns.push({ type:'grand-cross', planets:names, modality, description:`Grand Cross: ${names.join(' · ')}`, groundedMeaning:`Four planets locked in a box of squares and oppositions. Pressure comes from four directions simultaneously, with no clean release valve in the structure itself.${modalityNote} ${houseArenas} When a transit activates any one of these four points, all four light up — this is one of the most demanding structures a chart can carry, but it also tends to produce people who can hold an enormous amount without breaking, because they've had no choice but to build that capacity.` });'''
    if old_gcross not in src:
        print("WARNING: grand-cross groundedMeaning block not found verbatim — skipping that replacement.")
    else:
        src = src.replace(old_gcross, new_gcross)

    with open(path, "w") as f:
        f.write(src)

    print(f"Done. Backup saved at {path}.bak")

if __name__ == "__main__":
    main()
