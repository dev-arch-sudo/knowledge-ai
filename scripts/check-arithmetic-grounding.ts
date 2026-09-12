import { knowledgeCognitiveEngine } from '../server/cognitiveEngine/knowledgeCognitiveEngine.js';
import { KnowledgeDocument } from '../src/types.js';

const documents: KnowledgeDocument[] = [
  {
    id: 'arithmetic-proof-doc',
    filename: 'office-staffing.pdf',
    fileType: 'application/pdf',
    fileSize: 4096,
    uploadTimestamp: 1,
    processingStatus: 'processed',
    pageCount: 1,
    summary: 'Office staffing counts used to verify deterministic table arithmetic.',
    pages: [
      {
        pageNumber: 1,
        text: `# OFFICE STAFFING\n\nOffice Staffing Table\n| Office | Employees |\n| --- | --- |\n| Harbor Point | 84 |\n| Summit House | 61 |\n| Meridian Works | 43 |`,
      },
    ],
  },
];

const cases = [
  {
    id: 'sum',
    question: 'What is the total Employees count across all offices?',
    expected: ['188'],
  },
  {
    id: 'difference',
    question: 'What is the difference in Employees between Harbor Point and Meridian Works?',
    expected: ['41'],
  },
  {
    id: 'rank',
    question: 'Which office has the second highest Employees count?',
    expected: ['Summit House', '61'],
  },
];

for (const testCase of cases) {
  const result = await knowledgeCognitiveEngine.answerQuestion({
    question: testCase.question,
    tenantId: 'arithmetic_grounding_test_tenant',
    knowledgeBaseId: 'arithmetic_grounding_test_kb',
    documents,
    chatHistory: [],
    forceDeterministic: true,
  });

  for (const expected of testCase.expected) {
    if (!result.answer.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(`${testCase.id}: expected answer to contain ${expected}; got: ${result.answer}`);
    }
  }

  const score = result.diagnosticTrace.groundingScore > 1
    ? result.diagnosticTrace.groundingScore / 100
    : result.diagnosticTrace.groundingScore;

  if (score !== 1) {
    throw new Error(`${testCase.id}: expected grounding score 1, got ${score}. Answer: ${result.answer}`);
  }

  if (!result.diagnosticTrace.allClaimsSupported) {
    throw new Error(`${testCase.id}: expected all arithmetic claims to be supported.`);
  }
}

console.log('Arithmetic grounding proof guard passed for sum, difference, and rank-selection queries.');
