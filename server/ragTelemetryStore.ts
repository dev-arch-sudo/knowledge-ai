/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 9.5 RAG Telemetry & Retrieval Diagnostic Store
 * Maintains full audit traces of every retrieval decision for observability,
 * diagnostics, and the Retrieval Debug Console.
 */

import { CandidateChunk, RerankedChunk, EvidenceSufficiency, ClaimGroundingVerification } from './ragTypes.js';
import { RagQueryType } from './ragQueryResolver.js';

export type RagFailureClassification =
  | 'RETRIEVAL_FAILURE'
  | 'QUERY_REWRITE_FAILURE'
  | 'RERANKING_FAILURE'
  | 'CONTEXT_ASSEMBLY_FAILURE'
  | 'GENERATION_FAILURE'
  | 'GROUNDING_FAILURE'
  | 'CITATION_FAILURE'
  | 'CACHE_STALENESS'
  | 'PRODUCTION_PATH_FAILURE'
  | 'NONE_SUCCESS';

export interface RetrievalDiagnosticTrace {
  id: string;
  requestId: string;
  tenantId: string;
  aiId: string;
  timestamp: number;
  originalQuestion: string;
  contextualizedQuery: string;
  queryType: RagQueryType;
  resolutionExplanation: string;
  retrievedCandidateCount: number;
  candidateChunks: Array<{
    chunkId: string;
    sectionTitle: string;
    pageNumber: number;
    combinedScore: number;
    keywordScore: number;
    entityScore: number;
    semanticScore: number;
    matchReasons: string[];
    snippet: string;
  }>;
  rerankedChunks: Array<{
    chunkId: string;
    sectionTitle: string;
    pageNumber: number;
    rerankScore: number;
    rank: number;
    confidence: number;
    explanation: string;
    snippet: string;
  }>;
  selectedEvidenceChunks: Array<{
    chunkId: string;
    sectionTitle: string;
    pageNumber: number;
    text: string;
  }>;
  evidenceSufficiency: EvidenceSufficiency;
  finalAnswer: string;
  isFoundInDocuments: boolean;
  groundingScore: number;
  claimVerifications: ClaimGroundingVerification[];
  unsupportedClaims: string[];
  citations: Array<{
    documentName: string;
    pageNumber: number;
    sectionHeading: string;
    snippet: string;
  }>;
  engineUsed: string;
  failureClassification: RagFailureClassification;
  durationMs: number;
}

class RagTelemetryStore {
  private traces: RetrievalDiagnosticTrace[] = [];
  private readonly maxTraces = 100;

  public recordTrace(trace: RetrievalDiagnosticTrace): void {
    this.traces.unshift(trace);
    if (this.traces.length > this.maxTraces) {
      this.traces.pop();
    }
  }

  public getTraces(limit: number = 20, tenantId?: string): RetrievalDiagnosticTrace[] {
    let filtered = this.traces;
    if (tenantId) {
      filtered = filtered.filter((t) => t.tenantId === tenantId);
    }
    return filtered.slice(0, limit);
  }

  public getRecentTraces(limit: number = 20, tenantId?: string): RetrievalDiagnosticTrace[] {
    return this.getTraces(limit, tenantId);
  }

  public getStatistics(tenantId?: string): {
    totalQueries: number;
    groundedRate: number;
    averageDurationMs: number;
    failureBreakdown: Record<string, number>;
  } {
    let filtered = this.traces;
    if (tenantId) {
      filtered = filtered.filter((t) => t.tenantId === tenantId);
    }
    const totalQueries = filtered.length;
    if (totalQueries === 0) {
      return {
        totalQueries: 0,
        groundedRate: 100,
        averageDurationMs: 0,
        failureBreakdown: {},
      };
    }
    const groundedCount = filtered.filter((t) => t.isFoundInDocuments).length;
    const totalDuration = filtered.reduce((acc, t) => acc + t.durationMs, 0);
    const failureBreakdown: Record<string, number> = {};
    for (const t of filtered) {
      failureBreakdown[t.failureClassification] = (failureBreakdown[t.failureClassification] || 0) + 1;
    }
    return {
      totalQueries,
      groundedRate: Math.round((groundedCount / totalQueries) * 100),
      averageDurationMs: Math.round(totalDuration / totalQueries),
      failureBreakdown,
    };
  }

  public getTraceById(id: string): RetrievalDiagnosticTrace | undefined {
    return this.traces.find((t) => t.id === id || t.requestId === id);
  }

  public clear(): void {
    this.traces = [];
  }
}

export const ragTelemetryStore = new RagTelemetryStore();
