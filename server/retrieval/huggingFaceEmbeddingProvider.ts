import type { EmbeddingProvider, EmbeddingProviderMetadata } from './embeddingProvider.js';

type FeatureExtractor = (
  inputs: string | string[],
  options?: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean }
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

const QUERY_INSTRUCTION = 'Represent this sentence for searching relevant passages: ';

export class HuggingFaceBgeSmallEmbeddingProvider implements EmbeddingProvider {
  public readonly metadata: EmbeddingProviderMetadata = {
    provider: 'huggingface-transformers-js',
    model: 'Xenova/bge-small-en-v1.5',
    revision: 'main',
    dimension: 384,
    normalized: true,
    similarity: 'cosine',
    maxInputTokens: 512,
    execution: 'local',
  };

  private extractorPromise: Promise<FeatureExtractor> | null = null;

  private async getExtractor(): Promise<FeatureExtractor> {
    if (!this.extractorPromise) {
      this.extractorPromise = import('@huggingface/transformers').then(async ({ pipeline }) => {
        const extractor = await pipeline(
          'feature-extraction',
          this.metadata.model,
          { revision: this.metadata.revision }
        );
        return extractor as unknown as FeatureExtractor;
      });
    }
    return this.extractorPromise;
  }

  private toVectors(output: { data: Float32Array | number[]; dims: number[] }, expectedCount: number): number[][] {
    const dimension = output.dims.at(-1) ?? this.metadata.dimension;
    if (dimension !== this.metadata.dimension) {
      throw new Error(`Unexpected embedding dimension ${dimension}; expected ${this.metadata.dimension}.`);
    }

    const flat = Array.from(output.data);
    if (flat.length !== expectedCount * dimension) {
      throw new Error(
        `Unexpected embedding output size ${flat.length}; expected ${expectedCount * dimension}.`
      );
    }

    return Array.from({ length: expectedCount }, (_, index) =>
      flat.slice(index * dimension, (index + 1) * dimension)
    );
  }

  private async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getExtractor();
    const output = await extractor(texts, { pooling: 'cls', normalize: true });
    return this.toVectors(output, texts.length);
  }

  public embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  public embedQuery(text: string): Promise<number[]> {
    return this.embed([`${QUERY_INSTRUCTION}${text}`]).then((vectors) => vectors[0] ?? []);
  }
}
