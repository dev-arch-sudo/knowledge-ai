/**
 * Stop Condition Evaluator
 * Checks whether an adaptive run has reached one of the defined termination criteria.
 * Guarantees bounded execution and deterministic stopping.
 */

import { StopCondition, StopConditionType } from './adaptiveTypes.js';

export interface StopEvaluationInput {
  hasAuthoritativeContradiction: boolean;
  isEvidenceSufficient: boolean;
  isInsufficientEvidence: boolean;
  isBudgetExhausted: boolean;
  isTimeLimitReached: boolean;
  isEscalationLimitReached: boolean;
  isNegligibleGain: boolean;
  isSecurityBoundaryTriggered: boolean;
  details?: string;
}

export class StopConditionEvaluator {
  public evaluate(input: StopEvaluationInput): StopCondition | null {
    const now = Date.now();

    // Priority 1: Security boundary
    if (input.isSecurityBoundaryTriggered) {
      return {
        condition: 'SECURITY_BOUNDARY_TRIGGERED',
        reason: input.details || 'Adversarial security attack or prompt injection detected and blocked.',
        stopTimestamp: now,
      };
    }

    // Priority 2: Authoritative Contradiction
    if (input.hasAuthoritativeContradiction) {
      return {
        condition: 'AUTHORITATIVE_CONTRADICTION',
        reason: input.details || 'Direct contradiction against authoritative Knowledge AI document identified.',
        stopTimestamp: now,
      };
    }

    // Priority 3: Budget or time limits
    if (input.isBudgetExhausted) {
      return {
        condition: 'BUDGET_EXHAUSTED',
        reason: input.details || 'Maximum agent calls or cost units ceiling reached.',
        stopTimestamp: now,
      };
    }

    if (input.isTimeLimitReached) {
      return {
        condition: 'TIME_LIMIT_REACHED',
        reason: input.details || 'Execution duration exceeded maximum allowable latency budget.',
        stopTimestamp: now,
      };
    }

    // Priority 4: Escalation limit reached
    if (input.isEscalationLimitReached) {
      return {
        condition: 'ESCALATION_LIMIT_REACHED',
        reason: input.details || 'Maximum escalation rounds executed without further resolution.',
        stopTimestamp: now,
      };
    }

    // Priority 5: Negligible gain
    if (input.isNegligibleGain) {
      return {
        condition: 'NEGLIGIBLE_INFORMATION_GAIN',
        reason: input.details || 'Marginal information gain fell below threshold. Terminating to conserve compute.',
        stopTimestamp: now,
      };
    }

    // Priority 6: Evidence Sufficient
    if (input.isEvidenceSufficient) {
      return {
        condition: 'EVIDENCE_SUFFICIENT',
        reason: input.details || 'Authoritative evidence is sufficient and all claims verified.',
        stopTimestamp: now,
      };
    }

    // Priority 7: Insufficient evidence
    if (input.isInsufficientEvidence) {
      return {
        condition: 'INSUFFICIENT_EVIDENCE',
        reason: input.details || 'All verification avenues exhausted; evidence remains inconclusive.',
        stopTimestamp: now,
      };
    }

    return null;
  }
}

export const stopConditionEvaluator = new StopConditionEvaluator();
