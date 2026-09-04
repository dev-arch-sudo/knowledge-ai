/**
 * Escalation Controller
 * Manages bounded, evidence-driven escalation rounds.
 * Prevents runaway agent loops by enforcing max rounds and checking expected information gain.
 */

import { AdaptiveEscalationRecord } from './adaptiveTypes.js';

export class EscalationController {
  private maxRounds: number;

  constructor(maxRounds: number = 3) {
    this.maxRounds = maxRounds;
  }

  /**
   * Decide if an escalation round should be initiated
   */
  public shouldEscalate(
    currentRound: number,
    escalationReason: string,
    previousGain: number = 1.0,
    evidenceSufficiencyScore: number = 0.5
  ): { allowed: boolean; reason: string } {
    if (currentRound >= this.maxRounds) {
      return {
        allowed: false,
        reason: `Maximum escalation rounds limit (${this.maxRounds}) reached. Forcing termination to bound execution.`,
      };
    }

    // Stop if previous escalation brought negligible information gain
    if (currentRound > 1 && previousGain < 0.08) {
      return {
        allowed: false,
        reason: `Negligible information gain in prior round (${previousGain.toFixed(2)} < 0.08). Terminating escalation.`,
      };
    }

    // Stop if evidence is already completely sufficient
    if (evidenceSufficiencyScore >= 0.95) {
      return {
        allowed: false,
        reason: 'Evidence is already fully sufficient and grounded; further escalation is redundant.',
      };
    }

    return {
      allowed: true,
      reason: `Escalation round ${currentRound + 1} approved: ${escalationReason}`,
    };
  }

  /**
   * Plan next escalation step
   */
  public createEscalationRecord(
    round: number,
    escalationReason: string,
    previousEvidenceSummary: string,
    newCapabilityRequested: string,
    newAgentAdded: string,
    expectedInformationGain: number = 0.5
  ): AdaptiveEscalationRecord {
    return {
      round,
      escalationReason,
      previousEvidenceSummary,
      newCapabilityRequested,
      newAgentAdded,
      expectedInformationGain,
      actualInformationGain: 0.0, // Updated post-execution
    };
  }
}

export const escalationController = new EscalationController();
