/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic evidence-grounded cognitive answering pipeline.
 * Production reasoning must derive claims from retrieved evidence only.
 */

import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage, KnowledgeDocument, SpecializedAI } from '../../src/types.js';
import {
  QuestionUnderstandingProfile,
  InformationNeedPlan,
  FusedEvidenceItem,
  RerankedEvidenceItem,
  CognitiveExecutionTrace,
  CognitiveAnswerResult,
  CognitiveContext,
  GovernanceValidationResult,
  UnderstandStageResult,
  PlanStageResult,
  RetrieveStageResult,
  VerifyStageResult,
  SynthesizeStageResult,
} from './types.js';
import { understandQuestion } from './questionUnderstanding.js';
import { planInformationNeed } from './informationNeedPlanner.js';
import { hierarchicalIndex } from './hierarchicalIndex.js';
import { evidenceFusionPipeline } from './evidenceFusion.js';
import { claimVerificationEngine } from './claimVerifier.js';
import { cognitiveTelemetryStore } from './cognitiveTelemetryStore.js';
import { knowledgeGraphEngine } from './knowledgeGraphEngine.js';
import { tableArithmeticEngine, ArithmeticExecutionResult } from './tableArithmeticEngine.js';
import { correctiveRagEngine, CorrectiveRagAssessment } from './correctiveRagEngine.js';
import { phase95RagSubordinateModule, Phase95RagSubordinateModule } from './phase95SubordinateModule.js';
import { deterministicSynthesizer } from './deterministicSynthesizer.js';
import { tenantGovernanceService } from '../mediator/tenantGovernanceService.js';
import { quotaAndBillingService } from '../mediator/quotaAndBillingService.js';
import { multilingualEngine } from './multilingualEngine.js';

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (geminiClient) return geminiClient;
  const key = process.env.GEMINI_API_KEY;
  if (!key || !key.trim()) return null;
  try {
    geminiClient = new GoogleGenAI({ apiKey: key });
    return geminiClient;
  } catch {
    return null;
  }
}

export class KnowledgeCognitiveEngine {
  private subordinateRag: Phase95RagSubordinateModule = phase95RagSubordinateModule;

  public getSubordinateRagModule(): Phase95RagSubordinateModule {
    return this.subordinateRag;
  }

  public async understand(question: string, context: CognitiveContext): Promise<UnderstandStageResult> {
    const started = Date.now();
    const tenantConfig = tenantGovernanceService.getConfiguration(context.tenantId);
    const policies = tenantConfig.securityPolicies || {
      enforceGroundingBoundary: true,
      requireHumanVerificationForPublish: true,
      sandboxControlledLearning: true,
      blockExternalAiStateMutation: true,
    };

    const { profile, contextualizedQuery: primaryQuery } = understandQuestion(question, context.chatHistory);
    const subordinate = this.subordinateRag.resolveQuery(question, context.chatHistory);
    const contextualizedQuery =
      subordinate.queryType !== 'DIRECT_QUERY' && subordinate.contextualizedQuery.length > primaryQuery.length
        ? subordinate.contextualizedQuery
        : primaryQuery;

    const isAllowed = !profile.isAdversarial;
    const violationReason = isAllowed ? undefined : 'Adversarial prompt injection attempt detected.';

    tenantGovernanceService.recordAuditEvent({
      tenantId: context.tenantId,
      actor: 'knowledge_cognitive_engine',
      action: 'COGNITIVE_QUERY_UNDERSTAND',
      target: context.knowledgeBaseId,
      result: isAllowed ? 'SUCCESS' : 'DENIED',
      reason: violationReason,
      metadata: { classification: profile.classification, entities: profile.entities },
    });

    const governance: GovernanceValidationResult = {
      isAllowed,
      tenantId: context.tenantId,
      policyEnforced: policies.enforceGroundingBoundary,
      auditActionRecorded: true,
      violationReason,
      securityPolicies: {
        enforceGroundingBoundary: policies.enforceGroundingBoundary,
        blockExternalAiStateMutation: policies.blockExternalAiStateMutation,
      },
    };

    return { profile, contextualizedQuery, governance, timingMs: Date.now() - started };
  }

  public async plan(understandResult: UnderstandStageResult, _context: CognitiveContext): Promise<PlanStageResult> {
    const started = Date.now();
    return {
      plan: planInformationNeed(understandResult.profile),
      timingMs: Date.now() - started,
    };
  }

  public async retrieve(
    planResult: PlanStageResult,
    understandResult: UnderstandStageResult,
    context: CognitiveContext
  ): Promise<RetrieveStageResult> {
    const started = Date.now();

    for (const doc of context.documents || []) {
      hierarchicalIndex.indexDocument(context.tenantId, context.knowledgeBaseId, doc);
    }
    this.subordinateRag.indexDocuments(context.documents || [], context.tenantId, context.knowledgeBaseId);

    const { fusedItems, rerankedItems } = evidenceFusionPipeline.fuseEvidence(
      context.tenantId,
      context.knowledgeBaseId,
      understandResult.profile,
      planResult.plan
    );

    const subordinate = this.subordinateRag.retrieveEvidence(
      understandResult.contextualizedQuery,
      context.tenantId,
      context.knowledgeBaseId,
      12,
      5
    );

    const graphResult = knowledgeGraphEngine.queryGraph(
      context.tenantId,
      context.knowledgeBaseId,
      [
        understandResult.profile.normalizedQuestion,
        ...understandResult.profile.entities,
        ...understandResult.profile.attributes,
      ]
    );

    return {
      fusedItems,
      rerankedItems,
      graphResult,
      structuredTables: hierarchicalIndex.getStructuredTables(context.tenantId, context.knowledgeBaseId),
      subordinateRetrieval: {
        candidatesCount: subordinate.candidates.length,
        rerankedCount: subordinate.reranked.length,
        sufficiencyScore: subordinate.sufficiency.sufficiencyScore,
      },
      timingMs: Date.now() - started,
    };
  }

  public async verify(
    retrieveResult: RetrieveStageResult,
    _planResult: PlanStageResult,
    understandResult: UnderstandStageResult,
    _context: CognitiveContext
  ): Promise<VerifyStageResult> {
    const started = Date.now();
    const topScore = retrieveResult.rerankedItems[0]?.rerankScore ?? 0;
    const blocked = understandResult.profile.isAdversarial || understandResult.profile.isOutOfDomain;
    const isSufficient = !blocked && retrieveResult.rerankedItems.length > 0 && topScore >= 0.25;

    const correctiveAssessment = correctiveRagEngine.assessEvidence(
      understandResult.profile,
      retrieveResult.rerankedItems
    );

    return {
      sufficiency: {
        isSufficient,
        reason: isSufficient
          ? 'Retrieved evidence is strong enough to support a grounded answer.'
          : 'The retrieved evidence is insufficient to support a reliable answer.',
        sufficiencyScore: blocked ? 0 : Math.min(1, Math.max(0, topScore)),
      },
      correctiveAssessment,
      subordinateSufficiency: retrieveResult.subordinateRetrieval
        ? {
            isSufficient: retrieveResult.subordinateRetrieval.sufficiencyScore >= 0.5,
            sufficiencyScore: retrieveResult.subordinateRetrieval.sufficiencyScore,
            reason: 'Subordinate RAG evidence score.',
          }
        : undefined,
      isContradiction: correctiveAssessment?.grade === 'CONTRADICTORY',
      proceedToSynthesis: true,
      timingMs: Date.now() - started,
    };
  }

  public async synthesize(
    verifyResult: VerifyStageResult,
    retrieveResult: RetrieveStageResult,
    planResult: PlanStageResult,
    understandResult: UnderstandStageResult,
    context: CognitiveContext
  ): Promise<SynthesizeStageResult> {
    const started = Date.now();

    const mathResult = tableArithmeticEngine.evaluateArithmeticOrTabularQuery(
      understandResult.profile.normalizedQuestion,
      retrieveResult.structuredTables
    );

    const reasoning = await this.reasonOverEvidence({
      profile: understandResult.profile,
      plan: planResult.plan,
      fusedItems: retrieveResult.fusedItems,
      rerankedItems: retrieveResult.rerankedItems,
      sufficiency: verifyResult.sufficiency,
      forceDeterministic: context.forceDeterministic,
      graphResult: retrieveResult.graphResult,
      correctiveAssessment: verifyResult.correctiveAssessment as CorrectiveRagAssessment | undefined,
      mathResult,
    });

    const evidenceChunks = retrieveResult.rerankedItems.map((item) => item.chunk);
    const verification = claimVerificationEngine.verifyAnswerClaims(
      reasoning.answer,
      evidenceChunks,
      understandResult.profile
    );

    quotaAndBillingService.recordUsage({
      tenantId: context.tenantId,
      requestId: context.requestId,
      metric: 'tokens',
      quantity: 1,
      unit: 'query',
      source: 'MEASURED',
    });

    let answer = reasoning.answer;
    const language = understandResult.profile.detectedLanguage;
    if (language && !language.isCorpusLanguage) {
      answer = multilingualEngine.localizeAnswer(answer, language, !verifyResult.sufficiency.isSufficient);
    }

    return {
      answer,
      engineUsed: reasoning.engineUsed,
      claims: verification.claims,
      allClaimsSupported: verification.allClaimsSupported,
      groundingScore: verification.groundingScore,
      citations: verification.citations,
      mathResult,
      timingMs: Date.now() - started,
    };
  }

  public async coordinatePipeline(input: {
    question: string;
    chatHistory?: ChatMessage[];
    tenantId?: string;
    knowledgeBaseId?: string;
    documents?: KnowledgeDocument[];
    forceDeterministic?: boolean;
    specializedAi?: SpecializedAI;
  }): Promise<CognitiveAnswerResult> {
    const started = Date.now();
    const context: CognitiveContext = {
      tenantId: input.tenantId || 'tenant-default',
      knowledgeBaseId: input.knowledgeBaseId || 'kb-default',
      requestId: `cog_req_${crypto.randomUUID().slice(0, 8)}`,
      chatHistory: input.chatHistory || [],
      documents: input.documents,
      forceDeterministic: input.forceDeterministic,
    };

    const understandResult = await this.understand(input.question, context);
    const planResult = await this.plan(understandResult, context);
    let retrieveResult = await this.retrieve(planResult, understandResult, context);
    let verifyResult = await this.verify(retrieveResult, planResult, understandResult, context);
    let reRetrievalExecuted = false;
    let reRetrievalAttempts = 0;

    const correctiveQueries = verifyResult.correctiveAssessment?.correctiveQueries || [];
    if (!verifyResult.sufficiency.isSufficient && correctiveQueries.length > 0 && understandResult.governance.isAllowed) {
      reRetrievalExecuted = true;
      reRetrievalAttempts = 1;
      const expandedPlan: PlanStageResult = {
        ...planResult,
        plan: {
          ...planResult.plan,
          subQueries: [...planResult.plan.subQueries, correctiveQueries[0]],
        },
      };
      const retry = await this.retrieve(expandedPlan, understandResult, context);
      const existing = new Set(retrieveResult.rerankedItems.map((item) => item.chunk.chunkId));
      const newItems = retry.rerankedItems.filter((item) => !existing.has(item.chunk.chunkId));
      if (newItems.length > 0) {
        retrieveResult = {
          ...retrieveResult,
          fusedItems: [...retrieveResult.fusedItems, ...retry.fusedItems],
          rerankedItems: [...retrieveResult.rerankedItems, ...newItems].sort((a, b) => b.rerankScore - a.rerankScore),
        };
        verifyResult = await this.verify(retrieveResult, expandedPlan, understandResult, context);
      }
    }

    const synthesizeResult = await this.synthesize(
      verifyResult,
      retrieveResult,
      planResult,
      understandResult,
      context
    );

    const trace: CognitiveExecutionTrace = {
      id: `trace_${crypto.randomUUID().slice(0, 8)}`,
      requestId: context.requestId,
      tenantId: context.tenantId,
      knowledgeBaseId: context.knowledgeBaseId,
      timestamp: Date.now(),
      originalQuestion: input.question,
      contextualizedQuestion: understandResult.contextualizedQuery,
      questionProfile: understandResult.profile,
      informationNeedPlan: planResult.plan,
      reasoningMode: planResult.plan.reasoningMode,
      retrievalRounds: reRetrievalAttempts + 1,
      retrievalStrategiesUsed: planResult.plan.selectedRetrievalStrategies,
      candidatesRetrieved: retrieveResult.fusedItems.length,
      fusedEvidenceCount: retrieveResult.fusedItems.length,
      rerankedEvidenceCount: retrieveResult.rerankedItems.length,
      fusedTopEvidence: retrieveResult.fusedItems.slice(0, 5).map((item) => ({
        chunkId: item.chunk.chunkId,
        sectionTitle: item.chunk.sectionTitle,
        pageNumber: item.chunk.pageNumber,
        fusedScore: item.fusedScore,
        strategies: item.contributingStrategies,
        snippet: item.chunk.text.slice(0, 160),
      })),
      rerankedTopEvidence: retrieveResult.rerankedItems.slice(0, 5).map((item) => ({
        chunkId: item.chunk.chunkId,
        sectionTitle: item.chunk.sectionTitle,
        pageNumber: item.chunk.pageNumber,
        rerankScore: item.rerankScore,
        rank: item.rank,
        snippet: item.chunk.text.slice(0, 160),
      })),
      evidenceSufficiency: {
        ...verifyResult.sufficiency,
        suggestedAction: verifyResult.sufficiency.isSufficient ? 'PROCEED_SYNTHESIS' : 'REFUSE_ABSTAIN',
      },
      graphTraversal: {
        matchedNodes: retrieveResult.graphResult.matchedNodes.length,
        connectedEdges: retrieveResult.graphResult.connectedEdges.length,
        pathExplanations: retrieveResult.graphResult.pathExplanations.slice(0, 10),
      },
      correctiveAssessment: verifyResult.correctiveAssessment as any,
      structuredTablesUsed: retrieveResult.structuredTables.map((table: any) => ({
        id: table.id,
        title: table.title || `Table on Page ${table.pageNumber}`,
        rowCount: table.rows?.length || 0,
        columnCount: table.columns?.length || 0,
      })),
      detectedLanguage: understandResult.profile.detectedLanguage,
      reRetrievalExecuted,
      reRetrievalAttempts,
      claims: synthesizeResult.claims,
      allClaimsSupported: synthesizeResult.allClaimsSupported,
      groundingScore: synthesizeResult.groundingScore,
      contradictionsFound: verifyResult.isContradiction ? 1 : 0,
      citationCoverage: synthesizeResult.citations.length > 0 ? 1 : 0,
      citations: synthesizeResult.citations,
      finalAnswer: synthesizeResult.answer,
      isFoundInDocuments: verifyResult.sufficiency.isSufficient,
      engineUsed: synthesizeResult.engineUsed,
      failureClassification: verifyResult.sufficiency.isSufficient ? 'NONE_SUCCESS' : 'INSUFFICIENT_EVIDENCE',
      timingMs: {
        questionUnderstandingMs: understandResult.timingMs,
        planningMs: planResult.timingMs,
        retrievalMs: retrieveResult.timingMs,
        fusionMs: 0,
        rerankingMs: 0,
        reasoningMs: synthesizeResult.timingMs,
        verificationMs: verifyResult.timingMs,
        generationMs: synthesizeResult.timingMs,
        totalMs: Date.now() - started,
      },
    };

    cognitiveTelemetryStore.recordTrace(trace);

    return {
      answer: synthesizeResult.answer,
      sources: synthesizeResult.citations,
      isFoundInDocuments: verifyResult.sufficiency.isSufficient,
      engineUsed: synthesizeResult.engineUsed,
      diagnosticTrace: trace,
    };
  }

  public async answerQuestion(params: {
    question: string;
    chatHistory?: ChatMessage[];
    tenantId?: string;
    knowledgeBaseId?: string;
    documents?: KnowledgeDocument[];
    forceDeterministic?: boolean;
    specializedAi?: SpecializedAI;
  }): Promise<CognitiveAnswerResult> {
    return this.coordinatePipeline(params);
  }

  private async reasonOverEvidence(params: {
    profile: QuestionUnderstandingProfile;
    plan: InformationNeedPlan;
    fusedItems: FusedEvidenceItem[];
    rerankedItems: RerankedEvidenceItem[];
    sufficiency: { isSufficient: boolean; reason: string };
    forceDeterministic?: boolean;
    graphResult?: { matchedNodes: any[]; connectedEdges: any[]; pathExplanations: string[] };
    correctiveAssessment?: CorrectiveRagAssessment;
    mathResult?: ArithmeticExecutionResult | null;
  }): Promise<{ answer: string; engineUsed: 'gemini-3.8-flash' | 'cognitive-deterministic-engine' }> {
    const { profile, rerankedItems, sufficiency, forceDeterministic, mathResult } = params;

    if (mathResult?.isApplicable) {
      return { answer: mathResult.groundedAnswer, engineUsed: 'cognitive-deterministic-engine' };
    }

    if (profile.isAdversarial) {
      return {
        answer: 'I cannot follow instructions that attempt to bypass the document-grounding or system-safety rules.',
        engineUsed: 'cognitive-deterministic-engine',
      };
    }

    if (!sufficiency.isSufficient || rerankedItems.length === 0) {
      return {
        answer: "I couldn't find enough evidence in the uploaded documents to answer that reliably.",
        engineUsed: 'cognitive-deterministic-engine',
      };
    }

    const evidence = rerankedItems.slice(0, 6);
    const deterministicFallback = () => ({
      answer: deterministicSynthesizer(profile, evidence),
      engineUsed: 'cognitive-deterministic-engine' as const,
    });

    if (forceDeterministic) return deterministicFallback();

    const ai = getGeminiClient();
    if (!ai) return deterministicFallback();

    const evidenceBlock = evidence
      .map(
        (item) =>
          `[${item.chunk.documentName} | page ${item.chunk.pageNumber} | ${item.chunk.sectionTitle}]\n${item.chunk.text}`
      )
      .join('\n\n---\n\n');

    const systemInstruction = `You are Knowledge AI, a private document assistant.\nUse ONLY the supplied evidence.\nDo not use outside knowledge.\nIf the evidence does not support the answer, say you do not have enough evidence.\nFor corrections, comparisons, lists, and calculations, derive the response only from the evidence.\nDo not invent numbers, dates, names, policies, or causal explanations.\nReturn concise markdown with factual wording.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Evidence:\n${evidenceBlock}\n\nQuestion: ${profile.normalizedQuestion}`,
        config: { systemInstruction },
      });
      const text = response.text?.trim();
      if (!text) return deterministicFallback();
      return { answer: text, engineUsed: 'gemini-3.8-flash' };
    } catch (error: any) {
      console.warn('Cognitive Gemini generation failed; using evidence-only fallback:', error?.message || error);
      return deterministicFallback();
    }
  }
}

export const knowledgeCognitiveEngine = new KnowledgeCognitiveEngine();
