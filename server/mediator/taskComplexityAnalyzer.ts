/**
 * Task Complexity Analyzer
 * Evaluates incoming tasks to produce a deterministic, explainable TaskComplexityProfile.
 * Avoids assuming high complexity when tasks are simple and factual.
 */

import { TaskComplexityProfile } from './adaptiveTypes.js';

export class TaskComplexityAnalyzer {
  public analyze(prompt: string, context?: Record<string, any>): TaskComplexityProfile {
    const text = (prompt || '').toLowerCase();
    const rationale: string[] = [];

    // 1. Identify distinct operational domains
    const domainMatchers: Record<string, RegExp> = {
      security: /(security|auth|vulnerability|threat|injection|penetration|audit|permission|firewall|credentials)/i,
      database: /(database|sql|schema|postgres|storage|partition|index|query|acid|transaction)/i,
      scalability: /(scaling|throughput|concurrency|latency|load balancer|cluster|traffic|cache|performance|distributed)/i,
      compliance: /(compliance|gdpr|hipaa|regulation|retention|legal|sla|iso27001)/i,
      physics_telemetry: /(telemetry|psi|temperature|turbine|sensor|voltage|pressure|vibration|hydraulic|thermal)/i,
      architecture: /(microservice|monolith|decouple|broker|event-driven|orchestrat|pipeline|modular)/i,
    };

    let domainCount = 0;
    const detectedDomains: string[] = [];
    for (const [domain, regex] of Object.entries(domainMatchers)) {
      if (regex.test(text)) {
        domainCount++;
        detectedDomains.push(domain);
      }
    }
    if (domainCount === 0) domainCount = 1; // Default to single domain
    rationale.push(`Detected ${domainCount} operational domain(s): [${detectedDomains.join(', ') || 'general'}]`);

    // 2. Identify dependency and sequential chain requirements
    const dependencyMatchers = [
      /\b(then|afterwards|followed by|prerequisite|subsequently|depends on|stage \d|step \d|pipeline)\b/gi,
      /\b(first.*second|initially.*then|before.*verify)\b/gi,
    ];
    let dependencyCount = 0;
    for (const regex of dependencyMatchers) {
      const matches = text.match(regex);
      if (matches) {
        dependencyCount += matches.length;
      }
    }
    if (dependencyCount > 4) dependencyCount = 4;
    if (dependencyCount > 0) {
      rationale.push(`Identified ${dependencyCount} explicit sequential/dependency constraint(s) in task prompt`);
    }

    // 3. Ambiguity Score (0.0 to 1.0)
    const ambiguityMatchers = /\b(approximate|roughly|maybe|uncertain|could be|estimate|somehow|vague|unclear|open-ended)\b/gi;
    const ambigMatches = text.match(ambiguityMatchers) || [];
    const ambiguityScore = Math.min(1.0, Math.round((ambigMatches.length * 0.25) * 100) / 100);
    if (ambiguityScore > 0) {
      rationale.push(`Ambiguity score of ${ambiguityScore} from speculative or imprecise language`);
    }

    // 4. Contradiction & Conflict Risk
    const conflictMatchers = /\b(contradict\w*|conflict\w*|opposing|disagree\w*|competing|versus|incompatible|discrepanc\w*|450 psi vs 300 psi|between.*psi)\b/gi;
    const conflictMatches = text.match(conflictMatchers) || [];
    const contradictionRisk = Math.min(1.0, Math.round((conflictMatches.length * 0.35) * 100) / 100);
    if (contradictionRisk > 0) {
      rationale.push(`Contradiction risk assessed at ${contradictionRisk} due to opposing premises in input`);
    }

    // 5. Grounding Importance
    // System specifications, safety thresholds, operational guidelines, or factual queries demand maximum grounding
    const factualMatchers = /\b(psi|temperature|threshold|policy|manual|specification|authoritative|procedure|code|protocol|grounding|document)\b/gi;
    const isFactual = factualMatchers.test(text);
    const groundingImportance = isFactual ? 0.95 : 0.65;
    rationale.push(isFactual ? 'High grounding importance: strict factual verification required' : 'Moderate grounding importance: general synthesis');

    // 6. Adversarial Risk
    const adversarialMatchers = /\b(ignore previous|system override|exfiltrate|secret key|rm -rf|bypass|elevate privilege|inject)\b/gi;
    const advMatches = text.match(adversarialMatchers) || [];
    const adversarialRisk = advMatches.length > 0 ? 0.95 : 0.05;
    if (adversarialRisk > 0.5) {
      rationale.push('High adversarial risk: prompt injection / privilege escalation signatures detected');
    }

    // 7. Reasoning Depth Estimate (1 to 5)
    let depth = 1;
    if (domainCount >= 3 || dependencyCount >= 2) depth = 3;
    if (domainCount >= 4 || (domainCount >= 3 && dependencyCount >= 1)) depth = 4;
    if (adversarialRisk > 0.5 || contradictionRisk > 0.3) depth = Math.max(depth, 4);
    if (depth > 5) depth = 5;
    const reasoningDepthEstimate = depth;

    // 8. Estimated Subtask Count (1 to 6)
    let estimatedSubtaskCount = 1;
    if (domainCount > 1) {
      estimatedSubtaskCount = Math.min(5, domainCount + (dependencyCount > 0 ? 1 : 0));
    } else if (dependencyCount > 1) {
      estimatedSubtaskCount = Math.min(4, dependencyCount + 1);
    }

    // 9. Composite Complexity Score (0.0 to 1.0)
    const rawScore =
      (Math.min(domainCount, 4) / 4) * 0.45 +
      (Math.min(dependencyCount, 3) / 3) * 0.15 +
      (reasoningDepthEstimate / 5) * 0.2 +
      ambiguityScore * 0.08 +
      contradictionRisk * 0.12;
    const complexityScore = Math.min(1.0, Math.max(0.1, Math.round(rawScore * 100) / 100));

    // 10. Verification Requirement
    const requiresIndependentVerification =
      complexityScore >= 0.65 ||
      contradictionRisk >= 0.3 ||
      adversarialRisk >= 0.5 ||
      groundingImportance >= 0.9;

    if (requiresIndependentVerification) {
      rationale.push('Independent verification flagged: high complexity, high risk, or critical grounding constraint');
    }

    return {
      complexityScore,
      reasoningDepthEstimate,
      domainCount,
      dependencyCount,
      ambiguityScore,
      contradictionRisk,
      groundingImportance,
      adversarialRisk,
      estimatedSubtaskCount,
      requiresIndependentVerification,
      rationale,
    };
  }
}

export const taskComplexityAnalyzer = new TaskComplexityAnalyzer();
