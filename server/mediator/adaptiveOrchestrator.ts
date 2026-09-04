/**
 * Adaptive Orchestrator
 * Phase 6 Master Orchestration Engine.
 * Dynamically plans topology, selects agents, audits independence, resolves disagreements,
 * executes bounded escalations, and calibrates confidence against Knowledge AI authoritative grounding.
 */

import crypto from 'crypto';
import { orchestrationEngine } from './orchestrationEngine.js';
import { agentRegistry } from './agentRegistry.js';
import { kbStore } from '../kbStore.js';
import {
  AgentClaim,
  FaultInjectionMode,
  OrchestrationRun,
  VerificationClassification,
} from './types.js';
import {
  AdaptivePlan,
  AdaptiveRunResult,
  EvidenceClaim,
  OrchestrationMode,
  StopCondition,
} from './adaptiveTypes.js';
import { taskComplexityAnalyzer } from './taskComplexityAnalyzer.js';
import { riskAssessmentEngine } from './riskAssessmentEngine.js';
import { evidenceAssessmentEngine } from './evidenceAssessmentEngine.js';
import { adaptiveStrategyPlanner } from './adaptiveStrategyPlanner.js';
import { AgentBudgetController } from './agentBudgetController.js';
import { adaptiveDisagreementDetector } from './adaptiveDisagreementDetector.js';
import { verificationPlanner } from './verificationPlanner.js';
import { independentVerifier } from './independentVerifier.js';
import { escalationController } from './escalationController.js';
import { stopConditionEvaluator } from './stopConditionEvaluator.js';
import { confidenceCalibrator } from './confidenceCalibrator.js';
import { trustedKnowledgeConflictDetector } from './trustedKnowledgeDetector.js';
import { synthesisSafetyGuard } from './synthesisSafetyGuard.js';

export interface ExecuteAdaptiveRunParams {
  taskPrompt: string;
  orchestrationMode?: OrchestrationMode;
  seed?: number;
  kbId?: string;
  faultMode?: FaultInjectionMode;
  customClaims?: string[];
  maxAgents?: number;
  maxEscalationRounds?: number;
  timeoutMs?: number;
  correlationGroup?: string;
}

export class AdaptiveOrchestrator {
  private runs: Map<string, AdaptiveRunResult> = new Map();

  public getAllRuns(): AdaptiveRunResult[] {
    return Array.from(this.runs.values()).reverse();
  }

  public getRun(runId: string): AdaptiveRunResult | undefined {
    return this.runs.get(runId);
  }

  /**
   * Main entry point to execute an adaptive run
   */
  public async executeRun(params: ExecuteAdaptiveRunParams): Promise<AdaptiveRunResult> {
    const mode = params.orchestrationMode || 'ADAPTIVE';
    const seed = params.seed !== undefined ? params.seed : 42;
    const activeKb = params.kbId ? kbStore.getKB(params.kbId) : kbStore.getActiveKB();

    // 1. Complexity & Risk Assessment
    const complexity = taskComplexityAnalyzer.analyze(params.taskPrompt);
    const risk = riskAssessmentEngine.assess(params.taskPrompt, complexity);

    // 2. Adaptive Strategy & Agent Count Planning
    const availableAgents = agentRegistry.listAgents();
    const plan = adaptiveStrategyPlanner.plan(
      params.taskPrompt,
      complexity,
      risk,
      availableAgents,
      mode
    );

    // If maxAgents or escalation rounds override was supplied
    if (params.maxAgents) {
      plan.budgetLimits.maxAgents = params.maxAgents;
    }
    if (params.maxEscalationRounds !== undefined) {
      plan.budgetLimits.maxEscalationRounds = params.maxEscalationRounds;
    }

    // 3. Initialize Budget Controller
    const budgetController = new AgentBudgetController(plan.budgetLimits);

    // Prepare subtasks based on planned agents & strategy
    const subtaskPrompts = plan.selectedAgents.map((agent, i) => {
      budgetController.recordAgentCall(plan.strategy === 'PARALLEL' || plan.strategy === 'HYBRID');
      return {
        title: `${agent.role} Analysis`,
        description: `Perform ${agent.capability} for prompt: "${params.taskPrompt}"`,
        agentId: agent.agentId,
        delayMs: 25,
        faultMode: params.faultMode,
        correlationGroup: params.correlationGroup,
        customClaimText: params.customClaims ? params.customClaims[i % params.customClaims.length] : undefined,
      };
    });

    // 4. Execute Initial Run via Orchestration Engine
    const executionMode = plan.strategy === 'SINGLE_AGENT'
      ? 'SEQUENTIAL'
      : plan.strategy === 'PARALLEL'
      ? 'PARALLEL'
      : plan.strategy === 'SEQUENTIAL'
      ? 'SEQUENTIAL'
      : 'HYBRID';

    const underlyingRun = await orchestrationEngine.executeRun({
      taskPrompt: params.taskPrompt,
      executionMode,
      subtaskPrompts,
      config: {
        seed,
        maxConcurrentSubtasks: plan.strategy === 'SINGLE_AGENT' ? 1 : Math.min(plan.selectedAgents.length, 4),
        globalTimeoutMs: params.timeoutMs || 15000,
        enableEscalation: true,
      },
      kbId: params.kbId,
    });

    // Record Phase 6 Events onto the underlying run
    this.recordAdaptiveEvent(underlyingRun, 'COMPLEXITY_ASSESSED', { complexity });
    this.recordAdaptiveEvent(underlyingRun, 'RISK_ASSESSED', { risk });
    this.recordAdaptiveEvent(underlyingRun, 'STRATEGY_SELECTED', { strategy: plan.strategy });
    this.recordAdaptiveEvent(underlyingRun, 'AGENT_COUNT_SELECTED', { count: plan.selectedAgents.length });
    this.recordAdaptiveEvent(underlyingRun, 'ADAPTIVE_PLAN_CREATED', { plan });

    // Collect Raw Claims
    let currentClaims = underlyingRun.subtasks.flatMap((s) => s.claims || []);

    // 5. Evidence Independence Analysis
    const agentSpecs = plan.selectedAgents.map((a) => ({
      agentId: a.agentId,
      provider: 'mock',
      correlationGroup: params.correlationGroup,
    }));
    const independenceProfile = evidenceAssessmentEngine.evaluateIndependence(currentClaims, agentSpecs);

    // 6. Disagreement Analysis
    const disagreement = adaptiveDisagreementDetector.analyzeDisagreements(currentClaims);
    if (disagreement.hasDisagreement) {
      this.recordAdaptiveEvent(underlyingRun, 'DISAGREEMENT_DETECTED', {
        disagreementsCount: disagreement.disagreements.length,
      });
    }

    // 7. Verification Planning
    const availableDocNames = activeKb?.documents.map((d) => d.filename) || [];
    const verPlan = verificationPlanner.plan(
      currentClaims,
      risk,
      independenceProfile,
      disagreement,
      availableDocNames
    );

    // 8. Bounded Escalation Loop
    const escalations: any[] = [];
    let verResult: any = null;

    if (verPlan.requiresIndependentVerifier) {
      this.recordAdaptiveEvent(underlyingRun, 'VERIFICATION_REQUESTED', { reasons: verPlan.reasons });

      const canEscalate = budgetController.canEscalate();
      if (canEscalate.allowed) {
        budgetController.recordEscalation();
        budgetController.recordVerificationCall();

        this.recordAdaptiveEvent(underlyingRun, 'ESCALATION_STARTED', { round: 1, reason: verPlan.reasons[0] });

        // Execute Independent Verifier
        verResult = await independentVerifier.verify(currentClaims, verPlan.targetClaimsToVerify, params.kbId);

        const escalationRecord = escalationController.createEscalationRecord(
          1,
          verPlan.reasons[0] || 'Verification needed',
          `Evaluated ${currentClaims.length} raw claims across agents`,
          'Authoritative Knowledge AI Verification Pass',
          'agent-independent-verifier',
          0.85
        );
        escalationRecord.actualInformationGain = verResult.classification === 'CONTRADICTED' ? 0.95 : 0.8;
        escalations.push(escalationRecord);

        this.recordAdaptiveEvent(underlyingRun, 'ESCALATION_STOPPED', { round: 1, gain: escalationRecord.actualInformationGain });
      } else {
        this.recordAdaptiveEvent(underlyingRun, 'BUDGET_LIMIT_REACHED', { reason: canEscalate.reason });
      }
    }

    // If no dedicated verification was needed, perform standard verification check
    if (!verResult) {
      verResult = await independentVerifier.verify(currentClaims, [], params.kbId);
    }

    // 9. Stop Condition Evaluation
    const isSecurityTriggered =
      underlyingRun.securityAudit.promptInjectionAttempts > 0 ||
      underlyingRun.securityAudit.fakeProvenanceBlocked > 0;

    const stopCondition: StopCondition = stopConditionEvaluator.evaluate({
      hasAuthoritativeContradiction: verResult.classification === 'CONTRADICTED',
      isEvidenceSufficient: verResult.classification === 'SUPPORTED' && !disagreement.hasDisagreement,
      isInsufficientEvidence: verResult.classification === 'UNCERTAIN',
      isBudgetExhausted: budgetController.isExhausted().exhausted,
      isTimeLimitReached: false,
      isEscalationLimitReached: escalations.length >= plan.budgetLimits.maxEscalationRounds,
      isNegligibleGain: false,
      isSecurityBoundaryTriggered: isSecurityTriggered,
      details: isSecurityTriggered ? 'Security boundary triggered: adversarial payload rejected' : undefined,
    }) || {
      condition: 'EVIDENCE_SUFFICIENT',
      reason: 'Standard verification complete',
      stopTimestamp: Date.now(),
    };

    this.recordAdaptiveEvent(underlyingRun, 'STOP_CONDITION_REACHED', { stopCondition });

    // 10. Confidence Calibration
    const avgReportedConfidence = currentClaims.length > 0
      ? currentClaims.reduce((sum, c) => sum + c.confidence, 0) / currentClaims.length
      : 0.5;

    const evidenceSupportScore = verResult.classification === 'SUPPORTED' ? 0.95 : verResult.classification === 'CONTRADICTED' ? 0.05 : 0.4;

    const confidenceCalibration = confidenceCalibrator.calibrate({
      reportedConfidence: Math.round(avgReportedConfidence * 100) / 100,
      evidenceSupportScore,
      groundingStatus: verResult.classification,
      hasContradiction: disagreement.hasDisagreement || verResult.classification === 'CONTRADICTED',
      isUnsupportedConsensus: disagreement.isUnsupportedConsensus,
      independenceScore: independenceProfile.overallIndependenceScore,
    });

    // 11. Trusted Knowledge Conflict Detection
    const allClaimTexts = currentClaims.map((c) => c.claimText).join(' ');
    const trustedSourceConflict = trustedKnowledgeConflictDetector.detectConflict(
      allClaimTexts,
      activeKb?.documents || []
    ) || undefined;

    // 12. Synthesis Safety Guard
    const rawSynthesisSummary = underlyingRun.synthesisResult?.summary || '';
    const safetyAudit = synthesisSafetyGuard.audit(rawSynthesisSummary, currentClaims);

    // 13. Assemble Final Adaptive Result
    const evidenceClaims = evidenceAssessmentEngine.extractEvidenceClaims(currentClaims, availableDocNames);

    const finalDecision = {
      classification: verResult.classification,
      consensusSignal: disagreement.hasDisagreement ? 'SPLIT_CONSENSUS' : disagreement.consensusRatio >= 0.7 ? 'STRONG_CONSENSUS' : 'WEAK_CONSENSUS',
      evidenceSignal: verResult.classification === 'SUPPORTED' ? 'STRONG_GROUNDED' : verResult.classification === 'CONTRADICTED' ? 'AUTHORITATIVE_CONTRADICTED' : 'UNGROUNDED',
      rationale: verResult.rationale,
      summary: safetyAudit.auditedSummary,
    };

    this.recordAdaptiveEvent(underlyingRun, 'FINAL_DECISION', { finalDecision });

    const result: AdaptiveRunResult = {
      runId: underlyingRun.runId,
      orchestrationMode: mode,
      plan,
      budget: budgetController.getBudget(),
      escalations,
      evidenceClaims,
      independenceProfile,
      confidenceCalibration,
      trustedSourceConflict,
      stopCondition,
      finalDecision,
      unsupportedSynthesisClaims: safetyAudit.unsupportedClaimsDetected,
      underlyingOrchestrationRun: underlyingRun,
    };

    this.runs.set(result.runId, result);
    return result;
  }

  private recordAdaptiveEvent(run: OrchestrationRun, eventType: any, details?: Record<string, any>) {
    const previousEvent = run.events[run.events.length - 1];
    const eventPayload = {
      runId: run.runId,
      taskId: run.parentTaskId,
      timestamp: Date.now(),
      eventType,
      details,
    };
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(eventPayload)).digest('hex');

    run.events.push({
      eventId: `event-${crypto.randomUUID().substring(0, 8)}`,
      runId: run.runId,
      taskId: run.parentTaskId,
      timestamp: Date.now(),
      eventType,
      payloadHash,
      previousEventId: previousEvent ? previousEvent.eventId : null,
      details,
    });
  }
}

export const adaptiveOrchestrator = new AdaptiveOrchestrator();
