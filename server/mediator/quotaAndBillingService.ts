/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  QuotaPolicy,
  QuotaUsage,
  QuotaStatus,
  BillingAccount,
  BillingStatus,
  BillingProviderSource,
  UsageRecord,
  PlanConfig,
  FeatureEntitlement,
  BillingReconciliationDiscrepancy,
} from './phase9Types.js';

export const PLANS: Record<string, PlanConfig> = {
  FREE: {
    planId: 'FREE',
    name: 'Free Plan',
    maxUsers: 2,
    maxKnowledgeBases: 1,
    maxStorageMb: 100,
    maxMediatorRunsPerDay: 10,
    maxConcurrentRuns: 1,
    maxApiRequestsPerMin: 30,
    maxTokensPerMonth: 100000,
    maxEvaluationsPerDay: 2,
    availableProviders: ['provider-mock'],
    availableFeatures: ['mediator'],
  },
  STARTER: {
    planId: 'STARTER',
    name: 'Starter Plan',
    maxUsers: 5,
    maxKnowledgeBases: 3,
    maxStorageMb: 500,
    maxMediatorRunsPerDay: 50,
    maxConcurrentRuns: 3,
    maxApiRequestsPerMin: 120,
    maxTokensPerMonth: 500000,
    maxEvaluationsPerDay: 10,
    availableProviders: ['provider-mock', 'provider-gemini'],
    availableFeatures: ['mediator', 'api_access'],
  },
  PRO: {
    planId: 'PRO',
    name: 'Professional Plan',
    maxUsers: 20,
    maxKnowledgeBases: 10,
    maxStorageMb: 5000,
    maxMediatorRunsPerDay: 500,
    maxConcurrentRuns: 10,
    maxApiRequestsPerMin: 600,
    maxTokensPerMonth: 5000000,
    maxEvaluationsPerDay: 50,
    availableProviders: ['provider-mock', 'provider-gemini', 'provider-openai', 'provider-anthropic'],
    availableFeatures: [
      'mediator',
      'adaptive_orchestration',
      'real_provider',
      'evaluation',
      'api_access',
      'webhooks',
    ],
  },
  BUSINESS: {
    planId: 'BUSINESS',
    name: 'Business Enterprise Plan',
    maxUsers: 100,
    maxKnowledgeBases: 50,
    maxStorageMb: 25000,
    maxMediatorRunsPerDay: 2500,
    maxConcurrentRuns: 25,
    maxApiRequestsPerMin: 2000,
    maxTokensPerMonth: 25000000,
    maxEvaluationsPerDay: 200,
    availableProviders: ['provider-mock', 'provider-gemini', 'provider-openai', 'provider-anthropic'],
    availableFeatures: [
      'mediator',
      'adaptive_orchestration',
      'real_provider',
      'evaluation',
      'advanced_telemetry',
      'api_access',
      'webhooks',
      'advanced_governance',
    ],
  },
};

export class QuotaAndBillingService {
  private quotaPolicies = new Map<string, QuotaPolicy>();
  private billingAccounts = new Map<string, BillingAccount>();
  private usageRecords: UsageRecord[] = []; // Immutable append-only
  private concurrentRuns = new Map<string, number>(); // tenantId -> active runs

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const now = Date.now();

    // Default Quota for Alpha (PRO)
    this.quotaPolicies.set('tenant_alpha', {
      tenantId: 'tenant_alpha',
      maxApiRequestsPerMin: 600,
      maxMediatorRunsPerDay: 500,
      maxAgentExecutionsPerDay: 2000,
      maxProviderRequestsPerMin: 300,
      maxTokensPerMonth: 5000000,
      maxStorageMb: 5000,
      maxConcurrentRuns: 10,
      warningThresholdPct: 80,
    });

    // Default Quota for Beta (STARTER)
    this.quotaPolicies.set('tenant_beta', {
      tenantId: 'tenant_beta',
      maxApiRequestsPerMin: 120,
      maxMediatorRunsPerDay: 50,
      maxAgentExecutionsPerDay: 200,
      maxProviderRequestsPerMin: 60,
      maxTokensPerMonth: 500000,
      maxStorageMb: 500,
      maxConcurrentRuns: 3,
      warningThresholdPct: 80,
    });

    // Default Billing Account for Alpha
    this.billingAccounts.set('tenant_alpha', {
      accountId: 'bill_alpha_01',
      tenantId: 'tenant_alpha',
      planId: 'PRO',
      status: 'ACTIVE',
      providerSource: 'MOCK',
      currentPeriodStart: now - 15 * 86400000,
      currentPeriodEnd: now + 15 * 86400000,
      currency: 'USD',
      lastInvoiceStatus: 'PAID',
    });

    // Default Billing Account for Beta
    this.billingAccounts.set('tenant_beta', {
      accountId: 'bill_beta_01',
      tenantId: 'tenant_beta',
      planId: 'STARTER',
      status: 'ACTIVE',
      providerSource: 'MOCK',
      currentPeriodStart: now - 5 * 86400000,
      currentPeriodEnd: now + 25 * 86400000,
      currency: 'USD',
      lastInvoiceStatus: 'PAID',
    });

    // Seed sample usage records
    this.recordUsage({
      tenantId: 'tenant_alpha',
      requestId: 'req_seed_01',
      taskId: 'task_seed_01',
      providerId: 'provider-gemini',
      modelId: 'gemini-2.5-flash',
      metric: 'mediator_run',
      quantity: 1,
      unit: 'execution',
      source: 'MEASURED',
    });

    this.recordUsage({
      tenantId: 'tenant_alpha',
      requestId: 'req_seed_02',
      taskId: 'task_seed_01',
      providerId: 'provider-gemini',
      modelId: 'gemini-2.5-flash',
      metric: 'tokens',
      quantity: 1420,
      unit: 'token',
      source: 'MEASURED',
    });
  }

  // --- QUOTA MANAGEMENT ---

  public getQuotaPolicy(tenantId: string): QuotaPolicy {
    const policy = this.quotaPolicies.get(tenantId);
    if (!policy) {
      // Default fallback
      return {
        tenantId,
        maxApiRequestsPerMin: 60,
        maxMediatorRunsPerDay: 25,
        maxAgentExecutionsPerDay: 100,
        maxProviderRequestsPerMin: 30,
        maxTokensPerMonth: 250000,
        maxStorageMb: 250,
        maxConcurrentRuns: 2,
        warningThresholdPct: 80,
      };
    }
    return policy;
  }

  public setQuotaPolicy(tenantId: string, policy: Partial<QuotaPolicy>): QuotaPolicy {
    const existing = this.getQuotaPolicy(tenantId);
    const updated: QuotaPolicy = {
      ...existing,
      ...policy,
      tenantId,
    };
    this.quotaPolicies.set(tenantId, updated);
    return updated;
  }

  public getQuotaUsage(tenantId: string): QuotaUsage {
    const policy = this.getQuotaPolicy(tenantId);
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const oneMonthAgo = now - 30 * 86400000;

    const tenantRecords = this.usageRecords.filter((r) => r.tenantId === tenantId);

    const mediatorRunsToday = tenantRecords.filter(
      (r) => r.metric === 'mediator_run' && r.timestamp >= oneDayAgo
    ).length;

    const agentExecutionsToday = tenantRecords.filter(
      (r) => r.metric === 'agent_execution' && r.timestamp >= oneDayAgo
    ).length;

    const tokensThisMonth = tenantRecords
      .filter((r) => r.metric === 'tokens' && r.timestamp >= oneMonthAgo)
      .reduce((sum, r) => sum + r.quantity, 0);

    const concurrentRunsActive = this.concurrentRuns.get(tenantId) || 0;

    // Calculate ratio against limits
    const runRatio = mediatorRunsToday / Math.max(1, policy.maxMediatorRunsPerDay);
    const tokenRatio = tokensThisMonth / Math.max(1, policy.maxTokensPerMonth);
    const maxRatio = Math.max(runRatio, tokenRatio);

    let status: QuotaStatus = 'WITHIN_LIMIT';
    let warningMessage: string | undefined = undefined;

    if (maxRatio >= 1.0) {
      status = 'LIMIT_REACHED';
      warningMessage = 'Quota limit reached for one or more tracked dimensions.';
    } else if (maxRatio >= policy.warningThresholdPct / 100) {
      status = 'WARNING';
      warningMessage = `Approaching quota limit: ${Math.round(maxRatio * 100)}% of limit consumed.`;
    }

    return {
      tenantId,
      apiRequestsCurrentMin: 0,
      mediatorRunsToday,
      agentExecutionsToday,
      providerRequestsCurrentMin: 0,
      tokensThisMonth,
      storageMbUsed: 12.5, // sample storage usage
      concurrentRunsActive,
      status,
      warningMessage,
    };
  }

  public getTenantQuota(tenantId: string): { policy: QuotaPolicy; usage: QuotaUsage } {
    return {
      policy: this.getQuotaPolicy(tenantId),
      usage: this.getQuotaUsage(tenantId),
    };
  }

  public listInvoices(tenantId: string): any[] {
    const account = this.getBillingAccount(tenantId);
    return [
      {
        invoiceId: `inv_${tenantId}_01`,
        tenantId,
        amount: account.planId === 'PRO' ? 99 : account.planId === 'STARTER' ? 29 : 0,
        currency: 'USD',
        status: account.lastInvoiceStatus || 'PAID',
        periodStart: account.currentPeriodStart,
        periodEnd: account.currentPeriodEnd,
        generatedAt: Date.now() - 5 * 86400000,
      },
    ];
  }

  public generateInvoice(tenantId: string): any {
    const account = this.getBillingAccount(tenantId);
    return {
      invoiceId: `inv_${tenantId}_${Date.now()}`,
      tenantId,
      amount: account.planId === 'PRO' ? 99 : account.planId === 'STARTER' ? 29 : 0,
      currency: 'USD',
      status: 'ISSUED',
      periodStart: account.currentPeriodStart,
      periodEnd: account.currentPeriodEnd,
      generatedAt: Date.now(),
    };
  }

  public checkOperationAllowed(
    tenantId: string,
    operationType: 'mediator_run' | 'agent_execution' | 'api_request'
  ): { allowed: boolean; reason?: string; status: QuotaStatus } {
    const policy = this.getQuotaPolicy(tenantId);
    const usage = this.getQuotaUsage(tenantId);

    // Concurrency check
    if (usage.concurrentRunsActive >= policy.maxConcurrentRuns) {
      return {
        allowed: false,
        status: 'BLOCKED',
        reason: `Tenant concurrent execution limit reached (${usage.concurrentRunsActive}/${policy.maxConcurrentRuns})`,
      };
    }

    // Daily runs check
    if (operationType === 'mediator_run' && usage.mediatorRunsToday >= policy.maxMediatorRunsPerDay) {
      return {
        allowed: false,
        status: 'LIMIT_REACHED',
        reason: `Tenant daily mediator run limit reached (${usage.mediatorRunsToday}/${policy.maxMediatorRunsPerDay})`,
      };
    }

    return {
      allowed: true,
      status: usage.status,
      reason: usage.warningMessage,
    };
  }

  public trackConcurrentRunStart(tenantId: string): void {
    const current = this.concurrentRuns.get(tenantId) || 0;
    this.concurrentRuns.set(tenantId, current + 1);
  }

  public trackConcurrentRunEnd(tenantId: string): void {
    const current = this.concurrentRuns.get(tenantId) || 0;
    this.concurrentRuns.set(tenantId, Math.max(0, current - 1));
  }

  // --- USAGE METERING (APPEND-ONLY) ---

  public recordUsage(params: {
    tenantId: string;
    requestId: string;
    taskId?: string;
    providerId?: string;
    modelId?: string;
    metric: UsageRecord['metric'];
    quantity: number;
    unit: string;
    source?: 'MEASURED' | 'ESTIMATED' | 'UNKNOWN';
  }): UsageRecord {
    const record: UsageRecord = {
      usageId: `use_${crypto.randomBytes(8).toString('hex')}`,
      tenantId: params.tenantId,
      requestId: params.requestId,
      taskId: params.taskId,
      providerId: params.providerId,
      modelId: params.modelId,
      metric: params.metric,
      quantity: params.quantity,
      unit: params.unit,
      timestamp: Date.now(),
      source: params.source || 'MEASURED',
    };
    this.usageRecords.push(record);
    return record;
  }

  public listUsageRecords(tenantId: string, limit: number = 100): UsageRecord[] {
    return this.usageRecords
      .filter((r) => r.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  }

  // --- BILLING ACCOUNT & PLANS ---

  public getBillingAccount(tenantId: string): BillingAccount {
    let account = this.billingAccounts.get(tenantId);
    if (!account) {
      const now = Date.now();
      account = {
        accountId: `bill_${crypto.randomBytes(6).toString('hex')}`,
        tenantId,
        planId: 'FREE',
        status: 'ACTIVE',
        providerSource: 'MOCK',
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 86400000,
        currency: 'USD',
        lastInvoiceStatus: 'PAID',
      };
      this.billingAccounts.set(tenantId, account);
    }
    return account;
  }

  public updateBillingStatus(tenantId: string, status: BillingStatus): BillingAccount {
    const account = this.getBillingAccount(tenantId);
    const updated: BillingAccount = {
      ...account,
      status,
    };
    this.billingAccounts.set(tenantId, updated);
    return updated;
  }

  public changePlan(
    tenantId: string,
    targetPlanId: string
  ): { success: boolean; account?: BillingAccount; error?: string } {
    const targetPlan = PLANS[targetPlanId];
    if (!targetPlan) {
      return { success: false, error: `Plan ${targetPlanId} does not exist` };
    }

    const currentAccount = this.getBillingAccount(tenantId);
    const currentUsage = this.getQuotaUsage(tenantId);

    // Downgrade protection: verify current usage doesn't violate lower plan limits
    if (currentUsage.storageMbUsed > targetPlan.maxStorageMb) {
      return {
        success: false,
        error: `DOWNGRADE_BLOCKED: Current storage (${currentUsage.storageMbUsed} MB) exceeds ${targetPlan.name} limit of ${targetPlan.maxStorageMb} MB. Knowledge and memories are preserved.`,
      };
    }

    currentAccount.planId = targetPlanId;
    this.billingAccounts.set(tenantId, currentAccount);

    // Update quota policy to match plan
    this.setQuotaPolicy(tenantId, {
      maxApiRequestsPerMin: targetPlan.maxApiRequestsPerMin,
      maxMediatorRunsPerDay: targetPlan.maxMediatorRunsPerDay,
      maxTokensPerMonth: targetPlan.maxTokensPerMonth,
      maxStorageMb: targetPlan.maxStorageMb,
      maxConcurrentRuns: targetPlan.maxConcurrentRuns,
    });

    return { success: true, account: currentAccount };
  }

  public checkFeatureEntitlement(tenantId: string, feature: FeatureEntitlement): boolean {
    const account = this.getBillingAccount(tenantId);
    const plan = PLANS[account.planId] || PLANS.FREE;
    return plan.availableFeatures.includes(feature);
  }

  // --- RECONCILIATION & COST UNKNOWN RULE ---

  public reconcileUsage(
    tenantId: string,
    providerReportedUsage: { metric: string; quantity: number }[]
  ): BillingReconciliationDiscrepancy[] {
    const discrepancies: BillingReconciliationDiscrepancy[] = [];
    const tenantRecords = this.usageRecords.filter((r) => r.tenantId === tenantId);

    for (const report of providerReportedUsage) {
      const internalTotal = tenantRecords
        .filter((r) => r.metric === report.metric)
        .reduce((sum, r) => sum + r.quantity, 0);

      const diff = Math.abs(internalTotal - report.quantity);
      const isMatch = diff === 0;

      discrepancies.push({
        metric: report.metric,
        internalUsage: internalTotal,
        providerUsage: report.quantity,
        difference: diff,
        status: isMatch ? 'MATCH' : 'DISCREPANCY',
      });
    }

    return discrepancies;
  }

  public getProviderCost(providerId: string, modelId: string): string {
    // Phase 8 & 9 permanent rule: If authoritative invoicing API is not connected, cost is UNKNOWN
    return 'UNKNOWN';
  }
}

export const quotaAndBillingService = new QuotaAndBillingService();
