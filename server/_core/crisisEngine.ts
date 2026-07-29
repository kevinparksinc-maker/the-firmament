// server/_core/crisisEngine.ts
// Crisis Detection Engine — Full pattern recognition

export interface TransitAspect {
  planet: string;
  aspect: string;
  orb: number;
  house: number;
  targetPlanet?: string;
  targetHouse?: number;
  fixedStar?: string; // If planet is conjunct a fixed star
  isEclipse?: boolean;
  isStation?: boolean;
  isRetrograde?: boolean;
  planetSign?: string; // For stellium detection
  inSign?: string; // Sign the planet is in
}

export interface CrisisResult {
  score: number;
  isCrisis: boolean;
  severity: 'EXTREME' | 'SEVERE' | 'CRITICAL' | 'MODERATE' | 'NORMAL';
  icon: string;
  triggers: string[];
  activatedHouses: number[];
  crisisPatterns: string[]; // NEW: Named patterns detected
  recommendation: string;
  isDeathReturnEvent: boolean;
  deathReturnMessage?: string;
  stelliumHouses: Record<number, string[]>; // NEW: Which houses have stelliums
  rawBreakdown: {
    orbWeight: number;
    planetWeight: number;
    aspectWeight: number;
    houseWeight: number;
    contribution: number;
    pattern?: string; // NEW: What pattern contributed
  }[];
}

export class CrisisDetectionEngine {
  private readonly CRISIS_THRESHOLD = 200;

  private readonly planetWeights: Record<string, number> = {
    // ... same as before
  };

  private readonly houseWeights: Record<number, number> = {
    // ... same as before
  };

  private readonly aspectWeights: Record<string, number> = {
    // ... same as before
  };

  private readonly fixedStarWeights: Record<string, number> = {
    sirius: 20, // Return from death
    antares: 18, // Death-rebirth transformation
    regulus: 15, // Authority challenged
    aldabaran: 14, // Warrior crisis
    betelgeuse: 13, // Sudden destruction/rise
    algol: 15, // Violence, crisis
    spica: 12, // Survival, healing
  };

  private readonly crisisPatterns = {
    DEATH_RETURN: 'death_return_event',
    STELLIUM: 'stellium_activation',
    NODE_ANGLE: 'node_on_angle',
    ECLIPSE: 'eclipse_activation',
    FIXED_STAR: 'fixed_star_activation',
    STATION: 'station_activation',
    HOUSE_OVERLOAD: 'house_overload',
    CHAIN: 'transit_chain',
    ANGULAR_HOUSE: 'angular_house_activation',
    KING_QUEEN: 'king_queen_challenged',
  };

  analyze(transits: TransitAspect[]): CrisisResult {
    let score = 0;
    const triggers: string[] = [];
    const activatedHouses = new Set<number>();
    const crisisPatterns: string[] = [];
    const stelliumHouses: Record<number, string[]> = {};
    const breakdown: CrisisResult['rawBreakdown'] = [];

    // Track stelliums
    const houseGroups: Record<number, string[]> = {};
    for (const transit of transits) {
      const house = transit.house || 0;
      if (!houseGroups[house]) houseGroups[house] = [];
      houseGroups[house].push(transit.planet);
    }

    // Check for stelliums (3+ planets in same house)
    for (const [house, planets] of Object.entries(houseGroups)) {
      if (planets.length >= 3) {
        const h = parseInt(house);
        crisisPatterns.push('stellium_activation');
        stelliumHouses[h] = planets;
        triggers.push(`⭐ STELLIUM: ${planets.length} planets in House ${h} (${planets.join(', ')})`);

        // Extra weight if in crisis houses
        if ([1, 6, 8, 12].includes(h)) {
          score += 150;
          triggers.push(`🔥 CRISIS STELLIUM in House ${h} — amplified danger`);
        }
      }
    }

    // Main transit analysis
    for (const transit of transits) {
      const orb = Math.abs(transit.orb);
      if (orb > 5) continue;

      let orbWeight: number;
      let orbLabel: string;
      if (orb <= 0.5) {
        orbWeight = 10;
        orbLabel = 'EXACT';
      } else if (orb <= 1.0) {
        orbWeight = 7;
        orbLabel = 'CRITICAL';
      } else if (orb <= 2.0) {
        orbWeight = 4;
        orbLabel = 'MAJOR';
      } else {
        orbWeight = 2;
        orbLabel = 'MODERATE';
      }

      const planet = transit.planet.toLowerCase();
      let planetWeight = this.planetWeights[planet] || 1;
      const aspectWeight = this.aspectWeights[transit.aspect.toLowerCase()] || 5;
      const house = transit.house || 0;
      let houseWeight = this.houseWeights[house] || 1;

      // Fixed star weight
      let fixedStarBonus = 0;
      let fixedStarName = '';
      if (transit.fixedStar) {
        const star = transit.fixedStar.toLowerCase();
        fixedStarBonus = this.fixedStarWeights[star] || 0;
        fixedStarName = transit.fixedStar;
        planetWeight += fixedStarBonus;
        crisisPatterns.push('fixed_star_activation');
        triggers.push(`⭐ FIXED STAR: ${transit.planet} conjunct ${fixedStarName} (+${fixedStarBonus} weight)`);
      }

      // Eclipse weight
      if (transit.isEclipse) {
        crisisPatterns.push('eclipse_activation');
        planetWeight += 10;
        triggers.push(`🌑 ECLIPSE: ${planet} ${transit.aspect} to ${transit.targetPlanet || 'natal point'}`);
        if ([1, 6, 8, 12].includes(house)) {
          triggers.push(`🌑 CRISIS ECLIPSE in House ${house}`);
          score += 80;
        }
      }

      // Station weight
      if (transit.isStation) {
        crisisPatterns.push('station_activation');
        planetWeight += 8;
        triggers.push(`🔄 STATION: ${transit.planet} ${transit.isStation === true ? 'stationary direct' : 'stationary retrograde'}`);
        if ([1, 6, 8, 12].includes(house)) {
          score += 60;
        }
      }

      // Retrograde in crisis houses
      if (transit.isRetrograde && [1, 6, 8, 12].includes(house)) {
        triggers.push(`🔄 ${transit.planet} RETROGRADE in House ${house} — internal crisis`);
        score += 30;
      }

      // Node on angle
      if (['rahu', 'ketu'].includes(planet) && [1, 4, 7, 10].includes(house)) {
        crisisPatterns.push('node_on_angle');
        planetWeight += 12;
        const angle = house === 1 ? 'ASCENDANT' : house === 4 ? 'IC' : house === 7 ? 'DESCENDANT' : 'MC';
        triggers.push(`☊ ${planet.toUpperCase()} on ${angle} — karmic body event`);
        if (house === 1 || house === 7) {
          score += 100;
          triggers.push(`☊ ${planet.toUpperCase()} on ${angle} — identity/relationship threshold`);
        }
      }

      // Check for King/Queen of chart
      if (planet === 'sun' && transit.fixedStar === 'Regulus') {
        crisisPatterns.push('king_queen_challenged');
        triggers.push(`👑 Sun conjunct Regulus — authority and identity are being tested`);
        score += 50;
      }
      if (planet === 'moon' && transit.fixedStar === 'Sirius') {
        crisisPatterns.push('king_queen_challenged');
        triggers.push(`🌙 Moon conjunct Sirius — survival instinct activated, return from death`);
        score += 60;
      }
      if (planet === 'mars' && transit.fixedStar === 'Antares') {
        crisisPatterns.push('king_queen_challenged');
        triggers.push(`⚔️ Mars conjunct Antares — warrior death-rebirth event`);
        score += 60;
      }

      const contribution = orbWeight * planetWeight * aspectWeight * houseWeight;
      score += contribution;

      breakdown.push({
        orbWeight,
        planetWeight,
        aspectWeight,
        houseWeight,
        contribution,
        pattern: crisisPatterns[crisisPatterns.length - 1] || 'transit',
      });

      // Track activated crisis houses
      if ([1, 6, 8, 12].includes(house)) {
        activatedHouses.add(house);
      }

      // Build trigger string for significant transits
      if (contribution >= 100) {
        let trigger = `${planet.toUpperCase()} ${transit.aspect.toUpperCase()} at ${orb.toFixed(2)}° (${orbLabel})`;
        if (transit.targetPlanet) {
          trigger += ` → ${transit.targetPlanet.toUpperCase()}`;
        }
        if ([1, 6, 8, 12].includes(house)) {
          trigger += ` [HOUSE ${house}]`;
        }
        triggers.push(trigger);
      }
    }

    // Multi-axis convergence bonus
    const crisisHouses = [...activatedHouses].filter(h => [1, 6, 8, 12].includes(h));
    if (crisisHouses.length >= 2) {
      score += 100;
      triggers.push(`⚡ CONVERGENCE: Houses ${crisisHouses.join(', ')} active`);
      crisisPatterns.push('angular_house_activation');
    }
    if (crisisHouses.length >= 3) {
      score += 200;
      triggers.push('⚠️ THREE MORTALITY AXES CONVERGING — Rare and significant');
      crisisPatterns.push('angular_house_activation');
    }

    // Determine severity
    let severity: CrisisResult['severity'] = 'NORMAL';
    let icon = '•';
    if (score >= 1000) {
      severity = 'EXTREME';
      icon = '⚠️⚠️⚠️';
    } else if (score >= 500) {
      severity = 'SEVERE';
      icon = '⚠️⚠️';
    } else if (score >= 200) {
      severity = 'CRITICAL';
      icon = '⚠️';
    } else if (score >= 50) {
      severity = 'MODERATE';
      icon = '⚡';
    }

    // Death‑and‑return detection
    const isDeathReturnEvent = score >= 500 && activatedHouses.has(1) && activatedHouses.has(8);

    let deathReturnMessage: string | undefined;
    if (isDeathReturnEvent) {
      crisisPatterns.push('death_return_event');
      deathReturnMessage =
        '⚠️ The sky shows a rare convergence on your physical body (House 1) ' +
        'and 8th house of mortality. This is the signature of a death‑and‑return event — ' +
        'a moment where continuity of physical existence was genuinely in question. ' +
        'You are built to come back.';
      triggers.unshift('☠️ DEATH‑AND‑RETURN SIGNATURE DETECTED');
    }

    // Remove duplicate pattern entries
    const uniquePatterns = [...new Set(crisisPatterns)];

    return {
      score,
      isCrisis: score >= this.CRISIS_THRESHOLD,
      severity,
      icon,
      triggers: triggers.slice(0, 10),
      activatedHouses: crisisHouses,
      crisisPatterns: uniquePatterns,
      recommendation: this.getRecommendation(score, severity, uniquePatterns),
      isDeathReturnEvent,
      deathReturnMessage,
      stelliumHouses,
      rawBreakdown: breakdown,
    };
  }

  private getRecommendation(score: number, severity: string, patterns: string[]): string {
    const base = this.baseRecommendation(severity);

    let patternAdvice = '';
    if (patterns.includes('death_return_event')) {
      patternAdvice = ' ⚠️ This is a death-and-return event — rest, ground, and trust your survival instincts.';
    }
    if (patterns.includes('stellium_activation')) {
      patternAdvice += ' 🔥 Multiple planets are clustered — this amplifies everything.';
    }
    if (patterns.includes('eclipse_activation')) {
      patternAdvice += ' 🌑 Eclipse energy — things are being hidden or revealed suddenly.';
    }
    if (patterns.includes('fixed_star_activation')) {
      patternAdvice += ' ⭐ Fixed stars are activated — this is a fated or karmic event.';
    }
    if (patterns.includes('node_on_angle')) {
      patternAdvice += ' ☊ The karmic axis is on an angle — this is a soul-level threshold.';
    }

    return base + patternAdvice;
  }

  private baseRecommendation(severity: string): string {
    switch (severity) {
      case 'EXTREME':
        return '⚠️ This is a significant life event. Rest, avoid unnecessary risks, and stay close to trusted people. The sky is showing a major threshold crossing.';
      case 'SEVERE':
        return '⚠️ This is a major threshold crossing. Pay close attention to your body, environment, and emotional state. Consider reducing non-essential activities.';
      case 'CRITICAL':
        return '⚠️ This is a significant transit day. Be aware of physical and emotional intensity. Practice grounding and self-care.';
      case 'MODERATE':
        return '⚡ Noticeable transit activation. Pay attention but no extreme precautions needed.';
      default:
        return 'Normal transit day — no crisis-level patterns detected.';
    }
  }

  checkDate(transits: TransitAspect[]): { isCrisis: boolean; severity: string; summary: string } {
    const result = this.analyze(transits);
    return {
      isCrisis: result.isCrisis,
      severity: result.severity,
      summary: result.isCrisis
        ? `${result.icon} ${result.severity} — ${result.triggers.slice(0, 3).join('; ')}`
        : 'No crisis-level activations detected.',
    };
  }
}

export const crisisEngine = new CrisisDetectionEngine();