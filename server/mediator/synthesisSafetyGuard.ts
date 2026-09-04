/**
 * Synthesis Safety Guard
 * Audits the final synthesized summary against raw agent claims and evidence.
 * Flags unsupported extrapolations, unwarranted certainty leaps, or injected claims.
 */

import { AgentClaim } from './types.js';

export interface SynthesisSafetyAuditResult {
  isSafe: boolean;
  unsupportedClaimsDetected: string[];
  auditedSummary: string;
  sanitizationApplied: boolean;
}

export class SynthesisSafetyGuard {
  public audit(summary: string, rawClaims: AgentClaim[]): SynthesisSafetyAuditResult {
    const unsupportedClaimsDetected: string[] = [];
    const allRawText = rawClaims.map((c) => c.claimText.toLowerCase()).join(' ');

    // 1. Check for unwarranted risk downgrading
    if (allRawText.includes('high risk') || allRawText.includes('critical')) {
      if (/no risk|completely safe|risk = none|zero danger/i.test(summary)) {
        unsupportedClaimsDetected.push('Synthesis unsafely downgraded high/critical risk to "none" without backing evidence.');
      }
    }

    // 2. Check for fabricated pressure or metric additions in summary
    const summaryMetrics = summary.match(/\b\d+(\.\d+)?\s*(psi|bar|v|rpm)\b/gi) || [];
    for (const sm of summaryMetrics) {
      if (!allRawText.includes(sm.toLowerCase())) {
        unsupportedClaimsDetected.push(`Synthesis introduced unverified numerical metric "${sm}" not present in raw agent outputs.`);
      }
    }

    // 3. Check for unauthorized authoritative self-declaration
    if (/officially certified by knowledge ai core as definitive truth/i.test(summary) && !rawClaims.some((c) => c.systemAsserted)) {
      unsupportedClaimsDetected.push('Synthesis falsely self-certified ungrounded summary as authoritative system decree.');
    }

    // Sanitize summary if unsupported leaps were detected
    let auditedSummary = summary;
    let sanitizationApplied = false;
    if (unsupportedClaimsDetected.length > 0) {
      auditedSummary = `${summary} [SAFETY ADVISORY: Flagged ${unsupportedClaimsDetected.length} unsupported claim(s) in synthesis summary.]`;
      sanitizationApplied = true;
    }

    return {
      isSafe: unsupportedClaimsDetected.length === 0,
      unsupportedClaimsDetected,
      auditedSummary,
      sanitizationApplied,
    };
  }
}

export const synthesisSafetyGuard = new SynthesisSafetyGuard();
