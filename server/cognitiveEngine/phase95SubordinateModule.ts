/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 9.5 Subordinate RAG Module
 * Encapsulates the battle-tested Phase 9.5 Grounded RAG Pipeline as a subordinate
 * module under the Phase 10 KnowledgeCognitiveEngine coordinator.
 *
 * Capabilities:
 * - Conversational Query Resolution & Elliptical Disambiguation
 * - Multi-Tenant Hybrid Document Indexing & Chunk Partitioning
 * - Candidate Hybrid Search (BM25 + Semantic + Exact Entity)
 * - Multi-Factor Candidate Reranking
 * - Evidence Sufficiency Gating
 * - Evidence-First Grounded Answer Generation
 * - Claim-Level Grounding Verification
 */

import { KnowledgeDocument, ChatMessage, SpecializedAI, Citation } from '../../src/types.js';
import {
  DocumentChunk,
  CandidateChunk,
  RerankedChunk,
  EvidenceSufficiency,
  ClaimGroundingVerification,
} from '../ragTypes.js';
import {
  hybridRagIndex,
  chunkDocument,
  rerankCandidates,
  checkEvidenceSufficiency,
  verifyClaimsAgainstEvidence,
} from '../ragPipeline.js';
import { generateEvidenceFirstAnswer } from '../ragGenerator.js';
import { resolveConversationalQuery, QueryResolutionResult } from '../ragQueryResolver.js';
import { ragTelemetryStore, RetrievalDiagnosticTrace } from '../ragTelemetryStore.js';

export interface SubordinateRagRetrievalResult {
  retrievalQuery: string;
  resolution: QueryResolutionResult;
  candidates: CandidateChunk[];
  reranked: RerankedChunk[];
  sufficiency: EvidenceSufficiency;
}

export interface SubordinateRagExecutionResult {
  answer: string;
  sources: Citation[];
  isFoundInDocuments: boolean;
  engineUsed: 'phase-9.5-subordinate-engine' | 'grounded-local-engine';
  sufficiency: EvidenceSufficiency;
  claimVerifications: ClaimGroundingVerification[];
  groundingScore: number;
  diagnosticTrace: RetrievalDiagnosticTrace;
}

export class Phase95RagSubordinateModule {
  /**
   * Index documents into the multi-tenant hybrid RAG store
   */
  public indexDocuments(
    documents: KnowledgeDocument[],
    tenantId: string = 'tenant-default',
    knowledgeBaseId: string = 'kb-default'
  ): DocumentChunk[] {
    const validDocs = documents.filter(
      (d) => d.processingStatus === 'processed' && d.pages && d.pages.length > 0
    );
    if (validDocs.length === 0) return [];
    hybridRagIndex.indexDocuments(validDocs, tenantId, knowledgeBaseId);
    return hybridRagIndex.getChunks(tenantId, knowledgeBaseId);
  }

  /**
   * Resolve conversational pronouns and elliptical follow-up references
   */
  public resolveQuery(
    question: string,
    chatHistory: ChatMessage[] = []
  ): QueryResolutionResult {
    return resolveConversationalQuery(question, chatHistory);
  }

  /**
   * Execute subordinate retrieval: Hybrid Search + Exact-Entity Reranking
   */
  public retrieveEvidence(
    query: string,
    tenantId: string = 'tenant-default',
    knowledgeBaseId: string = 'kb-default',
    candidateLimit: number = 12,
    rerankLimit: number = 5
  ): { candidates: CandidateChunk[]; reranked: RerankedChunk[]; sufficiency: EvidenceSufficiency } {
    const candidates = hybridRagIndex.search(query, tenantId, knowledgeBaseId, candidateLimit);
    const reranked = rerankCandidates(query, candidates, rerankLimit);
    const sufficiency = checkEvidenceSufficiency(query, reranked);
    return { candidates, reranked, sufficiency };
  }

  /**
   * Evaluate evidence sufficiency using Phase 9.5 gating rules
   */
  public checkSufficiency(query: string, reranked: RerankedChunk[]): EvidenceSufficiency {
    return checkEvidenceSufficiency(query, reranked);
  }

  /**
   * Synthesize evidence-first answer using Phase 9.5 generator
   */
  public synthesizeAnswer(
    question: string,
    reranked: RerankedChunk[],
    specializedAi?: SpecializedAI,
    memoryContext?: string
  ): { answer: string; isFoundInDocuments: boolean } {
    return generateEvidenceFirstAnswer(question, reranked, specializedAi, memoryContext);
  }

  /**
   * Verify claim grounding against reranked evidence
   */
  public verifyClaims(
    answer: string,
    reranked: RerankedChunk[]
  ): { claims: ClaimGroundingVerification[]; groundingScore: number; allSupported: boolean } {
    const res = verifyClaimsAgainstEvidence(answer, reranked);
    return {
      claims: res.verifications,
      groundingScore: res.groundingScore,
      allSupported: res.unsupportedClaims.length === 0,
    };
  }

  /**
   * Execute full subordinate Phase 9.5 RAG pipeline
   */
  public async executeSubordinateRag(params: {
    question: string;
    documents: KnowledgeDocument[];
    chatHistory?: ChatMessage[];
    tenantId?: string;
    knowledgeBaseId?: string;
    specializedAi?: SpecializedAI;
    memoryContext?: string;
    requestId?: string;
  }): Promise<SubordinateRagExecutionResult> {
    const startTime = Date.now();
    const {
      question,
      documents,
      chatHistory = [],
      tenantId = 'tenant-default',
      knowledgeBaseId = 'kb-default',
      specializedAi,
      memoryContext,
      requestId = `sub_req_${Date.now()}`,
    } = params;

    // 1. Multi-Tenant Hybrid Document Indexing
    this.indexDocuments(documents, tenantId, knowledgeBaseId);

    // 2. Conversational Query Resolution
    const resolution = this.resolveQuery(question, chatHistory);
    const retrievalQuery = resolution.contextualizedQuery;

    // 3. Retrieval & Reranking
    const { candidates, reranked, sufficiency } = this.retrieveEvidence(
      retrievalQuery,
      tenantId,
      knowledgeBaseId,
      12,
      5
    );

    // 4. Answer Synthesis
    let finalAnswer: string;
    let isFoundInDocuments: boolean;

    if (!sufficiency.isSufficient) {
      finalAnswer =
        "I couldn't find enough information to answer this question in the uploaded documents.";
      isFoundInDocuments = false;
    } else {
      const generated = this.synthesizeAnswer(retrievalQuery, reranked, specializedAi, memoryContext);
      finalAnswer = generated.answer;
      isFoundInDocuments = generated.isFoundInDocuments;
    }

    // 5. Verification & Citations
    const { claims, groundingScore, allSupported } = this.verifyClaims(finalAnswer, reranked);

    const citations: Citation[] = reranked
      .filter((r) => r.rerankScore > 0.4)
      .slice(0, 3)
      .map((r) => ({
        documentId: r.chunk.documentId,
        documentName: r.chunk.documentName,
        pageNumber: r.chunk.pageNumber,
        snippet: r.chunk.text.slice(0, 160) + '...',
      }));

    const durationMs = Date.now() - startTime;

    // 6. Telemetry Recording
    const diagnosticTrace: RetrievalDiagnosticTrace = {
      id: `trace_sub_${Date.now()}`,
      requestId,
      tenantId,
      aiId: specializedAi?.id || 'ai_subordinate',
      timestamp: Date.now(),
      originalQuestion: question,
      contextualizedQuery: retrievalQuery,
      queryType: resolution.queryType,
      resolutionExplanation: resolution.resolutionExplanation,
      retrievedCandidateCount: candidates.length,
      candidateChunks: candidates.slice(0, 5).map((c) => ({
        chunkId: c.chunk.chunkId,
        sectionTitle: c.chunk.sectionTitle,
        pageNumber: c.chunk.pageNumber,
        combinedScore: c.combinedScore,
        keywordScore: c.keywordScore,
        entityScore: c.exactScore,
        semanticScore: c.semanticScore,
        matchReasons: c.matchReasons,
        snippet: c.chunk.text.slice(0, 120) + '...',
      })),
      rerankedChunks: reranked.map((r) => ({
        chunkId: r.chunk.chunkId,
        sectionTitle: r.chunk.sectionTitle,
        pageNumber: r.chunk.pageNumber,
        rerankScore: r.rerankScore,
        rank: r.rank,
        confidence: r.confidence ?? 0.9,
        explanation: r.relevanceExplanation,
        snippet: r.chunk.text.slice(0, 120) + '...',
      })),
      selectedEvidenceChunks: reranked.slice(0, 3).map((r) => ({
        chunkId: r.chunk.chunkId,
        sectionTitle: r.chunk.sectionTitle,
        pageNumber: r.chunk.pageNumber,
        text: r.chunk.text,
      })),
      evidenceSufficiency: sufficiency,
      finalAnswer,
      isFoundInDocuments,
      groundingScore,
      claimVerifications: claims,
      unsupportedClaims: claims.filter((c) => !c.supported).map((c) => c.claim),
      citations: citations.map((c) => ({
        documentName: c.documentName,
        pageNumber: typeof c.pageNumber === 'number' ? c.pageNumber : parseInt(String(c.pageNumber), 10) || 1,
        sectionHeading: c.sectionHeading || '',
        snippet: c.snippet,
      })),
      engineUsed: 'phase-9.5-subordinate-engine',
      failureClassification: !sufficiency.isSufficient
        ? 'RETRIEVAL_FAILURE'
        : !allSupported
        ? 'GROUNDING_FAILURE'
        : 'NONE_SUCCESS',
      durationMs,
    };

    ragTelemetryStore.recordTrace(diagnosticTrace);

    return {
      answer: finalAnswer,
      sources: citations,
      isFoundInDocuments,
      engineUsed: 'phase-9.5-subordinate-engine',
      sufficiency,
      claimVerifications: claims,
      groundingScore,
      diagnosticTrace,
    };
  }
}

export const phase95RagSubordinateModule = new Phase95RagSubordinateModule();
