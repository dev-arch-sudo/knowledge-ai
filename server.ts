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
import { ChatMessage, ApiChatRequest, ApiChatResponse, ApiErrorResponse } from './src/types.js';
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
    });

    // Add assistant message to history
    const assistantMessage: ChatMessage = {
      id: result.id,
      role: 'assistant',
      content: result.answer,
      timestamp: Date.now(),
      citations: result.rawCitations,
      isFoundInDocuments: result.grounded,
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

