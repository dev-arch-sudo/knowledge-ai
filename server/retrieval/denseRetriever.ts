import type { CandidateChunk, DocumentChunk } from '../ragTypes.js';
import type { EmbeddingProvider } from './embeddingProvider.js';
import { cosineSimilarity } from './embeddingProvider.js';

export interface DenseRankedChunk {
  chunk: DocumentChunk;
  score: number;
  rank: number;
}

export class DenseRetriever {
  private readonly chunks: DocumentChunk[];
  private documentEmbeddings: number[][] = [];

  public constructor(
    private readonly provider: EmbeddingProvider,
    chunks: DocumentChunk[]
  ) {
    this.chunks = chunks;
  }

  public async initialize(): Promise<void> {
    const texts = this.chunks.map((chunk) => `${chunk.sectionTitle}\n${chunk.text}`);
    this.documentEmbeddings = await this.provider.embedDocuments(texts);
    if (this.documentEmbeddings.length !== this.chunks.length) {
      throw new Error('Dense retriever received an embedding count that does not match the indexed chunks.');
    }
  }

  public async search(query: string, topK = 10): Promise<DenseRankedChunk[]> {
    if (this.documentEmbeddings.length !== this.chunks.length) {
      throw new Error('DenseRetriever.initialize() must be called before search().');
    }

    const queryEmbedding = await this.provider.embedQuery(query);
    return this.chunks
      .map((chunk, index) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, this.documentEmbeddings[index] ?? []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }
}

export interface FusedRankedChunk {
  chunk: DocumentChunk;
  score: number;
  rank: number;
  heuristicRank?: number;
  denseRank?: number;
}

/**
 * Reciprocal-rank fusion combines rankings rather than incomparable raw scores.
 * k=60 is the conventional damping constant; with this tiny corpus it still
 * rewards agreement while allowing either retriever to rescue a miss.
 */
export function reciprocalRankFuse(
  heuristic: CandidateChunk[],
  dense: DenseRankedChunk[],
  topK = 10,
  k = 60
): FusedRankedChunk[] {
  const byChunk = new Map<string, FusedRankedChunk>();

  heuristic.forEach((item, index) => {
    const rank = index + 1;
    byChunk.set(item.chunk.chunkId, {
      chunk: item.chunk,
      score: 1 / (k + rank),
      rank: 0,
      heuristicRank: rank,
    });
  });

  dense.forEach((item, index) => {
    const rank = index + 1;
    const existing = byChunk.get(item.chunk.chunkId);
    if (existing) {
      existing.score += 1 / (k + rank);
      existing.denseRank = rank;
    } else {
      byChunk.set(item.chunk.chunkId, {
        chunk: item.chunk,
        score: 1 / (k + rank),
        rank: 0,
        denseRank: rank,
      });
    }
  });

  return Array.from(byChunk.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
