/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 10 Cognitive Engine Types & Schema Definitions
 * RAGFlow-Inspired Cognitive Pipeline Data Structures
 */

import { Citation, KnowledgeDocument } from '../../src/types.js';

export type QuestionClassificationType =
  | 'DIRECT_FACT'
  | 'ENTITY_FACT'
  | 'ATTRIBUTE_LOOKUP'
  | 'COMPARISON'
  | 'MULTI_CONSTRAINT'
  | 'CALCULATION'
  | 'TEMPORAL'
  | 'AGGREGATION'
  | 'MULTI_HOP'
  | 'CROSS_SECTION'
  | 'CORRECTION'
  | 'FOLLOW_UP'
  | 'AMBIGUOUS'
  | 'UNKNOWN_INFORMATION'
  | 'OUT_OF_DOMAIN'
  | 'ADVERSARIAL';

export type ReasoningMode =
  | 'DIRECT'         // Mode A: Direct factual retrieval -> verify -> answer
  | 'SYNTHESIS'      // Mode B: Retrieve multiple cross-section facts -> synthesize -> verify -> answer
  | 'MULTI_HOP'      // Mode C: Sub-question identification -> multi-pass retrieval -> combine -> answer
  | 'ANALYTICAL'     // Mode D: Variable retrieval -> deterministic calculation/comparison -> verify -> answer
  | 'DEEP_REASONING';// Mode E: Bounded iterative refinement (hard limits: max 3 iterations, token/latency budget)

export type RetrievalStrategy =
  | 'EXACT_ENTITY'
  | 'BM25_LEXICAL'
  | 'SEMANTIC_DENSE'
  | 'NUMERIC'
  | 'SECTION_AWARE'
  | 'HIERARCHICAL'
  | 'QUERY_EXPANSION'
  | 'TABLE_AWARE';

export type HierarchicalLevel =
  | 'DOCUMENT_OVERVIEW' // Level 1
  | 'SECTION_HEADER'    // Level 2
  | 'SEMANTIC_CHUNK'    // Level 3
  | 'FACT_RECORD';      // Level 4 (fine-grained table row or atomic fact)

export interface LanguageDetectionResult {
  languageCode: string; // 'en', 'es', 'fr', 'de', 'zh', 'ja', 'hi', 'ar', 'pt', 'it', 'ru', etc.
  languageName: string; // 'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Hindi', etc.
  confidence: number;   // 0.0 to 1.0
  script: string;       // 'Latin', 'Han', 'Hiragana/Katakana', 'Devanagari', 'Arabic', 'Cyrillic', etc.
  isCorpusLanguage: boolean; // true if already matches document corpus language ('en')
  translatedRetrievalQuery?: string; // English normalized query for searching corpus
  crossLingualPivoted?: boolean;
}

export interface QuestionUnderstandingProfile {
  normalizedQuestion: string;
  classification: QuestionClassificationType;
  confidenceScore: number;
  entities: string[];
  attributes: string[];
  constraints: string[];
  temporalRequirement?: 'CURRENT' | 'FUTURE_2027' | 'HISTORICAL' | 'ANY';
  requestedOperation: 'RETRIEVE' | 'COMPARE' | 'CALCULATE' | 'AGGREGATE' | 'REFUSE_OUT_OF_DOMAIN' | 'DEFEND_ADVERSARIAL' | 'ABSTAIN_UNKNOWN' | 'CORRECT_ASSERTION';
  expectedAnswerType: 'NUMBER' | 'ENTITY' | 'LIST' | 'BOOLEAN' | 'EXPLANATION' | 'REFUSAL';
  requiredEvidenceCount: number;
  requiresMultipleRetrievalPasses: boolean;
  requiresCalculation: boolean;
  requiresContradictionCheck: boolean;
  requiresClarification: boolean;
  isAdversarial: boolean;
  isOutOfDomain: boolean;
  isUnknownInformation: boolean;
  userCorrectionAssertion?: string;
  detectedLanguage?: LanguageDetectionResult;
}

export interface InformationNeedPlan {
  primaryEntity?: string;
  secondaryEntities?: string[];
  targetAttributes: string[];
  subQueries: string[];
  reasoningMode: ReasoningMode;
  selectedRetrievalStrategies: RetrievalStrategy[];
  plannedOperations: ('RETRIEVE' | 'COMPARE' | 'CALCULATE' | 'AGGREGATE' | 'VERIFY')[];
  deterministicCalculation?: {
    operation: 'DIFFERENCE' | 'PERCENTAGE' | 'SUM' | 'RATIO' | 'COUNT';
    operands: Array<{ label: string; value?: number; unit?: string; entity?: string }>;
    result?: number;
    formattedResult?: string;
  };
  iterationLimit: number;
}

export interface HierarchicalChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  level: HierarchicalLevel;
  parentId?: string;
  childrenIds?: string[];
  pageNumber: number;
  sectionTitle: string;
  text: string;
  tokens: string[];
  entities: string[];
  numbers: number[];
  tableData?: Record<string, string | number>[];
}

export interface FusedEvidenceItem {
  chunk: HierarchicalChunk;
  individualScores: {
    semanticScore: number;
    lexicalScore: number;
    entityScore: number;
    numericScore: number;
    sectionScore: number;
    hierarchicalScore: number;
  };
  fusedScore: number;
  reciprocalRank: number;
  contributingStrategies: RetrievalStrategy[];
  confidence: number;
  matchReasons: string[];
}

export interface RerankedEvidenceItem {
  chunk: HierarchicalChunk;
  rerankScore: number;
  rank: number;
  confidence: number;
  relevanceExplanation: string;
  satisfiesNeedItem?: string;
}

export interface ClaimVerificationItem {
  claimId: string;
  claimText: string;
  isSupported: boolean;
  confidence: number;
  supportingChunkIds: string[];
  contradictedByChunkIds: string[];
  explanation: string;
  verifiedEntity?: string;
  verifiedNumber?: number;
  verifiedUnit?: string;
  temporalStatus: 'ALIGNED' | 'MISALIGNED';
}

export interface CognitiveExecutionTrace {
  id: string;
  requestId: string;
  tenantId: string;
  knowledgeBaseId: string;
  timestamp: number;
  originalQuestion: string;
  contextualizedQuestion: string;
  questionProfile: QuestionUnderstandingProfile;
  informationNeedPlan: InformationNeedPlan;
  reasoningMode: ReasoningMode;
  retrievalRounds: number;
  retrievalStrategiesUsed: RetrievalStrategy[];
  candidatesRetrieved: number;
  fusedEvidenceCount: number;
  rerankedEvidenceCount: number;
  fusedTopEvidence: Array<{
    chunkId: string;
    sectionTitle: string;
    pageNumber: number;
    fusedScore: number;
    strategies: string[];
    snippet: string;
  }>;
  rerankedTopEvidence: Array<{
    chunkId: string;
    sectionTitle: string;
    pageNumber: number;
    rerankScore: number;
    rank: number;
    snippet: string;
  }>;
  evidenceSufficiency: {
    isSufficient: boolean;
    sufficiencyScore: number;
    reason: string;
    suggestedAction: string;
  };
  deterministicCalculationResult?: {
    operation: string;
    operands: any[];
    result?: number;
    formattedResult?: string;
  };
  graphTraversal?: {
    matchedNodes: number;
    connectedEdges: number;
    pathExplanations: string[];
  };
  correctiveAssessment?: {
    grade: string;
    confidenceScore?: number;
    confidence?: number;
    gapAnalysis?: string[];
    correctiveQueries?: string[];
    contradictionResolution?: {
      conflictingStatements: string[];
      authoritativeResolution: string;
      reason: string;
    };
    reconciledFacts?: string[];
  };
  structuredTablesUsed?: Array<{
    id: string;
    title: string;
    rowCount: number;
    columnCount: number;
  }>;
  tableArithmeticResult?: {
    operation: string;
    formattedFormula: string;
    stepByStepProof: string;
  };
  detectedLanguage?: LanguageDetectionResult;
  reRetrievalExecuted?: boolean;
  reRetrievalAttempts?: number;
  claims: ClaimVerificationItem[];
  allClaimsSupported: boolean;
  groundingScore: number;
  contradictionsFound: number;
  citationCoverage: number;
  citations: Citation[];
  finalAnswer: string;
  isFoundInDocuments: boolean;
  engineUsed: 'gemini-3.8-flash' | 'cognitive-deterministic-engine';
  failureClassification: 'NONE_SUCCESS' | 'RETRIEVAL_FAILURE' | 'INSUFFICIENT_EVIDENCE' | 'GROUNDING_FAILURE' | 'CONTRADICTION_REFUSAL';
  timingMs: {
    questionUnderstandingMs: number;
    planningMs: number;
    retrievalMs: number;
    fusionMs: number;
    rerankingMs: number;
    reasoningMs: number;
    verificationMs: number;
    generationMs: number;
    totalMs: number;
  };
}

export interface CognitiveAnswerResult {
  answer: string;
  sources: Citation[];
  isFoundInDocuments: boolean;
  engineUsed: 'gemini-3.8-flash' | 'cognitive-deterministic-engine';
  diagnosticTrace: CognitiveExecutionTrace;
}

// ==========================================
// 5-STAGE PIPELINE COORDINATION INTERFACES
// Understand -> Plan -> Retrieve -> Verify -> Synthesize
// ==========================================

export interface CognitiveContext {
  tenantId: string;
  knowledgeBaseId: string;
  requestId: string;
  chatHistory: any[];
  forceDeterministic?: boolean;
  documents?: KnowledgeDocument[];
}

export interface GovernanceValidationResult {
  isAllowed: boolean;
  tenantId: string;
  policyEnforced: boolean;
  auditActionRecorded: boolean;
  violationReason?: string;
  securityPolicies: {
    enforceGroundingBoundary: boolean;
    blockExternalAiStateMutation: boolean;
  };
}

export interface UnderstandStageResult {
  profile: QuestionUnderstandingProfile;
  contextualizedQuery: string;
  governance: GovernanceValidationResult;
  timingMs: number;
}

export interface PlanStageResult {
  plan: InformationNeedPlan;
  timingMs: number;
}

export interface RetrieveStageResult {
  fusedItems: FusedEvidenceItem[];
  rerankedItems: RerankedEvidenceItem[];
  graphResult: {
    matchedNodes: any[];
    connectedEdges: any[];
    pathExplanations: string[];
  };
  structuredTables: any[];
  subordinateRetrieval?: {
    candidatesCount: number;
    rerankedCount: number;
    sufficiencyScore: number;
  };
  timingMs: number;
}

export interface VerifyStageResult {
  sufficiency: {
    isSufficient: boolean;
    reason: string;
    sufficiencyScore: number;
  };
  correctiveAssessment?: {
    grade: string;
    confidenceScore?: number;
    confidence?: number;
    gapAnalysis?: string[];
    correctiveQueries?: string[];
    contradictionResolution?: {
      conflictingStatements: string[];
      authoritativeResolution: string;
      reason: string;
    };
    reconciledFacts?: string[];
  };
  subordinateSufficiency?: {
    isSufficient: boolean;
    sufficiencyScore: number;
    reason: string;
  };
  isContradiction: boolean;
  proceedToSynthesis: boolean;
  timingMs: number;
}

export interface SynthesizeStageResult {
  answer: string;
  engineUsed: 'gemini-3.8-flash' | 'cognitive-deterministic-engine';
  claims: ClaimVerificationItem[];
  allClaimsSupported: boolean;
  groundingScore: number;
  citations: Citation[];
  mathResult?: any;
  timingMs: number;
}
