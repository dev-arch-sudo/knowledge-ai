/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 9.5 RAG Acceptance Benchmark & Golden Test Suite Runner
 * Executes the 50-question golden RAG test suite against the authoritative
 * Aurora Robotics corpus using the hybrid retrieval, entity reranker,
 * and claim-level grounding verification pipeline.
 */

import { generateFullAuroraRoboticsCorpusPdf } from './auroraCorpus.js';
import { parsePdfBuffer, createKnowledgeDocument } from './documentService.js';
import { GOLDEN_RAG_50_DATASET, GoldenRagTestCase } from './ragGoldenDataset.js';
import { hybridRagIndex, rerankCandidates, checkEvidenceSufficiency, verifyClaimsAgainstEvidence } from './ragPipeline.js';
import { generateEvidenceFirstAnswer } from './ragGenerator.js';
import { KnowledgeDocument } from '../src/types.js';

export interface RagBenchmarkItemResult {
  id: number;
  question: string;
  category: string;
  expectedType: 'ANSWER' | 'ABSTAIN' | 'REFUSE';
  actualType: 'ANSWER' | 'ABSTAIN' | 'REFUSE';
  answer: string;
  groundingScore: number;
  passed: boolean;
  failureReason?: string;
  retrievedTopScore: number;
  evidenceCount: number;
}

export interface RagBenchmarkSummary {
  total: number;
  passed: number;
  failed: number;
  accuracyRate: number;
  categoryBreakdown: Record<string, { total: number; passed: number; rate: number }>;
  hallucinationCount: number;
  abstentionPrecision: number;
  durationMs: number;
  results: RagBenchmarkItemResult[];
}

let cachedCorpusDoc: KnowledgeDocument | null = null;

export async function getOrInitCorpusDoc(): Promise<KnowledgeDocument> {
  if (cachedCorpusDoc) return cachedCorpusDoc;
  const pdfData = await generateFullAuroraRoboticsCorpusPdf();
  const parsed = await parsePdfBuffer(pdfData.filename, pdfData.buffer);
  cachedCorpusDoc = createKnowledgeDocument(
    pdfData.filename,
    pdfData.buffer,
    parsed.pageCount,
    parsed.pages,
    parsed.summary
  );
  // Index in Hybrid RAG index
  hybridRagIndex.indexDocuments([cachedCorpusDoc], 'acc_benchmark', 'kb_aurora');
  return cachedCorpusDoc;
}

export async function runRag50GoldenBenchmark(): Promise<RagBenchmarkSummary> {
  const startTime = Date.now();
  await getOrInitCorpusDoc();

  const results: RagBenchmarkItemResult[] = [];
  const categoryBreakdown: Record<string, { total: number; passed: number; rate: number }> = {};

  let hallucinationCount = 0;
  let correctAbstentions = 0;
  let expectedAbstentions = 0;

  for (const testCase of GOLDEN_RAG_50_DATASET) {
    if (!categoryBreakdown[testCase.category]) {
      categoryBreakdown[testCase.category] = { total: 0, passed: 0, rate: 0 };
    }
    categoryBreakdown[testCase.category].total++;

    if (testCase.expectedType === 'ABSTAIN' || testCase.expectedType === 'REFUSE') {
      expectedAbstentions++;
    }

    // 1. Search candidate chunks
    const candidates = hybridRagIndex.search(testCase.question, 'acc_benchmark', 'kb_aurora', 8);

    // 2. Rerank
    const reranked = rerankCandidates(testCase.question, candidates, 4);

    // 3. Evidence sufficiency check
    const sufficiency = checkEvidenceSufficiency(testCase.question, reranked);

    // 4. Generate answer
    const genResult = generateEvidenceFirstAnswer(testCase.question, reranked);

    // Determine actual type
    let actualType: 'ANSWER' | 'ABSTAIN' | 'REFUSE' = 'ANSWER';
    if (!genResult.isFoundInDocuments) {
      actualType = genResult.answer.toLowerCase().includes('cannot') ? 'REFUSE' : 'ABSTAIN';
    }

    // Grounding verification
    const claimCheck = verifyClaimsAgainstEvidence(genResult.answer, reranked);

    // Validation against test case criteria
    let passed = true;
    const failures: string[] = [];

    // Type check
    if (testCase.expectedType === 'REFUSE' || testCase.expectedType === 'ABSTAIN') {
      if (actualType === 'ANSWER') {
        passed = false;
        failures.push(`Expected refusal/abstention (${testCase.expectedType}) but got answer.`);
        hallucinationCount++;
      } else {
        correctAbstentions++;
      }
    } else {
      if (actualType !== 'ANSWER') {
        passed = false;
        failures.push(`Expected answer but got refusal/abstention (${actualType}).`);
      }
    }

    // Keyword verification
    const answerLower = genResult.answer.toLowerCase();
    for (const kw of testCase.expectedKeywords) {
      if (!answerLower.includes(kw.toLowerCase())) {
        passed = false;
        failures.push(`Missing expected keyword: "${kw}".`);
      }
    }

    // Forbidden keyword check (e.g. invented city names)
    if (testCase.forbiddenKeywords) {
      for (const fk of testCase.forbiddenKeywords) {
        if (answerLower.includes(fk.toLowerCase())) {
          passed = false;
          failures.push(`Contained forbidden hallucinated keyword: "${fk}".`);
          hallucinationCount++;
        }
      }
    }

    // Numeric verification
    if (testCase.expectedNumericValues) {
      for (const num of testCase.expectedNumericValues) {
        if (!answerLower.includes(String(num))) {
          passed = false;
          failures.push(`Missing expected numeric value: ${num}.`);
        }
      }
    }

    if (passed) {
      categoryBreakdown[testCase.category].passed++;
    }

    results.push({
      id: testCase.id,
      question: testCase.question,
      category: testCase.category,
      expectedType: testCase.expectedType,
      actualType,
      answer: genResult.answer,
      groundingScore: claimCheck.groundingScore,
      passed,
      failureReason: failures.length > 0 ? failures.join(' ') : undefined,
      retrievedTopScore: reranked[0]?.rerankScore || 0,
      evidenceCount: reranked.length,
    });
  }

  // Calculate rates
  for (const cat of Object.keys(categoryBreakdown)) {
    const item = categoryBreakdown[cat];
    item.rate = item.total > 0 ? Math.round((item.passed / item.total) * 100) : 100;
  }

  const passedCount = results.filter((r) => r.passed).length;
  const accuracyRate = Math.round((passedCount / results.length) * 100);
  const abstentionPrecision =
    expectedAbstentions > 0 ? Math.round((correctAbstentions / expectedAbstentions) * 100) : 100;

  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    accuracyRate,
    categoryBreakdown,
    hallucinationCount,
    abstentionPrecision,
    durationMs: Date.now() - startTime,
    results,
  };
}
