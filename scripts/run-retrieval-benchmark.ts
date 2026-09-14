import {
  hybridRagIndex,
  rerankCandidates,
  checkEvidenceSufficiency,
} from '../server/ragPipeline.js';
import {
  retrievalBenchmarkCases,
  retrievalBenchmarkDocuments,
  RetrievalEvidenceTarget,
} from '../benchmarks/retrieval/latticeHarborRetrievalDataset.js';
import { RerankedChunk } from '../server/ragTypes.js';

const TENANT_ID = 'retrieval_benchmark_tenant';
const KB_ID = 'retrieval_benchmark_kb';
const CANDIDATE_K = 20;
const RERANK_K = 10;

function targetMatches(item: RerankedChunk, target: RetrievalEvidenceTarget): boolean {
  if (item.chunk.documentName !== target.documentName) return false;
  if (item.chunk.pageNumber !== target.pageNumber) return false;
  const text = `${item.chunk.sectionTitle}\n${item.chunk.text}`.toLowerCase();
  return target.contains.every((needle) => text.includes(needle.toLowerCase()));
}

function targetCoverageAtK(
  ranked: RerankedChunk[],
  targets: RetrievalEvidenceTarget[],
  k: number
): number {
  if (targets.length === 0) return 1;
  const top = ranked.slice(0, k);
  const found = targets.filter((target) => top.some((item) => targetMatches(item, target))).length;
  return found / targets.length;
}

function firstRelevantRank(ranked: RerankedChunk[], targets: RetrievalEvidenceTarget[]): number | null {
  for (let index = 0; index < ranked.length; index += 1) {
    if (targets.some((target) => targetMatches(ranked[index], target))) return index + 1;
  }
  return null;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

hybridRagIndex.indexDocuments(retrievalBenchmarkDocuments, TENANT_ID, KB_ID);

const results = retrievalBenchmarkCases.map((testCase) => {
  const candidates = hybridRagIndex.search(testCase.question, TENANT_ID, KB_ID, CANDIDATE_K);
  const reranked = rerankCandidates(testCase.question, candidates, RERANK_K);
  const sufficiency = checkEvidenceSufficiency(testCase.question, reranked);

  if (!testCase.shouldHaveEvidence) {
    return {
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      shouldHaveEvidence: false,
      candidateCount: candidates.length,
      rerankedCount: reranked.length,
      sufficiencySaysAnswerable: sufficiency.isSufficient,
      sufficiencyScore: sufficiency.sufficiencyScore,
      topResults: reranked.slice(0, 3).map((item) => ({
        rank: item.rank,
        documentName: item.chunk.documentName,
        pageNumber: item.chunk.pageNumber,
        sectionTitle: item.chunk.sectionTitle,
        rerankScore: item.rerankScore,
        snippet: item.chunk.text.slice(0, 140),
      })),
      notes: testCase.notes,
    };
  }

  const coverage1 = targetCoverageAtK(reranked, testCase.expectedSources, 1);
  const coverage5 = targetCoverageAtK(reranked, testCase.expectedSources, 5);
  const coverage10 = targetCoverageAtK(reranked, testCase.expectedSources, 10);
  const firstRank = firstRelevantRank(reranked, testCase.expectedSources);

  return {
    id: testCase.id,
    category: testCase.category,
    question: testCase.question,
    shouldHaveEvidence: true,
    targetCount: testCase.expectedSources.length,
    candidateCount: candidates.length,
    rerankedCount: reranked.length,
    recallAt1: coverage1 === 1,
    recallAt5: coverage5 === 1,
    recallAt10: coverage10 === 1,
    sourceCoverageAt1: coverage1,
    sourceCoverageAt5: coverage5,
    sourceCoverageAt10: coverage10,
    firstRelevantRank: firstRank,
    reciprocalRank: firstRank ? 1 / firstRank : 0,
    expectedSources: testCase.expectedSources,
    topResults: reranked.slice(0, 10).map((item) => ({
      rank: item.rank,
      documentName: item.chunk.documentName,
      pageNumber: item.chunk.pageNumber,
      sectionTitle: item.chunk.sectionTitle,
      rerankScore: item.rerankScore,
      relevant: testCase.expectedSources.some((target) => targetMatches(item, target)),
      snippet: item.chunk.text.slice(0, 140),
    })),
    notes: testCase.notes,
  };
});

const answerable = results.filter((item): item is Extract<typeof item, { shouldHaveEvidence: true }> => item.shouldHaveEvidence === true);
const unsupported = results.filter((item): item is Extract<typeof item, { shouldHaveEvidence: false }> => item.shouldHaveEvidence === false);

const recallAt1 = average(answerable.map((item) => item.recallAt1 ? 1 : 0));
const recallAt5 = average(answerable.map((item) => item.recallAt5 ? 1 : 0));
const recallAt10 = average(answerable.map((item) => item.recallAt10 ? 1 : 0));
const sourceCoverageAt1 = average(answerable.map((item) => item.sourceCoverageAt1));
const sourceCoverageAt5 = average(answerable.map((item) => item.sourceCoverageAt5));
const sourceCoverageAt10 = average(answerable.map((item) => item.sourceCoverageAt10));
const mrr = average(answerable.map((item) => item.reciprocalRank));
const falsePositiveSufficiencyRate = unsupported.length
  ? unsupported.filter((item) => item.sufficiencySaysAnswerable).length / unsupported.length
  : 0;

const categoryBreakdown = Object.fromEntries(
  Array.from(new Set(answerable.map((item) => item.category))).map((category) => {
    const group = answerable.filter((item) => item.category === category);
    return [category, {
      cases: group.length,
      recallAt1: average(group.map((item) => item.recallAt1 ? 1 : 0)),
      recallAt5: average(group.map((item) => item.recallAt5 ? 1 : 0)),
      recallAt10: average(group.map((item) => item.recallAt10 ? 1 : 0)),
      mrr: average(group.map((item) => item.reciprocalRank)),
    }];
  })
);

const summary = {
  benchmark: 'production-retrieval-baseline',
  retriever: 'HybridRagIndex lexical/entity/number/phrase baseline',
  corpus: 'Lattice Harbor retrieval corpus',
  totalCases: results.length,
  answerableCases: answerable.length,
  unsupportedCases: unsupported.length,
  candidateK: CANDIDATE_K,
  rerankK: RERANK_K,
  recallAt1,
  recallAt5,
  recallAt10,
  sourceCoverageAt1,
  sourceCoverageAt5,
  sourceCoverageAt10,
  mrr,
  falsePositiveSufficiencyRate,
  categoryBreakdown,
};

console.log('RETRIEVAL_BENCHMARK_SUMMARY');
console.log(JSON.stringify(summary, null, 2));
console.log('RETRIEVAL_BENCHMARK_RESULTS');
console.log(JSON.stringify(results, null, 2));

// These are deliberately conservative regression floors for the first baseline.
// They are not product-quality targets. After the first measured CI run, the
// documented baseline can be used to define tighter non-regression thresholds.
if (recallAt5 < 0.5) {
  throw new Error(`Retrieval baseline is critically low at Recall@5: ${(recallAt5 * 100).toFixed(1)}%`);
}
if (recallAt10 < 0.6) {
  throw new Error(`Retrieval baseline is critically low at Recall@10: ${(recallAt10 * 100).toFixed(1)}%`);
}
if (mrr < 0.3) {
  throw new Error(`Retrieval baseline MRR is critically low: ${mrr.toFixed(3)}`);
}
