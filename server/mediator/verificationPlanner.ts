/**
 * Verification Planner
 * Decides whether current evidence is sufficient, insufficient, contradictory,
 * or requires an independent verification agent.
 */

import { AgentClaim } from './types.js';
import {
  EvidenceIndependenceProfile,
  TaskRiskProfile,
  VerificationDecisionOutcome,
  VerificationPlan,
} from './adaptiveTypes.js';
import { DisagreementAnalysisResult } from './adaptiveDisagreementDetector.js';

export class VerificationPlanner {
  public plan(
    claims: AgentClaim[],
    risk: TaskRiskProfile,
    independence: EvidenceIndependenceProfile,
    disagreement: DisagreementAnalysisResult,
    availableDocs: string[] = []
  ): VerificationPlan {
    const reasons: string[] = [];
    const targetClaimsToVerify: string[] = [];

    // 1. Check for Contradictions
    if (disagreement.hasDisagreement) {
      reasons.push(`Detected ${disagreement.disagreements.length} active contradiction(s) or numerical discrepancy(ies) between agent claims`);
      for (const d of disagreement.disagreements) {
        for (const c of d.competingClaims) {
          if (!targetClaimsToVerify.includes(c.claimText)) {
            targetClaimsToVerify.push(c.claimText);
          }
        }
      }
    }

    // 2. Check for Unsupported Consensus
    if (disagreement.isUnsupportedConsensus) {
      reasons.push('Detected unsupported majority consensus without authoritative evidence citations');
      if (disagreement.majorityClaimText && !targetClaimsToVerify.includes(disagreement.majorityClaimText)) {
        targetClaimsToVerify.push(disagreement.majorityClaimText);
      }
    }

    // 3. Check for Correlated Agents / Low Independence
    if (independence.isCorrelated) {
      reasons.push(`Evidence independence is low (${independence.overallIndependenceScore}); multiple agents share correlated failure modes`);
    }

    // 4. Check for High Factual / Security Risk
    if (risk.overallRiskLevel === 'HIGH' || risk.factualRisk >= 0.8) {
      reasons.push('High-risk task requires explicit grounded verification pass');
      for (const c of claims) {
        if (!targetClaimsToVerify.includes(c.claimText)) {
          targetClaimsToVerify.push(c.claimText);
        }
      }
    }

    // 5. Check for missing or suspicious citations
    for (const c of claims) {
      if (!c.supportingCitations || c.supportingCitations.length === 0) {
        if (!targetClaimsToVerify.includes(c.claimText)) {
          targetClaimsToVerify.push(c.claimText);
        }
      }
    }

    // Determine Decision
    let decision: VerificationDecisionOutcome = 'SUFFICIENT';
    let requiresIndependentVerifier = false;

    if (disagreement.hasDisagreement || independence.isCorrelated || disagreement.isUnsupportedConsensus) {
      decision = 'REQUIRES_INDEPENDENT_VERIFIER';
      requiresIndependentVerifier = true;
    } else if (targetClaimsToVerify.length > 0 && risk.overallRiskLevel !== 'LOW') {
      decision = 'REQUIRES_INDEPENDENT_VERIFIER';
      requiresIndependentVerifier = true;
    } else if (claims.some((c) => !c.supportingCitations || c.supportingCitations.length === 0)) {
      decision = 'INSUFFICIENT';
      requiresIndependentVerifier = true;
    } else {
      decision = 'SUFFICIENT';
      reasons.push('Evidence is supported by valid citations with high independence and no unresolved contradictions');
    }

    return {
      decision,
      reasons,
      requiresIndependentVerifier,
      targetClaimsToVerify,
      groundingContextDocs: availableDocs,
    };
  }
}

export const verificationPlanner = new VerificationPlanner();
