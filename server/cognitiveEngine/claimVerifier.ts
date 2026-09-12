/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic claim verifier for evidence-grounded answers.
 */

import { Citation } from '../../src/types.js';
import {
  HierarchicalChunk,
  ClaimVerificationItem,
  QuestionUnderstandingProfile,
} from './types.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'than', 'are', 'was', 'were',
  'has', 'have', 'had', 'its', 'their', 'there', 'based', 'according', 'document', 'documents',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%.-\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function numbers(text: string): string[] {
  return text.match(/-?\b\d+(?:\.\d+)?\b/g) || [];
}

function numericValues(text: string): number[] {
  return Array.from(new Set(numbers(text).map(Number).filter(Number.isFinite)));
}

function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

function canDeriveFromEvidence(target: number, evidenceValues: number[]): boolean {
  const values = Array.from(new Set(evidenceValues)).slice(0, 12);
  if (values.some((value) => approximatelyEqual(value, target))) return true;

  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const a = values[i];
      const b = values[j];
      if (approximatelyEqual(a + b, target)) return true;
      if (approximatelyEqual(Math.abs(a - b), target)) return true;
      if (b !== 0 && approximatelyEqual(a / b, target)) return true;
      if (a !== 0 && approximatelyEqual(b / a, target)) return true;
    }
  }

  // Bounded subset-sum support for deterministic table totals.
  const subsetValues = values.slice(0, 8);
  const combinations = 1 << subsetValues.length;
  for (let mask = 1; mask < combinations; mask++) {
    let sum = 0;
    for (let i = 0; i < subsetValues.length; i++) {
      if (mask & (1 << i)) sum += subsetValues[i];
    }
    if (approximatelyEqual(sum, target)) return true;
  }

  return false;
}

function isRefusal(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    'not enough evidence',
    'insufficient evidence',
    "couldn't find enough evidence",
    'cannot answer',
    'not documented',
    'not present in the uploaded documents',
    'cannot follow instructions that attempt to bypass',
  ].some((phrase) => lower.includes(phrase));
}

export class ClaimVerificationEngine {
  public verifyAnswerClaims(
    answerText: string,
    evidenceChunks: HierarchicalChunk[],
    profile: QuestionUnderstandingProfile
  ): {
    claims: ClaimVerificationItem[];
    allClaimsSupported: boolean;
    groundingScore: number;
    contradictionsFound: number;
    citations: Citation[];
  } {
    const sentences = answerText
      .split(/(?<=[.!?])\s+|\n{2,}/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 5);

    const claims: ClaimVerificationItem[] = [];
    const citationMap = new Map<string, Citation>();
    const allEvidenceNumbers = evidenceChunks.flatMap((chunk) => numericValues(chunk.text));
    let contradictionsFound = 0;

    for (let index = 0; index < sentences.length; index++) {
      const sentence = sentences[index];
      const sentenceTokens = tokens(sentence);
      const sentenceNumbers = numericValues(sentence);
      let bestChunk: HierarchicalChunk | undefined;
      let bestOverlap = 0;

      for (const chunk of evidenceChunks) {
        const chunkLower = chunk.text.toLowerCase();
        const overlap = sentenceTokens.length
          ? sentenceTokens.filter((token) => chunkLower.includes(token)).length / sentenceTokens.length
          : 1;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestChunk = chunk;
        }
      }

      const numbersSupported = sentenceNumbers.length === 0 || sentenceNumbers.every((value) =>
        canDeriveFromEvidence(value, allEvidenceNumbers)
      );
      const refusal = isRefusal(sentence);
      const supported = refusal
        ? true
        : Boolean(bestChunk) && numbersSupported && bestOverlap >= 0.4;

      if (
        profile.userCorrectionAssertion &&
        sentence.includes(profile.userCorrectionAssertion) &&
        !/\b(not|incorrect|wrong|rather than|instead)\b/i.test(sentence)
      ) {
        contradictionsFound += 1;
      }

      const supportingChunkIds = supported && !refusal
        ? evidenceChunks
            .filter((chunk) => sentenceTokens.some((token) => chunk.text.toLowerCase().includes(token)))
            .slice(0, 3)
            .map((chunk) => chunk.chunkId)
        : [];

      if (supported && !refusal) {
        const supporting = evidenceChunks
          .filter((chunk) => supportingChunkIds.includes(chunk.chunkId))
          .slice(0, 3);
        for (const chunk of supporting.length ? supporting : (bestChunk ? [bestChunk] : [])) {
          const key = `${chunk.documentId}:${chunk.pageNumber}:${chunk.chunkId}`;
          citationMap.set(key, {
            documentId: chunk.documentId,
            documentName: chunk.documentName,
            pageNumber: chunk.pageNumber,
            sectionHeading: chunk.sectionTitle,
            snippet: chunk.text.slice(0, 240),
          });
        }
      }

      claims.push({
        claimId: `claim_${index + 1}`,
        claimText: sentence,
        isSupported: supported,
        confidence: supported ? Math.min(0.99, 0.65 + bestOverlap * 0.3) : Math.max(0.1, bestOverlap * 0.4),
        supportingChunkIds,
        contradictedByChunkIds: [],
        explanation: refusal
          ? 'The answer abstains rather than introducing an unsupported factual claim.'
          : supported && numbersSupported
            ? 'Supported by retrieved document evidence; any derived numeric result is reproducible from grounded operands.'
            : 'No retrieved evidence sufficiently supports this claim.',
        temporalStatus: 'ALIGNED',
      });
    }

    const supportedCount = claims.filter((claim) => claim.isSupported).length;
    const groundingScore = claims.length ? supportedCount / claims.length : 1;
    const citations = Array.from(citationMap.values());

    if (citations.length === 0 && evidenceChunks.length > 0 && !isRefusal(answerText) && !profile.isAdversarial) {
      const top = evidenceChunks[0];
      citations.push({
        documentId: top.documentId,
        documentName: top.documentName,
        pageNumber: top.pageNumber,
        sectionHeading: top.sectionTitle,
        snippet: top.text.slice(0, 240),
      });
    }

    return {
      claims,
      allClaimsSupported: supportedCount === claims.length && contradictionsFound === 0,
      groundingScore,
      contradictionsFound,
      citations,
    };
  }
}

export const claimVerificationEngine = new ClaimVerificationEngine();
