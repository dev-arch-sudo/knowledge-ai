import fs from 'fs';
import path from 'path';
import { generateSampleDocs } from '../server/sampleDocs.js';
import { parsePdfBuffer, createKnowledgeDocument } from '../server/documentService.js';
import { hybridRagIndex, checkEvidenceSufficiency } from '../server/ragPipeline.js';
import type { DocumentChunk } from '../server/ragTypes.js';
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

const TENANT_ID = 'production_hybrid_benchmark_tenant';
const KB_ID = 'production_hybrid_benchmark_kb';
const CASES_PATH = path.join(process.cwd(), 'benchmarks', 'retrieval', 'retrieval-cases.json');
const EPSILON = 1e-9;

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
  const matched = expected.filter((source) =>
    top.some((item) => sourceMatchesChunk(source, item.chunk))
  ).length;
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

function summarize(results: MetricSet[]): MetricSet {
  return {
    recallAt1: average(results.map((item) => item.recallAt1)),
    recallAt5: average(results.map((item) => item.recallAt5)),
    recallAt10: average(results.map((item) => item.recallAt10)),
    mrr: average(results.map((item) => item.mrr)),
    ndcgAt10: average(results.map((item) => item.ndcgAt10)),
  };
}

function isNotWorse(hybrid: number, heuristic: number): boolean {
  return hybrid + EPSILON >= heuristic;
}

function assertNotWorse(label: string, hybrid: number, heuristic: number): void {
  if (!isNotWorse(hybrid, heuristic)) {
    throw new Error(
      `PRODUCTION_HYBRID_REGRESSION:${label}:hybrid=${hybrid.toFixed(6)}:heuristic=${heuristic.toFixed(6)}`
    );
  }
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

  const retriever = new ProductionRetriever();
  const answerable = cases.filter((item) => !item.noEvidence);
  const noEvidence = cases.filter((item) => item.noEvidence);

  const heuristicCandidateMetrics: MetricSet[] = [];
  const hybridCandidateMetrics: MetricSet[] = [];
  const heuristicEvidenceMetrics: MetricSet[] = [];
  const hybridEvidenceMetrics: MetricSet[] = [];
  const comparisons: Array<Record<string, unknown>> = [];

  for (const testCase of answerable) {
    const expected = testCase.expectedSources ?? [];
    const heuristic = await retriever.retrieve(testCase.question, TENANT_ID, KB_ID, {
      mode: 'heuristic',
      candidateK: 12,
      fusionK: 20,
      evidenceK: 5,
    });
    const hybrid = await retriever.retrieve(testCase.question, TENANT_ID, KB_ID, {
      mode: 'hybrid',
      candidateK: 12,
      fusionK: 20,
      evidenceK: 5,
    });

    if (hybrid.effectiveMode !== 'hybrid') {
      throw new Error(`PRODUCTION_HYBRID_BENCHMARK_FALLBACK:${testCase.id}:${hybrid.fallbackReason}`);
    }

    const heuristicCandidates = metrics(expected, heuristic.candidates);
    const hybridCandidates = metrics(expected, hybrid.candidates);
    const heuristicEvidence = metrics(expected, heuristic.reranked);
    const hybridEvidence = metrics(expected, hybrid.reranked);

    heuristicCandidateMetrics.push(heuristicCandidates);
    hybridCandidateMetrics.push(hybridCandidates);
    heuristicEvidenceMetrics.push(heuristicEvidence);
    hybridEvidenceMetrics.push(hybridEvidence);

    comparisons.push({
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      heuristicCandidates,
      hybridCandidates,
      heuristicEvidence,
      hybridEvidence,
      hybridTop5: hybrid.reranked.map((item) => ({
        rank: item.rank,
        document: item.chunk.documentName,
        page: item.chunk.pageNumber,
        section: item.chunk.sectionTitle,
        rerankScore: item.rerankScore,
      })),
    });
  }

  let heuristicAbstentions = 0;
  let hybridAbstentions = 0;
  const noEvidenceComparisons = [];

  for (const testCase of noEvidence) {
    const heuristic = await retriever.retrieve(testCase.question, TENANT_ID, KB_ID, {
      mode: 'heuristic',
      candidateK: 12,
      fusionK: 20,
      evidenceK: 5,
    });
    const hybrid = await retriever.retrieve(testCase.question, TENANT_ID, KB_ID, {
      mode: 'hybrid',
      candidateK: 12,
      fusionK: 20,
      evidenceK: 5,
    });
    const heuristicSufficiency = checkEvidenceSufficiency(testCase.question, heuristic.reranked);
    const hybridSufficiency = checkEvidenceSufficiency(testCase.question, hybrid.reranked);
    if (!heuristicSufficiency.isSufficient) heuristicAbstentions += 1;
    if (!hybridSufficiency.isSufficient) hybridAbstentions += 1;

    noEvidenceComparisons.push({
      id: testCase.id,
      question: testCase.question,
      heuristicAbstained: !heuristicSufficiency.isSufficient,
      hybridAbstained: !hybridSufficiency.isSufficient,
      heuristicSufficiencyScore: heuristicSufficiency.sufficiencyScore,
      hybridSufficiencyScore: hybridSufficiency.sufficiencyScore,
    });
  }

  const heuristicCandidateSummary = summarize(heuristicCandidateMetrics);
  const hybridCandidateSummary = summarize(hybridCandidateMetrics);
  const heuristicEvidenceSummary = summarize(heuristicEvidenceMetrics);
  const hybridEvidenceSummary = summarize(hybridEvidenceMetrics);
  const heuristicAbstentionRate = noEvidence.length ? heuristicAbstentions / noEvidence.length : 1;
  const hybridAbstentionRate = noEvidence.length ? hybridAbstentions / noEvidence.length : 1;

  const regressionGuard = {
    candidateRecallAt5NotWorse: isNotWorse(hybridCandidateSummary.recallAt5, heuristicCandidateSummary.recallAt5),
    candidateRecallAt10NotWorse: isNotWorse(hybridCandidateSummary.recallAt10, heuristicCandidateSummary.recallAt10),
    finalEvidenceRecallAt5NotWorse: isNotWorse(hybridEvidenceSummary.recallAt5, heuristicEvidenceSummary.recallAt5),
    finalEvidenceRecallAt10NotWorse: isNotWorse(hybridEvidenceSummary.recallAt10, heuristicEvidenceSummary.recallAt10),
    noEvidenceAbstentionNotWorse: isNotWorse(hybridAbstentionRate, heuristicAbstentionRate),
  };

  const summary = {
    benchmark: 'project-sample-documents-production-hybrid-v1',
    totalCases: cases.length,
    answerableCases: answerable.length,
    noEvidenceCases: noEvidence.length,
    productionSettings: {
      candidateK: 12,
      fusionK: 20,
      evidenceK: 5,
      defaultModeRemains: 'heuristic',
      hybridFeatureBoundary: 'KNOWLEDGE_AI_RETRIEVAL_MODE=hybrid',
    },
    firstStageCandidates: {
      heuristic: heuristicCandidateSummary,
      hybrid: hybridCandidateSummary,
    },
    finalEvidenceAfterRerank: {
      heuristic: heuristicEvidenceSummary,
      hybrid: hybridEvidenceSummary,
      note: 'Only five evidence chunks are retained in production, so Recall@10 equals Recall@5 for this stage.',
    },
    noEvidenceAbstention: {
      heuristic: heuristicAbstentionRate,
      hybrid: hybridAbstentionRate,
    },
    regressionGuard,
    boundaries: [
      'Hybrid mode uses local BGE + RRF and then the existing heuristic reranker.',
      'Dense failures must fall back to the existing heuristic path.',
      'The production default remains heuristic until this integration benchmark is reviewed.',
      'Cosine similarity is not used as answer confidence or as a refusal threshold.',
    ],
  };

  // Always emit the measured behavior before enforcing the blocking assertions.
  // This keeps failed CI runs diagnosable without weakening any regression guard.
  console.log('PRODUCTION_HYBRID_BENCHMARK_SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  console.log('PRODUCTION_HYBRID_BENCHMARK_CASES');
  console.log(JSON.stringify(comparisons, null, 2));
  console.log('PRODUCTION_HYBRID_NO_EVIDENCE_CASES');
  console.log(JSON.stringify(noEvidenceComparisons, null, 2));

  // The integration benchmark is a blocking safety gate, not only a report.
  // Hybrid must preserve retrieval coverage through the production reranker and
  // must not weaken the existing no-evidence abstention behavior on this frozen corpus.
  assertNotWorse('candidate_recall_at_5', hybridCandidateSummary.recallAt5, heuristicCandidateSummary.recallAt5);
  assertNotWorse('candidate_recall_at_10', hybridCandidateSummary.recallAt10, heuristicCandidateSummary.recallAt10);
  assertNotWorse('final_evidence_recall_at_5', hybridEvidenceSummary.recallAt5, heuristicEvidenceSummary.recallAt5);
  assertNotWorse('final_evidence_recall_at_10', hybridEvidenceSummary.recallAt10, heuristicEvidenceSummary.recallAt10);
  assertNotWorse('no_evidence_abstention', hybridAbstentionRate, heuristicAbstentionRate);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
