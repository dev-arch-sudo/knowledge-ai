import type { CandidateChunk, RerankedChunk } from '../ragTypes.js';
import { hybridRagIndex, rerankCandidates } from '../ragPipeline.js';
import { DenseRetriever, reciprocalRankFuse } from './denseRetriever.js';
import type { EmbeddingProvider } from './embeddingProvider.js';
import { HuggingFaceBgeSmallEmbeddingProvider } from './huggingFaceEmbeddingProvider.js';

export type ProductionRetrievalMode = 'heuristic' | 'hybrid';
export type EffectiveRetrievalMode = ProductionRetrievalMode | 'heuristic-fallback';

export interface ProductionRetrievalResult {
  candidates: CandidateChunk[];
  reranked: RerankedChunk[];
  requestedMode: ProductionRetrievalMode;
  effectiveMode: EffectiveRetrievalMode;
  fallbackReason?: string;
}

interface DenseCacheEntry {
  fingerprint: string;
  retriever: DenseRetriever;
}

function resolveMode(value = process.env.KNOWLEDGE_AI_RETRIEVAL_MODE): ProductionRetrievalMode {
  return value?.toLowerCase() === 'hybrid' ? 'hybrid' : 'heuristic';
}

function chunksFingerprint(tenantId: string, knowledgeBaseId: string): string {
  const chunks = hybridRagIndex.getChunks(tenantId, knowledgeBaseId);
  return chunks.map((chunk) => `${chunk.chunkId}:${chunk.contentHash}`).join('|');
}

export class ProductionRetriever {
  private readonly denseCache = new Map<string, DenseCacheEntry>();

  public constructor(
    private readonly provider: EmbeddingProvider = new HuggingFaceBgeSmallEmbeddingProvider()
  ) {}

  private cacheKey(tenantId: string, knowledgeBaseId: string): string {
    return `${tenantId}::${knowledgeBaseId}`;
  }

  private async getDenseRetriever(tenantId: string, knowledgeBaseId: string): Promise<DenseRetriever> {
    const key = this.cacheKey(tenantId, knowledgeBaseId);
    const fingerprint = chunksFingerprint(tenantId, knowledgeBaseId);
    const cached = this.denseCache.get(key);

    if (cached && cached.fingerprint === fingerprint) return cached.retriever;

    const chunks = hybridRagIndex.getChunks(tenantId, knowledgeBaseId);
    const retriever = new DenseRetriever(this.provider, chunks);
    await retriever.initialize();
    this.denseCache.set(key, { fingerprint, retriever });
    return retriever;
  }

  private heuristic(
    query: string,
    tenantId: string,
    knowledgeBaseId: string,
    candidateK: number,
    evidenceK: number
  ): ProductionRetrievalResult {
    const candidates = hybridRagIndex.search(query, tenantId, knowledgeBaseId, candidateK);
    return {
      candidates,
      reranked: rerankCandidates(query, candidates, evidenceK),
      requestedMode: 'heuristic',
      effectiveMode: 'heuristic',
    };
  }

  public async retrieve(
    query: string,
    tenantId: string,
    knowledgeBaseId: string,
    options: {
      mode?: ProductionRetrievalMode;
      candidateK?: number;
      fusionK?: number;
      evidenceK?: number;
    } = {}
  ): Promise<ProductionRetrievalResult> {
    const requestedMode = options.mode ?? resolveMode();
    const candidateK = options.candidateK ?? 12;
    const fusionK = options.fusionK ?? 20;
    const evidenceK = options.evidenceK ?? 5;

    if (requestedMode === 'heuristic') {
      return this.heuristic(query, tenantId, knowledgeBaseId, candidateK, evidenceK);
    }

    try {
      const heuristicCandidates = hybridRagIndex.search(query, tenantId, knowledgeBaseId, fusionK);
      const denseRetriever = await this.getDenseRetriever(tenantId, knowledgeBaseId);
      const denseCandidates = await denseRetriever.search(query, fusionK);
      const fused = reciprocalRankFuse(heuristicCandidates, denseCandidates, fusionK);
      const maxFusedScore = fused[0]?.score ?? 1;
      const heuristicByChunk = new Map(
        heuristicCandidates.map((candidate) => [candidate.chunk.chunkId, candidate])
      );
      const denseByChunk = new Map(
        denseCandidates.map((candidate) => [candidate.chunk.chunkId, candidate])
      );

      const candidates: CandidateChunk[] = fused.slice(0, candidateK).map((item) => {
        const heuristicCandidate = heuristicByChunk.get(item.chunk.chunkId);
        const denseCandidate = denseByChunk.get(item.chunk.chunkId);
        const normalizedRrf = maxFusedScore > 0 ? item.score / maxFusedScore : 0;
        const reasons = [
          ...(heuristicCandidate?.matchReasons ?? []),
          `rrf=${item.score.toFixed(5)}`,
          item.heuristicRank ? `heuristic_rank=${item.heuristicRank}` : 'heuristic_rank=none',
          item.denseRank ? `dense_rank=${item.denseRank}` : 'dense_rank=none',
        ];

        return {
          chunk: item.chunk,
          semanticScore: denseCandidate?.score ?? 0,
          keywordScore: heuristicCandidate?.keywordScore ?? 0,
          exactScore: heuristicCandidate?.exactScore ?? 0,
          combinedScore: normalizedRrf,
          matchReasons: reasons,
        };
      });

      return {
        candidates,
        reranked: rerankCandidates(query, candidates, evidenceK),
        requestedMode,
        effectiveMode: 'hybrid',
      };
    } catch (error) {
      const fallback = this.heuristic(query, tenantId, knowledgeBaseId, candidateK, evidenceK);
      return {
        ...fallback,
        requestedMode,
        effectiveMode: 'heuristic-fallback',
        fallbackReason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const productionRetriever = new ProductionRetriever();
