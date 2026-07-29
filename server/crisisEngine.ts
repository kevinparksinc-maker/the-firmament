// server/crisisEngine.ts
// Crisis Detection Engine — Identifies extreme transit activations

export interface TransitAspect {
  planet: string;
  aspect: string;
  orb: number;
  house: number;
  targetPlanet?: string;
  targetHouse?: number;
  isRetrograde?: boolean;
}

export interface CrisisResult {
  score: number;
  isCrisis: boolean;
  severity: 'EXTREME' | 'SEVERE' | 'CRITICAL' | 'MODERATE' | 'NORMAL';
  icon: string;
  triggers: string[];
  activatedHouses: number[];
  crisisPatterns: string[];
  recommendation: string;
  isDeathReturnEvent: boolean;
  deathReturnMessage?: string;
  stelliumHouses: Record<number, string[]>;
  rawBreakdown: any[];
}

export class CrisisDetectionEngine {
  private readonly CRISIS_THRESHOLD = 200;

  private readonly planetWeights: Record<string, number> = {
    mars: 10, saturn: 9, pluto: 9, uranus: 8,
    rahu: 8, ketu: 8, neptune: 6, sun: 5,
    moon: 4, jupiter: 4, venus: 2, mercury: 2,
  };

  private readonly houseWeights: Record<number, number> = {
    1: 10, 8: 10, 6: 8, 12: 7, 4: 5, 10: 5,
  };

  private readonly aspectWeights: Record<string, number> = {
    conjunction: 10, opposition: 9, square: 8, trine: 3, sextile: 2,
  };

  private readonly CRISIS_HOUSES = [1, 6, 8, 12];

  analyze(transits: TransitAspect[]): CrisisResult {
    let score = 0;
    const triggers: string[] = [];
    const activatedHouses = new Set<number>();
    const crisisPatterns: string[] = [];
    const stelliumHouses: Record<number, string[]> = {};
    const breakdown: any[] = [];

    // ─── STELLIUM DETECTION ──────────────────────────────────────────────
    const houseGroups: Record<number, string[]> = {};
    for (const t of transits) {
      const house = t.house || 0;
      if (!houseGroups[house]) houseGroups[house] = [];
      houseGroups[house].push(t.planet);
    }

    for (const [house, planets] of Object.entries(houseGroups)) {
      const h = parseInt(house);
      if (planets.length >= 3) {
        crisisPatterns.push('stellium_activation');
        stelliumHouses[h] = planets;
        triggers.push(`⭐ STELLIUM: ${planets.length} planets in House ${h}`);
        if (this.CRISIS_HOUSES.includes(h)) {
          score += 150;
          triggers.push(`🔥 CRISIS STELLIUM in House ${h}`);
        }
      }
    }

    // ─── MAIN TRANSIT ANALYSIS ──────────────────────────────────────────
    for (const transit of transits) {
      const orb = Math.abs(transit.orb);
      if (orb > 5) continue;

      let orbWeight: number;
      let orbLabel: string;
      if (orb <= 0.5) { orbWeight = 10; orbLabel = 'EXACT'; }
      else if (orb <= 1.0) { orbWeight = 7; orbLabel = 'CRITICAL'; }
      else if (orb <= 2.0) { orbWeight = 4; orbLabel = 'MAJOR'; }
      else { orbWeight = 2; orbLabel = 'MODERATE'; }

      const planet = transit.planet.toLowerCase();
      let planetWeight = this.planetWeights[planet] || 1;
      const aspectWeight = this.aspectWeights[transit.aspect.toLowerCase()] || 5;

      // Check BOTH transit house AND target house for crisis activation
      const transitHouse = transit.house || 0;
      const targetHouse = transit.targetHouse || 0;

      // Use the higher weight house (transit or target)
      let houseWeight = Math.max(
        this.houseWeights[transitHouse] || 1,
        this.houseWeights[targetHouse] || 1
      );

      // Track both houses for activation
      if (this.CRISIS_HOUSES.includes(transitHouse)) {
        activatedHouses.add(transitHouse);
      }
      if (this.CRISIS_HOUSES.includes(targetHouse)) {
        activatedHouses.add(targetHouse);
      }

      // Node on angle detection
      if (['rahu', 'ketu'].includes(planet)) {
        if ([1, 4, 7, 10].includes(transitHouse) || [1, 4, 7, 10].includes(targetHouse)) {
          crisisPatterns.push('node_on_angle');
          planetWeight += 12;
          const angle = [1, 4, 7, 10].includes(transitHouse) ? transitHouse : targetHouse;
          const angleName = { 1: 'ASCENDANT', 4: 'IC', 7: 'DESCENDANT', 10: 'MC' }[angle] || '';
          triggers.push(`☊ ${planet.toUpperCase()} on ${angleName} — karmic body event`);
          if (angle === 1 || angle === 7) score += 100;
        }
      }

      // Retrograde in crisis house
      if (transit.isRetrograde && this.CRISIS_HOUSES.includes(transitHouse)) {
        triggers.push(`🔄 ${transit.planet} RETROGRADE in House ${transitHouse}`);
        score += 30;
      }

      const contribution = orbWeight * planetWeight * aspectWeight * houseWeight;
      score += contribution;

      breakdown.push({ planet, orb, transitHouse, targetHouse, contribution });

      if (contribution >= 100) {
        let trigger = `${planet.toUpperCase()} ${transit.aspect.toUpperCase()} at ${orb.toFixed(2)}° (${orbLabel})`;
        if (transit.targetPlanet) {
          trigger += ` → ${transit.targetPlanet.toUpperCase()}`;
        }
        if (this.CRISIS_HOUSES.includes(transitHouse)) {
          trigger += ` [House ${transitHouse} → ${targetHouse}]`;
        }
        triggers.push(trigger);
      }
    }

    // ─── MULTI-AXIS CONVERGENCE ─────────────────────────────────────────
    const crisisHouses = [...activatedHouses].filter(h => this.CRISIS_HOUSES.includes(h));
    if (crisisHouses.length >= 2) {
      score += 100;
      triggers.push(`⚡ CONVERGENCE: Houses ${crisisHouses.join(', ')} active`);
      crisisPatterns.push('angular_house_activation');
    }
    if (crisisHouses.length >= 3) {
      score += 200;
      triggers.push('⚠️ THREE MORTALITY AXES CONVERGING');
      crisisPatterns.push('angular_house_activation');
    }

    // ─── DETERMINE SEVERITY ─────────────────────────────────────────────
    let severity: CrisisResult['severity'] = 'NORMAL';
    let icon = '•';
    if (score >= 1000) { severity = 'EXTREME'; icon = '⚠️⚠️⚠️'; }
    else if (score >= 500) { severity = 'SEVERE'; icon = '⚠️⚠️'; }
    else if (score >= 200) { severity = 'CRITICAL'; icon = '⚠️'; }
    else if (score >= 50) { severity = 'MODERATE'; icon = '⚡'; }

    // ─── DEATH-AND-RETURN DETECTION ────────────────────────────────────
    // Requires: House 1 AND House 8 activated, score >= 500
    const hasHouse1 = activatedHouses.has(1);
    const hasHouse8 = activatedHouses.has(8);
    const isDeathReturn = score >= 500 && hasHouse1 && hasHouse8;

    let deathReturnMessage: string | undefined;
    if (isDeathReturn) {
      crisisPatterns.push('death_return_event');
      deathReturnMessage =
        '⚠️ The sky shows a rare convergence on your physical body (House 1) ' +
        'and 8th house of mortality. This is the signature of a death‑and‑return event.';
      triggers.unshift('☠️ DEATH‑AND‑RETURN SIGNATURE DETECTED');
    }

    const uniquePatterns = [...new Set(crisisPatterns)];

    return {
      score,
      isCrisis: score >= this.CRISIS_THRESHOLD,
      severity,
      icon,
      triggers: triggers.slice(0, 15),
      activatedHouses: crisisHouses,
      crisisPatterns: uniquePatterns,
      recommendation: this.getRecommendation(severity, uniquePatterns),
      isDeathReturnEvent: isDeathReturn,
      deathReturnMessage,
      stelliumHouses,
      rawBreakdown: breakdown,
    };
  }

  private getRecommendation(severity: string, patterns: string[]): string {
    const base = {
      EXTREME: '⚠️ This is a significant life event. Rest and stay close to trusted people.',
      SEVERE: '⚠️ This is a major threshold crossing. Pay close attention to your body.',
      CRITICAL: '⚠️ This is a significant transit day. Practice grounding and self-care.',
      MODERATE: '⚡ Noticeable transit activation.',
      NORMAL: 'Normal transit day — no crisis-level patterns detected.',
    }[severity] || 'Normal transit day.';

    const advice = [];
    if (patterns.includes('death_return_event')) advice.push('⚰️ Death-and-return event — trust your survival instincts.');
    if (patterns.includes('stellium_activation')) advice.push('🔥 Multiple planets are clustered.');
    if (patterns.includes('node_on_angle')) advice.push('☊ The karmic axis is on an angle.');
    if (patterns.includes('angular_house_activation')) advice.push('⚡ Multiple crisis houses activated.');

    return base + (advice.length ? ' ' + advice.join(' ') : '');
  }
}

export const crisisEngine = new CrisisDetectionEngine();
