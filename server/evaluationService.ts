import { kbStore } from './kbStore.js';
import { specializedAIService } from './specializedAIService.js';
import { EvaluationRun, TestCaseResult, EvaluationTestCase } from '../src/types.js';

export async function runEvaluationSuite(kbId: string): Promise<EvaluationRun> {
  const kb = kbStore.getKB(kbId);
  if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

  const testCases: EvaluationTestCase[] = kb.testCases && kb.testCases.length > 0 ? kb.testCases : [];
  const results: TestCaseResult[] = [];

  for (const tc of testCases) {
    const startTime = Date.now();
    try {
      const response = await specializedAIService.answer({
        aiId: kb.specializedAi.id,
        message: tc.question,
        accountId: kb.accountId,
      });
      const latencyMs = Date.now() - startTime;
      const answerLower = response.answer.toLowerCase();

      let passed = false;
      let reason = '';

      if (tc.mustRefuse) {
        // Negative / refusal evaluation: Must NOT hallucinate outside knowledge
        const hasRefusalLanguage =
          response.refused ||
          !response.grounded ||
          answerLower.includes("couldn't find") ||
          answerLower.includes('not found') ||
          answerLower.includes('does not contain') ||
          answerLower.includes('no information') ||
          answerLower.includes('unable to find');

        // Check against known hallucinated facts (like Nepal population ~30M)
        const hasHallucination =
          answerLower.includes('30 million') ||
          answerLower.includes('29 million') ||
          answerLower.includes('30,000,000') ||
          answerLower.includes('ebitda was') ||
          answerLower.includes('$');

        if (hasRefusalLanguage && !hasHallucination) {
          passed = true;
          reason = 'Correctly refused out-of-domain knowledge query.';
        } else {
          passed = false;
          reason = 'Failed refusal check: answered using ungrounded external assumptions.';
        }
      } else {
        // Grounded or Cross-document question
        if (kb.documents.length === 0) {
          passed = false;
          reason = 'No documents in knowledge base to support answer.';
        } else {
          const hasCitations = response.sources && response.sources.length > 0;
          let matchedKeywords = true;

          if (tc.expectedKeywords && tc.expectedKeywords.length > 0) {
            matchedKeywords = tc.expectedKeywords.some(
              (kw) => answerLower.includes(kw.toLowerCase())
            );
          }

          if (tc.category === 'cross-document') {
            const multiDocCited =
              (response.sources && response.sources.length >= 2) ||
              (answerLower.includes('manual') && answerLower.includes('safety')) ||
              (answerLower.includes('ventilation') && answerLower.includes('coupling'));

            if (matchedKeywords && (multiDocCited || hasCitations)) {
              passed = true;
              reason = 'Successfully synthesized cross-document knowledge.';
            } else {
              passed = false;
              reason = `Incomplete cross-document synthesis or missing key concepts (${tc.expectedKeywords?.join(', ')}).`;
            }
          } else {
            // Standard grounded factual recall
            if (matchedKeywords && (response.grounded || hasCitations)) {
              passed = true;
              reason = `Grounding verified with citations and key facts (${tc.expectedKeywords?.join(', ')}).`;
            } else {
              passed = false;
              reason = `Missing required factual elements (${tc.expectedKeywords?.join(', ')}).`;
            }
          }
        }
      }

      results.push({
        testCaseId: tc.id,
        question: tc.question,
        category: tc.category,
        expectedBehavior: tc.expectedBehavior,
        actualAnswer: response.answer,
        citations: response.rawCitations,
        isFoundInDocuments: response.grounded,
        passed,
        reason,
        latencyMs,
      });
    } catch (err: any) {
      results.push({
        testCaseId: tc.id,
        question: tc.question,
        category: tc.category,
        expectedBehavior: tc.expectedBehavior,
        actualAnswer: `Error during test: ${err.message}`,
        citations: [],
        isFoundInDocuments: false,
        passed: false,
        reason: err.message || 'Execution error during evaluation query',
        latencyMs: Date.now() - startTime,
      });
    }
  }

  // Calculate scores
  const totalTests = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = totalTests - passedCount;
  const accuracyScore = totalTests > 0 ? Math.round((passedCount / totalTests) * 100) : 0;

  const groundedTests = results.filter((r) => r.category === 'grounded');
  const groundedScore =
    groundedTests.length > 0
      ? Math.round((groundedTests.filter((r) => r.passed).length / groundedTests.length) * 100)
      : 100;

  const crossDocTests = results.filter((r) => r.category === 'cross-document');
  const crossDocScore =
    crossDocTests.length > 0
      ? Math.round((crossDocTests.filter((r) => r.passed).length / crossDocTests.length) * 100)
      : 100;

  const refusalTests = results.filter((r) => r.category === 'negative-refusal');
  const refusalScore =
    refusalTests.length > 0
      ? Math.round((refusalTests.filter((r) => r.passed).length / refusalTests.length) * 100)
      : 100;

  const run: EvaluationRun = {
    id: 'eval_' + Math.random().toString(36).substring(2, 10),
    kbId,
    versionTag: kb.currentVersion || 'v1.0',
    timestamp: Date.now(),
    totalTests,
    passedCount,
    failedCount,
    accuracyScore,
    groundedScore,
    crossDocScore,
    refusalScore,
    results,
  };

  kbStore.recordEvaluationRun(kbId, run);
  return run;
}
