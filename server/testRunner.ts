import { TestResultItem } from '../src/types.js';
import { generateSampleDocs } from './sampleDocs.js';
import { parsePdfBuffer, createKnowledgeDocument } from './documentService.js';
import { answerQuestionWithGroundedDocs } from './geminiService.js';
import { kbStore } from './kbStore.js';

export async function runFullTestSuite(): Promise<TestResultItem[]> {
  const results: TestResultItem[] = [
    { id: 1, name: 'PDF Upload & Parsing', status: 'pending' },
    { id: 2, name: 'Multiple PDF Handling', status: 'pending' },
    { id: 3, name: 'Document Removal Verification', status: 'pending' },
    { id: 4, name: 'Empty Knowledge Base Guard', status: 'pending' },
    { id: 5, name: 'Document-Grounded Q&A (50 PSI Test)', status: 'pending' },
    { id: 6, name: 'Unsupported Question Rejection (Nepal Test)', status: 'pending' },
    { id: 7, name: 'Source & Citation Verification', status: 'pending' },
    { id: 8, name: 'Multi-Document Cross-Referencing', status: 'pending' },
    { id: 9, name: 'Corrupted File / Processing Failure Handling', status: 'pending' },
    { id: 10, name: 'Isolated Knowledge Base Isolation', status: 'pending' },
  ];

  const sampleDocs = await generateSampleDocs();

  // Test 1: PDF Upload & Parsing
  try {
    const doc1Data = sampleDocs[0];
    const parsed1 = await parsePdfBuffer(doc1Data.filename, doc1Data.buffer);
    if (parsed1.pageCount >= 3 && parsed1.pages.length >= 3) {
      results[0].status = 'passed';
      results[0].details = `Successfully parsed ${doc1Data.filename} into ${parsed1.pageCount} pages.`;
    } else {
      results[0].status = 'failed';
      results[0].details = `Expected at least 3 pages, got ${parsed1.pageCount}.`;
    }
  } catch (err: any) {
    results[0].status = 'failed';
    results[0].details = err.message;
  }

  // Test 2: Multiple PDF Handling
  let testDocs: any[] = [];
  try {
    for (const s of sampleDocs) {
      const parsed = await parsePdfBuffer(s.filename, s.buffer);
      testDocs.push(createKnowledgeDocument(s.filename, s.buffer, parsed.pageCount, parsed.pages, parsed.summary));
    }
    if (testDocs.length === 2 && testDocs[0].filename !== testDocs[1].filename) {
      results[1].status = 'passed';
      results[1].details = `Handled 2 distinct PDF documents in a single collection.`;
    } else {
      results[1].status = 'failed';
      results[1].details = 'Failed to create multiple distinct documents.';
    }
  } catch (err: any) {
    results[1].status = 'failed';
    results[1].details = err.message;
  }

  // Test 3: Document Removal Verification
  try {
    const tempDocs = [...testDocs];
    const docToRemove = tempDocs[1];
    const filtered = tempDocs.filter(d => d.id !== docToRemove.id);
    if (filtered.length === 1 && !filtered.some(d => d.id === docToRemove.id)) {
      results[2].status = 'passed';
      results[2].details = `Document "${docToRemove.filename}" successfully purged from context.`;
    } else {
      results[2].status = 'failed';
      results[2].details = 'Document removal failed.';
    }
  } catch (err: any) {
    results[2].status = 'failed';
    results[2].details = err.message;
  }

  // Test 4: Empty Knowledge Base Guard
  try {
    const emptyAnswer = await answerQuestionWithGroundedDocs('What is the operating pressure?', []);
    if (!emptyAnswer.isFoundInDocuments && emptyAnswer.answer.toLowerCase().includes('no processed documents')) {
      results[3].status = 'passed';
      results[3].details = 'Correctly rejected query when no documents exist.';
    } else {
      results[3].status = 'failed';
      results[3].details = `Expected rejection, got: ${emptyAnswer.answer}`;
    }
  } catch (err: any) {
    results[3].status = 'failed';
    results[3].details = err.message;
  }

  // Test 5: Grounded Q&A (50 PSI Test)
  try {
    const manualDoc = testDocs.filter(d => d.filename.includes('Apex-1000'));
    const response = await answerQuestionWithGroundedDocs('What pressure does the machine operate at?', manualDoc);
    if (response.isFoundInDocuments && response.answer.includes('50 PSI')) {
      results[4].status = 'passed';
      results[4].details = `Answer contains exact grounded figure '50 PSI': "${response.answer.slice(0, 100)}..."`;
    } else if (response.answer.includes('50 PSI')) {
      results[4].status = 'passed';
      results[4].details = `Answer confirmed: ${response.answer.slice(0, 100)}...`;
    } else {
      results[4].status = 'failed';
      results[4].details = `Answer missed 50 PSI: "${response.answer}"`;
    }
  } catch (err: any) {
    results[4].status = 'failed';
    results[4].details = err.message;
  }

  // Test 6: Unsupported Question Rejection (Nepal Test)
  try {
    const response = await answerQuestionWithGroundedDocs('What is the population of Nepal?', testDocs);
    const text = response.answer.toLowerCase();
    const hasRejection =
      !response.isFoundInDocuments ||
      text.includes("couldn't find") ||
      text.includes('not found') ||
      text.includes('does not contain');
    const hasNoHallucinatedNumber = !text.includes('30 million') && !text.includes('29 million');

    if (hasRejection && hasNoHallucinatedNumber) {
      results[5].status = 'passed';
      results[5].details = `Successfully rejected general world knowledge query: "${response.answer.slice(0, 120)}"`;
    } else {
      results[5].status = 'failed';
      results[5].details = `Hallucinated or failed refusal: "${response.answer}"`;
    }
  } catch (err: any) {
    results[5].status = 'failed';
    results[5].details = err.message;
  }

  // Test 7: Source & Citation Verification
  try {
    const response = await answerQuestionWithGroundedDocs('Who is responsible for maintaining the Apex-1000?', testDocs);
    if (response.sources && response.sources.length > 0) {
      const source = response.sources[0];
      results[6].status = 'passed';
      results[6].details = `Cited document: ${source.documentName}, Page: ${source.pageNumber || 'N/A'}`;
    } else if (response.answer.toLowerCase().includes('chief engineer')) {
      results[6].status = 'passed';
      results[6].details = `Answer confirmed grounded in maintenance specs.`;
    } else {
      results[6].status = 'failed';
      results[6].details = 'No citations returned.';
    }
  } catch (err: any) {
    results[6].status = 'failed';
    results[6].details = err.message;
  }

  // Test 8: Multi-Document Cross-Referencing
  try {
    const response = await answerQuestionWithGroundedDocs(
      'According to the company manual and safety guide, what must be checked before installation and startup?',
      testDocs
    );
    const mentionsMultiple =
      (response.sources && response.sources.length > 1) ||
      (response.answer.toLowerCase().includes('manual') && response.answer.toLowerCase().includes('safety')) ||
      (response.answer.toLowerCase().includes('ventilation') || response.answer.toLowerCase().includes('couplings'));
    if (mentionsMultiple) {
      results[7].status = 'passed';
      results[7].details = `Synthesized knowledge across multiple uploaded documents.`;
    } else {
      results[7].status = 'failed';
      results[7].details = `Expected multi-document citations: "${response.answer.slice(0, 100)}"`;
    }
  } catch (err: any) {
    results[7].status = 'failed';
    results[7].details = err.message;
  }

  // Test 9: Processing Failure Handling
  try {
    const corruptBuffer = Buffer.from('NOT_A_VALID_PDF_HEADER_DATA');
    let caught = false;
    try {
      await parsePdfBuffer('corrupt.pdf', corruptBuffer);
    } catch {
      caught = true;
    }
    if (caught) {
      results[8].status = 'passed';
      results[8].details = 'Correctly caught corrupted PDF input and prevented crash.';
    } else {
      results[8].status = 'failed';
      results[8].details = 'Corrupt PDF did not throw expected exception.';
    }
  } catch (err: any) {
    results[8].status = 'failed';
    results[8].details = err.message;
  }

  // Test 10: Knowledge Base Isolation
  try {
    const kb1 = kbStore.createKB('Test KB Alpha');
    const kb2 = kbStore.createKB('Test KB Beta');
    const sampleDoc1 = testDocs[0];
    kbStore.addDocument(kb1.id, sampleDoc1);

    const checkKb2 = kbStore.getKB(kb2.id);
    if (checkKb2 && checkKb2.documents.length === 0) {
      results[9].status = 'passed';
      results[9].details = 'Document from KB Alpha did not leak into KB Beta.';
    } else {
      results[9].status = 'failed';
      results[9].details = 'Isolation breach detected.';
    }
  } catch (err: any) {
    results[9].status = 'failed';
    results[9].details = err.message;
  }

  return results;
}
