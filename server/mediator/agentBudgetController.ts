/**
 * Agent Budget Controller
 * Enforces strict operational ceilings on agent counts, execution time, escalation rounds, and cost units.
 * Guarantees that adaptive loops terminate predictably and safely.
 */

import { AdaptiveBudget, AdaptiveBudgetConfig } from './adaptiveTypes.js';

export class AgentBudgetController {
  private config: AdaptiveBudgetConfig;
  private budget: AdaptiveBudget;
  private startTime: number;

  constructor(config?: Partial<AdaptiveBudgetConfig>) {
    this.config = {
      minAgents: config?.minAgents ?? 1,
      maxAgents: config?.maxAgents ?? 5,
      maxEscalationRounds: config?.maxEscalationRounds ?? 3,
      maxTotalAgentCalls: config?.maxTotalAgentCalls ?? 10,
      maxExecutionTimeMs: config?.maxExecutionTimeMs ?? 15000,
      maxEstimatedCostUnits: config?.maxEstimatedCostUnits ?? 120,
      maxDelegationDepth: config?.maxDelegationDepth ?? 3,
    };

    this.budget = {
      agentCalls: 0,
      parallelAgentCalls: 0,
      executionTimeMs: 0,
      estimatedCostUnits: 0,
      tokensIn: 0,
      tokensOut: 0,
      retries: 0,
      reassignments: 0,
      verificationCalls: 0,
      escalationRounds: 0,
    };

    this.startTime = Date.now();
  }

  public getBudget(): AdaptiveBudget {
    this.budget.executionTimeMs = Date.now() - this.startTime;
    return { ...this.budget };
  }

  public getConfig(): AdaptiveBudgetConfig {
    return { ...this.config };
  }

  public canExecuteAgentCall(): { allowed: boolean; reason?: string } {
    if (this.budget.agentCalls >= this.config.maxTotalAgentCalls) {
      return { allowed: false, reason: `Max agent calls ceiling reached (${this.config.maxTotalAgentCalls})` };
    }
    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.config.maxExecutionTimeMs) {
      return { allowed: false, reason: `Execution time limit exceeded (${elapsed}ms >= ${this.config.maxExecutionTimeMs}ms)` };
    }
    if (this.budget.estimatedCostUnits >= this.config.maxEstimatedCostUnits) {
      return { allowed: false, reason: `Estimated cost units ceiling reached (${this.budget.estimatedCostUnits} >= ${this.config.maxEstimatedCostUnits})` };
    }
    return { allowed: true };
  }

  public recordAgentCall(isParallel: boolean = false, tokensIn: number = 150, tokensOut: number = 200) {
    this.budget.agentCalls++;
    if (isParallel) {
      this.budget.parallelAgentCalls++;
    }
    this.budget.tokensIn += tokensIn;
    this.budget.tokensOut += tokensOut;
    // Cost formula: ~1 unit per call + 0.01 per token
    this.budget.estimatedCostUnits += 1 + Math.round((tokensIn + tokensOut) * 0.01);
  }

  public recordVerificationCall() {
    this.budget.verificationCalls++;
    this.recordAgentCall(false, 300, 250);
  }

  public canEscalate(): { allowed: boolean; reason?: string } {
    if (this.budget.escalationRounds >= this.config.maxEscalationRounds) {
      return { allowed: false, reason: `Max escalation rounds limit reached (${this.config.maxEscalationRounds})` };
    }
    const callCheck = this.canExecuteAgentCall();
    if (!callCheck.allowed) {
      return callCheck;
    }
    return { allowed: true };
  }

  public recordEscalation() {
    this.budget.escalationRounds++;
  }

  public recordRetry() {
    this.budget.retries++;
  }

  public recordReassignment() {
    this.budget.reassignments++;
  }

  public isExhausted(): { exhausted: boolean; reason?: string } {
    const check = this.canExecuteAgentCall();
    if (!check.allowed) return { exhausted: true, reason: check.reason };
    return { exhausted: false };
  }
}
