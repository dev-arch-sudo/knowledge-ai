/**
 * Adaptive Strategy Planner
 * Selects the optimal orchestration topology and initial agent team based on complexity and risk profiles.
 * Strict principle: Minimum sufficient intelligence. Do NOT maximize agent count when 1 agent is sufficient.
 */

import {
  AdaptivePlan,
  AdaptiveStrategy,
  AgentAssignmentPlan,
  OrchestrationMode,
  TaskComplexityProfile,
  TaskRiskProfile,
} from './adaptiveTypes.js';
import { AgentDefinition } from './types.js';

export class AdaptiveStrategyPlanner {
  public plan(
    taskPrompt: string,
    complexity: TaskComplexityProfile,
    risk: TaskRiskProfile,
    availableAgents: AgentDefinition[] = [],
    requestedMode: OrchestrationMode = 'ADAPTIVE'
  ): AdaptivePlan {
    const rationale: string[] = [];

    // 1. Determine Strategy
    let strategy: AdaptiveStrategy = 'SINGLE_AGENT';

    if (risk.overallRiskLevel === 'HIGH' || complexity.contradictionRisk >= 0.5 || complexity.adversarialRisk >= 0.5) {
      strategy = 'ESCALATED';
      rationale.push('Selected ESCALATED strategy due to elevated risk, contradiction, or adversarial indicators');
    } else if (complexity.dependencyCount >= 2 && complexity.domainCount <= 2) {
      strategy = 'SEQUENTIAL';
      rationale.push('Selected SEQUENTIAL strategy: task structure requires strict multi-stage dependency progression');
    } else if (complexity.domainCount >= 2 && complexity.dependencyCount >= 2) {
      strategy = 'HYBRID';
      rationale.push('Selected HYBRID strategy: multi-domain parallel execution followed by dependent aggregation');
    } else if (complexity.domainCount >= 2 && complexity.dependencyCount < 2) {
      strategy = 'PARALLEL';
      rationale.push('Selected PARALLEL strategy: task comprises independent domain dimensions');
    } else {
      strategy = 'SINGLE_AGENT';
      rationale.push('Selected SINGLE_AGENT strategy: task is focused, single-domain, and low-to-medium risk. Avoiding unnecessary agent overhead.');
    }

    // 2. Determine initial agent count
    let initialAgentCount = 1;
    if (strategy === 'SINGLE_AGENT') {
      initialAgentCount = 1;
    } else if (strategy === 'PARALLEL') {
      initialAgentCount = Math.min(4, Math.max(2, complexity.domainCount));
    } else if (strategy === 'SEQUENTIAL') {
      initialAgentCount = Math.min(3, Math.max(2, complexity.dependencyCount + 1));
    } else if (strategy === 'HYBRID') {
      initialAgentCount = Math.min(4, Math.max(3, complexity.domainCount + 1));
    } else if (strategy === 'ESCALATED') {
      initialAgentCount = 2; // Start with 2 diverse agents, escalating to verifier if needed
    }

    // 3. Select Diverse Agents
    const selectedAgents: AgentAssignmentPlan[] = [];

    // Helper to find or synthesize agent
    const assignAgent = (role: string, capability: string, domain: string, idPrefix: string) => {
      const existing = availableAgents.find((a) => a.role?.toLowerCase().includes(domain.toLowerCase()));
      const agentId = existing ? existing.id : `${idPrefix}-${domain}`;
      selectedAgents.push({
        agentId,
        role,
        capability,
        domain,
      });
    };

    if (strategy === 'SINGLE_AGENT') {
      assignAgent('Primary Analyst', 'General Task Execution', 'general', 'agent');
    } else {
      // Allocate diverse specialists based on detected domains
      if (/security|threat|auth/i.test(taskPrompt) || risk.securityRisk > 0.4) {
        assignAgent('Security Specialist', 'Vulnerability & Policy Audit', 'security', 'agent-sec');
      }
      if (/database|sql|storage/i.test(taskPrompt)) {
        assignAgent('Database Architect', 'Data Integrity & Query Analysis', 'database', 'agent-db');
      }
      if (/scaling|throughput|concurrency|latency/i.test(taskPrompt)) {
        assignAgent('Scalability Specialist', 'Distributed Systems & Concurrency', 'scalability', 'agent-scale');
      }
      if (/telemetry|psi|turbine|temperature/i.test(taskPrompt)) {
        assignAgent('Telemetry Diagnostics Specialist', 'Telemetry & Sensor Physics', 'telemetry', 'agent-telemetry');
      }

      // Ensure we meet initial count with general or verifier agents
      while (selectedAgents.length < initialAgentCount) {
        const idx = selectedAgents.length + 1;
        assignAgent(`Specialist ${idx}`, 'Domain Analysis', `domain_${idx}`, `agent-${idx}`);
      }
    }

    // 4. Budget Bounds
    const budgetLimits = {
      minAgents: 1,
      maxAgents: Math.max(initialAgentCount + 2, 5),
      maxEscalationRounds: 3,
      maxTotalAgentCalls: 10,
      maxExecutionTimeMs: 15000,
      maxEstimatedCostUnits: 120,
      maxDelegationDepth: 3,
    };

    return {
      taskPrompt,
      orchestrationMode: requestedMode,
      strategy,
      complexity,
      risk,
      initialAgentCount: selectedAgents.length,
      selectedAgents,
      budgetLimits,
      rationale,
    };
  }
}

export const adaptiveStrategyPlanner = new AdaptiveStrategyPlanner();
