/**
 * AI-to-AI Mediator & Multi-Agent Orchestration Types
 * Phase 5: Reliability, Evaluation & Adversarial Testing Layer
 */

export type ExecutionMode = 'SEQUENTIAL' | 'PARALLEL' | 'HYBRID';
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_COMPLETED';
export type SubtaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT' | 'SKIPPED';
export type PartialFailurePolicy = 'CONTINUE_WITH_PARTIAL_RESULTS' | 'FAIL_PARENT_TASK' | 'RETRY' | 'REASSIGN';

export type ClaimAgreement = 'AGREE' | 'DISAGREE' | 'CONDITIONAL' | 'INSUFFICIENT_INFORMATION';
export type VerificationClassification = 'SUPPORTED' | 'CONTRADICTED' | 'UNCERTAIN';

export type FaultInjectionMode =
  | 'NORMAL'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'MALFORMED'
  | 'ERROR'
  | 'WRONG_RESULT'
  | 'CONTRADICTORY_RESULT'
  | 'PROMPT_INJECTION'
  | 'FABRICATED_CITATION'
  | 'PROVENANCE_TAMPERING'
  | 'SLOW_RESPONSE'
  | 'CORRECT'
  | 'WRONG'
  | 'AMBIGUOUS'
  | 'CONTRADICTORY'
  | 'HIGH_CONFIDENCE_WRONG'
  | 'CORRELATED_WRONG'
  | 'MALICIOUS_SYNTHESIS'
  | 'TRUSTED_SOURCE_CONFLICT'
  | 'LOW_INFORMATION_GAIN';

export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  provider: 'mock' | 'gemini' | 'external';
  modelIdentifier?: string;
  capabilities: string[];
  isExternal: boolean;
  untrusted: boolean; // Must always be true for external/mediator agents
  systemPromptModifier?: string;
  faultMode?: FaultInjectionMode;
  failureRate?: number;
  fixedDelayMs?: number;
  correlationGroup?: string; // For testing correlated vs independent agents
}

export interface OrchestrationEvent {
  eventId: string;
  runId: string;
  taskId: string;
  subtaskId?: string;
  timestamp: number;
  eventType:
    | 'TASK_CREATED'
    | 'PLAN_CREATED'
    | 'SUBTASK_CREATED'
    | 'AGENT_ASSIGNED'
    | 'SUBTASK_STARTED'
    | 'SUBTASK_COMPLETED'
    | 'SUBTASK_FAILED'
    | 'AGENT_REASSIGNED'
    | 'RETRY_STARTED'
    | 'AGGREGATION_STARTED'
    | 'SYNTHESIS_STARTED'
    | 'SYNTHESIS_COMPLETED'
    | 'VERIFICATION_STARTED'
    | 'VERIFICATION_COMPLETED'
    | 'TASK_CANCELLED'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED'
    | 'DISAGREEMENT_DETECTED'
    | 'ESCALATION_TRIGGERED'
    | 'SECURITY_ALERT'
    | 'ADAPTIVE_PLAN_CREATED'
    | 'COMPLEXITY_ASSESSED'
    | 'RISK_ASSESSED'
    | 'STRATEGY_SELECTED'
    | 'AGENT_COUNT_SELECTED'
    | 'AGENT_ADDED'
    | 'AGENT_REMOVED'
    | 'EVIDENCE_COLLECTED'
    | 'VERIFICATION_REQUESTED'
    | 'ESCALATION_STARTED'
    | 'ESCALATION_STOPPED'
    | 'STOP_CONDITION_REACHED'
    | 'BUDGET_LIMIT_REACHED'
    | 'FINAL_DECISION';
  agentId?: string;
  provider?: string;
  payloadHash: string;
  previousEventId?: string | null;
  details?: Record<string, any>;
}

export interface SubtaskAttempt {
  attemptNumber: number;
  agentId: string;
  provider: string;
  startedAt: number;
  completedAt?: number;
  status: SubtaskStatus;
  error?: string;
  output?: any;
}

export interface ProvenanceTrace {
  runId: string;
  taskId: string;
  subtaskId?: string;
  agentId: string;
  provider: string;
  timestamp: number;
  claimedByAgent: boolean;
  systemAsserted: boolean;
  sourceDocCitations: string[];
  transformationNotes?: string;
  evidenceIndependenceScore: number;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  description: string;
  assignedAgentId: string;
  dependencies: string[]; // IDs of prerequisite subtasks
  status: SubtaskStatus;
  concurrencyGroup?: string;
  startedAt?: number;
  completedAt?: number;
  latencyMs?: number;
  attempts: SubtaskAttempt[];
  maxRetries: number;
  retryCount: number;
  timeoutMs: number;
  output?: any;
  error?: string;
  claims?: AgentClaim[];
  provenance?: ProvenanceTrace;
}

export interface AgentClaim {
  id: string;
  subtaskId: string;
  agentId: string;
  claimText: string;
  confidence: number;
  supportingCitations: string[];
  systemAsserted: boolean;
  agentClaimedProvenance?: {
    claimedSource: string;
    claimedVerified: boolean;
  };
  agreementStatus?: ClaimAgreement;
}

export interface DisagreementRecord {
  id: string;
  topic: string;
  competingClaims: AgentClaim[];
  evidenceFoundInGrounding: boolean;
  consensusRatio: number;
  consensusVote: string;
  resolutionStatus: 'RESOLVED_BY_EVIDENCE' | 'UNRESOLVED_CONTRADICTION' | 'INSUFFICIENT_EVIDENCE';
  finalGroundedClaim?: string;
}

export interface ContradictionRecord {
  id: string;
  claimA: AgentClaim;
  claimB: AgentClaim;
  detectedAt: number;
  provenanceA: ProvenanceTrace;
  provenanceB: ProvenanceTrace;
  verificationStatus: VerificationClassification;
  resolutionRationale: string;
}

export interface OrchestrationRunConfig {
  executionMode: ExecutionMode;
  partialFailurePolicy: PartialFailurePolicy;
  maxConcurrentSubtasks: number;
  maxDelegationDepth: number;
  maxSubtasks: number;
  maxRetries: number;
  globalTimeoutMs: number;
  subtaskTimeoutMs: number;
  seed?: number;
  enableEscalation?: boolean;
  dedicatedVerificationAgent?: boolean;
}

export interface OrchestrationRun {
  runId: string;
  parentTaskId: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  executionMode: ExecutionMode;
  config: OrchestrationRunConfig;
  participatingAgents: string[];
  subtasks: Subtask[];
  events: OrchestrationEvent[];
  disagreements: DisagreementRecord[];
  contradictions: ContradictionRecord[];
  synthesisResult?: {
    summary: string;
    originalClaimsCount: number;
    synthesizedClaimsCount: number;
    meaningPreserved: boolean;
    unsupportedClaimsDetected: string[];
  };
  verificationResults?: {
    classification: VerificationClassification;
    consensusSignal: 'STRONG_CONSENSUS' | 'WEAK_CONSENSUS' | 'SPLIT_CONSENSUS' | 'NO_CONSENSUS';
    evidenceSignal: 'STRONG_GROUNDED' | 'PARTIAL_GROUNDED' | 'UNGROUNDED';
    trustedKnowledgeReference?: string;
    rationale: string;
  };
  securityAudit: {
    promptInjectionAttempts: number;
    fakeProvenanceBlocked: number;
    fabricatedCitationsRejected: number;
    memoryPoisoningAttemptsBlocked: number;
    knowledgeVersionTamperingBlocked: number;
  };
  status: TaskStatus;
  finalOutput?: any;
  error?: string;
  actualDurationMs?: number;
  parallelSpeedupRatio?: number;
}

export interface BenchmarkMetrics {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  partialFailureCount: number;
  timeoutCount: number;
  retryCount: number;
  reassignmentCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  meanParallelSpeedup: number;
  disagreementsDetected: number;
  verificationEscalations: number;
  classifications: {
    supported: number;
    contradicted: number;
    uncertain: number;
  };
  securityEventsBlocked: {
    promptInjection: number;
    fakeProvenance: number;
    fabricatedCitation: number;
    memoryBoundaryAttempts: number;
  };
}
