/**
 * Adaptive Disagreement Detector
 * Detects factual, numerical, and logical contradictions across agent claims.
 * INVARIANT: Consensus is NOT truth. Majority vote is NEVER used to override conflicting evidence.
 */

import crypto from 'crypto';
import { AgentClaim, DisagreementRecord, VerificationClassification } from './types.js';

export interface DisagreementAnalysisResult {
  hasDisagreement: boolean;
  disagreements: DisagreementRecord[];
  numericalConflicts: Array<{ metric: string; valA: string; valB: string; agentA: string; agentB: string }>;
  polarityConflicts: Array<{ claimA: string; claimB: string; agentA: string; agentB: string }>;
  consensusRatio: number;
  majorityClaimText?: string;
  isUnsupportedConsensus: boolean;
}

export class AdaptiveDisagreementDetector {
  /**
   * Compare all claims and detect conflicts
   */
  public analyzeDisagreements(claims: AgentClaim[]): DisagreementAnalysisResult {
    const disagreements: DisagreementRecord[] = [];
    const numericalConflicts: Array<{ metric: string; valA: string; valB: string; agentA: string; agentB: string }> = [];
    const polarityConflicts: Array<{ claimA: string; claimB: string; agentA: string; agentB: string }> = [];

    if (claims.length < 2) {
      return {
        hasDisagreement: false,
        disagreements: [],
        numericalConflicts: [],
        polarityConflicts: [],
        consensusRatio: 1.0,
        majorityClaimText: claims[0]?.claimText,
        isUnsupportedConsensus: false,
      };
    }

    // 1. Check for opposing polarities (open vs closed, enable vs disable, true vs false, allow vs deny)
    const polarityPairs: [RegExp, RegExp][] = [
      [/\b(open|opened)\b/i, /\b(closed|close)\b/i],
      [/\b(enable|enabled|allow|allowed)\b/i, /\b(disable|disabled|deny|denied)\b/i],
      [/\b(nominal|safe|pass)\b/i, /\b(critical|exceeded|hazard|fail|danger)\b/i],
      [/\b(mandatory|required)\b/i, /\b(optional|prohibited|forbidden)\b/i],
    ];

    // 2. Numerical extraction (e.g., 450 psi vs 300 psi, 12 hours vs 24 hours)
    const extractNumbersWithUnits = (text: string) => {
      const regex = /(\b\d+(\.\d+)?)\s*([a-zA-Z%]+)?/g;
      const matches: { val: number; unit: string; full: string }[] = [];
      let m;
      while ((m = regex.exec(text)) !== null) {
        matches.push({ val: parseFloat(m[1]), unit: (m[3] || '').toLowerCase(), full: m[0] });
      }
      return matches;
    };

    // Pairwise comparison
    for (let i = 0; i < claims.length; i++) {
      const claimA = claims[i];
      const textA = claimA.claimText;
      const numsA = extractNumbersWithUnits(textA);

      for (let j = i + 1; j < claims.length; j++) {
        const claimB = claims[j];
        const textB = claimB.claimText;
        const numsB = extractNumbersWithUnits(textB);

        // Polarity check
        for (const [reA, reB] of polarityPairs) {
          if ((reA.test(textA) && reB.test(textB)) || (reB.test(textA) && reA.test(textB))) {
            polarityConflicts.push({
              claimA: textA,
              claimB: textB,
              agentA: claimA.agentId,
              agentB: claimB.agentId,
            });

            disagreements.push({
              id: `disagree-pol-${crypto.randomUUID().substring(0, 8)}`,
              topic: 'Operational State Polarity Contradiction',
              competingClaims: [claimA, claimB],
              evidenceFoundInGrounding: false,
              consensusRatio: 0.5,
              consensusVote: 'SPLIT',
              resolutionStatus: 'PENDING_VERIFICATION',
            });
            break;
          }
        }

        // Numerical mismatch check
        for (const nA of numsA) {
          for (const nB of numsB) {
            if (nA.unit === nB.unit && nA.unit.length > 0 && nA.val !== nB.val) {
              numericalConflicts.push({
                metric: `${nA.unit.toUpperCase()}`,
                valA: nA.full,
                valB: nB.full,
                agentA: claimA.agentId,
                agentB: claimB.agentId,
              });

              disagreements.push({
                id: `disagree-num-${crypto.randomUUID().substring(0, 8)}`,
                topic: `Discrepancy in ${nA.unit.toUpperCase()} parameter (${nA.full} vs ${nB.full})`,
                competingClaims: [claimA, claimB],
                evidenceFoundInGrounding: false,
                consensusRatio: 0.5,
                consensusVote: 'SPLIT',
                resolutionStatus: 'PENDING_VERIFICATION',
              });
            }
          }
        }
      }
    }

    // Calculate consensus ratio
    // Group claims by similarity
    const claimClusters: Array<{ text: string; claims: AgentClaim[] }> = [];
    for (const c of claims) {
      let added = false;
      for (const cl of claimClusters) {
        if (this.areClaimsSyntacticallySimilar(cl.text, c.claimText)) {
          cl.claims.push(c);
          added = true;
          break;
        }
      }
      if (!added) {
        claimClusters.push({ text: c.claimText, claims: [c] });
      }
    }

    claimClusters.sort((a, b) => b.claims.length - a.claims.length);
    const largestCluster = claimClusters[0];
    const consensusRatio = largestCluster ? Math.round((largestCluster.claims.length / claims.length) * 100) / 100 : 1.0;
    const majorityClaimText = largestCluster?.text;

    // Detect Unsupported Consensus:
    // If >70% of agents agree on a claim, but none of them provide verified citations
    const isUnsupportedConsensus =
      consensusRatio >= 0.7 &&
      largestCluster.claims.every((c) => !c.supportingCitations || c.supportingCitations.length === 0);

    return {
      hasDisagreement: disagreements.length > 0,
      disagreements,
      numericalConflicts,
      polarityConflicts,
      consensusRatio,
      majorityClaimText,
      isUnsupportedConsensus,
    };
  }

  private areClaimsSyntacticallySimilar(a: string, b: string): boolean {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    let common = 0;
    for (const w of wordsA) {
      if (wordsB.has(w) && w.length > 3) common++;
    }
    const ratio = common / Math.max(wordsA.size, wordsB.size, 1);
    return ratio >= 0.65;
  }
}

export const adaptiveDisagreementDetector = new AdaptiveDisagreementDetector();
