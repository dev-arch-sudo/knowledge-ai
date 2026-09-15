export type EmbeddingSimilarity = 'cosine' | 'dot_product' | 'euclidean';

export interface EmbeddingProviderMetadata {
  provider: string;
  model: string;
  revision?: string;
  dimension: number;
  normalized: boolean;
  similarity: EmbeddingSimilarity;
  maxInputTokens?: number;
  execution: 'local' | 'hosted';
}

export interface EmbeddingProvider {
  readonly metadata: EmbeddingProviderMetadata;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
