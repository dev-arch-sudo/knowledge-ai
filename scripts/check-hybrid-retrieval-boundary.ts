import fs from 'fs';
import path from 'path';
import { generateSampleDocs } from '../server/sampleDocs.js';
import { parsePdfBuffer, createKnowledgeDocument } from '../server/documentService.js';
import type { DocumentChunk } from '../server/ragTypes.js';
import type { EmbeddingProvider } from '../server/retrieval/embeddingProvider.js';
import { ProductionRetriever } from '../server/retrieval/productionRetriever.js';

interface ExpectedSource {
  document: string;
  page: number;
  contains: string[];
}

interface RetrievalCase {
  id: string;
  category: string;
  question: string;
  expectedSources?: ExpectedSource[];
  noEvidence?: boolean;
}

interface RankedChunk {
  chunk: DocumentChunk;
}

interface MetricSet {
  recallAt1: number;
  recallAt5: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
}

const TENANT_ID = 'hybrid_boundary_benchmark_tenant';
const KB_ID = 'hybrid_boundary_benchmark_kb';
const CASES_PATH = path.join(process.cwd(), 'benchmarks', 'retrieval', 'retrieval-cases.json');

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceMatchesChunk(source: ExpectedSource, chunk: DocumentChunk): boolean {
  if (chunk.documentName !== source.document || chunk.pageNumber !== source.page) return false;
  const haystack = normalize(`${chunk.sectionTitle} ${chunk.text}`);
  return source.contains.every((term) => haystack.includes(normalize(term)));
}

function recallAtK(expected: ExpectedSource[], ranked: RankedChunk[], k: number): number {
  if (!expected.length) return 1;
  const top = ranked.slice(0, k);
  const matched = expected.filter((source) => top.some((item) => sourceMatchesChunk(source, item.chunk))).length;
  return matched / expected.length;
}

function reciprocalRank(expected: ExpectedSource[], ranked: RankedChunk[]): number {
  for (let index = 0; index < ranked.length; index += 1) {
    if (expected.some((source) => sourceMatchesChunk(source, ranked[index]!.chunk))) {
      return 1 / (index + 1);
    }
  }
  return 0;
}

function ndcgAtK(expected: ExpectedSource[], ranked: RankedChunk[], k: number): number {
  if (!expected.length) return 1;
  const used = new Set<number>();
  let dcg = 0;

  ranked.slice(0, k).forEach((item, index) => {
    const sourceIndex = expected.findIndex((source, candidateIndex) =>
      !used.has(candidateIndex) && sourceMatchesChunk(source, item.chunk)
    );
    if (sourceIndex >= 0) {
      used.add(sourceIndex);
      dcg += 1 / Math.log2(index + 2);
    }
  });

  const idealCount = Math.min(expected.length, k);
  let idcg = 0;
  for (let index = 0; index < idealCount; index += 1) {
    idcg += 1 / Math.log2(index + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function summarize(results: MetricSet[]): MetricSet {
  return {
    recallAt1: average(results.map((item) => item.recallAt1)),
    recallAt5: average(results.map((item) => item.recallAt5)),
    recallAt10: average(results.map((item) => item.recallAt10)),
    mrr: average(results.map((item) => item.mrr)),
    ndcgAt10: average(results.map((item) => item.ndcgAt10)),
  };
}

async function buildBenchmarkDocuments() {
  const generated = await generateSampleDocs();
  const documents = [];
  for (const sample of generated) {
    const parsed = await parsePdfBuffer(sample.filename, sample.buffer);
    documents.push(
      createKnowledgeDocument(
        sample.filename,
        sample.buffer,
        parsed.pageCount,
        parsed.pages,
        parsed.summary
      )
    );
  }
  return documents;
}

async function run() {
  const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8')) as RetrievalCase[];
  const documents = await buildBenchmarkDocuments();
  const retriever = new ProductionRetriever();

  const firstAnswerable = cases.find((item) => !item.noEvidence);
  if (!firstAnswerable) throw new Error('Hybrid retrieval benchmark has no answerable cases.');

  const defaultResult = await retriever.retrieve({
    query: firstAnswerable.question,
    documents,
    tenantId: TENANT_ID,
    knowledgeBaseId: KB_ID,
    topK: 20,
  });
  if (defaultResult.modeUsed !== 'heuristic') {
    throw new Error(`Default retrieval mode changed unexpectedly to ${defaultResult.modeUsed}.`);
  }

  const metricRows: MetricSet[] = [];
  for (const testCase of cases.filter((item) => !item.noEvidence)) {
    const result = await retriever.retrieve({
      query: testCase.question,
      documents,
      tenantId: TENANT_ID,
      knowledgeBaseId: KB_ID,
      topK: 20,
      mode: 'hybrid',
    });

    if (result.modeUsed !== 'hybrid') {
      throw new Error(`Hybrid retrieval unexpectedly fell back for ${testCase.id}: ${result.fallbackReason ?? 'unknown reason'}`);
    }

    const expected = testCase.expectedSources ?? [];
    metricRows.push({
      recallAt1: recallAtK(expected, result.candidates, 1),
      recallAt5: recallAtK(expected, result.candidates, 5),
      recallAt10: recallAtK(expected, result.candidates, 10),
      mrr: reciprocalRank(expected, result.candidates),
      ndcgAt10: ndcgAtK(expected, result.candidates, 10),
    });
  }

  const summary = summarize(metricRows);

  // These thresholds freeze the measured architecture gain while allowing tiny
  // implementation-level variation. They intentionally do not assert confidence
  // or no-evidence behavior because RRF/cosine are ranking signals only.
  if (summary.recallAt5 < 0.95) {
    throw new Error(`Hybrid boundary Recall@5 regressed: ${(summary.recallAt5 * 100).toFixed(2)}%`);
  }
  if (summary.recallAt10 < 0.99) {
    throw new Error(`Hybrid boundary Recall@10 regressed: ${(summary.recallAt10 * 100).toFixed(2)}%`);
  }
  if (summary.mrr < 0.82) {
    throw new Error(`Hybrid boundary MRR regressed: ${(summary.mrr * 100).toFixed(2)}%`);
  }

  const failingProvider: EmbeddingProvider = {
    metadata: {
      provider: 'test-failure',
      model: 'intentional-failure',
      dimension: 1,
      normalized: true,
      similarity: 'cosine',
      execution: 'local',
    },
    async embedDocuments() {
      throw new Error('intentional embedding failure');
    },
    async embedQuery() {
      return [0];
    },
  };

  const fallbackRetriever = new ProductionRetriever(() => failingProvider);
  const fallback = await fallbackRetriever.retrieve({
    query: firstAnswerable.question,
    documents,
    tenantId: `${TENANT_ID}_fallback`,
    knowledgeBaseId: `${KB_ID}_fallback`,
    topK: 12,
    mode: 'hybrid',
  });

  if (fallback.modeUsed !== 'heuristic-fallback' || fallback.candidates.length === 0) {
    throw new Error('Hybrid retrieval did not fail safely to the heuristic retriever.');
  }

  console.log('HYBRID_RETRIEVAL_BOUNDARY_PASS');
  console.log(JSON.stringify({
    benchmark: 'project-sample-documents-retrieval-v1',
    answerableCases: metricRows.length,
    defaultMode: defaultResult.modeUsed,
    hybridMetrics: summary,
    fallbackMode: fallback.modeUsed,
    note: 'Hybrid RRF is validated as a ranking boundary only. Evidence sufficiency and grounding remain separate trust controls.',
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
