/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 9.5 RAG Types & Interfaces
 */

export interface DocumentChunk {
  chunkId: string;
  tenantId?: string;
  knowledgeBaseId?: string;
  documentId: string;
  documentVersionId?: string;
  documentName: string;
  pageNumber: number;
  sectionTitle: string;
  text: string;
  tokenCountEstimate: number;
  sourceOffset?: number;
  contentHash: string;
  entities: string[];
  numbers: number[];
}

export interface CandidateChunk {
  chunk: DocumentChunk;
  semanticScore: number;
  keywordScore: number;
  exactScore: number;
  combinedScore: number;
  matchReasons: string[];
}

export interface RerankedChunk {
  chunk: DocumentChunk;
  rerankScore: number;
  rank: number;
  confidence: number;
  relevanceExplanation: string;
}

export interface EvidenceSufficiency {
  isSufficient: boolean;
  sufficiencyScore: number;
  reason: string;
  suggestedAction: 'ANSWER' | 'ABSTAIN_INSUFFICIENT' | 'REFUSE_OUT_OF_DOMAIN';
}

export interface ClaimGroundingVerification {
  claim: string;
  supported: boolean;
  confidence: number;
  supportingChunkIds: string[];
  supportingSnippets: string[];
}

export interface RagPipelineResult {
  question: string;
  normalizedQuery: string;
  detectedEntities: string[];
  detectedNumbers: number[];
  retrievedCandidates: CandidateChunk[];
  rerankedChunks: RerankedChunk[];
  selectedEvidence: RerankedChunk[];
  finalContext: string;
  evidenceSufficiency: EvidenceSufficiency;
  generatedAnswer: string;
  groundingScore: number;
  claimVerifications: ClaimGroundingVerification[];
  unsupportedClaims: string[];
  citations: Array<{
    documentId?: string;
    documentName: string;
    pageNumber: number;
    sectionHeading: string;
    snippet: string;
    chunkId: string;
  }>;
  isFoundInDocuments: boolean;
  abstentionReason?: string;
  retrievalLatencyMs: number;
  rerankingLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
}
