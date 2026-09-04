/**
 * Mediator Phase 6: Adaptive Evidence-Driven Multi-Agent Orchestration Types
 * Implements complexity assessment, risk profiling, claim-level evidence models,
 * evidence independence, bounded escalation, and confidence calibration.
 */

import {
  OrchestrationRun,
  OrchestrationRunConfig,
  ProvenanceTrace,
  VerificationClassification,
} from './types.js';

export type OrchestrationMode = 'FIXED' | 'ADAPTIVE';

export type AdaptiveStrategy =
  | 'SINGLE_AGENT'
  | 'PARALLEL'
  | 'SEQUENTIAL'
  | 'HYBRID'
  | 'ESCALATED';

export type VerificationDecisionOutcome =
  | 'SUFFICIENT'
  | 'INSUFFICIENT'
  | 'CONTRADICTORY'
  | 'REQUIRES_INDEPENDENT_VERIFIER';

export type StopConditionType =
  | 'EVIDENCE_SUFFICIENT'
  | 'AUTHORITATIVE_CONTRADICTION'
  | 'INSUFFICIENT_EVIDENCE'
  | 'BUDGET_EXHAUSTED'
  | 'TIME_LIMIT_REACHED'
  | 'ESCALATION_LIMIT_REACHED'
  | 'NEGLIGIBLE_INFORMATION_GAIN'
  | 'SECURITY_BOUNDARY_TRIGGERED';

export interface TaskComplexityProfile {
  complexityScore: number; // 0.0 - 1.0 (bounded normalized)
  reasoningDepthEstimate: number; // 1 - 5
  domainCount: number;
  dependencyCount: number;
  ambiguityScore: number; // 0.0 - 1.0
  contradictionRisk: number; // 0.0 - 1.0
  groundingImportance: number; // 0.0 - 1.0
  adversarialRisk: number; // 0.0 - 1.0
  estimatedSubtaskCount: number;
  requiresIndependentVerification: boolean;
  rationale: string[];
}

export interface TaskRiskProfile {
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factualRisk: number; // 0.0 - 1.0
  securityRisk: number; // 0.0 - 1.0
  contradictionRisk: number; // 0.0 - 1.0
  hallucinationRisk: number; // 0.0 - 1.0
  promptInjectionRisk: number; // 0.0 - 1.0
  provenanceRisk: number; // 0.0 - 1.0
  externalSourceDependency: number; // 0.0 - 1.0
  impactOfIncorrectOutput: number; // 0.0 - 1.0
  verificationRequirements: string[];
}

export interface EvidenceClaim {
  claimId: string;
  text: string;
  agentId: string;
  providerId?: string;
  evidenceRefs: string[];
  knowledgeVersionId?: string;
  supportStatus: 'SUPPORTED' | 'CONTRADICTED' | 'UNCERTAIN' | 'UNSUPPORTED';
  independenceScore: number; // 0.0 - 1.0
  provenance: ProvenanceTrace;
}

export interface EvidenceIndependenceProfile {
  overallIndependenceScore: number; // 0.0 - 1.0
  sourceOverlap: number; // 0.0 - 1.0 (1.0 = identical sources, 0.0 = completely disjoint)
  promptOverlap: number; // 0.0 - 1.0
  knowledgeOverlap: number; // 0.0 - 1.0
  providerOverlap: number; // 0.0 - 1.0
  claimOverlap: number; // 0.0 - 1.0
  evidenceOverlap: number; // 0.0 - 1.0
  correlatedAgentGroups: Array<{
    groupName: string;
    agentIds: string[];
    reason: string;
  }>;
  isCorrelated: boolean;
}

export interface VerificationPlan {
  decision: VerificationDecisionOutcome;
  reasons: string[];
  requiresIndependentVerifier: boolean;
  targetClaimsToVerify: string[];
  groundingContextDocs: string[];
}

export interface ConfidenceCalibrationProfile {
  reportedConfidence: number; // Model self-reported
  calibratedConfidence: number; // Grounded evidence derived
  evidenceSupportScore: number; // 0.0 - 1.0
  groundingStatus: VerificationClassification;
  isFalseConfidence: boolean; // Flagged when high confidence + weak or no evidence
  flags: string[];
}

export interface AdaptiveBudgetConfig {
  minAgents: number;
  maxAgents: number;
  maxEscalationRounds: number;
  maxTotalAgentCalls: number;
  maxExecutionTimeMs: number;
  maxEstimatedCostUnits: number;
  maxDelegationDepth: number;
}

export interface AdaptiveBudget {
  agentCalls: number;
  parallelAgentCalls: number;
  executionTimeMs: number;
  estimatedCostUnits: number;
  tokensIn: number;
  tokensOut: number;
  retries: number;
  reassignments: number;
  verificationCalls: number;
  escalationRounds: number;
}

export interface AdaptiveEscalationRecord {
  round: number;
  escalationReason: string;
  previousEvidenceSummary: string;
  newCapabilityRequested: string;
  newAgentAdded: string;
  expectedInformationGain: number; // 0.0 - 1.0
  actualInformationGain: number; // 0.0 - 1.0
}

export interface StopCondition {
  condition: StopConditionType;
  reason: string;
  stopTimestamp: number;
}

export interface TrustedSourceConflictRecord {
  conflictId: string;
  sourceA: string;
  sourceB: string;
  versionA: string;
  versionB: string;
  claimA: string;
  claimB: string;
  contradictionType: string;
  detectedAt: number;
}

export interface AgentAssignmentPlan {
  agentId: string;
  role: string;
  capability: string;
  domain: string;
  correlationGroup?: string;
}

export interface AdaptivePlan {
  taskPrompt: string;
  orchestrationMode: OrchestrationMode;
  strategy: AdaptiveStrategy;
  complexity: TaskComplexityProfile;
  risk: TaskRiskProfile;
  initialAgentCount: number;
  selectedAgents: AgentAssignmentPlan[];
  budgetLimits: AdaptiveBudgetConfig;
  rationale: string[];
}

export interface AdaptiveRunResult {
  runId: string;
  orchestrationMode: OrchestrationMode;
  plan: AdaptivePlan;
  budget: AdaptiveBudget;
  escalations: AdaptiveEscalationRecord[];
  evidenceClaims: EvidenceClaim[];
  independenceProfile: EvidenceIndependenceProfile;
  confidenceCalibration: ConfidenceCalibrationProfile;
  trustedSourceConflict?: TrustedSourceConflictRecord;
  stopCondition: StopCondition;
  finalDecision: {
    classification: VerificationClassification;
    consensusSignal: string;
    evidenceSignal: string;
    rationale: string;
    summary: string;
  };
  unsupportedSynthesisClaims: string[];
  underlyingOrchestrationRun: OrchestrationRun;
}

export interface BenchmarkConfigComparison {
  accuracy: number;
  verificationRate: number;
  unsupportedClaimRate: number;
  falseConfidenceRate: number;
  avgAgents: number;
  avgLatencyMs: number;
  escalationRate: number;
  unnecessaryAgentRate: number;
  parallelSpeedup: number;
  budgetUtilization: number;
  totalCostUnits: number;
}

export interface ComparativeBenchmarkResult {
  id: string;
  name: string;
  seed: number;
  timestamp: number;
  configurations: {
    FIXED_1: BenchmarkConfigComparison;
    FIXED_4: BenchmarkConfigComparison;
    FIXED_10: BenchmarkConfigComparison;
    ADAPTIVE: BenchmarkConfigComparison;
  };
  summaryAnalysis: string;
  efficiencyVerdict: string;
}
