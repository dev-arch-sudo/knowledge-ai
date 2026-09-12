import { knowledgeCognitiveEngine } from '../server/cognitiveEngine/knowledgeCognitiveEngine.js';
import { ChatMessage, KnowledgeDocument } from '../src/types.js';

const documents: KnowledgeDocument[] = [
  {
    id: 'synthesis-policy-doc',
    filename: 'policy.pdf',
    fileType: 'application/pdf',
    fileSize: 4096,
    uploadTimestamp: 1,
    processingStatus: 'processed',
    pageCount: 1,
    summary: 'Leave and remote work policy.',
    pages: [{
      pageNumber: 1,
      text: `# PEOPLE POLICY\n\nAnnual Leave: Full-time employees receive 24 paid annual-leave days per calendar year.\nRemote Work: Eligible employees may work remotely up to 3 days per week.`,
    }],
  },
  {
    id: 'synthesis-support-doc',
    filename: 'support.pdf',
    fileType: 'application/pdf',
    fileSize: 4096,
    uploadTimestamp: 2,
    processingStatus: 'processed',
    pageCount: 1,
    summary: 'Support tiers and escalation.',
    pages: [{
      pageNumber: 1,
      text: `# CUSTOMER SUPPORT TIERS\n\nService Tier Matrix\n| Tier | Initial Response Minutes | Availability | Included Projects |\n| --- | --- | --- | --- |\n| Standard | 480 | Business hours | 2 |\n| Priority | 120 | 06:00-22:00 UTC | 6 |\n| Critical | 30 | 24/7 | 15 |\n\nCritical-tier incidents that remain unresolved for 90 minutes are escalated to the Incident Commander.`,
    }],
  },
  {
    id: 'synthesis-office-doc',
    filename: 'office.pdf',
    fileType: 'application/pdf',
    fileSize: 4096,
    uploadTimestamp: 3,
    processingStatus: 'processed',
    pageCount: 1,
    summary: 'Office directory.',
    pages: [{
      pageNumber: 1,
      text: `# OFFICE DIRECTORY\n\nOffice Staffing Table\n| Office | Country | Employees | Opened |\n| --- | --- | --- | --- |\n| Harbor Point | Portugal | 84 | 2024-02-12 |\n| Summit House | Canada | 61 | 2023-09-18 |\n| Meridian Works | Japan | 43 | 2025-05-06 |`,
    }],
  },
];

const history: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'Tell me about Meridian Works.', timestamp: 1 },
  { id: 'a1', role: 'assistant', content: 'I will use the office directory.', timestamp: 2 },
];

const cases = [
  { question: 'How many paid annual-leave days do full-time employees receive?', expected: ['24'], maxLength: 180 },
  { question: 'What is the Critical support tier initial response time?', expected: ['Critical', '30'], maxLength: 140 },
  { question: 'Who receives a Critical incident escalation after 90 minutes?', expected: ['Incident Commander'], maxLength: 180 },
  { question: 'Which country is Meridian Works located in?', expected: ['Meridian Works', 'Japan'], maxLength: 120 },
  { question: 'How many employees does it have?', expected: ['43'], maxLength: 120, chatHistory: history },
  { question: '¿Dónde está la oficina Meridian Works?', expected: ['Japan'], maxLength: 160 },
  { question: 'Meridian Works कहाँ छ?', expected: ['Japan'], maxLength: 160 },
];

for (const testCase of cases) {
  const result = await knowledgeCognitiveEngine.answerQuestion({
    question: testCase.question,
    chatHistory: testCase.chatHistory || [],
    tenantId: 'deterministic_synthesis_test_tenant',
    knowledgeBaseId: 'deterministic_synthesis_test_kb',
    documents,
    forceDeterministic: true,
  });

  const answer = result.answer.trim();
  for (const expected of testCase.expected) {
    if (!answer.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(`Expected answer to contain ${expected}; got: ${answer}`);
    }
  }
  if (answer.length > testCase.maxLength) {
    throw new Error(`Deterministic answer is too verbose (${answer.length} chars): ${answer}`);
  }
  if (answer.includes('| ---') || answer.split('\n').length > 3) {
    throw new Error(`Deterministic answer dumped source/table content: ${answer}`);
  }
  if (!result.diagnosticTrace.allClaimsSupported || result.diagnosticTrace.groundingScore !== 1) {
    throw new Error(`Deterministic answer lost grounding: ${answer}`);
  }
}

console.log('Deterministic synthesis guard passed for concise facts, flattened tables, relational questions, follow-ups, and multilingual lookups.');
