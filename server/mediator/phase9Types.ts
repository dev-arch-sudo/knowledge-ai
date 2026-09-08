/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OperationalValidationStatus } from './phase8Types.js';

// =========================================================================
// SECTION 1: TENANCY & MEMBERSHIP
// =========================================================================

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING';

export interface Tenant {
  tenantId: string;
  name: string;
  status: TenantStatus;
  planId: string; // 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'
  createdAt: number;
  updatedAt: number;
  configurationVersion: number;
  customSettings?: Record<string, any>;
  deletedAt?: number;
  isDeleted?: boolean;
}

export type TenantRole =
  | 'OWNER'
  | 'ADMIN'
  | 'DEVELOPER'
  | 'OPERATOR'
  | 'ANALYST'
  | 'MEMBER'
  | 'VIEWER';

export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface TenantMembership {
  membershipId: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  status: MembershipStatus;
  createdAt: number;
  updatedAt: number;
}

export interface TenantInvitation {
  invitationId: string;
  tenantId: string;
  emailHash: string;
  role: TenantRole;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  tokenHash: string; // Never plaintext token in storage/logs
  expiresAt: number;
  createdAt: number;
}

export type OwnershipTransferStatus =
  | 'REQUESTED'
  | 'PENDING_CONFIRMATION'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface OwnershipTransfer {
  transferId: string;
  tenantId: string;
  currentOwnerId: string;
  targetUserId: string;
  status: OwnershipTransferStatus;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
}

// =========================================================================
// SECTION 2: RBAC & PERMISSIONS
// =========================================================================

export type Permission =
  | 'knowledge.read'
  | 'knowledge.write'
  | 'knowledge.publish'
  | 'memory.read'
  | 'memory.manage'
  | 'mediator.execute'
  | 'mediator.configure'
  | 'provider.manage'
  | 'evaluation.run'
  | 'evaluation.review'
  | 'telemetry.read'
  | 'billing.read'
  | 'billing.manage'
  | 'members.manage'
  | 'apiKeys.create'
  | 'apiKeys.revoke'
  | 'configuration.manage'
  | 'security.audit';

export interface AuthenticatedPrincipal {
  userId: string;
  email?: string;
  isPlatformAdmin?: boolean;
  tenantMemberships: Record<string, { role: TenantRole; status: MembershipStatus }>;
}

export interface SecurityContext {
  authenticatedPrincipal: AuthenticatedPrincipal;
  effectiveTenantId: string;
  effectiveRole: TenantRole;
  effectivePermissions: Set<Permission>;
  apiKeyId?: string;
}

// =========================================================================
// SECTION 3: API MANAGEMENT & API KEYS
// =========================================================================

export type ApiKeyStatus = 'ACTIVE' | 'ROTATING' | 'REVOKED' | 'EXPIRED';

export interface ApiKey {
  keyId: string;
  tenantId: string;
  name: string;
  prefix: string; // e.g. "sk_live_abc"
  secretHash: string; // SHA-256 hash of plaintext
  scopes: string[]; // e.g. ['knowledge:read', 'mediator:execute']
  status: ApiKeyStatus;
  createdAt: number;
  expiresAt?: number;
  lastUsedAt?: number;
  createdBy: string;
  rotatedKeyId?: string;
}

export interface ApiKeyCreationResult {
  apiKey: ApiKey;
  plaintextSecret: string; // ONLY returned once on creation
}

// =========================================================================
// SECTION 4: RATE LIMITING & QUOTA
// =========================================================================

export type QuotaStatus =
  | 'WITHIN_LIMIT'
  | 'WARNING'
  | 'LIMIT_REACHED'
  | 'BLOCKED'
  | 'UNAVAILABLE';

export interface QuotaPolicy {
  tenantId: string;
  maxApiRequestsPerMin: number;
  maxMediatorRunsPerDay: number;
  maxAgentExecutionsPerDay: number;
  maxProviderRequestsPerMin: number;
  maxTokensPerMonth: number;
  maxStorageMb: number;
  maxConcurrentRuns: number;
  warningThresholdPct: number; // e.g. 80
}

export interface QuotaUsage {
  tenantId: string;
  apiRequestsCurrentMin: number;
  mediatorRunsToday: number;
  agentExecutionsToday: number;
  providerRequestsCurrentMin: number;
  tokensThisMonth: number;
  storageMbUsed: number;
  concurrentRunsActive: number;
  status: QuotaStatus;
  warningMessage?: string;
}

// =========================================================================
// SECTION 5: BILLING ABSTRACTION & USAGE METERING
// =========================================================================

export type BillingStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type BillingProviderSource = 'MOCK' | 'REAL' | 'UNKNOWN';

export interface BillingAccount {
  accountId: string;
  tenantId: string;
  planId: string;
  status: BillingStatus;
  providerSource: BillingProviderSource;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  currency: string;
  lastInvoiceStatus?: 'PAID' | 'PENDING' | 'FAILED' | 'UNKNOWN';
}

export interface UsageRecord {
  usageId: string;
  tenantId: string;
  requestId: string;
  taskId?: string;
  providerId?: string;
  modelId?: string;
  metric: 'api_request' | 'mediator_run' | 'agent_execution' | 'provider_call' | 'evaluation_run' | 'tokens' | 'storage_mb';
  quantity: number;
  unit: string;
  timestamp: number;
  source: 'MEASURED' | 'ESTIMATED' | 'UNKNOWN';
}

export interface PlanConfig {
  planId: string;
  name: string;
  maxUsers: number;
  maxKnowledgeBases: number;
  maxStorageMb: number;
  maxMediatorRunsPerDay: number;
  maxConcurrentRuns: number;
  maxApiRequestsPerMin: number;
  maxTokensPerMonth: number;
  maxEvaluationsPerDay: number;
  availableProviders: string[];
  availableFeatures: FeatureEntitlement[];
}

export type FeatureEntitlement =
  | 'mediator'
  | 'adaptive_orchestration'
  | 'real_provider'
  | 'evaluation'
  | 'advanced_telemetry'
  | 'api_access'
  | 'webhooks'
  | 'advanced_governance';

export interface BillingReconciliationDiscrepancy {
  metric: string;
  internalUsage: number;
  providerUsage: number;
  difference: number;
  status: 'MATCH' | 'DISCREPANCY' | 'UNVERIFIABLE';
}

// =========================================================================
// SECTION 6: WEBHOOKS
// =========================================================================

export interface WebhookEndpoint {
  endpointId: string;
  tenantId: string;
  url: string;
  events: string[];
  secretHash: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: number;
  failureCount: number;
}

export interface WebhookEvent {
  eventId: string;
  tenantId: string;
  category: string;
  payload: Record<string, any>;
  timestamp: number;
}

export interface WebhookDelivery {
  deliveryId: string;
  eventId: string;
  endpointId: string;
  tenantId: string;
  attempt: number;
  maxRetries: number;
  status: 'SUCCESS' | 'FAILED' | 'RETRYING';
  httpStatus?: number;
  failureReason?: string;
  timestamp: number;
  durationMs: number;
}

// =========================================================================
// SECTION 7: TENANT GOVERNANCE, CONFIGURATION & DATA LIFECYCLE
// =========================================================================

export interface TenantConfiguration {
  configVersion: number;
  tenantId: string;
  defaultModel: string;
  providerRouting: Record<string, string>;
  adaptiveOrchestrationMode: 'STANDARD' | 'PARALLEL' | 'ADAPTIVE';
  agentLimit: number;
  telemetryRetentionDays: number;
  auditRetentionDays: number;
  allowedProviders: string[];
  securityPolicies: {
    enforceGroundingBoundary: boolean;
    requireHumanVerificationForPublish: boolean;
    sandboxControlledLearning: boolean;
    blockExternalAiStateMutation: boolean;
  };
  updatedAt: number;
  updatedBy: string;
}

export type TenantDeletionState =
  | 'REQUESTED'
  | 'CONFIRMATION_REQUIRED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface TenantDeletionWorkflow {
  workflowId: string;
  tenantId: string;
  requestedBy: string;
  state: TenantDeletionState;
  requestedAt: number;
  confirmationCodeHash?: string;
  scheduledExecutionTime?: number;
  completedAt?: number;
}

export type BreakGlassStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED';

export interface BreakGlassAccess {
  accessId: string;
  tenantId: string;
  actor: string;
  reason: string;
  status: BreakGlassStatus;
  requestedAt: number;
  expiresAt: number;
  approvedBy?: string;
  revokedAt?: number;
}

export interface AuditEventItem {
  auditId: string;
  tenantId: string;
  actor: string;
  action: string;
  target: string;
  timestamp: number;
  result: 'SUCCESS' | 'DENIED' | 'ERROR';
  reason?: string;
  metadata?: Record<string, any>;
  prevHash?: string;
  hash: string;
}

// =========================================================================
// SECTION 8: READINESS GATES & REPORTS
// =========================================================================

export type Phase9GateKey =
  | 'TENANCY'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'API_SECURITY'
  | 'QUOTAS'
  | 'BILLING'
  | 'DATA_LIFECYCLE'
  | 'GOVERNANCE'
  | 'OBSERVABILITY'
  | 'SECURITY'
  | 'BACKWARD_COMPATIBILITY';

export interface Phase9ReadinessGate {
  gate: Phase9GateKey;
  status: 'PASS' | 'WARN' | 'FAIL' | 'NOT_VALIDATED';
  score: number;
  validationSource: OperationalValidationStatus;
  findings: string[];
}

export type Phase9ReadinessStatus =
  | 'NOT_READY'
  | 'CONDITIONALLY_READY'
  | 'READY_FOR_CANARY'
  | 'CANARY_VALIDATED'
  | 'PRODUCTION_READY'
  | 'ROLLBACK_REQUIRED';

export interface Phase9SaaSReadinessReport {
  overallStatus: Phase9ReadinessStatus;
  timestamp: number;
  buildVersion: string;
  technicalReady: boolean;
  securityReady: boolean;
  operationalReady: boolean;
  commercialBillingStatus: 'CONFIGURED' | 'NOT_CONFIGURED';
  gates: Record<Phase9GateKey, Phase9ReadinessGate>;
  summary: {
    totalTenants: number;
    activeTenants: number;
    membershipsTotal: number;
    apiKeysTotal: number;
    usageRecordsTotal: number;
    auditEventsTotal: number;
  };
  limitations: Array<{
    id: string;
    title: string;
    description: string;
    impact: string;
  }>;
}
