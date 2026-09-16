import crypto from 'crypto';
import type { KnowledgeDocument } from '../../src/types.js';
import { hybridRagIndex } from '../ragPipeline.js';
import type { CandidateChunk, DocumentChunk } from '../ragTypes.js';
import { DenseRetriever, reciprocalRankFuse } from './denseRetriever.js';
import type { EmbeddingProvider } from './embeddingProvider.js';
import { HuggingFaceBgeSmallEmbeddingProvider } from './huggingFaceEmbeddingProvider.js';

export type ProductionRetrievalMode = 'heuristic' | 'hybrid';
export type ProductionRetrievalModeUsed = 'heuristic' | 'hybrid' | 'heuristic-fallback';

export interface ProductionRetrievalRequest {
  query: string;
  documents: KnowledgeDocument[];
  tenantId?: string;
  knowledgeBaseId?: string;
  topK?: number;
  mode?: ProductionRetrievalMode;
}

export interface ProductionRetrievalResult {
  candidates: CandidateChunk[];
  requestedMode: ProductionRetrievalMode;
  modeUsed: ProductionRetrievalModeUsed;
  fallbackReason?: string;
}

interface DenseCacheEntry {
  signature: string;
  retriever: DenseRetriever;
}

type EmbeddingProviderFactory = () => EmbeddingProvider;

function configuredMode(): ProductionRetrievalMode {
  return process.env.KNOWLEDGE_AI_RETRIEVAL_MODE?.trim().toLowerCase() === 'hybrid'
    ? 'hybrid'
    : 'heuristic';
}

function chunkSignature(chunks: DocumentChunk[]): string {
  const stable = chunks
    .map((chunk) => `${chunk.chunkId}:${chunk.contentHash}`)
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(stable).digest('hex');
}

/**
 * Production first-stage retrieval boundary.
 *
 * Heuristic retrieval remains the default so introducing this abstraction does
 * not silently change production behavior. Hybrid mode is opt-in and combines
 * the existing heuristic ranking with local BGE dense retrieval using RRF.
 *
 * RRF is intentionally kept as a ranking signal only. It is not interpreted as
 * confidence and does not replace evidence sufficiency or grounding checks.
 */
export class ProductionRetriever {
  private readonly denseCache = new Map<string, DenseCacheEntry>();
  private readonly provider: EmbeddingProvider;

  public constructor(providerFactory: EmbeddingProviderFactory = () => new HuggingFaceBgeSmallEmbeddingProvider()) {
    this.provider = providerFactory();
  }

  private cacheKey(tenantId: string, knowledgeBaseId: string): string {
    return `${tenantId}::${knowledgeBaseId}`;
  }

  private async getDenseRetriever(
    tenantId: string,
    knowledgeBaseId: string,
    chunks: DocumentChunk[]
  ): Promise<DenseRetriever> {
    const key = this.cacheKey(tenantId, knowledgeBaseId);
    const signature = chunkSignature(chunks);
    const cached = this.denseCache.get(key);
    if (cached?.signature === signature) return cached.retriever;

    const retriever = new DenseRetriever(this.provider, chunks);
    await retriever.initialize();
    this.denseCache.set(key, { signature, retriever });
    return retriever;
  }

  private toCandidateChunks(
    fused: ReturnType<typeof reciprocalRankFuse>,
    heuristic: CandidateChunk[]
  ): CandidateChunk[] {
    const heuristicByChunk = new Map(heuristic.map((item) => [item.chunk.chunkId, item]));

    return fused.map((item) => {
      const lexical = heuristicByChunk.get(item.chunk.chunkId);
      const matchReasons = [
        ...(lexical?.matchReasons ?? []),
        `rrf_score=${item.score.toFixed(6)}`,
        item.heuristicRank ? `heuristic_rank=${item.heuristicRank}` : 'heuristic_rank=none',
        item.denseRank ? `dense_rank=${item.denseRank}` : 'dense_rank=none',
      ];

      // Preserve the old heuristic scores for downstream sufficiency/reranking.
      // The RRF score controls first-stage ordering only; it must not become a
      // synthetic confidence score. Dense-only rescues therefore carry zero
      // heuristic confidence until the later ranking/sufficiency layer is
      // explicitly benchmarked for semantic evidence.
      return {
        chunk: item.chunk,
        semanticScore: lexical?.semanticScore ?? 0,
        keywordScore: lexical?.keywordScore ?? 0,
        exactScore: lexical?.exactScore ?? 0,
        combinedScore: lexical?.combinedScore ?? 0,
        matchReasons,
      };
    });
  }

  public async retrieve(request: ProductionRetrievalRequest): Promise<ProductionRetrievalResult> {
    const tenantId = request.tenantId ?? 'acc_default';
    const knowledgeBaseId = request.knowledgeBaseId ?? 'kb_default';
    const topK = Math.max(1, request.topK ?? 12);
    const requestedMode = request.mode ?? configuredMode();

    hybridRagIndex.indexDocuments(request.documents, tenantId, knowledgeBaseId);
    const heuristic = hybridRagIndex.search(request.query, tenantId, knowledgeBaseId, requestedMode === 'hybrid' ? Math.max(topK, 20) : topK);

    if (requestedMode === 'heuristic') {
      return {
        candidates: heuristic.slice(0, topK),
        requestedMode,
        modeUsed: 'heuristic',
      };
    }

    const chunks = hybridRagIndex.getChunks(tenantId, knowledgeBaseId);
    if (chunks.length === 0) {
      return {
        candidates: heuristic.slice(0, topK),
        requestedMode,
        modeUsed: 'heuristic-fallback',
        fallbackReason: 'No indexed chunks were available for dense retrieval.',
      };
    }

    try {
      const denseRetriever = await this.getDenseRetriever(tenantId, knowledgeBaseId, chunks);
      const dense = await denseRetriever.search(request.query, Math.max(topK, 20));
      const fused = reciprocalRankFuse(heuristic, dense, topK);
      return {
        candidates: this.toCandidateChunks(fused, heuristic),
        requestedMode,
        modeUsed: 'hybrid',
      };
    } catch (error) {
      const fallbackReason = error instanceof Error ? error.message : String(error);
      console.warn('Hybrid retrieval failed; falling back to heuristic retrieval:', fallbackReason);
      return {
        candidates: heuristic.slice(0, topK),
        requestedMode,
        modeUsed: 'heuristic-fallback',
        fallbackReason,
      };
    }
  }
}

export const productionRetriever = new ProductionRetriever();
