import { enforceGroundingGuard } from '../server/groundingGuard.js';
import { RerankedChunk } from '../server/ragTypes.js';

const evidence: RerankedChunk[] = [
  {
    chunk: {
      chunkId: 'chk_leave_policy',
      tenantId: 'test_tenant',
      knowledgeBaseId: 'test_kb',
      documentId: 'doc_policy',
      documentName: 'people-policy.pdf',
      pageNumber: 1,
      sectionTitle: 'Annual Leave',
      text: 'Full-time employees receive 24 paid annual-leave days per calendar year after completing a 90-day probation period.',
      tokenCountEstimate: 20,
      contentHash: 'test_hash',
      entities: ['Full-time'],
      numbers: [24, 90],
    },
    rerankScore: 9,
    rank: 1,
    confidence: 0.95,
    relevanceExplanation: 'test evidence',
  },
];

const accepted = enforceGroundingGuard({
  generatedAnswer: 'Full-time employees receive 24 paid annual-leave days per calendar year.',
  rerankedEvidence: evidence,
  repairAnswer: () => 'unused repair',
});

if (accepted.action !== 'ACCEPT' || !accepted.isFoundInDocuments) {
  throw new Error(`Expected supported answer to be accepted; got ${JSON.stringify(accepted)}`);
}

const repaired = enforceGroundingGuard({
  generatedAnswer: 'Full-time employees receive 30 paid annual-leave days per calendar year.',
  rerankedEvidence: evidence,
  repairAnswer: () => 'Full-time employees receive 24 paid annual-leave days per calendar year.',
});

if (repaired.action !== 'REPAIR' || !repaired.isFoundInDocuments || repaired.answer.includes('30')) {
  throw new Error(`Expected unsupported answer to be repaired; got ${JSON.stringify(repaired)}`);
}

if (!repaired.originalUnsupportedClaims.some((claim) => claim.includes('30'))) {
  throw new Error('Expected repair result to preserve the original unsupported claim for diagnostics.');
}

const refused = enforceGroundingGuard({
  generatedAnswer: 'Full-time employees receive 30 paid annual-leave days per calendar year.',
  rerankedEvidence: evidence,
  repairAnswer: () => 'Full-time employees receive 31 paid annual-leave days per calendar year.',
});

if (refused.action !== 'REFUSE' || refused.isFoundInDocuments) {
  throw new Error(`Expected irreparable unsupported answer to be refused; got ${JSON.stringify(refused)}`);
}

if (!refused.answer.toLowerCase().includes('supported evidence')) {
  throw new Error(`Expected grounding refusal wording; got: ${refused.answer}`);
}

console.log('Grounding gate guard passed: supported answers are accepted, unsupported answers are repaired once, and irreparable claims are refused.');
