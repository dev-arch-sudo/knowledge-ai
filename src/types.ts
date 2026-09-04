export interface DocumentPage {
  pageNumber: number;
  text: string;
}

export type DocumentProcessingStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface KnowledgeDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadTimestamp: number;
  processingStatus: DocumentProcessingStatus;
  errorMessage?: string;
  pageCount: number;
  pages?: DocumentPage[];
  geminiFileRef?: string;
  summary?: string;
}

export interface Citation {
  documentId?: string;
  documentName: string;
  pageNumber?: number | string;
  sectionHeading?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  citations?: Citation[];
  isFoundInDocuments?: boolean;
  memoryUsed?: boolean;
  memoryCount?: number;
  usedMemories?: Array<{ id: string; type: string; summary: string }>;
  experienceRecorded?: boolean;
  userFeedback?: 'helpful' | 'unhelpful' | 'correct' | 'incorrect' | 'procedure_worked' | 'procedure_failed';
  experienceId?: string;
}

export type ResponseStyle = 'concise' | 'detailed' | 'bullet-points' | 'executive-summary';
export type CitationMode = 'standard' | 'strict-snippets' | 'academic';

export interface SpecializedAI {
  id: string;
  kbId: string;
  name: string;
  description: string;
  roleDefinition: string;
  systemPromptModifier?: string;
  responseStyle: ResponseStyle;
  citationMode: CitationMode;
  strictRefusal: boolean;
  confidenceThreshold?: number;
  // Phase 4 Memory Configuration
  memoryEnabled?: boolean;
  memoryRetrievalEnabled?: boolean;
  allowedMemoryTypes?: MemoryType[];
  maxRetrievedMemories?: number;
  memoryConfidenceThreshold?: number;
  allowCandidateGeneration?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeVersion {
  id: string;
  versionNumber: number;
  versionTag: string;
  label: string;
  timestamp: number;
  documentCount: number;
  totalPages: number;
  documents: KnowledgeDocument[];
  isCurrent: boolean;
}

export type EvaluationCategory = 'grounded' | 'cross-document' | 'negative-refusal' | 'custom';

export interface EvaluationTestCase {
  id: string;
  kbId: string;
  category: EvaluationCategory;
  question: string;
  expectedBehavior: string;
  expectedKeywords?: string[];
  mustRefuse?: boolean;
}

export interface TestCaseResult {
  testCaseId: string;
  question: string;
  category: EvaluationCategory;
  expectedBehavior: string;
  actualAnswer: string;
  citations: Citation[];
  isFoundInDocuments: boolean;
  passed: boolean;
  reason: string;
  latencyMs: number;
}

export interface EvaluationRun {
  id: string;
  kbId: string;
  versionTag: string;
  timestamp: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  accuracyScore: number;
  groundedScore: number;
  crossDocScore: number;
  refusalScore: number;
  results: TestCaseResult[];
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdDate: number;
  updatedAt: number;
  currentVersion: string;
  versions: KnowledgeVersion[];
  documents: KnowledgeDocument[];
  processingStatus: 'empty' | 'processing' | 'ready' | 'error';
  chatHistory: ChatMessage[];
  specializedAi: SpecializedAI;
  testCases?: EvaluationTestCase[];
  evaluationRuns?: EvaluationRun[];
  accountId?: string;
}

export interface TestResultItem {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  details?: string;
  expected?: string;
  actual?: string;
}

export interface ApiKey {
  id: string;
  accountId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  maskedKey: string;
  environment: 'live' | 'test';
  scopes: string[];
  status: 'active' | 'revoked';
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

export interface ApiUsage {
  id: string;
  requestId: string;
  apiKeyId: string;
  accountId: string;
  aiId: string;
  endpoint: string;
  timestamp: number;
  status: number;
  latencyMs: number;
  refused: boolean;
  grounded: boolean;
  errorCode?: string;
}

export interface ApiSource {
  document_id?: string;
  document_name: string;
  page?: number;
  section?: string;
  excerpt?: string;
  source_type?: 'knowledge' | 'memory';
  memory_id?: string;
  memory_type?: MemoryType;
}

export interface ApiChatRequest {
  ai_id: string;
  message: string;
  conversation_id?: string;
}

export interface ApiChatResponse {
  id: string;
  request_id: string;
  ai_id: string;
  conversation_id?: string;
  answer: string;
  grounded: boolean;
  refused: boolean;
  conflict_detected?: boolean;
  knowledge_version: string;
  sources: ApiSource[];
  // Phase 4 Metadata
  memory_used?: boolean;
  memory_count?: number;
  experience_recorded?: boolean;
}

export interface ApiErrorResponse {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'AI_NOT_FOUND'
      | 'KNOWLEDGE_BASE_NOT_FOUND'
      | 'KNOWLEDGE_NOT_READY'
      | 'RATE_LIMITED'
      | 'PROCESSING_ERROR'
      | 'AI_ERROR'
      | 'INTERNAL_ERROR'
      | 'MEMORY_NOT_FOUND'
      | 'MEMORY_ACCESS_DENIED'
      | 'EXPERIENCE_NOT_FOUND'
      | 'SANDBOX_SCENARIO_NOT_FOUND'
      | 'SANDBOX_RUN_FAILED'
      | 'LEARNING_CANDIDATE_NOT_FOUND'
      | 'IMPROVEMENT_NOT_FOUND'
      | 'APPROVAL_NOT_AUTHORIZED'
      | 'REGRESSION_DETECTED'
      | 'INVALID_STATE_TRANSITION';
    message: string;
  };
  request_id?: string;
}

export interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  refusedRequests: number;
  errorRequests: number;
  averageLatencyMs: number;
  recentLogs: ApiUsage[];
}

// ==========================================
// PHASE 4: MEMORY, EXPERIENCE & SANDBOX TYPES
// ==========================================

export type MemoryType = 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL' | 'FEEDBACK';
export type MemoryStatus = 'CANDIDATE' | 'VERIFIED' | 'REJECTED' | 'ARCHIVED';

export interface Memory {
  id: string;
  accountId: string;
  aiId: string;
  type: MemoryType;
  content: string;
  summary: string;
  tags?: string[];
  evidence: string[];
  confidence: number;
  sourceExperienceIds: string[];
  sourceDocumentIds?: string[];
  sourceConversationIds?: string[];
  knowledgeVersionId: string;
  status: MemoryStatus;
  scope: 'global' | 'ai_local';
  createdAt: number;
  updatedAt: number;
  verifiedAt?: number | null;
  verifiedBy?: string | null;
  archivedAt?: number | null;
  rejectionReason?: string | null;
}

export type ExperienceSource =
  | 'WEB'
  | 'API'
  | 'SANDBOX'
  | 'EVALUATION'
  | 'SYSTEM'
  | 'HUMAN_FEEDBACK';

export type ExperienceStatus = 'RECORDED' | 'EVALUATED' | 'FLAGGED' | 'ARCHIVED';

export interface Experience {
  id: string;
  accountId: string;
  aiId: string;
  knowledgeVersionId: string;
  conversationId?: string;
  messageId?: string;
  source: ExperienceSource;
  situation: string;
  action: string;
  outcome: string;
  expectedOutcome?: string;
  actualOutcome?: string;
  feedback?: string;
  evidence?: string[];
  evaluationId?: string;
  status: ExperienceStatus;
  sandboxScenarioId?: string;
  sandboxRunId?: string;
  createdAt: number;
  timestamp?: number;
}

export type ScenarioDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ScenarioStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface SandboxScenario {
  id: string;
  accountId: string;
  aiId: string;
  name: string;
  description: string;
  initialState?: string;
  userInput: string;
  expectedBehavior: string;
  expectedOutcome: string;
  evaluationCriteria: string;
  difficulty: ScenarioDifficulty;
  tags: string[];
  status: ScenarioStatus;
  createdAt: number;
  updatedAt: number;
}

export type SandboxRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type SandboxRunOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export interface SandboxActionLog {
  timestamp: number;
  type: string;
  detail: string;
}

export interface SandboxRun {
  id: string;
  accountId: string;
  aiId: string;
  scenarioId: string;
  knowledgeVersionId: string;
  actions: SandboxActionLog[];
  observations: string[];
  finalOutcome: SandboxRunOutcome;
  score: number; // 0-100
  evaluationId?: string;
  status: SandboxRunStatus;
  seed?: string;
  error?: string;
  actualOutput?: string;
  createdAt: number;
  completedAt?: number;
}

export type LearningCandidateStatus =
  | 'DRAFT'
  | 'UNDER_EVALUATION'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LearningCandidate {
  id: string;
  accountId: string;
  aiId: string;
  sourceExperienceIds: string[];
  sourceMemoryIds: string[];
  proposedChange: string;
  rationale: string;
  evidence: string;
  confidence: number;
  expectedBenefit: string;
  riskLevel: RiskLevel;
  evaluationId?: string;
  status: LearningCandidateStatus;
  createdAt: number;
  updatedAt: number;
}

export type ImprovementProposalStatus =
  | 'DRAFT'
  | 'EVALUATING'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface ImprovementScorecard {
  baselineScore: number;
  candidateScore: number;
  difference: number;
  regressionCount: number;
  newSuccesses: number;
  newFailures: number;
  riskLevel: RiskLevel;
  confidence: number;
  sampleSize: number;
  groundingBefore: number;
  groundingAfter: number;
  refusalBefore: number;
  refusalAfter: number;
  citationBefore: number;
  citationAfter: number;
}

export interface ImprovementProposal {
  id: string;
  accountId: string;
  aiId: string;
  currentVersionId: string;
  candidateIds: string[];
  title: string;
  proposedChanges: string;
  rationale: string;
  evidence: string;
  expectedBenefit: string;
  riskAssessment: string;
  evaluationId?: string;
  scorecard: ImprovementScorecard;
  status: ImprovementProposalStatus;
  approvedBy?: string | null;
  approvedAt?: number | null;
  rejectedBy?: string | null;
  rejectedAt?: number | null;
  rejectionReason?: string | null;
  targetVersionTag?: string;
  createdVersionTag?: string;
  createdAt: number;
}

export type AuditEventAction =
  | 'MEMORY_CREATED'
  | 'MEMORY_VERIFIED'
  | 'MEMORY_REJECTED'
  | 'MEMORY_ARCHIVED'
  | 'EXPERIENCE_RECORDED'
  | 'LEARNING_CANDIDATE_CREATED'
  | 'LEARNING_CANDIDATE_EVALUATED'
  | 'IMPROVEMENT_PROPOSAL_CREATED'
  | 'IMPROVEMENT_PROPOSAL_APPROVED'
  | 'IMPROVEMENT_PROPOSAL_REJECTED'
  | 'SANDBOX_RUN_STARTED'
  | 'SANDBOX_RUN_COMPLETED'
  | 'SANDBOX_RUN_FAILED'
  | 'VERSION_CREATED_FROM_IMPROVEMENT';

export interface AuditEvent {
  id: string;
  accountId: string;
  actor: string;
  aiId: string;
  resourceId: string;
  action: AuditEventAction;
  timestamp: number;
  requestId?: string;
  details?: Record<string, any>;
}

export interface Phase4DashboardStats {
  verifiedMemoriesCount: number;
  totalMemoriesCount: number;
  candidateMemoriesCount: number;
  rejectedMemoriesCount: number;
  archivedMemoriesCount: number;
  experiencesCount: number;
  realExperiencesCount: number;
  sandboxExperiencesCount: number;
  sandboxRunsCount: number;
  sandboxSuccessRate: number;
  learningCandidatesCount: number;
  pendingProposalsCount: number;
  approvedImprovementsCount: number;
  recentAuditEvents: AuditEvent[];
}

export type MemoryAuditLog = AuditEvent;
export type Phase4DashboardMetrics = any;

// ==========================================
// PHASE 5: MEDIATOR & RELIABILITY TYPES
// ==========================================

export type ExecutionMode = 'SEQUENTIAL' | 'PARALLEL' | 'HYBRID';
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_COMPLETED';
export type SubtaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT' | 'SKIPPED';
export type ClaimAgreement = 'AGREE' | 'DISAGREE' | 'CONDITIONAL' | 'INSUFFICIENT_INFORMATION';
export type VerificationClassification = 'SUPPORTED' | 'CONTRADICTED' | 'UNCERTAIN';

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  provider: 'mock' | 'gemini' | 'external';
  modelIdentifier?: string;
  capabilities: string[];
  isExternal: boolean;
  untrusted: boolean;
}

export interface OrchestrationEvent {
  eventId: string;
  runId: string;
  taskId: string;
  subtaskId?: string;
  timestamp: number;
  eventType: string;
  agentId?: string;
  provider?: string;
  payloadHash: string;
  previousEventId?: string | null;
  details?: Record<string, any>;
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

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  description: string;
  assignedAgentId: string;
  dependencies: string[];
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

export interface DisagreementRecord {
  id: string;
  topic: string;
  competingClaims: AgentClaim[];
  evidenceFoundInGrounding: boolean;
  consensusRatio: number;
  consensusVote: string;
  resolutionStatus: string;
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

export interface OrchestrationRun {
  runId: string;
  parentTaskId: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  executionMode: ExecutionMode;
  config: {
    executionMode: ExecutionMode;
    partialFailurePolicy: string;
    maxConcurrentSubtasks: number;
    maxDelegationDepth: number;
    maxSubtasks: number;
    maxRetries: number;
    globalTimeoutMs: number;
    subtaskTimeoutMs: number;
    seed?: number;
    enableEscalation?: boolean;
    dedicatedVerificationAgent?: boolean;
  };
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

// =========================================================================
// PHASE 6: ADAPTIVE EVIDENCE-DRIVEN MULTI-AGENT TYPES
// =========================================================================

export type OrchestrationMode = 'FIXED' | 'ADAPTIVE';

export type AdaptiveStrategy =
  | 'SINGLE_AGENT'
  | 'PARALLEL'
  | 'SEQUENTIAL'
  | 'HYBRID'
  | 'ESCALATED';

export interface TaskComplexityProfile {
  taskPrompt: string;
  complexityScore: number; // 0.0 - 1.0
  domainCount: number;
  subtaskCount: number;
  dependencyCount: number;
  uncertaintyLevel: number;
  adversarialRisk: number;
  contradictionRisk: number;
  suggestedTopology: AdaptiveStrategy;
  suggestedAgentCount: number;
  rationale: string[];
}

export interface TaskRiskProfile {
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  securityRisk: number;
  factualRisk: number;
  hallucinationRisk: number;
  contradictionImpact: number;
  requiresIndependentVerifier: boolean;
  rationale: string[];
}

export interface AgentAssignmentPlan {
  agentId: string;
  role: string;
  capability: string;
  domain: string;
}

export interface AdaptivePlan {
  taskPrompt: string;
  orchestrationMode: OrchestrationMode;
  strategy: AdaptiveStrategy;
  complexity: TaskComplexityProfile;
  risk: TaskRiskProfile;
  initialAgentCount: number;
  selectedAgents: AgentAssignmentPlan[];
  budgetLimits: {
    minAgents: number;
    maxAgents: number;
    maxEscalationRounds: number;
    maxTotalAgentCalls: number;
    maxExecutionTimeMs: number;
    maxEstimatedCostUnits: number;
    maxDelegationDepth: number;
  };
  rationale: string[];
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
  expectedInformationGain: number;
  actualInformationGain: number;
}

export interface EvidenceClaim {
  claimId: string;
  text: string;
  agentId: string;
  providerId: string;
  evidenceRefs: string[];
  supportStatus: 'SUPPORTED' | 'CONTRADICTED' | 'UNCERTAIN' | 'UNSUPPORTED';
  independenceScore: number;
  provenance: ClaimProvenance;
}

export interface EvidenceIndependenceProfile {
  overallIndependenceScore: number;
  sourceOverlap: number;
  promptOverlap: number;
  providerOverlap: number;
  correlatedAgentGroups: string[][];
  isCorrelated: boolean;
}

export interface ConfidenceCalibrationProfile {
  reportedConfidence: number;
  calibratedConfidence: number;
  evidenceSupportScore: number;
  groundingStatus: VerificationClassification;
  isFalseConfidence: boolean;
  flags: string[];
}

export interface TrustedSourceConflictRecord {
  conflictId: string;
  sourceA: string;
  sourceB: string;
  versionA?: string;
  versionB?: string;
  claimA: string;
  claimB: string;
  contradictionType: string;
  detectedAt: number;
}

export type StopConditionType =
  | 'EVIDENCE_SUFFICIENT'
  | 'AUTHORITATIVE_CONTRADICTION'
  | 'INSUFFICIENT_EVIDENCE'
  | 'BUDGET_EXHAUSTED'
  | 'TIME_LIMIT_REACHED'
  | 'ESCALATION_LIMIT_REACHED'
  | 'NEGLIGIBLE_INFORMATION_GAIN'
  | 'SECURITY_BOUNDARY_TRIGGERED';

export interface StopCondition {
  condition: StopConditionType;
  reason: string;
  stopTimestamp: number;
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



