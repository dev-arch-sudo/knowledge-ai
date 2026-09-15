import fs from 'fs';
import path from 'path';
import { generateSampleDocs } from '../server/sampleDocs.js';
import { parsePdfBuffer, createKnowledgeDocument } from '../server/documentService.js';
import { hybridRagIndex } from '../server/ragPipeline.js';
import type { DocumentChunk } from '../server/ragTypes.js';
import { DenseRetriever, reciprocalRankFuse } from '../server/retrieval/denseRetriever.js';
import { HuggingFaceBgeSmallEmbeddingProvider } from '../server/retrieval/huggingFaceEmbeddingProvider.js';

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

const TENANT_ID = 'embedding_benchmark_tenant';
const KB_ID = 'embedding_benchmark_kb';
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

function metrics(expected: ExpectedSource[], ranked: RankedChunk[]): MetricSet {
  return {
    recallAt1: recallAtK(expected, ranked, 1),
    recallAt5: recallAtK(expected, ranked, 5),
    recallAt10: recallAtK(expected, ranked, 10),
    mrr: reciprocalRank(expected, ranked),
    ndcgAt10: ndcgAtK(expected, ranked, 10),
  };
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function summarize(results: Array<{ metrics: MetricSet }>): MetricSet {
  return {
    recallAt1: average(results.map((item) => item.metrics.recallAt1)),
    recallAt5: average(results.map((item) => item.metrics.recallAt5)),
    recallAt10: average(results.map((item) => item.metrics.recallAt10)),
    mrr: average(results.map((item) => item.metrics.mrr)),
    ndcgAt10: average(results.map((item) => item.metrics.ndcgAt10)),
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
  hybridRagIndex.indexDocuments(documents, TENANT_ID, KB_ID);
  const chunks = hybridRagIndex.getChunks(TENANT_ID, KB_ID);

  const provider = new HuggingFaceBgeSmallEmbeddingProvider();
  const denseRetriever = new DenseRetriever(provider, chunks);
  const startedAt = Date.now();
  await denseRetriever.initialize();
  const indexingLatencyMs = Date.now() - startedAt;

  const answerable = cases.filter((item) => !item.noEvidence);
  const noEvidence = cases.filter((item) => item.noEvidence);
  const heuristicResults: Array<{ id: string; category: string; metrics: MetricSet }> = [];
  const denseResults: Array<{ id: string; category: string; metrics: MetricSet }> = [];
  const hybridResults: Array<{ id: string; category: string; metrics: MetricSet }> = [];
  const caseComparisons: Array<Record<string, unknown>> = [];

  for (const testCase of answerable) {
    const expected = testCase.expectedSources ?? [];
    const heuristic = hybridRagIndex.search(testCase.question, TENANT_ID, KB_ID, 20);
    const dense = await denseRetriever.search(testCase.question, 20);
    const hybrid = reciprocalRankFuse(heuristic, dense, 20);

    const heuristicMetrics = metrics(expected, heuristic);
    const denseMetrics = metrics(expected, dense);
    const hybridMetrics = metrics(expected, hybrid);
    heuristicResults.push({ id: testCase.id, category: testCase.category, metrics: heuristicMetrics });
    denseResults.push({ id: testCase.id, category: testCase.category, metrics: denseMetrics });
    hybridResults.push({ id: testCase.id, category: testCase.category, metrics: hybridMetrics });

    caseComparisons.push({
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      heuristic: heuristicMetrics,
      dense: denseMetrics,
      hybrid: hybridMetrics,
      denseTop5: dense.slice(0, 5).map((item) => ({
        rank: item.rank,
        score: item.score,
        document: item.chunk.documentName,
        page: item.chunk.pageNumber,
        section: item.chunk.sectionTitle,
      })),
    });
  }

  const negativeScoreObservations = [];
  for (const testCase of noEvidence) {
    const dense = await denseRetriever.search(testCase.question, 5);
    negativeScoreObservations.push({
      id: testCase.id,
      question: testCase.question,
      topDenseCosine: dense[0]?.score ?? null,
      topDenseChunk: dense[0] ? {
        document: dense[0].chunk.documentName,
        page: dense[0].chunk.pageNumber,
        section: dense[0].chunk.sectionTitle,
      } : null,
    });
  }

  const heuristicSummary = summarize(heuristicResults);
  const denseSummary = summarize(denseResults);
  const hybridSummary = summarize(hybridResults);
  const categories = Array.from(new Set(answerable.map((item) => item.category)));
  const categoryBreakdown = Object.fromEntries(categories.map((category) => {
    const inCategory = (items: Array<{ category: string; metrics: MetricSet }>) =>
      items.filter((item) => item.category === category);
    return [category, {
      total: answerable.filter((item) => item.category === category).length,
      heuristic: summarize(inCategory(heuristicResults)),
      dense: summarize(inCategory(denseResults)),
      hybrid: summarize(inCategory(hybridResults)),
    }];
  }));

  const summary = {
    benchmark: 'project-sample-documents-retrieval-v1',
    experiment: 'bge-small-en-v1.5-local-dense-v1',
    totalCases: cases.length,
    answerableCases: answerable.length,
    noEvidenceCases: noEvidence.length,
    indexedChunks: chunks.length,
    embeddingProvider: provider.metadata,
    indexingLatencyMs,
    heuristic: heuristicSummary,
    dense: denseSummary,
    hybridRrf: hybridSummary,
    categoryBreakdown,
    noEvidenceDenseScoreObservations: negativeScoreObservations,
    interpretation: [
      'Dense cosine similarity is a ranking signal, not a calibrated confidence score.',
      'No dense abstention threshold is selected by this experiment.',
      'The existing production retriever remains unchanged until an experiment is explicitly promoted.',
      'Hybrid uses reciprocal-rank fusion so heuristic and cosine raw score scales are never mixed directly.',
    ],
  };

  console.log('EMBEDDING_RETRIEVAL_BENCHMARK_SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  console.log('EMBEDDING_RETRIEVAL_BENCHMARK_CASES');
  console.log(JSON.stringify(caseComparisons, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
