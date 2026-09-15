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
 * 8. Hard post-generation grounding gate with one evidence-only repair attempt
 * 9. Verifiable Citations with Document, Page, Section, and Snippet
 * 10. Diagnostic Telemetry Recording
 */

import { GoogleGenAI } from '@google/genai';
import { KnowledgeDocument, Citation, ChatMessage, SpecializedAI } from '../src/types.js';
import { resolveConversationalQuery } from './ragQueryResolver.js';
import {
  hybridRagIndex,
  checkEvidenceSufficiency,
} from './ragPipeline.js';
import { productionRetriever } from './retrieval/productionRetriever.js';
import { generateEvidenceFirstAnswer } from './ragGenerator.js';
import { enforceGroundingGuard } from './groundingGuard.js';
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

  // 3. Multi-Tenant Document Indexing
  hybridRagIndex.indexDocuments(processedDocs, tenantId, knowledgeBaseId);

  // 4-5. Fresh retrieval + reranking through the guarded production boundary.
  // Default remains heuristic. Set KNOWLEDGE_AI_RETRIEVAL_MODE=hybrid to enable
  // heuristic + local BGE dense retrieval with reciprocal-rank fusion. Any dense
  // model/index failure falls back to the existing heuristic path.
  const retrieval = await productionRetriever.retrieve(retrievalQuery, tenantId, knowledgeBaseId, {
    candidateK: 12,
    fusionK: 20,
    evidenceK: 5,
  });
  const candidates = retrieval.candidates;
  const reranked = retrieval.reranked;
  const retrievalModeNote = retrieval.effectiveMode === 'heuristic-fallback'
    ? ` Retrieval mode: heuristic-fallback (${retrieval.fallbackReason || 'dense retrieval unavailable'}).`
    : ` Retrieval mode: ${retrieval.effectiveMode}.`;

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
      resolutionExplanation: `${resolution.resolutionExplanation}${retrievalModeNote}`,
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
Preserve exact entity names and exact numerical quantities.
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
    const genResult = generateEvidenceFirstAnswer(retrievalQuery, reranked, specializedAi, memoryContext);
    answerText = genResult.answer;
    engineUsed = 'grounded-local-engine';
  }

  // 8. Hard post-generation grounding boundary.
  // Retrieval sufficiency alone does not make a generated answer trustworthy.
  // If verification fails, attempt one deterministic evidence-only repair and
  // verify that repair. If it still fails, abstain instead of returning the claim.
  const groundingDecision = enforceGroundingGuard({
    generatedAnswer: answerText,
    rerankedEvidence: reranked,
    repairAnswer: () =>
      generateEvidenceFirstAnswer(retrievalQuery, reranked, specializedAi, memoryContext).answer,
  });

  answerText = groundingDecision.answer;
  if (groundingDecision.action === 'REPAIR') {
    engineUsed = 'grounded-local-engine';
  }

  const claimCheck = groundingDecision.claimCheck;
  const isFoundInDocuments = groundingDecision.isFoundInDocuments;

  // 9. Structured citations are exposed only for a grounded final answer.
  const sources: Citation[] = isFoundInDocuments
    ? reranked.slice(0, 3).map((item) => ({
        documentId: item.chunk.documentId,
        documentName: item.chunk.documentName,
        pageNumber: item.chunk.pageNumber,
        sectionHeading: item.chunk.sectionTitle,
        snippet: item.chunk.text.substring(0, 200),
      }))
    : [];

  // 10. Record Telemetry Diagnostic Trace
  const failureClassification: RagFailureClassification = isFoundInDocuments
    ? 'NONE_SUCCESS'
    : 'GROUNDING_FAILURE';

  const trace: RetrievalDiagnosticTrace = {
    id: 'trace_' + Date.now(),
    requestId,
    tenantId,
    aiId: specializedAi?.id || 'ai_default',
    timestamp: Date.now(),
    originalQuestion: question,
    contextualizedQuery: retrievalQuery,
    queryType: resolution.queryType,
    resolutionExplanation: groundingDecision.action === 'REPAIR'
      ? `${resolution.resolutionExplanation}${retrievalModeNote} Final provider answer required evidence-only repair before release.`
      : groundingDecision.action === 'REFUSE'
        ? `${resolution.resolutionExplanation}${retrievalModeNote} Final answer failed claim verification and was refused.`
        : `${resolution.resolutionExplanation}${retrievalModeNote}`,
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
    isFoundInDocuments,
    groundingScore: claimCheck.groundingScore,
    claimVerifications: claimCheck.verifications,
    unsupportedClaims: isFoundInDocuments ? [] : groundingDecision.originalUnsupportedClaims,
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
    isFoundInDocuments,
    engineUsed,
    diagnosticTrace: trace,
  };
}
