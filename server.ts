import express from 'express';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { kbStore } from './server/kbStore.js';
import { parsePdfBuffer, createKnowledgeDocument } from './server/documentService.js';
import { generateSampleDocs } from './server/sampleDocs.js';
import { answerQuestionWithGroundedDocs } from './server/geminiService.js';
import { runFullTestSuite } from './server/testRunner.js';
import { runEvaluationSuite } from './server/evaluationService.js';
import { apiKeyStore } from './server/apiKeyStore.js';
import { specializedAIService, SpecializedAIError } from './server/specializedAIService.js';
import { runApiAcceptanceTests } from './server/apiTestRunner.js';
import { memoryStore } from './server/memoryStore.js';
import { memoryRetrievalService } from './server/memoryRetrievalService.js';
import { sandboxService } from './server/sandboxService.js';
import { learningService } from './server/learningService.js';
import { runPhase4AcceptanceTests } from './server/phase4TestRunner.js';
import { orchestrationEngine } from './server/mediator/orchestrationEngine.js';
import { agentRegistry } from './server/mediator/agentRegistry.js';
import { benchmarkRunner } from './server/mediator/benchmarkRunner.js';
import { runMediatorPhase3Tests } from './server/mediator/mediatorPhase3Runner.js';
import { runMediatorPhase4Tests } from './server/mediator/mediatorPhase4Runner.js';
import { runMediatorPhase5Tests } from './server/mediator/mediatorPhase5Runner.js';
import { runMediatorPhase6Tests } from './server/mediator/mediatorPhase6Runner.js';
import { runMediatorPhase7Tests } from './server/mediator/mediatorPhase7Runner.js';
import { runMediatorPhase8Tests } from './server/mediator/mediatorPhase8Runner.js';
import { runMediatorPhase9Tests } from './server/mediator/mediatorPhase9Runner.js';
import { executeComprehensiveAudit } from './server/fullAuditRunner.js';
import { runRag50GoldenBenchmark } from './server/ragBenchmarkRunner.js';
import { runEightTurnConversationalSequence } from './server/ragConversationalTester.js';
import { ragTelemetryStore } from './server/ragTelemetryStore.js';
import { multiTenancyService } from './server/mediator/multiTenancyService.js';
import { apiManagementService } from './server/mediator/apiManagementService.js';
import { quotaAndBillingService } from './server/mediator/quotaAndBillingService.js';
import { tenantGovernanceService } from './server/mediator/tenantGovernanceService.js';
import { webhookService } from './server/mediator/webhookService.js';
import { saasReadinessService } from './server/mediator/saasReadinessService.js';
import { realProviderAdapter } from './server/mediator/realProviderAdapter.js';
import { goldenDatasetService } from './server/mediator/goldenDatasetService.js';
import { telemetryService } from './server/mediator/telemetryAndObservability.js';
import { operationalHardeningService } from './server/mediator/operationalHardeningService.js';
import { systemReadinessService } from './server/mediator/systemReadinessService.js';
import { integratedStressHarness } from './server/mediator/integratedStressHarness.js';
import { getProductionLimitations } from './server/mediator/limitationsRegister.js';
import { adaptiveOrchestrator } from './server/mediator/adaptiveOrchestrator.js';
import { adaptiveBenchmarkEngine } from './server/mediator/adaptiveBenchmarkEngine.js';
import { taskComplexityAnalyzer } from './server/mediator/taskComplexityAnalyzer.js';
import { riskAssessmentEngine } from './server/mediator/riskAssessmentEngine.js';
import { adaptiveStrategyPlanner } from './server/mediator/adaptiveStrategyPlanner.js';
import { adaptiveDisagreementDetector } from './server/mediator/adaptiveDisagreementDetector.js';
import { independentVerifier } from './server/mediator/independentVerifier.js';
import { ChatMessage, ApiChatRequest, ApiChatResponse, ApiErrorResponse, MemoryStatus, MemoryType, ExperienceSource } from './src/types.js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf';
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdfMime || isPdfExt) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: "${file.originalname}". Only PDF documents are supported.`));
    }
  },
});

// --- API ROUTES ---

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. Get active Knowledge Base
app.get('/api/kb', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    res.json({
      kb: activeKb,
      allKbs: kbStore.listKBs(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve knowledge base' });
  }
});

// 3. Create new Knowledge Base
app.post('/api/kb/new', (req, res) => {
  try {
    const name = req.body.name || 'New Knowledge Base';
    const description = req.body.description;
    const newKb = kbStore.createKB(name, description);
    res.json({
      message: 'Created new knowledge base',
      kb: newKb,
      allKbs: kbStore.listKBs(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create knowledge base' });
  }
});

// 3b. Update Knowledge Base Details
app.patch('/api/kb/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const updated = kbStore.updateKB(id, { name, description });
    if (!updated) return res.status(404).json({ error: 'Knowledge base not found' });
    res.json({
      message: 'Knowledge base updated',
      kb: updated,
      allKbs: kbStore.listKBs(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update knowledge base' });
  }
});

// 3c. Delete Knowledge Base
app.delete('/api/kb/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = kbStore.deleteKB(id);
    if (!deleted) return res.status(404).json({ error: 'Knowledge base not found' });
    res.json({
      message: 'Knowledge base deleted',
      activeKb: kbStore.getActiveKB(),
      allKbs: kbStore.listKBs(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete knowledge base' });
  }
});

// 4. Switch active Knowledge Base
app.post('/api/kb/switch', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing knowledge base id' });
    const success = kbStore.setActiveKB(id);
    if (!success) return res.status(404).json({ error: 'Knowledge base not found' });
    res.json({
      message: 'Active knowledge base switched',
      kb: kbStore.getActiveKB(),
      allKbs: kbStore.listKBs(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to switch knowledge base' });
  }
});

// --- SPECIALIZED AI CONFIGURATION ROUTES ---

// Get Specialized AI configuration
app.get('/api/kb/:id/ai', (req, res) => {
  try {
    const { id } = req.params;
    const kb = kbStore.getKB(id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
    res.json({ specializedAi: kb.specializedAi });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get Specialized AI configuration' });
  }
});

// Update Specialized AI configuration
app.put('/api/kb/:id/ai', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedAi = kbStore.updateSpecializedAI(id, updates);
    if (!updatedAi) return res.status(404).json({ error: 'Knowledge base not found' });
    res.json({
      message: 'Specialized AI configuration updated',
      specializedAi: updatedAi,
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update Specialized AI configuration' });
  }
});

// --- KNOWLEDGE VERSIONING ROUTES ---

// List versions for KB
app.get('/api/kb/:id/versions', (req, res) => {
  try {
    const { id } = req.params;
    const kb = kbStore.getKB(id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
    res.json({
      currentVersion: kb.currentVersion,
      versions: kb.versions || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get versions' });
  }
});

// Create new version snapshot
app.post('/api/kb/:id/versions/create', (req, res) => {
  try {
    const { id } = req.params;
    const label = req.body.label || 'New Version Snapshot';
    const newVersion = kbStore.createVersionSnapshot(id, label);
    res.json({
      message: `Created snapshot version ${newVersion.versionTag}`,
      version: newVersion,
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create version snapshot' });
  }
});

// Rollback to a specific version
app.post('/api/kb/:id/versions/:versionId/rollback', (req, res) => {
  try {
    const { id, versionId } = req.params;
    const restoredKb = kbStore.rollbackToVersion(id, versionId);
    res.json({
      message: `Knowledge base rolled back to version ${restoredKb.currentVersion}`,
      kb: restoredKb,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rollback version' });
  }
});

// --- EVALUATION & TEST SUITE ROUTES ---

// Run automated evaluation suite
app.post('/api/kb/:id/evaluations/run', async (req, res) => {
  try {
    const { id } = req.params;
    const runResult = await runEvaluationSuite(id);
    res.json({
      message: 'Evaluation suite completed',
      run: runResult,
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    console.error('Evaluation run error:', err);
    res.status(500).json({ error: err.message || 'Failed to execute evaluation suite' });
  }
});

// Get evaluation history
app.get('/api/kb/:id/evaluations/history', (req, res) => {
  try {
    const { id } = req.params;
    const kb = kbStore.getKB(id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
    res.json({
      evaluationRuns: kb.evaluationRuns || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get evaluation history' });
  }
});

// Add custom evaluation test case
app.post('/api/kb/:id/evaluations/test-cases', (req, res) => {
  try {
    const { id } = req.params;
    const { category, question, expectedBehavior, expectedKeywords, mustRefuse } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }
    const createdCase = kbStore.addTestCase(id, {
      category: category || 'grounded',
      question: question.trim(),
      expectedBehavior: expectedBehavior?.trim() || 'Verified against uploaded documents',
      expectedKeywords: Array.isArray(expectedKeywords) ? expectedKeywords : undefined,
      mustRefuse: Boolean(mustRefuse),
    });
    res.json({
      message: 'Evaluation test case added',
      testCase: createdCase,
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to add test case' });
  }
});

// Delete custom evaluation test case
app.delete('/api/kb/:id/evaluations/test-cases/:tcId', (req, res) => {
  try {
    const { id, tcId } = req.params;
    const deleted = kbStore.removeTestCase(id, tcId);
    res.json({
      message: deleted ? 'Test case removed' : 'Test case not found',
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete test case' });
  }
});

// 5. Upload PDF documents
app.post('/api/kb/documents/upload', upload.array('files', 10), async (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const files = (req.files as Express.Multer.File[]) || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No PDF files were provided in the upload request.' });
    }

    const processedDocs = [];
    const errors = [];

    for (const file of files) {
      try {
        const { pageCount, pages, summary } = await parsePdfBuffer(file.originalname, file.buffer);
        const doc = createKnowledgeDocument(file.originalname, file.buffer, pageCount, pages, summary);
        kbStore.addDocument(activeKb.id, doc);
        processedDocs.push(doc);
      } catch (docErr: any) {
        errors.push({ filename: file.originalname, error: docErr.message });
      }
    }

    res.json({
      message: `Processed ${processedDocs.length} document(s).`,
      processed: processedDocs,
      errors: errors.length > 0 ? errors : undefined,
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    res.status(500).json({ error: err.message || 'Failed to process document upload' });
  }
});

// 6. Load sample documents for instant testing
app.post('/api/kb/documents/sample', async (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const samples = await generateSampleDocs();

    const addedDocs = [];
    for (const s of samples) {
      const { pageCount, pages, summary } = await parsePdfBuffer(s.filename, s.buffer);
      const doc = createKnowledgeDocument(s.filename, s.buffer, pageCount, pages, summary);
      kbStore.addDocument(activeKb.id, doc);
      addedDocs.push(doc);
    }

    res.json({
      message: 'Sample documents loaded successfully',
      addedCount: addedDocs.length,
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    console.error('Sample docs error:', err);
    res.status(500).json({ error: err.message || 'Failed to load sample documents' });
  }
});

// 7. Remove a document
app.delete('/api/kb/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const activeKb = kbStore.getActiveKB();
    const removed = kbStore.removeDocument(activeKb.id, id);
    if (!removed) {
      return res.status(404).json({ error: `Document with ID ${id} was not found in active knowledge base.` });
    }
    res.json({
      message: 'Document removed successfully',
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove document' });
  }
});

// 8. Retry a failed document
app.post('/api/kb/documents/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const activeKb = kbStore.getActiveKB();
    const doc = activeKb.documents.find((d) => d.id === id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    kbStore.updateDocumentStatus(activeKb.id, id, 'processed');
    res.json({
      message: 'Document status reset',
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retry document' });
  }
});

// 9. Ask a question (Document-grounded Chat with Specialized AI - Shared Core Service)
app.post('/api/kb/chat', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Question cannot be empty' });
    }

    const activeKb = kbStore.getActiveKB();

    if (activeKb.documents.length === 0) {
      return res.status(400).json({
        error: 'No documents in knowledge base. Please upload one or more PDFs before asking questions.',
      });
    }

    if (activeKb.documents.some((d) => d.processingStatus === 'processing' || d.processingStatus === 'pending')) {
      return res.status(400).json({
        error: 'Your documents are still processing. Please wait until your documents finish processing.',
      });
    }

    // Add user message to history
    const userMessage: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 10),
      role: 'user',
      content: question.trim(),
      timestamp: Date.now(),
    };
    kbStore.addChatMessage(activeKb.id, userMessage);

    // Call unified Specialized AI service
    const result = await specializedAIService.answer({
      aiId: activeKb.specializedAi.id,
      message: question.trim(),
      accountId: activeKb.accountId || 'acc_default',
      chatHistory: activeKb.chatHistory,
      source: 'WEB',
    });

    // Add assistant message to history
    const assistantMessage: ChatMessage = {
      id: result.id,
      role: 'assistant',
      content: result.answer,
      timestamp: Date.now(),
      citations: result.rawCitations,
      isFoundInDocuments: result.grounded,
      memoryUsed: result.memoryUsed,
      memoryCount: result.memoryCount,
      experienceRecorded: result.experienceRecorded,
      experienceId: result.experienceId,
    };
    kbStore.addChatMessage(activeKb.id, assistantMessage);

    res.json({
      message: assistantMessage,
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    console.error('Chat error:', err.message);
    const statusCode = err instanceof SpecializedAIError ? err.statusCode : 500;
    res.status(statusCode).json({ error: err.message || 'Failed to generate grounded answer' });
  }
});

// 10. Clear chat conversation
app.delete('/api/kb/chat', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    kbStore.clearChat(activeKb.id);
    res.json({
      message: 'Conversation cleared',
      kb: kbStore.getActiveKB(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear conversation' });
  }
});

// 11. Run Phase 1 Acceptance Test suite
app.post('/api/kb/run-tests', async (req, res) => {
  try {
    const testResults = await runFullTestSuite();
    res.json({
      results: testResults,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Test suite error:', err);
    res.status(500).json({ error: err.message || 'Test suite execution failed' });
  }
});

// ==========================================
// --- PHASE 3: REST API (v1) ENDPOINTS ---
// ==========================================

// Helper: Extract & validate Bearer token
function authenticateApiRequest(req: express.Request, res: express.Response, requestId: string): any {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API key. Provide token in "Authorization: Bearer <API_KEY>" header.',
      },
      request_id: requestId,
    });
    return null;
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid Authorization header format. Expected "Bearer <API_KEY>".',
      },
      request_id: requestId,
    });
    return null;
  }

  const rawKey = parts[1];
  const validation = apiKeyStore.validateApiKey(rawKey);
  if (!validation.valid || !validation.apiKey) {
    const isRevoked = validation.error?.includes('revoked');
    const statusCode = isRevoked ? 403 : 401;
    const errorCode = isRevoked ? 'FORBIDDEN' : 'UNAUTHORIZED';
    res.status(statusCode).json({
      error: {
        code: errorCode,
        message: validation.error || 'Invalid API key.',
      },
      request_id: requestId,
    });
    return null;
  }

  // Check rate limit: 100 requests per minute
  const rateLimit = apiKeyStore.checkRateLimit(validation.apiKey.id, 100);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.resetSeconds));
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please try again later.',
      },
      request_id: requestId,
    });
    return null;
  }

  return validation.apiKey;
}

// 1. Health Endpoint
app.get('/api/v1/health', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);
  res.json({
    status: 'ok',
    version: 'v1',
    request_id: requestId,
  });
});

// 2. Primary Chat Endpoint: POST /api/v1/chat
app.post('/api/v1/chat', async (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);
  const startTime = Date.now();

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id, message, conversation_id } = req.body || {};

  if (!ai_id || typeof ai_id !== 'string' || !ai_id.trim()) {
    apiKeyStore.recordUsage({
      requestId,
      apiKeyId: apiKey.id,
      accountId: apiKey.accountId,
      aiId: ai_id || 'unknown',
      endpoint: '/api/v1/chat',
      timestamp: Date.now(),
      status: 400,
      latencyMs: Date.now() - startTime,
      refused: false,
      grounded: false,
      errorCode: 'INVALID_REQUEST',
    });
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The ai_id field is required.',
      },
      request_id: requestId,
    });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    apiKeyStore.recordUsage({
      requestId,
      apiKeyId: apiKey.id,
      accountId: apiKey.accountId,
      aiId: ai_id.trim(),
      endpoint: '/api/v1/chat',
      timestamp: Date.now(),
      status: 400,
      latencyMs: Date.now() - startTime,
      refused: false,
      grounded: false,
      errorCode: 'INVALID_REQUEST',
    });
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The message field is required.',
      },
      request_id: requestId,
    });
  }

  try {
    const result = await specializedAIService.answer({
      aiId: ai_id.trim(),
      message: message.trim(),
      conversationId: conversation_id ? String(conversation_id).trim() : undefined,
      accountId: apiKey.accountId,
      source: 'API',
      requestId,
    });

    const latencyMs = Date.now() - startTime;

    // Record usage
    apiKeyStore.recordUsage({
      requestId,
      apiKeyId: apiKey.id,
      accountId: apiKey.accountId,
      aiId: result.aiId,
      endpoint: '/api/v1/chat',
      timestamp: Date.now(),
      status: 200,
      latencyMs,
      refused: result.refused,
      grounded: result.grounded,
    });

    const response: ApiChatResponse = {
      id: result.id,
      request_id: requestId,
      ai_id: result.aiId,
      conversation_id: result.conversationId,
      answer: result.answer,
      grounded: result.grounded,
      refused: result.refused,
      conflict_detected: result.conflictDetected,
      knowledge_version: result.knowledgeVersion,
      sources: result.sources,
      memory_used: result.memoryUsed,
      memory_count: result.memoryCount,
      experience_recorded: result.experienceRecorded,
    };

    res.json(response);
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const statusCode = err instanceof SpecializedAIError ? err.statusCode : 500;
    const errorCode = err instanceof SpecializedAIError ? err.code : 'INTERNAL_ERROR';

    apiKeyStore.recordUsage({
      requestId,
      apiKeyId: apiKey.id,
      accountId: apiKey.accountId,
      aiId: ai_id.trim(),
      endpoint: '/api/v1/chat',
      timestamp: Date.now(),
      status: statusCode,
      latencyMs,
      refused: false,
      grounded: false,
      errorCode,
    });

    res.status(statusCode).json({
      error: {
        code: errorCode,
        message: err.message || 'An error occurred while processing the request.',
      },
      request_id: requestId,
    });
  }
});

// 3. AI Status Endpoint: GET /api/v1/ai/:ai_id
app.get('/api/v1/ai/:ai_id', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const lookup = kbStore.getSpecializedAIById(ai_id);

  if (!lookup) {
    return res.status(404).json({
      error: {
        code: 'AI_NOT_FOUND',
        message: `Specialized AI with id "${ai_id}" was not found.`,
      },
      request_id: requestId,
    });
  }

  const { ai, kb } = lookup;
  if (kb.accountId && kb.accountId !== apiKey.accountId) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: You are not authorized to view this Specialized AI.',
      },
      request_id: requestId,
    });
  }

  const isReady =
    kb.documents.length > 0 &&
    kb.processingStatus === 'ready' &&
    !kb.documents.some((d) => d.processingStatus === 'processing' || d.processingStatus === 'pending');

  res.json({
    id: ai.id,
    name: ai.name,
    description: ai.description,
    status: isReady ? 'ready' : 'not_ready',
    knowledge_version: kb.currentVersion || 'v1.0',
    request_id: requestId,
  });
});

// 4. Knowledge Status Endpoint: GET /api/v1/ai/:ai_id/knowledge
app.get('/api/v1/ai/:ai_id/knowledge', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const lookup = kbStore.getSpecializedAIById(ai_id);

  if (!lookup) {
    return res.status(404).json({
      error: {
        code: 'AI_NOT_FOUND',
        message: `Specialized AI with id "${ai_id}" was not found.`,
      },
      request_id: requestId,
    });
  }

  const { ai, kb } = lookup;
  if (kb.accountId && kb.accountId !== apiKey.accountId) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied: You are not authorized to view this Knowledge Base.',
      },
      request_id: requestId,
    });
  }

  const isReady =
    kb.documents.length > 0 &&
    kb.processingStatus === 'ready' &&
    !kb.documents.some((d) => d.processingStatus === 'processing' || d.processingStatus === 'pending');

  const totalPages = kb.documents.reduce((acc, d) => acc + (d.pageCount || 0), 0);

  res.json({
    ai_id: ai.id,
    status: isReady ? 'ready' : 'not_ready',
    active_version: kb.currentVersion || 'v1.0',
    documents: kb.documents.length,
    pages: totalPages,
    updated_at: new Date(kb.updatedAt || kb.createdDate).toISOString(),
    request_id: requestId,
  });
});

// --- DEVELOPER PLATFORM MANAGEMENT ROUTES (FOR WEB APP DASHBOARD) ---

// List API Keys
app.get('/api/v1/developer/keys', (req, res) => {
  try {
    const keys = apiKeyStore.listApiKeys('acc_default');
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list API keys' });
  }
});

// Create API Key
app.post('/api/v1/developer/keys', (req, res) => {
  try {
    const { name, environment, scopes } = req.body || {};
    const created = apiKeyStore.createApiKey({
      name: name || 'New API Key',
      accountId: 'acc_default',
      environment: environment === 'test' ? 'test' : 'live',
      scopes,
    });
    res.json({
      apiKey: created.apiKey,
      secret: created.secret,
      message: 'API Key created successfully. Store this key securely; it will not be shown again.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create API key' });
  }
});

// Revoke API Key
app.delete('/api/v1/developer/keys/:id', (req, res) => {
  try {
    const { id } = req.params;
    const revoked = apiKeyStore.revokeApiKey(id, 'acc_default');
    if (!revoked) {
      return res.status(404).json({ error: 'API key not found or already revoked' });
    }
    res.json({
      message: 'API key revoked successfully',
      keys: apiKeyStore.listApiKeys('acc_default'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to revoke API key' });
  }
});

// Get Developer Usage Statistics
app.get('/api/v1/developer/usage', (req, res) => {
  try {
    const stats = apiKeyStore.getUsageStats('acc_default');
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch usage metrics' });
  }
});

// Run Phase 3 Automated API Acceptance Tests
app.post('/api/v1/tests/run', async (req, res) => {
  try {
    const results = await runApiAcceptanceTests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Phase 3 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Phase 3 API tests' });
  }
});

// =========================================================================
// PHASE 4: MEMORY, EXPERIENCE & CONTROLLED LEARNING SANDBOX ROUTES
// =========================================================================

// --- 1. RUN PHASE 4 ACCEPTANCE TESTS ---
app.post('/api/v1/tests/phase4', async (req, res) => {
  try {
    const results = await runPhase4AcceptanceTests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Phase 4 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Phase 4 acceptance tests' });
  }
});

// --- MEDIATOR TEST SUITES ---
// Run Mediator Phase 3 Core Tests (12 tests)
app.post('/api/v1/tests/mediator-phase3', async (req, res) => {
  try {
    const results = await runMediatorPhase3Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Mediator Phase 3 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Mediator Phase 3 tests' });
  }
});

// Run Mediator Phase 4 Advanced Protocol Tests (21 tests)
app.post('/api/v1/tests/mediator-phase4', async (req, res) => {
  try {
    const results = await runMediatorPhase4Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Mediator Phase 4 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Mediator Phase 4 tests' });
  }
});

// Run Mediator Phase 5 Comprehensive Battery (51 tests)
app.post('/api/v1/tests/mediator-phase5', async (req, res) => {
  try {
    const results = await runMediatorPhase5Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Mediator Phase 5 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Mediator Phase 5 tests' });
  }
});

// Run Mediator Phase 6 Adaptive Evidence-Driven Battery (54 tests)
app.post('/api/v1/tests/mediator-phase6', async (req, res) => {
  try {
    const results = await runMediatorPhase6Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Mediator Phase 6 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Mediator Phase 6 tests' });
  }
});

app.post('/api/v1/mediator/tests/phase6', async (req, res) => {
  try {
    const results = await runMediatorPhase6Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Mediator Phase 6 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Mediator Phase 6 tests' });
  }
});

// =========================================================================
// PHASE 7: SYSTEM INTEGRATION, STRESS TESTING & PRODUCTION READINESS
// =========================================================================

// Run Phase 7 Comprehensive 70-test Acceptance Battery
app.post(['/api/v1/tests/phase7', '/api/v1/tests/mediator-phase7'], async (req, res) => {
  try {
    const results = await runMediatorPhase7Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Phase 7 acceptance tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Phase 7 acceptance tests' });
  }
});

// System Health Endpoint: GET /api/v1/system/health
app.get('/api/v1/system/health', (req, res) => {
  try {
    const health = systemReadinessService.getSystemHealth();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Readiness Gate Summary: GET /api/v1/system/readiness
app.get('/api/v1/system/readiness', async (req, res) => {
  try {
    const report = await systemReadinessService.generateProductionReadinessReport(false);
    res.json({
      status: report.overallStatus,
      criticalFailures: report.criticalFailures.length,
      warnings: report.warnings.length,
      summary: report.summary,
      timestamp: report.timestamp,
      buildVersion: report.buildVersion,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Full Production Readiness Report: GET /api/v1/system/readiness-report
app.get('/api/v1/system/readiness-report', async (req, res) => {
  try {
    const forceFresh = req.query.fresh === 'true';
    const report = await systemReadinessService.generateProductionReadinessReport(forceFresh);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Known Limitations Register: GET /api/v1/system/limitations
app.get('/api/v1/system/limitations', (req, res) => {
  try {
    const limitations = getProductionLimitations();
    res.json({ limitations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Concurrency Stress Run: POST /api/v1/stress/concurrency
app.post('/api/v1/stress/concurrency', async (req, res) => {
  try {
    const { concurrencyLevel } = req.body || {};
    const level = concurrencyLevel ? parseInt(concurrencyLevel, 10) : 10;
    const result = await integratedStressHarness.runConcurrencyStress(level);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Task & Tenant Isolation Audit: POST /api/v1/stress/isolation
app.post('/api/v1/stress/isolation', async (req, res) => {
  try {
    const result = await integratedStressHarness.auditTaskAndTenantIsolation();
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// State Machine Transition Audit: POST /api/v1/stress/state-machine
app.post('/api/v1/stress/state-machine', (req, res) => {
  try {
    const result = integratedStressHarness.auditStateMachineTransitions();
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// PHASE 8: REAL-WORLD EVALUATION, OBSERVABILITY & OPERATIONAL HARDENING
// =========================================================================

// Run Phase 8 Comprehensive 80-test Acceptance Battery
app.post(['/api/v1/tests/phase8', '/api/v1/tests/mediator-phase8'], async (req, res) => {
  try {
    const results = await runMediatorPhase8Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Phase 8 acceptance tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Phase 8 acceptance tests' });
  }
});

// Operational Readiness Dashboard Report: GET /api/v1/operations/readiness-dashboard
app.get('/api/v1/operations/readiness-dashboard', (req, res) => {
  try {
    const report = operationalHardeningService.getOperationalReadinessReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Observability SLIs & SLOs: GET /api/v1/observability/slos
app.get('/api/v1/observability/slos', (req, res) => {
  try {
    const report = telemetryService.getSloReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Observability SLO Configuration: POST /api/v1/observability/slos/config
app.post('/api/v1/observability/slos/config', (req, res) => {
  try {
    const updated = telemetryService.updateSloConfig(req.body || {});
    res.json({ updated, sloReport: telemetryService.getSloReport() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Observability Traces: GET /api/v1/observability/traces
app.get('/api/v1/observability/traces', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const traces = telemetryService.listTraceSpans(limit);
    res.json({ traces });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Observability Alerts: GET /api/v1/observability/alerts
app.get('/api/v1/observability/alerts', (req, res) => {
  try {
    const includeResolved = req.query.all === 'true';
    const alerts = telemetryService.listAlerts(includeResolved);
    res.json({ alerts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve Alert: POST /api/v1/observability/alerts/:id/resolve
app.post('/api/v1/observability/alerts/:id/resolve', (req, res) => {
  try {
    const resolved = telemetryService.resolveAlert(req.params.id);
    res.json({ resolved, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Golden Evaluation Datasets: GET /api/v1/eval/golden-datasets
app.get('/api/v1/eval/golden-datasets', (req, res) => {
  try {
    const datasets = goldenDatasetService.listDatasets();
    res.json({ datasets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Execute Evaluation Run: POST /api/v1/eval/run
app.post('/api/v1/eval/run', async (req, res) => {
  try {
    const run = await goldenDatasetService.executeEvaluationRun(req.body || {});
    res.json({ run });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List Evaluation Runs: GET /api/v1/eval/runs
app.get('/api/v1/eval/runs', (req, res) => {
  try {
    const runs = goldenDatasetService.listEvaluationRuns();
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Human Evaluation: Record POST /api/v1/eval/human
app.post('/api/v1/eval/human', (req, res) => {
  try {
    const record = goldenDatasetService.recordHumanEvaluation(req.body);
    res.json({ record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Human Evaluation: List & Agreement GET /api/v1/eval/human
app.get('/api/v1/eval/human', (req, res) => {
  try {
    const taskId = req.query.taskId as string | undefined;
    const records = goldenDatasetService.listHumanEvaluations(taskId);
    let agreement = null;
    if (taskId) {
      agreement = goldenDatasetService.calculateInterRaterAgreement(taskId);
    }
    res.json({ records, agreement });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Incidents: GET /api/v1/operations/incidents
app.get('/api/v1/operations/incidents', (req, res) => {
  try {
    const incidents = operationalHardeningService.listIncidents();
    res.json({ incidents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Incident Create: POST /api/v1/operations/incidents
app.post('/api/v1/operations/incidents', (req, res) => {
  try {
    const incident = operationalHardeningService.createIncident(req.body);
    res.status(201).json({ incident });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Incident Transition: PATCH /api/v1/operations/incidents/:id/state
app.patch('/api/v1/operations/incidents/:id/state', (req, res) => {
  try {
    const { state, note } = req.body || {};
    const incident = operationalHardeningService.transitionIncidentState(
      req.params.id,
      state,
      note || 'Transitioned by operator'
    );
    res.json({ incident });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Feature Flags: GET /api/v1/operations/feature-flags
app.get('/api/v1/operations/feature-flags', (req, res) => {
  try {
    const flags = operationalHardeningService.listFeatureFlags();
    res.json({ flags });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Feature Flag Toggle: PATCH /api/v1/operations/feature-flags/:name
app.patch('/api/v1/operations/feature-flags/:name', (req, res) => {
  try {
    const { value, operatorRole } = req.body || {};
    const flag = operationalHardeningService.setFeatureFlag(
      req.params.name,
      value,
      operatorRole || 'OPERATOR'
    );
    res.json({ flag });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Configuration Drift: GET /api/v1/operations/config-drift
app.get('/api/v1/operations/config-drift', (req, res) => {
  try {
    const drift = operationalHardeningService.detectConfigurationDrift();
    const snapshots = operationalHardeningService.getSnapshots();
    res.json({ drift, snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Isolated Backup/Restore Test: POST /api/v1/operations/backup-restore-test
app.post('/api/v1/operations/backup-restore-test', async (req, res) => {
  try {
    const result = await operationalHardeningService.executeBackupRestoreTest();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Scaling Audit: GET /api/v1/operations/scaling-audit
app.get('/api/v1/operations/scaling-audit', (req, res) => {
  try {
    const audit = operationalHardeningService.getComponentScalingAudit();
    res.json({ audit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Canary Config: GET /api/v1/operations/canary
app.get('/api/v1/operations/canary', (req, res) => {
  try {
    const canary = operationalHardeningService.getCanaryConfig();
    res.json({ canary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Canary Update: POST /api/v1/operations/canary
app.post('/api/v1/operations/canary', (req, res) => {
  try {
    const updated = operationalHardeningService.updateCanaryConfig(req.body);
    res.json({ canary: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Operations Canary Rollback: POST /api/v1/operations/canary/rollback
app.post('/api/v1/operations/canary/rollback', (req, res) => {
  try {
    const { reason } = req.body || {};
    const rolledBack = operationalHardeningService.triggerCanaryRollback(reason || 'Operator triggered rollback');
    res.json({ canary: rolledBack });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Provider Health Profiles: GET /api/v1/providers/health
app.get('/api/v1/providers/health', (req, res) => {
  try {
    const profiles = realProviderAdapter.getHealthProfiles();
    res.json({ profiles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// PHASE 9: MULTI-TENANCY, API GATEWAY, USAGE METERING & SAAS READINESS
// =========================================================================

// Run Phase 9 Comprehensive 103-test Battery
app.post(['/api/v1/tests/phase9', '/api/v1/tests/mediator-phase9'], async (req, res) => {
  try {
    const results = await runMediatorPhase9Tests();
    res.json({
      results,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('Phase 9 tests error:', err);
    res.status(500).json({ error: err.message || 'Failed to run Phase 9 test suite' });
  }
});

// Overall SaaS Platform Readiness: GET /api/v1/saas/status
app.get('/api/v1/saas/status', (req, res) => {
  try {
    const status = saasReadinessService.getOverallSaaSReadiness();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive Production-Readiness & Security Audit Battery
app.post('/api/v1/audit/comprehensive', async (req, res) => {
  try {
    const report = await executeComprehensiveAudit();
    res.json(report);
  } catch (err: any) {
    console.error('Comprehensive audit execution error:', err);
    res.status(500).json({ error: err.message || 'Audit execution failed' });
  }
});

// Tenants List: GET /api/v1/tenants
app.get('/api/v1/tenants', (req, res) => {
  try {
    const tenants = multiTenancyService.listTenants();
    res.json({ tenants });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant Details: GET /api/v1/tenants/:tenantId
app.get('/api/v1/tenants/:tenantId', (req, res) => {
  try {
    const tenant = multiTenancyService.getTenant(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const quota = quotaAndBillingService.getTenantQuota(req.params.tenantId);
    const billing = quotaAndBillingService.getBillingAccount(req.params.tenantId);
    res.json({ tenant, quota, billing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Provision Tenant: POST /api/v1/tenants
app.post('/api/v1/tenants', (req, res) => {
  try {
    const { name, tier, ownerUserId, contactEmail, region, allowedDomains } = req.body || {};
    if (!name || !tier || !ownerUserId || !contactEmail) {
      return res.status(400).json({ error: 'Missing required tenant fields: name, tier, ownerUserId, contactEmail' });
    }
    const tenant = multiTenancyService.provisionTenant({
      name,
      tier,
      ownerUserId,
      contactEmail,
      region,
      allowedDomains,
    });
    res.status(201).json({ tenant });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SaaS Customer Self-Service Onboarding: POST /api/v1/tenants/onboard
app.post('/api/v1/tenants/onboard', (req, res) => {
  try {
    const result = saasReadinessService.onboardCustomer(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant API Keys: GET /api/v1/tenants/:tenantId/api-keys
app.get('/api/v1/tenants/:tenantId/api-keys', (req, res) => {
  try {
    const keys = apiManagementService.listApiKeys(req.params.tenantId);
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Tenant API Key: POST /api/v1/tenants/:tenantId/api-keys
app.post('/api/v1/tenants/:tenantId/api-keys', (req, res) => {
  try {
    const { name, scopes, rateLimitPerMinute, monthlyQuota } = req.body || {};
    const key = apiManagementService.generateApiKey(req.params.tenantId, {
      name: name || 'API Key',
      scopes: scopes || ['ai.execute', 'ai.read'],
      rateLimitPerMinute,
      monthlyQuota,
    });
    res.status(201).json({ key });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke Tenant API Key: DELETE /api/v1/tenants/:tenantId/api-keys/:keyId
app.delete('/api/v1/tenants/:tenantId/api-keys/:keyId', (req, res) => {
  try {
    const { reason } = req.body || {};
    const revoked = apiManagementService.revokeApiKey(req.params.keyId, req.params.tenantId, reason);
    if (!revoked) {
      return res.status(404).json({ error: 'API key not found or already revoked' });
    }
    res.json({ message: 'API key successfully revoked', keyId: req.params.keyId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant Billing Account: GET /api/v1/tenants/:tenantId/billing
app.get('/api/v1/tenants/:tenantId/billing', (req, res) => {
  try {
    const billing = quotaAndBillingService.getBillingAccount(req.params.tenantId);
    if (!billing) {
      return res.status(404).json({ error: 'Billing account not found' });
    }
    res.json({ billing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant Invoices: GET /api/v1/tenants/:tenantId/invoices
app.get('/api/v1/tenants/:tenantId/invoices', (req, res) => {
  try {
    const invoices = quotaAndBillingService.listInvoices(req.params.tenantId);
    res.json({ invoices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate Tenant Invoice: POST /api/v1/tenants/:tenantId/invoices/generate
app.post('/api/v1/tenants/:tenantId/invoices/generate', (req, res) => {
  try {
    const invoice = quotaAndBillingService.generateInvoice(req.params.tenantId);
    res.status(201).json({ invoice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant Quotas: GET /api/v1/tenants/:tenantId/quotas
app.get('/api/v1/tenants/:tenantId/quotas', (req, res) => {
  try {
    const quota = quotaAndBillingService.getTenantQuota(req.params.tenantId);
    if (!quota) {
      return res.status(404).json({ error: 'Quota not found' });
    }
    res.json({ quota });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant Audit Logs: GET /api/v1/tenants/:tenantId/audit-logs
app.get('/api/v1/tenants/:tenantId/audit-logs', (req, res) => {
  try {
    const logs = tenantGovernanceService.getAuditLogs({ tenantId: req.params.tenantId });
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant Compliance Export: GET /api/v1/tenants/:tenantId/compliance-export
app.get('/api/v1/tenants/:tenantId/compliance-export', (req, res) => {
  try {
    const record = tenantGovernanceService.exportComplianceRecord(req.params.tenantId);
    res.json({ record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant Webhooks: GET /api/v1/tenants/:tenantId/webhooks
app.get('/api/v1/tenants/:tenantId/webhooks', (req, res) => {
  try {
    const webhooks = webhookService.listWebhooks(req.params.tenantId);
    res.json({ webhooks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Register Webhook: POST /api/v1/tenants/:tenantId/webhooks
app.post('/api/v1/tenants/:tenantId/webhooks', (req, res) => {
  try {
    const { targetUrl, events, secret } = req.body || {};
    if (!targetUrl || !events) {
      return res.status(400).json({ error: 'targetUrl and events are required' });
    }
    const webhook = webhookService.registerWebhook(req.params.tenantId, {
      targetUrl,
      events,
      secret,
    });
    res.status(201).json({ webhook });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook Delivery Logs: GET /api/v1/tenants/:tenantId/webhooks/events
app.get('/api/v1/tenants/:tenantId/webhooks/events', (req, res) => {
  try {
    const events = webhookService.getDeliveryEvents(req.params.tenantId);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate Billing Cycle: POST /api/v1/saas/sim-billing-cycle
app.post('/api/v1/saas/sim-billing-cycle', (req, res) => {
  try {
    const { tenantId } = req.body || {};
    const result = saasReadinessService.simulateBillingCycle(tenantId || 'tenant_alpha');
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// OpenAPI Spec: GET /api/v1/api-docs/openapi
app.get('/api/v1/api-docs/openapi', (req, res) => {
  try {
    const spec = apiManagementService.getOpenApiSpec();
    res.json(spec);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. AUTHENTICATED REST API ROUTES (/api/v1/ai/:ai_id/...) ---

// GET /api/v1/ai/:ai_id/memories
app.get('/api/v1/ai/:ai_id/memories', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { status, type } = req.query;

  try {
    const memories = memoryStore.listMemories({
      accountId: apiKey.accountId,
      aiId: ai_id,
      status: status as MemoryStatus | undefined,
      type: type as MemoryType | undefined,
    });
    res.json({ memories, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/memories
app.post('/api/v1/ai/:ai_id/memories', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { type, content, summary, tags, evidence, confidence, actor } = req.body || {};

  if (!content || !summary || !type) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Fields type, content, and summary are required.' },
      request_id: requestId,
    });
  }

  try {
    const memory = memoryStore.createMemory({
      accountId: apiKey.accountId,
      aiId: ai_id,
      type,
      content,
      summary,
      tags,
      evidence,
      confidence,
      actor: actor || apiKey.name,
      requestId,
    });
    res.status(201).json({ memory, request_id: requestId });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'CREATION_FAILED', message: err.message }, request_id: requestId });
  }
});

// PATCH /api/v1/ai/:ai_id/memories/:memory_id/status
app.patch('/api/v1/ai/:ai_id/memories/:memory_id/status', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id, memory_id } = req.params;
  const { status, reason, reviewer } = req.body || {};

  const effectiveReviewer = reviewer || apiKey.name || 'API Authorized Reviewer';

  try {
    let updated;
    if (status === 'VERIFIED') {
      updated = memoryStore.verifyMemory(memory_id, apiKey.accountId, effectiveReviewer, requestId);
    } else if (status === 'REJECTED') {
      if (!reason) {
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Rejection reason is required.' },
          request_id: requestId,
        });
      }
      updated = memoryStore.rejectMemory(memory_id, apiKey.accountId, effectiveReviewer, reason, requestId);
    } else if (status === 'ARCHIVED') {
      updated = memoryStore.archiveMemory(memory_id, apiKey.accountId, effectiveReviewer, requestId);
    } else {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS', message: 'Target status must be VERIFIED, REJECTED, or ARCHIVED.' },
        request_id: requestId,
      });
    }
    res.json({ memory: updated, request_id: requestId });
  } catch (err: any) {
    const statusCode = err.message.includes('NOT_FOUND') ? 404 : 403;
    res.status(statusCode).json({ error: { code: 'STATUS_UPDATE_FAILED', message: err.message }, request_id: requestId });
  }
});

// GET /api/v1/ai/:ai_id/experiences
app.get('/api/v1/ai/:ai_id/experiences', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { source, status } = req.query;

  try {
    const experiences = memoryStore.listExperiences({
      accountId: apiKey.accountId,
      aiId: ai_id,
      source: source as ExperienceSource | undefined,
      status: status as any,
    });
    res.json({ experiences, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/experiences
app.post('/api/v1/ai/:ai_id/experiences', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { situation, action, outcome, expectedOutcome, actualOutcome, feedback, source, evidence } = req.body || {};

  if (!situation || !action || !outcome) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Fields situation, action, and outcome are required.' },
      request_id: requestId,
    });
  }

  try {
    const exp = memoryStore.recordExperience({
      accountId: apiKey.accountId,
      aiId: ai_id,
      knowledgeVersionId: 'v1.0',
      source: source || 'API',
      situation,
      action,
      outcome,
      expectedOutcome,
      actualOutcome,
      evidence,
      feedback,
      requestId,
    });
    res.status(201).json({ experience: exp, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'RECORD_FAILED', message: err.message }, request_id: requestId });
  }
});

// GET /api/v1/ai/:ai_id/sandbox/scenarios
app.get('/api/v1/ai/:ai_id/sandbox/scenarios', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  try {
    const scenarios = memoryStore.listScenarios(apiKey.accountId, ai_id);
    res.json({ scenarios, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/sandbox/scenarios
app.post('/api/v1/ai/:ai_id/sandbox/scenarios', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { name, description, userInput, expectedBehavior, expectedOutcome, evaluationCriteria, difficulty, tags } = req.body || {};

  if (!name || !userInput || !expectedBehavior) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Fields name, userInput, and expectedBehavior are required.' },
      request_id: requestId,
    });
  }

  try {
    const scenario = memoryStore.createScenario({
      accountId: apiKey.accountId,
      aiId: ai_id,
      name,
      description,
      userInput,
      expectedBehavior,
      expectedOutcome,
      evaluationCriteria,
      difficulty,
      tags,
      requestId,
    });
    res.status(201).json({ scenario, request_id: requestId });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'CREATION_FAILED', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/sandbox/runs
app.post('/api/v1/ai/:ai_id/sandbox/runs', async (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { scenarioId, seed } = req.body || {};

  if (!scenarioId) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'The scenarioId field is required.' },
      request_id: requestId,
    });
  }

  try {
    const run = await sandboxService.runScenario({
      scenarioId,
      accountId: apiKey.accountId,
      aiId: ai_id,
      seed,
      requestId,
    });
    res.json({ run, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'RUN_FAILED', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/sandbox/batch
app.post('/api/v1/ai/:ai_id/sandbox/batch', async (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { scenarioIds, repeatCount } = req.body || {};

  try {
    const batchResult = await sandboxService.runBatch({
      accountId: apiKey.accountId,
      aiId: ai_id,
      scenarioIds,
      repeatCount,
      requestId,
    });
    res.json({ batchResult, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'BATCH_FAILED', message: err.message }, request_id: requestId });
  }
});

// GET /api/v1/ai/:ai_id/sandbox/runs
app.get('/api/v1/ai/:ai_id/sandbox/runs', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  try {
    const runs = memoryStore.listRuns(apiKey.accountId, ai_id);
    res.json({ runs, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// GET /api/v1/ai/:ai_id/learning
app.get('/api/v1/ai/:ai_id/learning', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  try {
    const candidates = memoryStore.listLearningCandidates(apiKey.accountId, ai_id);
    res.json({ candidates, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/learning/generate
app.post('/api/v1/ai/:ai_id/learning/generate', async (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { focusArea } = req.body || {};

  try {
    const candidate = await learningService.generateCandidateFromExperiences({
      accountId: apiKey.accountId,
      aiId: ai_id,
      focusArea,
      requestId,
    });
    res.status(201).json({ candidate, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'GENERATE_FAILED', message: err.message }, request_id: requestId });
  }
});

// GET /api/v1/ai/:ai_id/improvements
app.get('/api/v1/ai/:ai_id/improvements', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  try {
    const proposals = memoryStore.listImprovementProposals(apiKey.accountId, ai_id);
    res.json({ proposals, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/improvements/propose
app.post('/api/v1/ai/:ai_id/improvements/propose', async (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  const { candidateIds, title } = req.body || {};

  if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'candidateIds array is required.' },
      request_id: requestId,
    });
  }

  try {
    const proposal = await learningService.evaluateCandidatesAndBuildScorecard({
      accountId: apiKey.accountId,
      aiId: ai_id,
      candidateIds,
      title,
      requestId,
    });
    res.status(201).json({ proposal, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'PROPOSAL_FAILED', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/improvements/:id/approve
app.post('/api/v1/ai/:ai_id/improvements/:id/approve', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { id } = req.params;
  const { reviewer } = req.body || {};
  const approver = reviewer || apiKey.name || 'Authorized Lead Engineer';

  try {
    const { proposal, newVersionTag } = memoryStore.approveImprovementProposal(
      id,
      apiKey.accountId,
      approver,
      requestId
    );
    res.json({
      proposal,
      newVersionTag,
      message: `Improvement proposal approved. Created immutable knowledge version ${newVersionTag}.`,
      request_id: requestId,
    });
  } catch (err: any) {
    const statusCode = err.message.includes('NOT_FOUND') ? 404 : 403;
    res.status(statusCode).json({ error: { code: 'APPROVAL_FAILED', message: err.message }, request_id: requestId });
  }
});

// POST /api/v1/ai/:ai_id/improvements/:id/reject
app.post('/api/v1/ai/:ai_id/improvements/:id/reject', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { id } = req.params;
  const { reason, reviewer } = req.body || {};

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Rejection reason is required.' },
      request_id: requestId,
    });
  }

  try {
    const proposal = memoryStore.rejectImprovementProposal(
      id,
      apiKey.accountId,
      reviewer || apiKey.name,
      reason.trim(),
      requestId
    );
    res.json({ proposal, request_id: requestId });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'REJECT_FAILED', message: err.message }, request_id: requestId });
  }
});

// GET /api/v1/ai/:ai_id/dashboard
app.get('/api/v1/ai/:ai_id/dashboard', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  try {
    const stats = memoryStore.getDashboardStats(apiKey.accountId, ai_id);
    res.json({ stats, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// GET /api/v1/ai/:ai_id/audit
app.get('/api/v1/ai/:ai_id/audit', (req, res) => {
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', requestId);

  const apiKey = authenticateApiRequest(req, res, requestId);
  if (!apiKey) return;

  const { ai_id } = req.params;
  try {
    const events = memoryStore.getAuditEvents(apiKey.accountId, ai_id, 50);
    res.json({ events, request_id: requestId });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: requestId });
  }
});

// --- 3. WEB UI CONVENIENCE ROUTES (SCOPED TO ACTIVE KB) ---

// Get active KB Phase 4 Dashboard stats
app.get('/api/phase4/dashboard', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const stats = memoryStore.getDashboardStats(accountId, aiId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List memories for active KB
app.get('/api/phase4/memories', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { status, type } = req.query;
    const memories = memoryStore.listMemories({
      accountId,
      aiId,
      status: status as MemoryStatus | undefined,
      type: type as MemoryType | undefined,
    });
    res.json({ memories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create candidate memory from Web UI
app.post('/api/phase4/memories', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { type, content, summary, tags, evidence, confidence, actor } = req.body || {};
    const memory = memoryStore.createMemory({
      accountId,
      aiId,
      type: type || 'SEMANTIC',
      content,
      summary,
      tags,
      evidence,
      confidence: confidence !== undefined ? parseFloat(confidence) : 0.85,
      actor: actor || 'Knowledge AI Web Console',
    });
    res.json({ memory, message: 'Candidate memory created. Requires human verification before active retrieval.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update memory status from Web UI (verify, reject, archive)
app.patch('/api/phase4/memories/:id/status', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const { id } = req.params;
    const { status, reason, reviewer } = req.body || {};
    const effectiveReviewer = reviewer || 'Systems Operator';

    let updated;
    if (status === 'VERIFIED') {
      updated = memoryStore.verifyMemory(id, accountId, effectiveReviewer);
    } else if (status === 'REJECTED') {
      updated = memoryStore.rejectMemory(id, accountId, effectiveReviewer, reason || 'Rejected in console');
    } else if (status === 'ARCHIVED') {
      updated = memoryStore.archiveMemory(id, accountId, effectiveReviewer);
    } else {
      return res.status(400).json({ error: 'Invalid status' });
    }
    res.json({ memory: updated, message: `Memory status transitioned to ${status}.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List experiences for active KB
app.get('/api/phase4/experiences', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { source } = req.query;
    const experiences = memoryStore.listExperiences({
      accountId,
      aiId,
      source: source as ExperienceSource | undefined,
    });
    res.json({ experiences });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Submit user feedback on chat response
app.post('/api/phase4/feedback', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { experienceId, helpful, feedback, situation, action } = req.body || {};

    if (experienceId) {
      const exp = memoryStore.getExperience(experienceId, accountId);
      if (exp) {
        exp.feedback = feedback || (helpful ? 'Operator marked helpful' : 'Operator marked unhelpful');
        exp.outcome = helpful ? 'ANSWERED_GROUNDED' : 'OPERATOR_FLAGGED_CORRECTION';
        memoryStore.saveToDisk();
        return res.json({ experience: exp, message: 'Feedback recorded.' });
      }
    }

    // Otherwise record new human feedback experience
    const newExp = memoryStore.recordExperience({
      accountId,
      aiId,
      knowledgeVersionId: activeKb.currentVersion || 'v1.0',
      source: 'HUMAN_FEEDBACK',
      situation: situation || 'User feedback on playground response',
      action: action || (helpful ? 'Approved response' : 'Flagged response issue'),
      outcome: helpful ? 'POSITIVE_FEEDBACK' : 'NEGATIVE_FEEDBACK',
      feedback,
    });
    res.json({ experience: newExp, message: 'Feedback recorded.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List sandbox scenarios
app.get('/api/phase4/sandbox/scenarios', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const scenarios = memoryStore.listScenarios(accountId, aiId);
    res.json({ scenarios });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create sandbox scenario
app.post('/api/phase4/sandbox/scenarios', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { name, description, userInput, expectedBehavior, expectedOutcome, evaluationCriteria, difficulty, tags } = req.body || {};
    const scenario = memoryStore.createScenario({
      accountId,
      aiId,
      name,
      description,
      userInput,
      expectedBehavior,
      expectedOutcome,
      evaluationCriteria,
      difficulty,
      tags,
    });
    res.json({ scenario });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Run single sandbox scenario
app.post('/api/phase4/sandbox/runs', async (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { scenarioId } = req.body || {};
    const run = await sandboxService.runScenario({
      scenarioId,
      accountId,
      aiId,
    });
    res.json({ run });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run batch sandbox scenarios
app.post('/api/phase4/sandbox/batch', async (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { scenarioIds, repeatCount } = req.body || {};
    const batchResult = await sandboxService.runBatch({
      accountId,
      aiId,
      scenarioIds,
      repeatCount: repeatCount || 1,
    });
    res.json({ batchResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List sandbox runs
app.get('/api/phase4/sandbox/runs', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const runs = memoryStore.listRuns(accountId, aiId);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List learning candidates
app.get('/api/phase4/learning/candidates', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const candidates = memoryStore.listLearningCandidates(accountId, aiId);
    res.json({ candidates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate learning candidate
app.post('/api/phase4/learning/generate', async (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { focusArea } = req.body || {};
    const candidate = await learningService.generateCandidateFromExperiences({
      accountId,
      aiId,
      focusArea,
    });
    res.json({ candidate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List improvement proposals
app.get('/api/phase4/improvements', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const proposals = memoryStore.listImprovementProposals(accountId, aiId);
    res.json({ proposals });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Propose improvement with regression scorecard
app.post('/api/phase4/improvements/propose', async (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const aiId = activeKb.specializedAi.id;
    const { candidateIds, title } = req.body || {};
    const proposal = await learningService.evaluateCandidatesAndBuildScorecard({
      accountId,
      aiId,
      candidateIds,
      title,
    });
    res.json({ proposal });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Approve improvement proposal
app.post('/api/phase4/improvements/:id/approve', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const { id } = req.params;
    const { reviewer } = req.body || {};
    const approver = reviewer || 'Systems Director (Human)';
    const result = memoryStore.approveImprovementProposal(id, accountId, approver);
    res.json({
      ...result,
      message: `Proposal approved. Created immutable version ${result.newVersionTag}. Active KB remains isolated until explicit release.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reject improvement proposal
app.post('/api/phase4/improvements/:id/reject', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const accountId = activeKb.accountId || 'acc_default';
    const { id } = req.params;
    const { reason, reviewer } = req.body || {};
    const proposal = memoryStore.rejectImprovementProposal(
      id,
      accountId,
      reviewer || 'Reviewer',
      reason || 'Declined during review'
    );
    res.json({ proposal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update Specialized AI Memory Configuration
app.patch('/api/phase4/ai-config', (req, res) => {
  try {
    const activeKb = kbStore.getActiveKB();
    const { memoryEnabled, memoryRetrievalEnabled, maxRetrievedMemories, memoryConfidenceThreshold } = req.body || {};
    const updated = kbStore.updateSpecializedAI(activeKb.id, {
      memoryEnabled: memoryEnabled !== undefined ? Boolean(memoryEnabled) : undefined,
      memoryRetrievalEnabled: memoryRetrievalEnabled !== undefined ? Boolean(memoryRetrievalEnabled) : undefined,
      maxRetrievedMemories: maxRetrievedMemories !== undefined ? parseInt(maxRetrievedMemories, 10) : undefined,
      memoryConfidenceThreshold: memoryConfidenceThreshold !== undefined ? parseFloat(memoryConfidenceThreshold) : undefined,
    });
    res.json({
      specializedAi: updated,
      message: 'Specialized AI memory governance settings updated successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// PHASE 5: MULTI-AGENT MEDIATOR & RELIABILITY ENDPOINTS
// =========================================================================

// List registered agents
app.get('/api/v1/mediator/agents', (req, res) => {
  try {
    const agents = agentRegistry.listAgents();
    res.json({ agents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all orchestration runs
app.get('/api/v1/mediator/runs', (req, res) => {
  try {
    const runs = orchestrationEngine.listRuns();
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific orchestration run with full event stream and telemetry
app.get('/api/v1/mediator/runs/:runId', (req, res) => {
  try {
    const { runId } = req.params;
    const run = orchestrationEngine.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ run });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Execute task through multi-agent mediator
app.post('/api/v1/mediator/execute', async (req, res) => {
  try {
    const { taskPrompt, subtaskPrompts, config, mode, faultMode, correlationGroup, customClaims, maxAgents, maxEscalationRounds, kbId } = req.body || {};
    if (!taskPrompt) {
      return res.status(400).json({ error: 'taskPrompt is required' });
    }

    if (mode === 'ADAPTIVE' || (!subtaskPrompts && mode !== 'FIXED')) {
      const adaptiveResult = await adaptiveOrchestrator.executeRun({
        taskPrompt,
        orchestrationMode: mode || 'ADAPTIVE',
        seed: config?.seed,
        kbId,
        faultMode,
        customClaims,
        maxAgents,
        maxEscalationRounds,
        timeoutMs: config?.globalTimeoutMs,
        correlationGroup,
      });
      return res.json({
        run: adaptiveResult.underlyingOrchestrationRun,
        adaptiveResult,
      });
    }

    const run = await orchestrationEngine.executeRun({
      taskPrompt,
      subtaskPrompts,
      config,
      kbId,
    });
    res.json({ run });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 6: Plan task topology & agent count without execution
app.post('/api/v1/mediator/plan', (req, res) => {
  try {
    const { taskPrompt, mode } = req.body || {};
    if (!taskPrompt) return res.status(400).json({ error: 'taskPrompt is required' });
    const complexity = taskComplexityAnalyzer.analyze(taskPrompt);
    const risk = riskAssessmentEngine.assess(taskPrompt, complexity);
    const availableAgents = agentRegistry.listAgents();
    const plan = adaptiveStrategyPlanner.plan(taskPrompt, complexity, risk, availableAgents, mode || 'ADAPTIVE');
    res.json({ plan, complexity, risk });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 6: Analyze claims for contradictions and unsupported consensus
app.post('/api/v1/mediator/disagreements/analyze', (req, res) => {
  try {
    const { claims } = req.body || {};
    if (!claims || !Array.isArray(claims)) {
      return res.status(400).json({ error: 'claims array is required' });
    }
    const result = adaptiveDisagreementDetector.analyzeDisagreements(claims);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 6: Independent verification pass against authoritative grounding
app.post('/api/v1/mediator/verify', async (req, res) => {
  try {
    const { claims, targetClaims, kbId } = req.body || {};
    if (!claims || !Array.isArray(claims)) {
      return res.status(400).json({ error: 'claims array is required' });
    }
    const result = await independentVerifier.verify(claims, targetClaims || [], kbId);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 6: List adaptive runs
app.get('/api/v1/mediator/adaptive/runs', (req, res) => {
  try {
    const runs = adaptiveOrchestrator.getAllRuns();
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 6: Get specific adaptive run
app.get('/api/v1/mediator/adaptive/runs/:runId', (req, res) => {
  try {
    const { runId } = req.params;
    const run = adaptiveOrchestrator.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Adaptive run not found' });
    res.json({ adaptiveRun: run });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 6: Comparative benchmark (FIXED_1, FIXED_4, FIXED_10, ADAPTIVE)
app.post('/api/v1/mediator/benchmarks/compare', async (req, res) => {
  try {
    const { seed } = req.body || {};
    const result = await adaptiveBenchmarkEngine.runComparativeBenchmark(seed ? parseInt(seed, 10) : 42);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel active orchestration run
app.post('/api/v1/mediator/runs/:runId/cancel', (req, res) => {
  try {
    const { runId } = req.params;
    const success = orchestrationEngine.cancelRun(runId);
    if (!success) {
      return res.status(400).json({ error: 'Run cannot be cancelled or was not found' });
    }
    res.json({ message: 'Run cancelled successfully', runId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get aggregated reliability and quality metrics
app.get('/api/v1/mediator/metrics', (req, res) => {
  try {
    const metrics = benchmarkRunner.getMetrics();
    res.json({ metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Benchmark: Parallel speedup
app.post('/api/v1/mediator/benchmarks/parallelism', async (req, res) => {
  try {
    const { subtaskCount, delayMs } = req.body || {};
    const result = await benchmarkRunner.runParallelSpeedupBenchmark(
      subtaskCount ? parseInt(subtaskCount, 10) : 4,
      delayMs ? parseInt(delayMs, 10) : 50
    );
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Benchmark: Agent count scaling
app.post('/api/v1/mediator/benchmarks/scaling', async (req, res) => {
  try {
    const result = await benchmarkRunner.runAgentCountExperiment();
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Benchmark: Majority wrong scenario
app.post('/api/v1/mediator/benchmarks/majority-wrong', async (req, res) => {
  try {
    const result = await benchmarkRunner.runMajorityWrongBenchmark();
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Phase 9.5 50-Question Golden RAG Acceptance Benchmark
app.post('/api/v1/rag/benchmark/run', async (req, res) => {
  try {
    const benchmarkResults = await runRag50GoldenBenchmark();
    res.json({ success: true, benchmark: benchmarkResults });
  } catch (err: any) {
    console.error('Error running RAG 50 golden benchmark:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/rag/benchmark/status', async (req, res) => {
  try {
    const benchmarkResults = await runRag50GoldenBenchmark();
    res.json({ success: true, benchmark: benchmarkResults });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 9.5 8-Turn Conversational Reproduction & Stale-Context Verification
app.post('/api/v1/rag/reproduce-sequence', async (req, res) => {
  try {
    const mode = req.body?.mode === 'ISOLATED_SINGLE_TURN' ? 'ISOLATED_SINGLE_TURN' : 'CONVERSATIONAL_ACCUMULATION';
    const sequenceResult = await runEightTurnConversationalSequence(mode);
    res.json({ success: true, sequence: sequenceResult });
  } catch (err: any) {
    console.error('Error running 8-turn conversational sequence:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 9.5 RAG Retrieval Diagnostic Telemetry Traces
app.get('/api/v1/rag/telemetry', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const tenantId = req.query.tenantId as string;
    const traces = ragTelemetryStore.getRecentTraces(limit, tenantId);
    res.json({ success: true, traces, count: traces.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 9.5 RAG Retrieval Diagnostic Telemetry Summary Statistics
app.get('/api/v1/rag/telemetry/stats', (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    const stats = ragTelemetryStore.getStatistics(tenantId);
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- VITE / STATIC SERVING ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Knowledge AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

