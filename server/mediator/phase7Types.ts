/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =========================================================================
// KNOWLEDGE AI + MEDIATOR PHASE 7: TYPES & PRODUCTION READINESS CONTRACTS
// =========================================================================

export type ProductionReadinessCategory =
  | 'CORRECTNESS'
  | 'SECURITY'
  | 'RELIABILITY'
  | 'PERFORMANCE'
  | 'SCALABILITY'
  | 'OBSERVABILITY'
  | 'DATA_INTEGRITY'
  | 'API_STABILITY'
  | 'RESOURCE_CONTROL'
  | 'RECOVERY'
  | 'REGRESSION';

export type ProductionReadinessGate =
  | 'NOT_READY'
  | 'CONDITIONALLY_READY'
  | 'READY_FOR_STAGING'
  | 'PRODUCTION_READY';

export interface CategoryReadinessReport {
  category: ProductionReadinessCategory;
  status: 'PASS' | 'WARN' | 'FAIL';
  score?: number; // 0.0 to 1.0
  tests: number;
  passed: number;
  failed: number;
  warnings: number;
  evidence: string[];
}

export interface ProductionReadinessReport {
  overallStatus: ProductionReadinessGate;
  timestamp: number;
  buildVersion: string;
  categories: Record<ProductionReadinessCategory, CategoryReadinessReport>;
  criticalFailures: string[];
  warnings: string[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    regressionSuites: {
      knowledgeAIP4: { passed: number; total: number };
      mediatorP3: { passed: number; total: number };
      mediatorP4: { passed: number; total: number };
      mediatorP5: { passed: number; total: number };
      mediatorP6: { passed: number; total: number };
      mediatorP7: { passed: number; total: number };
      mediatorP8?: { passed: number; total: number };
    };
  };
  performanceMetrics: {
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    throughputRps: number;
    agentCallCount: number;
    retryRate: number;
    escalationRate: number;
  };
  reliabilityMetrics: {
    successRate: number;
    timeoutRate: number;
    recoveryRate: number;
    cancellationRate: number;
    partialFailureRate: number;
  };
  resourceLimits: {
    maxAgents: number;
    maxSubtasks: number;
    maxRetries: number;
    maxDelegationDepth: number;
    maxExecutionTimeMs: number;
    maxQueueDepth: number;
  };
}

export enum StandardizedErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  ORCHESTRATION_ERROR = 'ORCHESTRATION_ERROR',
  GROUNDING_ERROR = 'GROUNDING_ERROR',
  VERIFICATION_ERROR = 'VERIFICATION_ERROR',
  RESOURCE_LIMIT = 'RESOURCE_LIMIT',
  CANCELLATION = 'CANCELLATION',
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR',
  LEDGER_INTEGRITY_ERROR = 'LEDGER_INTEGRITY_ERROR',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
}

export type LimitationStatus = 'TESTED' | 'ASSUMED' | 'NOT_TESTED';

export interface ProductionLimitationItem {
  id: string;
  category: string;
  description: string;
  status: LimitationStatus;
  mitigation: string;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SystemHealthComponent {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  latencyMs?: number;
  details?: Record<string, any>;
}

export interface SystemHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: number;
  components: {
    api: SystemHealthComponent;
    mediator: SystemHealthComponent;
    knowledgeAI: SystemHealthComponent;
    grounding: SystemHealthComponent;
    persistence: SystemHealthComponent;
    eventLedger: SystemHealthComponent;
    providers: SystemHealthComponent;
    adaptiveOrchestration: SystemHealthComponent;
  };
}

export interface ConcurrencyTestResult {
  concurrencyLevel: number;
  successfulRuns: number;
  failedRuns: number;
  queueTimeMs: number;
  executionTimeMs: number;
  throughputRps: number;
  eventsCount: number;
  databaseOperations: number;
  providerCalls: number;
  hasRaceConditions: boolean;
}

export interface IsolationAuditResult {
  contextIsolated: boolean;
  memoryIsolated: boolean;
  provenanceIsolated: boolean;
  eventIsolated: boolean;
  cacheIsolated: boolean;
  taskStateIsolated: boolean;
  crossTenantLeaked: boolean;
  details: string[];
}

export interface StateMachineAuditResult {
  validTransitionsAllowed: boolean;
  illegalTransitionsRejected: boolean;
  auditedTransitions: {
    from: string;
    to: string;
    expectedOutcome: 'ALLOW' | 'REJECT';
    actualOutcome: 'ALLOW' | 'REJECT';
    passed: boolean;
  }[];
}

export interface FeatureFlagConfig {
  adaptiveOrchestrationEnabled: boolean;
  backpressureEnabled: boolean;
  strictLedgerVerification: boolean;
  secretRedactionAudit: boolean;
}
