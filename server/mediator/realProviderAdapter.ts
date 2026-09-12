/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Provider simulation harness used by mediator reliability tests.
 *
 * IMPORTANT: this module does not make live provider API calls. It produces
 * deterministic/simulated provider responses for orchestration, budget,
 * failover, and telemetry tests. Live model generation currently happens in
 * the grounded/cognitive Gemini paths. Do not present data from this adapter
 * as empirically measured production-provider performance.
 */

import crypto from 'crypto';
import {
  ProviderHealthProfile,
  RealProviderBudget,
  RealProviderBudgetStatus,
  ExecutionEnvironment,
} from './phase8Types.js';
import { AgentClaim, ProvenanceTrace } from './types.js';

export interface ProviderExecutionRequest {
  providerId: string;
  modelId: string;
  modelVersion?: string;
  configurationVersion?: string;
  taskPrompt: string;
  subtaskId: string;
  runId: string;
  environment: ExecutionEnvironment;
  budget?: Partial<RealProviderBudget>;
  authHeaderPresent?: boolean;
  correlationGroup?: string;
  allowFailover?: boolean;
  failoverProviderId?: string;
}

export interface ProviderExecutionResponse {
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'RATE_LIMITED' | 'BUDGET_EXCEEDED';
  providerId: string;
  modelId: string;
  modelVersion: string;
  configurationVersion: string;
  claims: AgentClaim[];
  rawOutput: string;
  provenance: ProvenanceTrace;
  latencyMs: number;
  tokensUsed: { inputTokens: number; outputTokens: number; totalTokens: number };
  costReported: string | number;
  failoverEngaged?: boolean;
  errorDetails?: string;
  providerRequestId?: string;
}

export class RealProviderAdapter {
  private healthProfiles: Map<string, ProviderHealthProfile> = new Map();
  private activeBudgets: Map<string, RealProviderBudgetStatus> = new Map();
  private globalActiveConcurrent: number = 0;

  constructor() {
    this.initDefaultHealthProfiles();
  }

  private initDefaultHealthProfiles() {
    // These are simulation fixtures, not observed production-provider metrics.
    this.healthProfiles.set('provider-gemini', {
      providerId: 'provider-gemini',
      modelId: 'gemini-2.5-flash',
      availability: 1.0,
      successRate: 0.995,
      timeoutRate: 0.003,
      errorRate: 0.002,
      latencyP50: 240,
      latencyP95: 580,
      latencyP99: 890,
      tokenUsage: { inputTokens: 45200, outputTokens: 18400, totalTokens: 63600 },
      rateLimitEvents: 0,
      status: 'HEALTHY',
      validationSource: 'SIMULATED',
    });

    this.healthProfiles.set('provider-vertex', {
      providerId: 'provider-vertex',
      modelId: 'gemini-1.5-pro-enterprise',
      availability: 1.0,
      successRate: 0.998,
      timeoutRate: 0.001,
      errorRate: 0.001,
      latencyP50: 310,
      latencyP95: 640,
      latencyP99: 940,
      tokenUsage: { inputTokens: 28000, outputTokens: 9100, totalTokens: 37100 },
      rateLimitEvents: 0,
      status: 'HEALTHY',
      validationSource: 'SIMULATED',
    });

    this.healthProfiles.set('provider-ha-cluster', {
      providerId: 'provider-ha-cluster',
      modelId: 'claude-3-5-sonnet-compat',
      availability: 1.0,
      successRate: 0.99,
      timeoutRate: 0.005,
      errorRate: 0.005,
      latencyP50: 290,
      latencyP95: 620,
      latencyP99: 910,
      tokenUsage: { inputTokens: 12000, outputTokens: 4200, totalTokens: 16200 },
      rateLimitEvents: 0,
      status: 'HEALTHY',
      validationSource: 'SIMULATED',
    });
  }

  /**
   * Execute the provider simulation harness with bounded budgets, synthetic
   * failover behavior, secret-safe provenance, and clearly simulated metrics.
   */
  public async execute(req: ProviderExecutionRequest): Promise<ProviderExecutionResponse> {
    const startTime = Date.now();
    const env = req.environment || 'DETERMINISTIC_TEST';
    const providerId = req.providerId || 'provider-gemini';
    const modelId = req.modelId || 'gemini-2.5-flash';
    const modelVersion = req.modelVersion || 'simulation-v1';
    const configurationVersion = req.configurationVersion || 'simulation-cfg-v1';

    const budgetKey = `${req.runId}_${providerId}`;
    let budgetStatus = this.activeBudgets.get(budgetKey);
    if (!budgetStatus && req.budget) {
      budgetStatus = {
        budget: {
          maxRequests: req.budget.maxRequests ?? 20,
          maxConcurrentRequests: req.budget.maxConcurrentRequests ?? 5,
          maxTokens: req.budget.maxTokens ?? 100000,
          maxExecutionTimeMs: req.budget.maxExecutionTimeMs ?? 15000,
          maxEstimatedCostUnits: req.budget.maxEstimatedCostUnits ?? 100,
        },
        usedRequests: 0,
        activeConcurrentRequests: 0,
        usedTokens: 0,
        elapsedTimeMs: 0,
        usedCostUnits: 0,
        costReported: 'UNKNOWN',
        limitReached: false,
        status: 'WITHIN_BUDGET',
      };
      this.activeBudgets.set(budgetKey, budgetStatus);
    }

    if (budgetStatus) {
      if (budgetStatus.usedRequests >= budgetStatus.budget.maxRequests) {
        budgetStatus.limitReached = true;
        budgetStatus.status = 'BUDGET_LIMIT_REACHED';
        return {
          status: 'BUDGET_EXCEEDED',
          providerId,
          modelId,
          modelVersion,
          configurationVersion,
          claims: [],
          rawOutput: '',
          provenance: this.generateProvenance(req, providerId, modelId),
          latencyMs: Date.now() - startTime,
          tokensUsed: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          costReported: 'UNKNOWN',
          errorDetails: 'BUDGET_LIMIT_REACHED: Max requests quota exceeded for simulated test run.',
        };
      }
      budgetStatus.usedRequests += 1;
      budgetStatus.activeConcurrentRequests += 1;
      this.globalActiveConcurrent += 1;
    }

    try {
      let activeProvider = providerId;
      let failoverEngaged = false;

      if (req.allowFailover && req.failoverProviderId && providerId === 'provider-unavailable-primary') {
        activeProvider = req.failoverProviderId;
        failoverEngaged = true;
      }

      const providerRequestId = `sim_req_${crypto.randomBytes(8).toString('hex')}`;
      const promptTokenEstimate = Math.ceil(req.taskPrompt.length / 4);
      const outputTokenEstimate = 85;
      const totalTokens = promptTokenEstimate + outputTokenEstimate;

      if (budgetStatus) {
        budgetStatus.usedTokens += totalTokens;
      }

      const claims: AgentClaim[] = [
        {
          id: `claim_${crypto.randomBytes(6).toString('hex')}`,
          subtaskId: req.subtaskId,
          agentId: `agent-${activeProvider}`,
          claimText: `[SIMULATED] Orchestration response produced for ${activeProvider} under ${env}.`,
          text: `[SIMULATED] Orchestration response produced for ${activeProvider} under ${env}.`,
          confidence: 0.94,
          groundingStatus: 'UNVERIFIED',
          supportingCitations: [],
          systemAsserted: false,
          sources: [],
        } as any,
      ];

      const latencyMs = Math.floor(Math.random() * 25) + 30;
      const profile = this.healthProfiles.get(activeProvider);
      if (profile) {
        profile.lastSuccessfulRequest = Date.now();
        profile.tokenUsage.inputTokens += promptTokenEstimate;
        profile.tokenUsage.outputTokens += outputTokenEstimate;
        profile.tokenUsage.totalTokens += totalTokens;
      }

      return {
        status: 'SUCCESS',
        providerId: activeProvider,
        modelId,
        modelVersion,
        configurationVersion,
        claims,
        rawOutput: `[SIMULATED] Provider response for ${activeProvider} (${modelId}) under environment ${env}.`,
        provenance: this.generateProvenance(req, activeProvider, modelId),
        latencyMs,
        tokensUsed: {
          inputTokens: promptTokenEstimate,
          outputTokens: outputTokenEstimate,
          totalTokens,
        },
        costReported: 'UNKNOWN',
        failoverEngaged,
        providerRequestId,
      };
    } finally {
      if (budgetStatus) {
        budgetStatus.activeConcurrentRequests = Math.max(0, budgetStatus.activeConcurrentRequests - 1);
        this.globalActiveConcurrent = Math.max(0, this.globalActiveConcurrent - 1);
        budgetStatus.elapsedTimeMs += Date.now() - startTime;
      }
    }
  }

  private generateProvenance(
    req: ProviderExecutionRequest,
    providerId: string,
    modelId: string
  ): ProvenanceTrace {
    const rawChain = `${req.runId}:${req.subtaskId}:${providerId}:${modelId}:${Date.now()}`;
    const hash = crypto.createHash('sha256').update(rawChain).digest('hex');
    return {
      runId: req.runId,
      taskId: req.runId,
      subtaskId: req.subtaskId,
      agentId: `agent-${providerId}`,
      sourceAgentId: `agent-${providerId}`,
      provider: providerId,
      timestamp: Date.now(),
      executionTimestamp: Date.now(),
      claimedByAgent: true,
      systemAsserted: false,
      sourceDocCitations: [],
      evidenceIndependenceScore: 1.0,
      documentReferences: [],
      reasoningChainHash: hash,
    } as any;
  }

  public getHealthProfiles(): ProviderHealthProfile[] {
    return Array.from(this.healthProfiles.values());
  }

  public getHealthProfile(providerId: string): ProviderHealthProfile | undefined {
    return this.healthProfiles.get(providerId);
  }

  public updateHealthProfile(providerId: string, updates: Partial<ProviderHealthProfile>): void {
    const existing = this.healthProfiles.get(providerId);
    if (existing) {
      this.healthProfiles.set(providerId, { ...existing, ...updates });
    }
  }

  public getBudgetStatus(runId: string, providerId: string): RealProviderBudgetStatus | undefined {
    return this.activeBudgets.get(`${runId}_${providerId}`);
  }

  public reset(): void {
    this.activeBudgets.clear();
    this.globalActiveConcurrent = 0;
    this.initDefaultHealthProfiles();
  }
}

export const realProviderAdapter = new RealProviderAdapter();
