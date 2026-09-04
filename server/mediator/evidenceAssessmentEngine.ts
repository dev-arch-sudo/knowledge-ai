/**
 * Evidence Assessment Engine
 * Converts raw agent outputs into structured EvidenceClaims.
 * Calculates evidence independence, source overlap, and detects correlated agent failure modes.
 * Principle: Correlated agreement is NOT independent confirmation.
 */

import { AgentClaim, ProvenanceTrace, VerificationClassification } from './types.js';
import { EvidenceClaim, EvidenceIndependenceProfile } from './adaptiveTypes.js';

export class EvidenceAssessmentEngine {
  /**
   * Extract and standardize EvidenceClaims from raw agent claims
   */
  public extractEvidenceClaims(
    rawClaims: AgentClaim[],
    groundingContextDocs: string[] = []
  ): EvidenceClaim[] {
    return rawClaims.map((claim) => {
      // Check if citations intersect with known grounding docs
      const citations = claim.supportingCitations || [];
      const hasGroundingDoc = citations.some((c) =>
        groundingContextDocs.some((g) => g.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(g.toLowerCase()))
      );

      let supportStatus: 'SUPPORTED' | 'CONTRADICTED' | 'UNCERTAIN' | 'UNSUPPORTED' = 'UNCERTAIN';
      if (claim.systemAsserted) {
        supportStatus = 'SUPPORTED';
      } else if (citations.length === 0) {
        supportStatus = 'UNSUPPORTED';
      } else if (hasGroundingDoc) {
        supportStatus = 'SUPPORTED';
      }

      const provenance: ProvenanceTrace = {
        runId: claim.id,
        taskId: claim.subtaskId,
        subtaskId: claim.subtaskId,
        agentId: claim.agentId,
        provider: 'mock',
        timestamp: Date.now(),
        claimedByAgent: true,
        systemAsserted: claim.systemAsserted || false,
        sourceDocCitations: citations,
        evidenceIndependenceScore: 1.0,
      };

      return {
        claimId: claim.id,
        text: claim.claimText,
        agentId: claim.agentId,
        providerId: 'mock',
        evidenceRefs: citations,
        supportStatus,
        independenceScore: 1.0,
        provenance,
      };
    });
  }

  /**
   * Evaluate the independence of evidence across multiple agents
   */
  public evaluateIndependence(
    claims: AgentClaim[],
    agents: Array<{ agentId: string; provider?: string; correlationGroup?: string; prompt?: string }>
  ): EvidenceIndependenceProfile {
    if (claims.length <= 1) {
      return {
        overallIndependenceScore: 1.0,
        sourceOverlap: 0.0,
        promptOverlap: 0.0,
        knowledgeOverlap: 0.0,
        providerOverlap: 0.0,
        claimOverlap: 0.0,
        evidenceOverlap: 0.0,
        correlatedAgentGroups: [],
        isCorrelated: false,
      };
    }

    // 1. Group by correlation groups or identical shared providers
    const groupMap = new Map<string, string[]>();
    for (const a of agents) {
      if (a.correlationGroup) {
        const list = groupMap.get(a.correlationGroup) || [];
        list.push(a.agentId);
        groupMap.set(a.correlationGroup, list);
      }
    }

    const correlatedAgentGroups: Array<{ groupName: string; agentIds: string[]; reason: string }> = [];
    let hasCorrelationGroup = false;

    for (const [groupName, agentIds] of groupMap.entries()) {
      if (agentIds.length > 1) {
        hasCorrelationGroup = true;
        correlatedAgentGroups.push({
          groupName,
          agentIds,
          reason: `Agents [${agentIds.join(', ')}] share correlation group '${groupName}' with interdependent reasoning premises`,
        });
      }
    }

    // 2. Compute citation/source overlap
    const allCitations = claims.map((c) => (c.supportingCitations || []).map((s) => s.toLowerCase()));
    let sharedCitationsCount = 0;
    let totalCitations = 0;

    const citationFreq = new Map<string, number>();
    for (const list of allCitations) {
      for (const cite of list) {
        totalCitations++;
        citationFreq.set(cite, (citationFreq.get(cite) || 0) + 1);
      }
    }

    for (const count of citationFreq.values()) {
      if (count > 1) {
        sharedCitationsCount += count;
      }
    }

    const sourceOverlap = totalCitations > 0
      ? Math.min(1.0, Math.round((sharedCitationsCount / totalCitations) * 100) / 100)
      : 0.0;

    // 3. Provider overlap
    const providerList = agents.map((a) => a.provider || 'mock');
    const uniqueProviders = new Set(providerList);
    const providerOverlap = agents.length > 1
      ? Math.round(((agents.length - uniqueProviders.size) / agents.length) * 100) / 100
      : 0;

    // 4. Claim text syntactic overlap
    let textSimilarity = 0;
    let pairs = 0;
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        pairs++;
        const wordsA = new Set(claims[i].claimText.toLowerCase().split(/\s+/));
        const wordsB = new Set(claims[j].claimText.toLowerCase().split(/\s+/));
        let common = 0;
        for (const w of wordsA) {
          if (wordsB.has(w) && w.length > 3) common++;
        }
        textSimilarity += common / Math.max(wordsA.size, wordsB.size, 1);
      }
    }
    const claimOverlap = pairs > 0 ? Math.min(1.0, Math.round((textSimilarity / pairs) * 100) / 100) : 0;

    // 5. Overall Evidence Overlap
    const evidenceOverlap = Math.min(
      1.0,
      Math.round((sourceOverlap * 0.4 + claimOverlap * 0.3 + providerOverlap * 0.3) * 100) / 100
    );

    // 6. Calculate overall independence score
    let overallIndependenceScore = Math.max(0.05, Math.round((1.0 - evidenceOverlap) * 100) / 100);

    // If explicit correlation group was detected, independence is severely degraded
    if (hasCorrelationGroup) {
      overallIndependenceScore = Math.min(overallIndependenceScore, 0.2);
    }

    return {
      overallIndependenceScore,
      sourceOverlap,
      promptOverlap: hasCorrelationGroup ? 0.9 : 0.2,
      knowledgeOverlap: sourceOverlap,
      providerOverlap,
      claimOverlap,
      evidenceOverlap,
      correlatedAgentGroups,
      isCorrelated: hasCorrelationGroup || overallIndependenceScore <= 0.35,
    };
  }
}

export const evidenceAssessmentEngine = new EvidenceAssessmentEngine();
