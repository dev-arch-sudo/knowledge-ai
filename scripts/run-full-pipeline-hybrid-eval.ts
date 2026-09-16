import fs from 'fs';
import path from 'path';
import { generateSampleDocs } from '../server/sampleDocs.js';
import { parsePdfBuffer, createKnowledgeDocument } from '../server/documentService.js';
import { checkEvidenceSufficiency, rerankCandidates } from '../server/ragPipeline.js';
import type { DocumentChunk, RerankedChunk } from '../server/ragTypes.js';
import { ProductionRetriever, type ProductionRetrievalMode } from '../server/retrieval/productionRetriever.js';

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

interface ModeSummary {
  mode: ProductionRetrievalMode;
  candidate: MetricSet;
  reranked: MetricSet;
  noEvidenceAbstainRate: number;
  answerableSufficiencyRate: number;
  answerableFalseRefusalRate: number;
  denseRescueCases: number;
  denseRescuesSurvivingRerankTop5: number;
}

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
  const index = ranked.findIndex((item) => expected.some((source) => sourceMatchesChunk(source, item.chunk)));
  return index >= 0 ? 1 / (index + 1) : 0;
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

function summarizeMetrics(rows: MetricSet[]): MetricSet {
  return {
    recallAt1: average(rows.map((row) => row.recallAt1)),
    recallAt5: average(rows.map((row) => row.recallAt5)),
    recallAt10: average(rows.map((row) => row.recallAt10)),
    mrr: average(rows.map((row) => row.mrr)),
    ndcgAt10: average(rows.map((row) => row.ndcgAt10)),
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

async function evaluateMode(
  mode: ProductionRetrievalMode,
  cases: RetrievalCase[],
  documents: Awaited<ReturnType<typeof buildBenchmarkDocuments>>,
  heuristicTop5Relevant: Map<string, boolean>
): Promise<{ summary: ModeSummary; rows: Array<Record<string, unknown>> }> {
  const retriever = new ProductionRetriever();
  const candidateRows: MetricSet[] = [];
  const rerankedRows: MetricSet[] = [];
  const rows: Array<Record<string, unknown>> = [];
  let noEvidenceCount = 0;
  let noEvidenceAbstains = 0;
  let answerableCount = 0;
  let answerableSufficient = 0;
  let denseRescueCases = 0;
  let denseRescuesSurvivingRerankTop5 = 0;

  for (const testCase of cases) {
    const result = await retriever.retrieve({
      query: testCase.question,
      documents,
      tenantId: `full_pipeline_${mode}`,
      knowledgeBaseId: 'benchmark',
      topK: 20,
      mode,
    });
    const reranked = rerankCandidates(testCase.question, result.candidates, 10);
    const sufficiency = checkEvidenceSufficiency(testCase.question, reranked as RerankedChunk[]);

    if (testCase.noEvidence) {
      noEvidenceCount += 1;
      if (!sufficiency.isSufficient) noEvidenceAbstains += 1;
      rows.push({
        id: testCase.id,
        category: testCase.category,
        noEvidence: true,
        modeUsed: result.modeUsed,
        abstains: !sufficiency.isSufficient,
        sufficiencyScore: sufficiency.sufficiencyScore,
        topCandidateScore: result.candidates[0]?.combinedScore ?? 0,
        topRerankScore: reranked[0]?.rerankScore ?? 0,
      });
      continue;
    }

    answerableCount += 1;
    if (sufficiency.isSufficient) answerableSufficient += 1;

    const expected = testCase.expectedSources ?? [];
    const candidateMetric = metrics(expected, result.candidates);
    const rerankedMetric = metrics(expected, reranked);
    candidateRows.push(candidateMetric);
    rerankedRows.push(rerankedMetric);

    const candidateTop5Relevant = candidateMetric.recallAt5 > 0;
    const rerankedTop5Relevant = rerankedMetric.recallAt5 > 0;
    const wasHeuristicMiss = heuristicTop5Relevant.get(testCase.id) === false;
    const isDenseRescue = mode === 'hybrid' && wasHeuristicMiss && candidateTop5Relevant;
    if (isDenseRescue) {
      denseRescueCases += 1;
      if (rerankedTop5Relevant) denseRescuesSurvivingRerankTop5 += 1;
    }

    rows.push({
      id: testCase.id,
      category: testCase.category,
      noEvidence: false,
      modeUsed: result.modeUsed,
      candidateMetrics: candidateMetric,
      rerankedMetrics: rerankedMetric,
      evidenceSufficient: sufficiency.isSufficient,
      sufficiencyScore: sufficiency.sufficiencyScore,
      denseRescueFromHeuristicTop5: isDenseRescue,
      denseRescueSurvivesRerankTop5: isDenseRescue && rerankedTop5Relevant,
      candidateTop5: result.candidates.slice(0, 5).map((item, index) => ({
        rank: index + 1,
        document: item.chunk.documentName,
        page: item.chunk.pageNumber,
        score: item.combinedScore,
        reasons: item.matchReasons,
      })),
      rerankedTop5: reranked.slice(0, 5).map((item, index) => ({
        rank: index + 1,
        document: item.chunk.documentName,
        page: item.chunk.pageNumber,
        score: item.rerankScore,
      })),
    });
  }

  const summary: ModeSummary = {
    mode,
    candidate: summarizeMetrics(candidateRows),
    reranked: summarizeMetrics(rerankedRows),
    noEvidenceAbstainRate: noEvidenceCount ? noEvidenceAbstains / noEvidenceCount : 1,
    answerableSufficiencyRate: answerableCount ? answerableSufficient / answerableCount : 1,
    answerableFalseRefusalRate: answerableCount ? (answerableCount - answerableSufficient) / answerableCount : 0,
    denseRescueCases,
    denseRescuesSurvivingRerankTop5,
  };

  return { summary, rows };
}

async function run() {
  const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8')) as RetrievalCase[];
  const documents = await buildBenchmarkDocuments();

  const heuristicTop5Relevant = new Map<string, boolean>();
  const heuristicProbe = new ProductionRetriever();
  for (const testCase of cases.filter((item) => !item.noEvidence)) {
    const result = await heuristicProbe.retrieve({
      query: testCase.question,
      documents,
      tenantId: 'full_pipeline_probe',
      knowledgeBaseId: 'benchmark',
      topK: 20,
      mode: 'heuristic',
    });
    heuristicTop5Relevant.set(
      testCase.id,
      recallAtK(testCase.expectedSources ?? [], result.candidates, 5) > 0
    );
  }

  const heuristic = await evaluateMode('heuristic', cases, documents, heuristicTop5Relevant);
  const hybrid = await evaluateMode('hybrid', cases, documents, heuristicTop5Relevant);

  const summary = {
    benchmark: 'project-sample-documents-full-pipeline-hybrid-eval-v1',
    totalCases: cases.length,
    answerableCases: cases.filter((item) => !item.noEvidence).length,
    noEvidenceCases: cases.filter((item) => item.noEvidence).length,
    heuristic: heuristic.summary,
    hybrid: hybrid.summary,
    delta: {
      candidateRecallAt5: hybrid.summary.candidate.recallAt5 - heuristic.summary.candidate.recallAt5,
      rerankedRecallAt5: hybrid.summary.reranked.recallAt5 - heuristic.summary.reranked.recallAt5,
      rerankedMrr: hybrid.summary.reranked.mrr - heuristic.summary.reranked.mrr,
      noEvidenceAbstainRate: hybrid.summary.noEvidenceAbstainRate - heuristic.summary.noEvidenceAbstainRate,
      answerableFalseRefusalRate: hybrid.summary.answerableFalseRefusalRate - heuristic.summary.answerableFalseRefusalRate,
    },
    interpretationRule: {
      ranking: 'RRF/cosine may improve ranking, but are not confidence.',
      promotion: 'Do not make hybrid the default unless reranked relevance improves or holds and no-evidence abstention does not regress.',
      nextIfSuppressed: 'If dense rescues disappear after heuristic reranking, separate retrieval-rank features from evidence-confidence features instead of mapping RRF into confidence.',
    },
  };

  console.log('FULL_PIPELINE_HYBRID_EVAL_SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  console.log('FULL_PIPELINE_HYBRID_EVAL_RESULTS');
  console.log(JSON.stringify({ heuristic: heuristic.rows, hybrid: hybrid.rows }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
