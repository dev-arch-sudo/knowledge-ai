import { RerankedChunk } from './ragTypes.js';
import { verifyClaimsAgainstEvidence } from './ragPipeline.js';

export const DEFAULT_GROUNDING_REFUSAL =
  "I couldn't find enough supported evidence in the uploaded documents to answer that reliably.";

type ClaimCheck = ReturnType<typeof verifyClaimsAgainstEvidence>;

export interface GroundingGuardResult {
  answer: string;
  isFoundInDocuments: boolean;
  claimCheck: ClaimCheck;
  action: 'ACCEPT' | 'REPAIR' | 'REFUSE';
  originalUnsupportedClaims: string[];
}

export interface GroundingGuardInput {
  generatedAnswer: string;
  rerankedEvidence: RerankedChunk[];
  repairAnswer: () => string;
  refusalText?: string;
}

/**
 * Enforces the document-grounding boundary after generation.
 *
 * A provider answer is never returned as grounded merely because retrieval was
 * sufficient. The final answer itself must pass claim verification. If it does
 * not, we make one deterministic evidence-only repair attempt and verify again.
 * If the repair still contains unsupported claims, we abstain.
 */
export function enforceGroundingGuard(input: GroundingGuardInput): GroundingGuardResult {
  const {
    generatedAnswer,
    rerankedEvidence,
    repairAnswer,
    refusalText = DEFAULT_GROUNDING_REFUSAL,
  } = input;

  const initialCheck = verifyClaimsAgainstEvidence(generatedAnswer, rerankedEvidence);
  if (initialCheck.unsupportedClaims.length === 0) {
    return {
      answer: generatedAnswer,
      isFoundInDocuments: true,
      claimCheck: initialCheck,
      action: 'ACCEPT',
      originalUnsupportedClaims: [],
    };
  }

  const repairedAnswer = repairAnswer().trim();
  if (repairedAnswer) {
    const repairCheck = verifyClaimsAgainstEvidence(repairedAnswer, rerankedEvidence);
    if (repairCheck.unsupportedClaims.length === 0) {
      return {
        answer: repairedAnswer,
        isFoundInDocuments: true,
        claimCheck: repairCheck,
        action: 'REPAIR',
        originalUnsupportedClaims: initialCheck.unsupportedClaims,
      };
    }
  }

  return {
    answer: refusalText,
    isFoundInDocuments: false,
    claimCheck: {
      groundingScore: 1,
      verifications: [],
      unsupportedClaims: [],
    },
    action: 'REFUSE',
    originalUnsupportedClaims: initialCheck.unsupportedClaims,
  };
}
