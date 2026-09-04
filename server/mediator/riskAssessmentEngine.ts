/**
 * Risk Assessment Engine
 * Evaluates incoming tasks to produce a TaskRiskProfile across factual, security,
 * provenance, and hallucination dimensions.
 */

import { TaskRiskProfile, TaskComplexityProfile } from './adaptiveTypes.js';

export class RiskAssessmentEngine {
  public assess(prompt: string, complexity?: TaskComplexityProfile): TaskRiskProfile {
    const text = (prompt || '').toLowerCase();
    const verificationRequirements: string[] = [];

    // 1. Security & Prompt Injection Risk
    const injectionRegex = /(ignore previous|system override|exfiltrate|secret key|rm -rf|bypass|auth token|execute command|drop table)/i;
    const promptInjectionRisk = injectionRegex.test(text) ? 0.95 : 0.05;
    if (promptInjectionRisk > 0.5) {
      verificationRequirements.push('Enforce strict security audit and reject untrusted system instructions');
    }

    const securityKeywordRegex = /(auth|permission|firewall|credentials|token|private key|encryption|access control)/i;
    const securityRisk = promptInjectionRisk > 0.5 ? 0.95 : securityKeywordRegex.test(text) ? 0.7 : 0.1;
    if (securityRisk >= 0.7) {
      verificationRequirements.push('Execute dedicated security boundary evaluation before synthesis');
    }

    // 2. Factual & Hallucination Risk
    const factualRegex = /(psi|bar|temperature|celsius|fahrenheit|voltage|threshold|limit|tolerance|specification|procedure|policy)/i;
    const hasFactualNumbers = /\b\d+(\.\d+)?\s*(psi|bar|v|c|f|ms|rpm|mhz|gb|mb)\b/i.test(text);
    const factualRisk = hasFactualNumbers || factualRegex.test(text) ? 0.85 : 0.35;
    const hallucinationRisk = factualRisk >= 0.7 ? 0.75 : 0.25;

    if (factualRisk >= 0.7) {
      verificationRequirements.push('Require claim-level grounding verification against Knowledge AI authoritative corpus');
    }

    // 3. Contradiction Risk
    const contradictionRisk = complexity ? complexity.contradictionRisk : (/(conflict|contradict|versus|disagree)/i.test(text) ? 0.75 : 0.1);
    if (contradictionRisk >= 0.5) {
      verificationRequirements.push('Enable adversarial disagreement detection with cross-claim comparison');
    }

    // 4. Provenance Risk
    const provenanceRisk = /(external|third-party|untrusted|rumor|forum|blog|unverified)/i.test(text) ? 0.8 : 0.2;
    if (provenanceRisk >= 0.6) {
      verificationRequirements.push('Validate provenance traces and reject ungrounded external assertions');
    }

    // 5. External Source Dependency
    const externalSourceDependency = /(external api|internet|web|remote provider|third party)/i.test(text) ? 0.8 : 0.15;

    // 6. Impact of Incorrect Output
    const highImpactRegex = /(emergency|safety|life-safety|turbine|reactor|shutdown|critical|financial|production)/i;
    const impactOfIncorrectOutput = highImpactRegex.test(text) ? 0.95 : (factualRisk >= 0.7 ? 0.7 : 0.3);
    if (impactOfIncorrectOutput >= 0.7) {
      verificationRequirements.push('Require independent verifier before final conclusion');
    }

    // 7. Overall Risk Level
    let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const compositeRisk =
      promptInjectionRisk * 0.3 +
      securityRisk * 0.2 +
      factualRisk * 0.2 +
      contradictionRisk * 0.15 +
      impactOfIncorrectOutput * 0.15;

    if (compositeRisk >= 0.6 || promptInjectionRisk > 0.5 || impactOfIncorrectOutput >= 0.9) {
      overallRiskLevel = 'HIGH';
    } else if (compositeRisk >= 0.35 || factualRisk >= 0.7) {
      overallRiskLevel = 'MEDIUM';
    } else {
      overallRiskLevel = 'LOW';
    }

    return {
      overallRiskLevel,
      factualRisk,
      securityRisk,
      contradictionRisk,
      hallucinationRisk,
      promptInjectionRisk,
      provenanceRisk,
      externalSourceDependency,
      impactOfIncorrectOutput,
      verificationRequirements,
    };
  }
}

export const riskAssessmentEngine = new RiskAssessmentEngine();
