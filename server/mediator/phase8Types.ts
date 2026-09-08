/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TaskStatus, AgentClaim, ProvenanceTrace } from './types.js';

// =========================================================================
// SECTION 3: OPERATIONAL VALIDATION MODEL
// =========================================================================

export type OperationalValidationStatus =
  | 'DETERMINISTIC_TESTED'
  | 'SIMULATED'
  | 'REAL_PROVIDER_TESTED'
  | 'STAGING_VALIDATED'
  | 'PRODUCTION_OBSERVED'
  | 'NOT_VALIDATED';

export type ExecutionEnvironment =
  | 'DETERMINISTIC_TEST'
  | 'SIMULATION'
  | 'REAL_PROVIDER_TEST'
  | 'STAGING'
  | 'PRODUCTION';

export interface ValidatedMetric<T = number | string | boolean> {
  metric: string;
  value: T;
  unit?: string;
  source: OperationalValidationStatus;
  sampleCount?: number;
  environment?: ExecutionEnvironment;
  method?: string;
  uncertainty?: string;
  measuredAt: number;
}

// =========================================================================
// SECTION 6 & 7: PROVIDER HEALTH & QUALITY
// =========================================================================

export interface ProviderHealthProfile {
  providerId: string;
  modelId: string;
  availability: number; // 0.0 - 1.0
  successRate: number; // 0.0 - 1.0
  timeoutRate: number; // 0.0 - 1.0
  errorRate: number; // 0.0 - 1.0
  latencyP50: number; // ms
  latencyP95: number; // ms
  latencyP99: number; // ms
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  rateLimitEvents: number;
  lastSuccessfulRequest?: number;
  lastFailure?: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  validationSource: OperationalValidationStatus;
}

export interface ProviderQualityScorecard {
  providerId: string;
  modelId: string;
  groundedCorrectness: number;
  unsupportedClaimRate: number;
  verificationSuccess: number;
  contradictionDetection: number;
  citationValidity: number;
  refusalCorrectness: number;
  latencyMs: number;
  tokenUsage: number;
  failureRate: number;
  modelConfidenceVsEvidenceDelta: number; // Distinguish confidence from evidence
}

// =========================================================================
// SECTION 8 & 9: GOLDEN EVALUATION DATASET & VERSIONING
// =========================================================================

export type GoldenCaseCategory =
  | 'GROUNDING'
  | 'MULTI_AGENT'
  | 'SECURITY'
  | 'ADAPTIVE'
  | 'RELIABILITY';

export type ExpectedGroundingClassification =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'UNCERTAIN'
  | 'SECURITY_BLOCKED';

export interface GoldenTestCase {
  caseId: string;
  category: GoldenCaseCategory;
  name: string;
  taskPrompt: string;
  subtaskPrompts?: Array<{ title: string; description: string; expectedClassification?: string }>;
  expectedClassification: ExpectedGroundingClassification;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  adversarialPayload?: boolean;
  requiredProvenanceTags?: string[];
}

export interface GoldenEvaluationDataset {
  datasetId: string;
  datasetVersion: string;
  createdAt: number;
  updatedAt: number;
  testCount: number;
  checksum: string;
  cases: GoldenTestCase[];
}

// =========================================================================
// SECTION 10: REAL-WORLD QUALITY EVALUATION RUN
// =========================================================================

export interface EvaluationRun {
  runId: string;
  datasetId: string;
  datasetVersion: string;
  providerId: string;
  modelId: string;
  orchestrationMode: 'FIXED_1' | 'FIXED_4' | 'FIXED_10' | 'ADAPTIVE';
  seed: number;
  startedAt: number;
  completedAt: number;
  taskCount: number;
  successfulTasks: number;
  failedTasks: number;
  metrics: {
    groundingAccuracy: number;
    verificationAccuracy: number;
    unsupportedClaimRate: number;
    contradictionDetectionRate: number;
    falseConfidenceRate: number;
    citationValidity: number;
    securityRejectionRate: number;
    avgLatencyMs: number;
    tokenUsage: { input: number; output: number; total: number };
  };
}

// =========================================================================
// SECTION 11 & 12: HUMAN EVALUATION & INTER-RATER AGREEMENT
// =========================================================================

export interface HumanEvaluationRecord {
  evaluationId: string;
  taskId: string;
  reviewerRole: 'SYSTEMS_DIRECTOR' | 'DOMAIN_EXPERT' | 'SAFETY_OFFICER' | 'OPERATOR';
  groundingCorrect: boolean;
  unsupportedClaims: boolean;
  citationCorrect: boolean;
  securityCorrect: boolean;
  overallAssessment: 'ACCEPT' | 'REJECT' | 'NEEDS_REVISION';
  notes?: string;
  timestamp: number;
}

export interface InterRaterAgreementReport {
  taskId: string;
  evaluationsCount: number;
  agreementPercentage: number;
  status: 'HIGH_AGREEMENT' | 'MODERATE_AGREEMENT' | 'DISAGREEMENT' | 'NOT_ENOUGH_DATA';
  details: string;
}

// =========================================================================
// SECTION 13 & 14: TRACEABILITY & STRUCTURED OBSERVABILITY
// =========================================================================

export interface FullTraceSpan {
  requestId: string;
  taskId: string;
  orchestrationRunId: string;
  subtaskId: string;
  agentExecutionId: string;
  providerRequestId?: string;
  evidenceClaimId: string;
  verificationId: string;
  eventId: string;
  durations: {
    requestDurationMs: number;
    queueDurationMs: number;
    planningDurationMs: number;
    providerDurationMs: number;
    verificationDurationMs: number;
    synthesisDurationMs: number;
    persistenceDurationMs: number;
  };
  sanitized: boolean;
  timestamp: number;
}

export interface StructuredTelemetryEvent {
  eventId: string;
  timestamp: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  component: string;
  action: string;
  trace: Partial<FullTraceSpan>;
  metadata: Record<string, any>;
  redactedSecretsCount: number;
}

// =========================================================================
// SECTION 17, 18, 19: SLI, SLO & ERROR BUDGETS
// =========================================================================

export interface SliReport {
  availability: number; // Successful eligible / total eligible
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  errorRate: number; // Failed requests / total
  groundingSuccessRate: number; // Grounding workflow success
  verificationIntegrityRate: number; // Correct verification / evaluated
  recoveryRate: number; // Recovered transient failures / recoverable
  measuredPeriodMs: number;
  source: OperationalValidationStatus;
}

export interface SloConfiguration {
  availabilityTarget: number; // e.g. 0.999
  p95LatencyTargetMs: number; // e.g. 200
  errorRateTarget: number; // e.g. 0.01
  recoveryTarget: number; // e.g. 0.95
}

export interface SloStatusReport {
  target: SloConfiguration;
  actual: SliReport;
  status: 'COMPLIANT' | 'BREACHED' | 'AT_RISK';
  errorBudget: {
    configured: boolean;
    allowedFailures: number;
    actualFailures: number;
    remainingBudget: number;
    budgetConsumedRatio: number;
    status: 'HEALTHY' | 'DEPLETED' | 'ERROR_BUDGET_NOT_CONFIGURED';
  };
}

// =========================================================================
// SECTION 20 & 21: ALERTING MODEL
// =========================================================================

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AlertType =
  | 'HIGH_ERROR_RATE'
  | 'HIGH_LATENCY'
  | 'PROVIDER_OUTAGE'
  | 'PROVIDER_TIMEOUT_SPIKE'
  | 'RETRY_STORM'
  | 'QUEUE_GROWTH'
  | 'RESOURCE_EXHAUSTION'
  | 'LEDGER_INTEGRITY_FAILURE'
  | 'AUTH_ANOMALY'
  | 'AUTHORIZATION_FAILURE'
  | 'CROSS_TENANT_ISOLATION_FAILURE'
  | 'GROUNDING_FAILURE_SPIKE'
  | 'UNEXPECTED_MEMORY_PROMOTION'
  | 'UNAUTHORIZED_KV_MUTATION'
  | 'CREDENTIAL_EXPOSURE';

export interface AlertEvent {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  resolved: boolean;
}

// =========================================================================
// SECTION 23: REAL PROVIDER BUDGET CONTROLS
// =========================================================================

export interface RealProviderBudget {
  maxRequests: number;
  maxConcurrentRequests: number;
  maxTokens: number;
  maxExecutionTimeMs: number;
  maxEstimatedCostUnits: number;
}

export interface RealProviderBudgetStatus {
  budget: RealProviderBudget;
  usedRequests: number;
  activeConcurrentRequests: number;
  usedTokens: number;
  elapsedTimeMs: number;
  usedCostUnits: number;
  costReported: string | number; // "UNKNOWN" if unavailable
  limitReached: boolean;
  status: 'WITHIN_BUDGET' | 'BUDGET_LIMIT_REACHED';
}

// =========================================================================
// SECTION 30 & 31: CAPACITY & HORIZONTAL SCALING
// =========================================================================

export type CapacityProfile = 'SMALL' | 'MEDIUM' | 'LARGE';

export type HorizontalScalingClassification =
  | 'SAFE_FOR_MULTI_INSTANCE'
  | 'REQUIRES_SHARED_STATE'
  | 'REQUIRES_COORDINATION'
  | 'SINGLE_NODE_ONLY';

export interface ArchitecturalComponentScalingAudit {
  componentName: string;
  classification: HorizontalScalingClassification;
  stateType: 'IN_MEMORY' | 'LOCAL_CACHE' | 'LOCAL_QUEUE' | 'STATELESS' | 'PERSISTENT_LEDGER';
  justification: string;
  mitigationForMultiInstance: string;
}

// =========================================================================
// SECTION 33 & 34: DISASTER RECOVERY & BACKUP / RESTORE
// =========================================================================

export interface DisasterRecoveryProfile {
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  backupStatus: 'HEALTHY' | 'DEGRADED' | 'NOT_CONFIGURED';
  restoreTestStatus: 'TESTED_AND_VERIFIED' | 'FAILED' | 'NOT_VALIDATED';
  lastSuccessfulRestoreValidation?: number;
  ledgerIntegritySurvives: boolean;
  knowledgeVersionSurvives: boolean;
  provenanceSurvives: boolean;
  memoryLifecycleSurvives: boolean;
}

// =========================================================================
// SECTION 36, 37, 38: DEPLOYMENT, FEATURE FLAGS & CONFIG DRIFT
// =========================================================================

export type DeploymentRoutingMode = 'CANARY' | 'FULL' | 'ROLLBACK';

export interface CanaryConfiguration {
  mode: DeploymentRoutingMode;
  canaryTrafficPercentage: number;
  targetProvider: string;
  targetModel: string;
  minEvaluationScore: number;
  status: 'ACTIVE' | 'ROLLED_BACK' | 'PROMOTED_TO_FULL';
}

export interface FeatureFlagAuditItem {
  name: string;
  description: string;
  defaultValue: boolean | string;
  currentValue: boolean | string;
  ownerRole: string;
  createdAt: number;
  isSecurityCritical: boolean;
}

export interface ConfigurationSnapshot {
  snapshotId: string;
  version: string;
  timestamp: number;
  agentLimits: { maxAgents: number; maxRetries: number; maxRounds: number };
  providerConfig: { defaultProvider: string; timeoutMs: number };
  groundingConfig: { strictFactualMode: boolean; minVerificationScore: number };
  adaptiveThresholds: { complexityThreshold: number; riskThreshold: number };
  featureFlags: Record<string, any>;
  checksum: string;
}

export interface ConfigurationDriftReport {
  hasDrift: boolean;
  baseSnapshotVersion: string;
  currentSnapshotVersion: string;
  divergentKeys: string[];
  severity: 'NONE' | 'LOW' | 'HIGH';
  timestamp: number;
}

// =========================================================================
// SECTION 44: HUMAN APPROVAL WORKFLOW FOR MODEL CHANGES
// =========================================================================

export type ModelChangeStatus =
  | 'PROPOSED'
  | 'EVALUATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEPLOYED'
  | 'ROLLED_BACK';

export interface ModelChangeProposal {
  proposalId: string;
  proposedProvider: string;
  proposedModel: string;
  proposedBy: string;
  evaluationRunId?: string;
  status: ModelChangeStatus;
  regressionGateStatus: 'ALLOW' | 'WARN' | 'BLOCK';
  rationale: string;
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNotes?: string;
}

// =========================================================================
// SECTION 54: INCIDENT MANAGEMENT
// =========================================================================

export type IncidentState =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'CONTAINED'
  | 'RECOVERING'
  | 'RESOLVED'
  | 'POSTMORTEM';

export interface ProductionIncidentRecord {
  incidentId: string;
  title: string;
  severity: AlertSeverity;
  state: IncidentState;
  createdAt: number;
  updatedAt: number;
  affectedSubsystems: string[];
  actionsTaken: string[];
  resolution?: string;
  requiresRollback: boolean;
}

// =========================================================================
// SECTION 56 & 57: DEPLOYMENT READINESS DASHBOARD & PRODUCTION GATES
// =========================================================================

export type DeploymentGateName =
  | 'CODE'
  | 'TESTS'
  | 'SECURITY'
  | 'DATA'
  | 'OBSERVABILITY'
  | 'BACKUP'
  | 'RECOVERY'
  | 'PERFORMANCE'
  | 'MODEL_EVALUATION'
  | 'CONFIGURATION'
  | 'ROLLBACK';

export type GateEvaluationResult = 'PASS' | 'WARN' | 'FAIL' | 'NOT_VALIDATED';

export type ProductionReadinessState =
  | 'NOT_READY'
  | 'CONDITIONALLY_READY'
  | 'READY_FOR_CANARY'
  | 'CANARY_VALIDATED'
  | 'PRODUCTION_READY'
  | 'ROLLBACK_REQUIRED';

export interface DeploymentGateReport {
  gate: DeploymentGateName;
  status: GateEvaluationResult;
  score: number; // 0.0 - 1.0
  validationSource: OperationalValidationStatus;
  findings: string[];
  mandatoryForCanary: boolean;
  mandatoryForProduction: boolean;
}

export interface Phase8OperationalReadinessReport {
  overallStatus: ProductionReadinessState;
  timestamp: number;
  buildVersion: string;
  gates: Record<DeploymentGateName, DeploymentGateReport>;
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
      mediatorP8: { passed: number; total: number };
    };
    cumulativeTotal: number;
    cumulativePassed: number;
  };
  observability: {
    slis: SliReport;
    slos: SloStatusReport;
    activeAlerts: AlertEvent[];
    recentTracesCount: number;
  };
  providers: {
    healthProfiles: ProviderHealthProfile[];
    activeCanary: CanaryConfiguration;
  };
  operationalLimitations: Array<{
    limitation: string;
    impact: string;
    detection: string;
    mitigation: string;
    validationStatus: OperationalValidationStatus;
  }>;
}
