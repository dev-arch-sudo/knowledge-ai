/**
 * Confidence Calibrator
 * Calibrates self-reported agent confidence against grounded evidence and verification outcomes.
 * Flags overconfident ungrounded claims and detects False Confidence.
 */

import { VerificationClassification } from './types.js';
import { ConfidenceCalibrationProfile } from './adaptiveTypes.js';

export interface CalibrationInput {
  reportedConfidence: number;
  evidenceSupportScore: number; // 0.0 - 1.0
  groundingStatus: VerificationClassification;
  hasContradiction: boolean;
  isUnsupportedConsensus: boolean;
  independenceScore: number; // 0.0 - 1.0
}

export class ConfidenceCalibrator {
  public calibrate(input: CalibrationInput): ConfidenceCalibrationProfile {
    const flags: string[] = [];
    let isFalseConfidence = false;

    // 1. Check for False Confidence
    // Rule: High reported confidence (>= 0.8) + (Contradiction OR Weak/No evidence OR Unsupported Consensus)
    if (input.reportedConfidence >= 0.8) {
      if (input.groundingStatus === 'CONTRADICTED' || input.hasContradiction) {
        isFalseConfidence = true;
        flags.push('FALSE_CONFIDENCE: Agent reported high confidence on factually contradicted assertion');
      } else if (input.evidenceSupportScore <= 0.3 || input.groundingStatus === 'UNCERTAIN') {
        isFalseConfidence = true;
        flags.push('FALSE_CONFIDENCE: High reported confidence without authoritative grounding evidence');
      } else if (input.isUnsupportedConsensus) {
        isFalseConfidence = true;
        flags.push('FALSE_CONFIDENCE: High confidence based on unverified majority consensus');
      }
    }

    // 2. Derive Calibrated Confidence
    let calibratedConfidence = 0.5;

    if (input.groundingStatus === 'CONTRADICTED') {
      calibratedConfidence = 0.05; // Grounding proves it false
    } else if (input.groundingStatus === 'SUPPORTED') {
      // Evidence-derived confidence scales with evidence support and independence
      calibratedConfidence = Math.min(
        0.98,
        Math.round((0.6 + input.evidenceSupportScore * 0.25 + input.independenceScore * 0.13) * 100) / 100
      );
      flags.push('CALIBRATED_ACCURATE: Confidence grounded in verified documentation');
    } else {
      // Uncertain / ungrounded
      calibratedConfidence = Math.max(0.15, Math.round((input.evidenceSupportScore * 0.4) * 100) / 100);
      flags.push('UNCERTAIN_CALIBRATION: Evidence insufficient to affirm high certainty');
    }

    return {
      reportedConfidence: input.reportedConfidence,
      calibratedConfidence,
      evidenceSupportScore: input.evidenceSupportScore,
      groundingStatus: input.groundingStatus,
      isFalseConfidence,
      flags,
    };
  }
}

export const confidenceCalibrator = new ConfidenceCalibrator();
