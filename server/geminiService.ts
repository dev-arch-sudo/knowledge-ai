/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 9.5 Production RAG Engine & Grounding Service
 * Implements:
 * 1. Conversational Query Resolution (RAGFlow / LlamaIndex / Haystack inspired)
 * 2. Fresh Retrieval Invariant (Retrieval is executed on every single conversational turn)
 * 3. Multi-Tenant Hybrid Index & Semantic Search
 * 4. Multi-Factor Second-Stage Reranking
 * 5. Evidence Sufficiency Gating
 * 6. Evidence-First Answer Generation (Gemini 3.8-flash or local deterministic engine)
 * 7. Claim-Level Grounding Verification
 * 8. Verifiable Citations with Document, Page, Section, and Snippet
 * 9. Diagnostic Telemetry Recording
 */

import { GoogleGenAI } from '@google/genai';
import { KnowledgeDocument, Citation, ChatMessage, SpecializedAI } from '../src/types.js';
import { resolveConversationalQuery } from './ragQueryResolver.js';
import {
  hybridRagIndex,
  rerankCandidates,
  checkEvidenceSufficiency,
  verifyClaimsAgainstEvidence,
} from './ragPipeline.js';
import { generateEvidenceFirstAnswer } from './ragGenerator.js';
import { ragTelemetryStore, RetrievalDiagnosticTrace, RagFailureClassification } from './ragTelemetryStore.js';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

export interface GroundedAnswerResult {
  answer: string;
  sources: Citation[];
  isFoundInDocuments: boolean;
  engineUsed: 'gemini-3.8-flash' | 'grounded-local-engine';
  diagnosticTrace?: RetrievalDiagnosticTrace;
}

/**
 * Executes full Phase 9.5 Grounded RAG Pipeline
 */
export async function answerQuestionWithGroundedDocs(
  question: string,
  documents: KnowledgeDocument[],
  chatHistory: ChatMessage[] = [],
  specializedAi?: SpecializedAI,
  memoryContext?: string,
  tenantId: string = 'acc_default',
  knowledgeBaseId: string = 'kb_default',
  requestId: string = 'req_' + Date.now()
): Promise<GroundedAnswerResult> {
  const startTime = Date.now();
  const processedDocs = documents.filter(
    (d) => d.processingStatus === 'processed' && d.pages && d.pages.length > 0
  );

  if (processedDocs.length === 0) {
    return {
      answer: "I couldn't find enough information to answer this question because no processed documents are currently in this knowledge base.",
      sources: [],
      isFoundInDocuments: false,
      engineUsed: 'grounded-local-engine',
    };
  }

  const qLower = question.toLowerCase();

  // 1. Adversarial Prompt Injection Defense (Category 10)
  if (
    qLower.includes('ignore previous instructions') ||
    qLower.includes('ignore all previous') ||
    qLower.includes('reveal the system prompt') ||
    qLower.includes('reveal system prompt') ||
    qLower.includes('system prompt') ||
    qLower.includes('confidential_admin_key')
  ) {
    const trace: RetrievalDiagnosticTrace = {
      id: 'trace_' + Date.now(),
      requestId,
      tenantId,
      aiId: specializedAi?.id || 'ai_default',
      timestamp: Date.now(),
      originalQuestion: question,
      contextualizedQuery: question,
      queryType: 'DIRECT_QUERY',
      resolutionExplanation: 'Adversarial prompt injection detected; immediate security refusal triggered.',
      retrievedCandidateCount: 0,
      candidateChunks: [],
      rerankedChunks: [],
      selectedEvidenceChunks: [],
      evidenceSufficiency: {
        isSufficient: false,
        sufficiencyScore: 0,
        reason: 'Adversarial attempt to bypass platform boundaries.',
        suggestedAction: 'REFUSE_OUT_OF_DOMAIN',
      },
      finalAnswer: 'I cannot execute instructions attempting to reveal internal system prompts or bypass document grounding rules. System policies and prompts are strictly protected, and external content cannot mutate platform instructions.',
      isFoundInDocuments: false,
      groundingScore: 0,
      claimVerifications: [],
      unsupportedClaims: [],
      citations: [],
      engineUsed: 'grounded-local-engine',
      failureClassification: 'NONE_SUCCESS',
      durationMs: Date.now() - startTime,
    };
    ragTelemetryStore.recordTrace(trace);

    return {
      answer: trace.finalAnswer,
      sources: [],
      isFoundInDocuments: false,
      engineUsed: 'grounded-local-engine',
      diagnosticTrace: trace,
    };
  }

  // 2. Conversational Query Resolution Stage (Phase 9.5 Core Invariant)
  // Resolves pronouns ("it", "its", "those", "that") and elliptical references into self-contained retrieval queries.
  // CRITICAL: Conversational history is used ONLY to resolve the entity/subject. It does NOT replace the query
  // and previous assistant answers are NOT injected as authoritative document context!
  const resolution = resolveConversationalQuery(question, chatHistory);
  const retrievalQuery = resolution.contextualizedQuery;

  // 3. Multi-Tenant Hybrid Document Indexing
  hybridRagIndex.indexDocuments(processedDocs, tenantId, knowledgeBaseId);

  // 4. First-Stage Fresh Retrieval (BM25 + Semantic + Exact Entity Matching)
  const candidates = hybridRagIndex.search(retrievalQuery, tenantId, knowledgeBaseId, 12);

  // 5. Second-Stage Multi-Factor Reranking
  const reranked = rerankCandidates(retrievalQuery, candidates, 5);

  // 6. Evidence Sufficiency Gating
  const sufficiency = checkEvidenceSufficiency(retrievalQuery, reranked);

  // If evidence is insufficient or out-of-domain, strictly refuse without hallucination
  if (!sufficiency.isSufficient) {
    const refusalText = "I couldn't find enough information to answer this question in the uploaded documents.";
    const trace: RetrievalDiagnosticTrace = {
      id: 'trace_' + Date.now(),
      requestId,
      tenantId,
      aiId: specializedAi?.id || 'ai_default',
      timestamp: Date.now(),
      originalQuestion: question,
      contextualizedQuery: retrievalQuery,
      queryType: resolution.queryType,
      resolutionExplanation: resolution.resolutionExplanation,
      retrievedCandidateCount: candidates.length,
      candidateChunks: candidates.map((c) => ({
        chunkId: c.chunk.chunkId,
        sectionTitle: c.chunk.sectionTitle,
        pageNumber: c.chunk.pageNumber,
        combinedScore: c.combinedScore,
        keywordScore: c.keywordScore,
        entityScore: c.exactScore,
        semanticScore: c.semanticScore,
        matchReasons: c.matchReasons,
        snippet: c.chunk.text.substring(0, 150),
      })),
      rerankedChunks: reranked.map((r) => ({
        chunkId: r.chunk.chunkId,
        sectionTitle: r.chunk.sectionTitle,
        pageNumber: r.chunk.pageNumber,
        rerankScore: r.rerankScore,
        rank: r.rank,
        confidence: r.confidence,
        explanation: r.relevanceExplanation,
        snippet: r.chunk.text.substring(0, 150),
      })),
      selectedEvidenceChunks: [],
      evidenceSufficiency: sufficiency,
      finalAnswer: refusalText,
      isFoundInDocuments: false,
      groundingScore: 0,
      claimVerifications: [],
      unsupportedClaims: [],
      citations: [],
      engineUsed: 'grounded-local-engine',
      failureClassification: candidates.length === 0 ? 'RETRIEVAL_FAILURE' : 'NONE_SUCCESS',
      durationMs: Date.now() - startTime,
    };
    ragTelemetryStore.recordTrace(trace);

    return {
      answer: refusalText,
      sources: [],
      isFoundInDocuments: false,
      engineUsed: 'grounded-local-engine',
      diagnosticTrace: trace,
    };
  }

  // 7. Evidence-First Answer Generation
  let answerText = '';
  let engineUsed: 'gemini-3.8-flash' | 'grounded-local-engine' = 'grounded-local-engine';
  const ai = getGenAI();

  if (ai) {
    try {
      // Build strictly grounded context containing ONLY reranked chunks
      let evidencePrompt = '=== RETRIEVED AUTHORITATIVE EVIDENCE CHUNKS ===\n\n';
      for (const item of reranked) {
        evidencePrompt += `[CHUNK ID: ${item.chunk.chunkId} | DOC: "${item.chunk.documentName}" | PAGE: ${item.chunk.pageNumber} | SECTION: "${item.chunk.sectionTitle}"]\n`;
        evidencePrompt += `${item.chunk.text}\n\n`;
      }

      const styleInstruction = (() => {
        switch (specializedAi?.responseStyle) {
          case 'concise':
            return 'Style: Keep answer concise, crisp, and direct (2-3 sentences).';
          case 'bullet-points':
            return 'Style: Format core points as clean markdown bullet points with bold key terms.';
          case 'executive-summary':
            return 'Style: Structure response as an Executive Summary.';
          case 'detailed':
          default:
            return 'Style: Provide a clear, thorough explanation citing exact numbers and facts.';
        }
      })();

      const systemInstruction = `You are the production grounded answering engine for Knowledge AI.
Your ONLY source of authoritative truth is the RETRIEVED AUTHORITATIVE EVIDENCE CHUNKS.
Do NOT use pretrained general knowledge or extrapolate facts not present in the evidence.
If the evidence does NOT contain the exact answer, refuse by setting isFoundInDocuments to false.
Preserve exact entity names (e.g., AR-40, Singapore Central Logistics Hub) and exact numerical quantities.
${styleInstruction}
Return response in strict JSON:
{
  "answer": "Grounded answer text in markdown",
  "isFoundInDocuments": true or false,
  "sources": [
    {
      "documentName": "filename.pdf",
      "pageNumber": 1,
      "sectionHeading": "Section Title",
      "snippet": "Direct supporting quotation"
    }
  ]
}`;

      let userPrompt = `${evidencePrompt}\n`;
      if (memoryContext && memoryContext.trim()) {
        userPrompt += `${memoryContext}\n\n`;
      }
      userPrompt += `Question: ${retrievalQuery}\nProvide your grounded response in JSON format.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleanJson);
      }

      if (parsed && typeof parsed.answer === 'string' && parsed.isFoundInDocuments !== false) {
        answerText = parsed.answer;
        engineUsed = 'gemini-3.8-flash';
      } else {
        // Fallback to deterministic synthesizer
        const genResult = generateEvidenceFirstAnswer(retrievalQuery, reranked, specializedAi, memoryContext);
        answerText = genResult.answer;
        engineUsed = 'grounded-local-engine';
      }
    } catch (err: any) {
      console.warn('Gemini API generation failed, falling back to deterministic synthesizer:', err.message);
      const genResult = generateEvidenceFirstAnswer(retrievalQuery, reranked, specializedAi, memoryContext);
      answerText = genResult.answer;
      engineUsed = 'grounded-local-engine';
    }
  } else {
    // Deterministic evidence-first generation
    const genResult = generateEvidenceFirstAnswer(retrievalQuery, reranked, specializedAi, memoryContext);
    answerText = genResult.answer;
    engineUsed = 'grounded-local-engine';
  }

  // 8. Claim-Level Grounding Verification
  const claimCheck = verifyClaimsAgainstEvidence(answerText, reranked);

  // 9. Structured Verifiable Citations
  const sources: Citation[] = reranked.slice(0, 3).map((item) => ({
    documentId: item.chunk.documentId,
    documentName: item.chunk.documentName,
    pageNumber: item.chunk.pageNumber,
    sectionHeading: item.chunk.sectionTitle,
    snippet: item.chunk.text.substring(0, 200),
  }));

  // 10. Record Telemetry Diagnostic Trace
  let failureClassification: RagFailureClassification = 'NONE_SUCCESS';
  if (claimCheck.unsupportedClaims.length > 0) {
    failureClassification = 'GROUNDING_FAILURE';
  }

  const trace: RetrievalDiagnosticTrace = {
    id: 'trace_' + Date.now(),
    requestId,
    tenantId,
    aiId: specializedAi?.id || 'ai_default',
    timestamp: Date.now(),
    originalQuestion: question,
    contextualizedQuery: retrievalQuery,
    queryType: resolution.queryType,
    resolutionExplanation: resolution.resolutionExplanation,
    retrievedCandidateCount: candidates.length,
    candidateChunks: candidates.map((c) => ({
      chunkId: c.chunk.chunkId,
      sectionTitle: c.chunk.sectionTitle,
      pageNumber: c.chunk.pageNumber,
      combinedScore: c.combinedScore,
      keywordScore: c.keywordScore,
      entityScore: c.exactScore,
      semanticScore: c.semanticScore,
      matchReasons: c.matchReasons,
      snippet: c.chunk.text.substring(0, 150),
    })),
    rerankedChunks: reranked.map((r) => ({
      chunkId: r.chunk.chunkId,
      sectionTitle: r.chunk.sectionTitle,
      pageNumber: r.chunk.pageNumber,
      rerankScore: r.rerankScore,
      rank: r.rank,
      confidence: r.confidence,
      explanation: r.relevanceExplanation,
      snippet: r.chunk.text.substring(0, 150),
    })),
    selectedEvidenceChunks: reranked.map((r) => ({
      chunkId: r.chunk.chunkId,
      sectionTitle: r.chunk.sectionTitle,
      pageNumber: r.chunk.pageNumber,
      text: r.chunk.text,
    })),
    evidenceSufficiency: sufficiency,
    finalAnswer: answerText,
    isFoundInDocuments: true,
    groundingScore: claimCheck.groundingScore,
    claimVerifications: claimCheck.verifications,
    unsupportedClaims: claimCheck.unsupportedClaims,
    citations: sources.map((s) => ({
      documentName: s.documentName,
      pageNumber: typeof s.pageNumber === 'number' ? s.pageNumber : 1,
      sectionHeading: s.sectionHeading || 'General',
      snippet: s.snippet || '',
    })),
    engineUsed,
    failureClassification,
    durationMs: Date.now() - startTime,
  };
  ragTelemetryStore.recordTrace(trace);

  return {
    answer: answerText,
    sources,
    isFoundInDocuments: true,
    engineUsed,
    diagnosticTrace: trace,
  };
}
