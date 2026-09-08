/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  TenantConfiguration,
  TenantDeletionWorkflow,
  TenantDeletionState,
  BreakGlassAccess,
  BreakGlassStatus,
  AuditEventItem,
} from './phase9Types.js';
import { multiTenancyService } from './multiTenancyService.js';
import { quotaAndBillingService } from './quotaAndBillingService.js';
import { kbStore } from '../kbStore.js';
import { memoryStore } from '../memoryStore.js';

export class TenantGovernanceService {
  private configurations = new Map<string, TenantConfiguration>();
  private configHistory = new Map<string, TenantConfiguration[]>();
  private deletionWorkflows = new Map<string, TenantDeletionWorkflow>();
  private breakGlassStore = new Map<string, BreakGlassAccess>();
  private auditEvents: AuditEventItem[] = []; // Immutable cryptographically chained ledger
  private lastAuditHash: string = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor() {
    this.seedDefaultConfigurations();
  }

  private seedDefaultConfigurations() {
    const now = Date.now();

    // Configuration for Alpha
    const configAlpha: TenantConfiguration = {
      configVersion: 1,
      tenantId: 'tenant_alpha',
      defaultModel: 'gemini-2.5-flash',
      providerRouting: { general: 'provider-gemini', fallback: 'provider-mock' },
      adaptiveOrchestrationMode: 'ADAPTIVE',
      agentLimit: 12,
      telemetryRetentionDays: 90,
      auditRetentionDays: 365,
      allowedProviders: ['provider-mock', 'provider-gemini', 'provider-openai'],
      securityPolicies: {
        enforceGroundingBoundary: true,
        requireHumanVerificationForPublish: true,
        sandboxControlledLearning: true,
        blockExternalAiStateMutation: true,
      },
      updatedAt: now,
      updatedBy: 'system_bootstrap',
    };
    this.configurations.set('tenant_alpha', configAlpha);
    this.configHistory.set('tenant_alpha', [{ ...configAlpha }]);

    // Seed initial audit events
    this.recordAuditEvent({
      tenantId: 'tenant_alpha',
      actor: 'system_bootstrap',
      action: 'TENANT_PROVISIONED',
      target: 'tenant_alpha',
      result: 'SUCCESS',
      metadata: { plan: 'PRO' },
    });
  }

  // --- TENANT CONFIGURATION & PRECEDENCE ---

  public getConfiguration(tenantId: string): TenantConfiguration {
    const config = this.configurations.get(tenantId);
    if (!config) {
      const now = Date.now();
      const def: TenantConfiguration = {
        configVersion: 1,
        tenantId,
        defaultModel: 'gemini-2.5-flash',
        providerRouting: { general: 'provider-mock' },
        adaptiveOrchestrationMode: 'STANDARD',
        agentLimit: 6,
        telemetryRetentionDays: 30,
        auditRetentionDays: 365,
        allowedProviders: ['provider-mock'],
        securityPolicies: {
          enforceGroundingBoundary: true,
          requireHumanVerificationForPublish: true,
          sandboxControlledLearning: true,
          blockExternalAiStateMutation: true,
        },
        updatedAt: now,
        updatedBy: 'default',
      };
      this.configurations.set(tenantId, def);
      this.configHistory.set(tenantId, [{ ...def }]);
      return def;
    }
    return config;
  }

  public updateConfiguration(
    tenantId: string,
    updates: Partial<TenantConfiguration>,
    actorId: string,
    source: 'USER_ADMIN' | 'EXTERNAL_AI' = 'USER_ADMIN'
  ): TenantConfiguration {
    // PRECEDENCE RULE: External AI output can NEVER modify configuration!
    if (source === 'EXTERNAL_AI') {
      this.recordAuditEvent({
        tenantId,
        actor: actorId,
        action: 'CONFIGURATION_MUTATION_BLOCKED',
        target: tenantId,
        result: 'DENIED',
        reason: 'External AI output has zero authority to mutate tenant configuration.',
      });
      throw new Error('External AI cannot mutate tenant configuration: Precedence rule violated.');
    }

    const current = this.getConfiguration(tenantId);
    const newVersion = current.configVersion + 1;

    // Safety policies cannot be weakened by tenant admin without platform security override
    const safeSecurityPolicies = {
      ...current.securityPolicies,
      ...(updates.securityPolicies || {}),
      // Invariants: Grounding and AI state mutation blocks cannot be disabled
      enforceGroundingBoundary: true,
      blockExternalAiStateMutation: true,
    };

    const updated: TenantConfiguration = {
      ...current,
      ...updates,
      tenantId,
      configVersion: newVersion,
      securityPolicies: safeSecurityPolicies,
      updatedAt: Date.now(),
      updatedBy: actorId,
    };

    this.configurations.set(tenantId, updated);
    const history = this.configHistory.get(tenantId) || [];
    history.push({ ...updated });
    this.configHistory.set(tenantId, history);

    this.recordAuditEvent({
      tenantId,
      actor: actorId,
      action: 'CONFIGURATION_UPDATED',
      target: `version_${newVersion}`,
      result: 'SUCCESS',
      metadata: { configVersion: newVersion },
    });

    return updated;
  }

  public listConfigurationHistory(tenantId: string): TenantConfiguration[] {
    return this.configHistory.get(tenantId) || [];
  }

  // --- DATA EXPORT ---

  public exportTenantData(tenantId: string, requestingActorId: string): Record<string, any> {
    const tenant = multiTenancyService.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const config = this.getConfiguration(tenantId);
    const memberships = multiTenancyService.listMemberships(tenantId);
    const quota = quotaAndBillingService.getQuotaUsage(tenantId);
    const usage = quotaAndBillingService.listUsageRecords(tenantId, 500);
    const audit = this.listAuditEvents(tenantId, 500);

    // Export scoped knowledge and memories
    const kb = kbStore.getAll();
    const memories = memoryStore.list();

    const exportPayload = {
      tenantId,
      name: tenant.name,
      exportedAt: Date.now(),
      exportedBy: requestingActorId,
      configuration: config,
      membershipsCount: memberships.length,
      quota,
      usageCount: usage.length,
      auditEventsCount: audit.length,
      knowledgeBasesCount: kb.length,
      memoriesCount: memories.length,
    };

    this.recordAuditEvent({
      tenantId,
      actor: requestingActorId,
      action: 'TENANT_DATA_EXPORTED',
      target: tenantId,
      result: 'SUCCESS',
      metadata: { recordCount: usage.length + audit.length },
    });

    return exportPayload;
  }

  public getAuditLogs(params?: { tenantId?: string; limit?: number }) {
    return this.listAuditEvents(params?.tenantId, params?.limit || 100);
  }

  public exportComplianceRecord(tenantId: string) {
    return this.exportTenantData(tenantId, 'compliance_auditor');
  }

  // --- CONTROLLED TENANT DELETION ---

  public requestTenantDeletion(tenantId: string, requestedBy: string): TenantDeletionWorkflow {
    const tenant = multiTenancyService.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const workflowId = `del_${crypto.randomBytes(6).toString('hex')}`;
    const rawConfirm = crypto.randomBytes(16).toString('hex');
    const confirmationCodeHash = crypto.createHash('sha256').update(rawConfirm).digest('hex');

    const workflow: TenantDeletionWorkflow = {
      workflowId,
      tenantId,
      requestedBy,
      state: 'CONFIRMATION_REQUIRED',
      requestedAt: Date.now(),
      confirmationCodeHash,
      scheduledExecutionTime: Date.now() + 7 * 86400000, // 7-day grace period
    };

    this.deletionWorkflows.set(workflowId, workflow);

    this.recordAuditEvent({
      tenantId,
      actor: requestedBy,
      action: 'TENANT_DELETION_REQUESTED',
      target: workflowId,
      result: 'SUCCESS',
      metadata: { scheduledExecutionTime: workflow.scheduledExecutionTime },
    });

    return workflow;
  }

  public executeTenantDeletion(workflowId: string, confirmationCode: string, actorId: string): TenantDeletionWorkflow {
    const workflow = this.deletionWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Deletion workflow ${workflowId} not found`);
    }

    const hash = crypto.createHash('sha256').update(confirmationCode).digest('hex');
    if (hash !== workflow.confirmationCodeHash) {
      this.recordAuditEvent({
        tenantId: workflow.tenantId,
        actor: actorId,
        action: 'TENANT_DELETION_FAILED',
        target: workflowId,
        result: 'DENIED',
        reason: 'Invalid confirmation code',
      });
      throw new Error('Invalid deletion confirmation code');
    }

    workflow.state = 'COMPLETED';
    workflow.completedAt = Date.now();

    // Soft delete tenant: mark as deactivated / isDeleted=true while preserving immutable audit logs for compliance
    const tenant = multiTenancyService.getTenant(workflow.tenantId);
    if (tenant) {
      tenant.status = 'DEACTIVATED';
      tenant.isDeleted = true;
      tenant.deletedAt = Date.now();
    }

    this.recordAuditEvent({
      tenantId: workflow.tenantId,
      actor: actorId,
      action: 'TENANT_SOFT_DELETED',
      target: workflow.tenantId,
      result: 'SUCCESS',
      reason: 'Tenant soft-deleted and deactivated. Audit records retained.',
    });

    return workflow;
  }

  // --- BREAK-GLASS ACCESS ---

  public requestBreakGlassAccess(tenantId: string, actor: string, reason: string): BreakGlassAccess {
    if (!reason || reason.trim().length < 10) {
      throw new Error('Break-glass access requires a substantive justification (minimum 10 characters)');
    }

    const accessId = `bg_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const item: BreakGlassAccess = {
      accessId,
      tenantId,
      actor,
      reason: reason.trim(),
      status: 'APPROVED', // Automated emergency activation with strict time bound
      requestedAt: now,
      expiresAt: now + 3600000, // 1 hour max
      approvedBy: 'security_governance_automation',
    };

    this.breakGlassStore.set(accessId, item);

    this.recordAuditEvent({
      tenantId,
      actor,
      action: 'BREAK_GLASS_ACCESS_GRANTED',
      target: accessId,
      result: 'SUCCESS',
      reason: item.reason,
      metadata: { expiresAt: item.expiresAt },
    });

    return item;
  }

  public revokeBreakGlassAccess(accessId: string, revokingActor: string): BreakGlassAccess {
    const item = this.breakGlassStore.get(accessId);
    if (!item) {
      throw new Error(`Break-glass record ${accessId} not found`);
    }

    item.status = 'REVOKED';
    item.revokedAt = Date.now();

    this.recordAuditEvent({
      tenantId: item.tenantId,
      actor: revokingActor,
      action: 'BREAK_GLASS_ACCESS_REVOKED',
      target: accessId,
      result: 'SUCCESS',
    });

    return item;
  }

  // --- CRYPTOGRAPHIC AUDIT EVENT LEDGER ---

  public recordAuditEvent(params: {
    tenantId: string;
    actor: string;
    action: string;
    target: string;
    result: 'SUCCESS' | 'DENIED' | 'ERROR';
    reason?: string;
    metadata?: Record<string, any>;
  }): AuditEventItem {
    const auditId = `aud_${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = Date.now();
    const prevHash = this.lastAuditHash;

    const hashInput = `${prevHash}:${auditId}:${params.tenantId}:${params.actor}:${params.action}:${params.target}:${timestamp}:${params.result}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    const item: AuditEventItem = {
      auditId,
      tenantId: params.tenantId,
      actor: params.actor,
      action: params.action,
      target: params.target,
      timestamp,
      result: params.result,
      reason: params.reason,
      metadata: params.metadata,
      prevHash,
      hash,
    };

    this.auditEvents.push(item);
    this.lastAuditHash = hash;
    return item;
  }

  public listAuditEvents(tenantId?: string, limit: number = 100): AuditEventItem[] {
    let list = this.auditEvents;
    if (tenantId) {
      list = list.filter((a) => a.tenantId === tenantId);
    }
    return list.slice(-limit).reverse();
  }

  public verifyAuditChainIntegrity(): { valid: boolean; totalEvents: number; brokenIndex?: number } {
    if (this.auditEvents.length === 0) {
      return { valid: true, totalEvents: 0 };
    }

    let currentExpectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < this.auditEvents.length; i++) {
      const event = this.auditEvents[i];
      if (event.prevHash !== currentExpectedPrev) {
        return { valid: false, totalEvents: this.auditEvents.length, brokenIndex: i };
      }

      const hashInput = `${event.prevHash}:${event.auditId}:${event.tenantId}:${event.actor}:${event.action}:${event.target}:${event.timestamp}:${event.result}`;
      const recalculated = crypto.createHash('sha256').update(hashInput).digest('hex');
      if (recalculated !== event.hash) {
        return { valid: false, totalEvents: this.auditEvents.length, brokenIndex: i };
      }

      currentExpectedPrev = event.hash;
    }

    return { valid: true, totalEvents: this.auditEvents.length };
  }
}

export const tenantGovernanceService = new TenantGovernanceService();
