import fs from 'fs';
import path from 'path';
import { generateSampleDocs } from '../server/sampleDocs.js';
import { parsePdfBuffer, createKnowledgeDocument } from '../server/documentService.js';
import {
  hybridRagIndex,
  rerankCandidates,
  checkEvidenceSufficiency,
} from '../server/ragPipeline.js';
import { DocumentChunk, RerankedChunk } from '../server/ragTypes.js';

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

const TENANT_ID = 'retrieval_benchmark_tenant';
const KB_ID = 'retrieval_benchmark_kb';
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

function sourceRank(source: ExpectedSource, ranked: RankedChunk[]): number | null {
  const index = ranked.findIndex((item) => sourceMatchesChunk(source, item.chunk));
  return index >= 0 ? index + 1 : null;
}

function recallAtK(expected: ExpectedSource[], ranked: RankedChunk[], k: number): number {
  if (!expected.length) return 1;
  const top = ranked.slice(0, k);
  const matched = expected.filter((source) => top.some((item) => sourceMatchesChunk(source, item.chunk))).length;
  return matched / expected.length;
}

function reciprocalRank(expected: ExpectedSource[], ranked: RankedChunk[]): number {
  const ranks = expected
    .map((source) => sourceRank(source, ranked))
    .filter((rank): rank is number => rank !== null);
  if (!ranks.length) return 0;
  return 1 / Math.min(...ranks);
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
  for (let index = 0; index < idealCount; index++) {
    idcg += 1 / Math.log2(index + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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
  const allChunks = hybridRagIndex.getChunks(TENANT_ID, KB_ID);

  const unresolvedJudgments: Array<{ caseId: string; source: ExpectedSource }> = [];
  for (const testCase of cases.filter((item) => !item.noEvidence)) {
    for (const source of testCase.expectedSources || []) {
      if (!allChunks.some((chunk) => sourceMatchesChunk(source, chunk))) {
        unresolvedJudgments.push({ caseId: testCase.id, source });
      }
    }
  }

  if (unresolvedJudgments.length > 0) {
    console.error('RETRIEVAL_BENCHMARK_INVALID_JUDGMENTS');
    console.error(JSON.stringify(unresolvedJudgments, null, 2));
    throw new Error(`${unresolvedJudgments.length} retrieval benchmark source judgments do not resolve to production chunks.`);
  }

  const answerableResults: Array<Record<string, unknown>> = [];
  const noEvidenceResults: Array<Record<string, unknown>> = [];

  for (const testCase of cases) {
    const candidates = hybridRagIndex.search(testCase.question, TENANT_ID, KB_ID, 20);
    const reranked = rerankCandidates(testCase.question, candidates, 10);

    if (testCase.noEvidence) {
      const sufficiency = checkEvidenceSufficiency(testCase.question, reranked as RerankedChunk[]);
      noEvidenceResults.push({
        id: testCase.id,
        category: testCase.category,
        question: testCase.question,
        candidateCount: candidates.length,
        topCandidateScore: candidates[0]?.combinedScore ?? 0,
        topRerankScore: reranked[0]?.rerankScore ?? 0,
        correctlyAbstains: !sufficiency.isSufficient,
        sufficiencyScore: sufficiency.sufficiencyScore,
      });
      continue;
    }

    const expected = testCase.expectedSources || [];
    const candidateMetrics = {
      recallAt1: recallAtK(expected, candidates, 1),
      recallAt5: recallAtK(expected, candidates, 5),
      recallAt10: recallAtK(expected, candidates, 10),
      mrr: reciprocalRank(expected, candidates),
      ndcgAt10: ndcgAtK(expected, candidates, 10),
    };
    const rerankedMetrics = {
      recallAt1: recallAtK(expected, reranked, 1),
      recallAt5: recallAtK(expected, reranked, 5),
      recallAt10: recallAtK(expected, reranked, 10),
      mrr: reciprocalRank(expected, reranked),
      ndcgAt10: ndcgAtK(expected, reranked, 10),
    };

    answerableResults.push({
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      expectedSourceCount: expected.length,
      candidateMetrics,
      rerankedMetrics,
      candidateTop5: candidates.slice(0, 5).map((item, index) => ({
        rank: index + 1,
        document: item.chunk.documentName,
        page: item.chunk.pageNumber,
        section: item.chunk.sectionTitle,
        score: item.combinedScore,
        snippet: item.chunk.text.slice(0, 140),
      })),
      rerankedTop5: reranked.slice(0, 5).map((item, index) => ({
        rank: index + 1,
        document: item.chunk.documentName,
        page: item.chunk.pageNumber,
        section: item.chunk.sectionTitle,
        score: item.rerankScore,
        snippet: item.chunk.text.slice(0, 140),
      })),
    });
  }

  const candidate = {
    recallAt1: average(answerableResults.map((item: any) => item.candidateMetrics.recallAt1)),
    recallAt5: average(answerableResults.map((item: any) => item.candidateMetrics.recallAt5)),
    recallAt10: average(answerableResults.map((item: any) => item.candidateMetrics.recallAt10)),
    mrr: average(answerableResults.map((item: any) => item.candidateMetrics.mrr)),
    ndcgAt10: average(answerableResults.map((item: any) => item.candidateMetrics.ndcgAt10)),
  };

  const rerankedSummary = {
    recallAt1: average(answerableResults.map((item: any) => item.rerankedMetrics.recallAt1)),
    recallAt5: average(answerableResults.map((item: any) => item.rerankedMetrics.recallAt5)),
    recallAt10: average(answerableResults.map((item: any) => item.rerankedMetrics.recallAt10)),
    mrr: average(answerableResults.map((item: any) => item.rerankedMetrics.mrr)),
    ndcgAt10: average(answerableResults.map((item: any) => item.rerankedMetrics.ndcgAt10)),
  };

  const noEvidencePassRate = noEvidenceResults.length
    ? noEvidenceResults.filter((item: any) => item.correctlyAbstains).length / noEvidenceResults.length
    : 1;

  const categoryBreakdown = Object.fromEntries(
    Array.from(new Set(answerableResults.map((item: any) => item.category))).map((category) => {
      const group = answerableResults.filter((item: any) => item.category === category);
      return [category, {
        total: group.length,
        candidateRecallAt5: average(group.map((item: any) => item.candidateMetrics.recallAt5)),
        rerankedRecallAt5: average(group.map((item: any) => item.rerankedMetrics.recallAt5)),
        rerankedMrr: average(group.map((item: any) => item.rerankedMetrics.mrr)),
      }];
    })
  );

  const summary = {
    benchmark: 'project-sample-documents-retrieval-v1',
    totalCases: cases.length,
    answerableCases: answerableResults.length,
    noEvidenceCases: noEvidenceResults.length,
    indexedChunks: allChunks.length,
    candidateRetriever: candidate,
    heuristicReranker: rerankedSummary,
    noEvidencePassRate,
    categoryBreakdown,
    note: 'This is the pre-embedding baseline. semanticScore is currently phrase/bigram overlap, not dense-vector similarity.',
  };

  console.log('RETRIEVAL_BENCHMARK_SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  console.log('RETRIEVAL_BENCHMARK_RESULTS');
  console.log(JSON.stringify({ answerableResults, noEvidenceResults }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
