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

/**
 * Prove a derived numeric value from values present in ONE relevant evidence chunk.
 * Keeping derivation local prevents accidental support from unrelated numbers spread
 * across different documents/chunks.
 */
function canDeriveFromLocalEvidence(target: number, evidenceValues: number[]): boolean {
  const unique = Array.from(new Set(evidenceValues));
  if (unique.some((value) => approximatelyEqual(value, target))) return true;

  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const a = unique[i];
      const b = unique[j];
      if (approximatelyEqual(a + b, target)) return true;
      if (approximatelyEqual(Math.abs(a - b), Math.abs(target))) return true;
      if (b !== 0 && approximatelyEqual(a / b, target)) return true;
      if (a !== 0 && approximatelyEqual(b / a, target)) return true;
    }
  }

  // For positive totals, perform a bounded subset-sum over plausible operands in
  // the same chunk. Values much larger than the requested total (for example,
  // years embedded in table dates) cannot contribute to a normal positive sum.
  if (target > 0 && Number.isInteger(target)) {
    const candidates = unique
      .filter((value) => Number.isInteger(value) && value > 0 && value <= target)
      .slice(0, 24);

    const reachable = new Set<number>([0]);
    for (const value of candidates) {
      const additions: number[] = [];
      for (const sum of reachable) {
        const next = sum + value;
        if (next <= target) additions.push(next);
      }
      for (const next of additions) reachable.add(next);
      if (Array.from(reachable).some((sum) => approximatelyEqual(sum, target))) return true;
      if (reachable.size > 4096) break;
    }
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

function chunkOverlap(sentenceTokens: string[], chunk: HierarchicalChunk): number {
  if (!sentenceTokens.length) return 1;
  const chunkLower = chunk.text.toLowerCase();
  return sentenceTokens.filter((token) => chunkLower.includes(token)).length / sentenceTokens.length;
}

function numericProofChunks(
  sentenceNumbers: number[],
  sentenceTokens: string[],
  evidenceChunks: HierarchicalChunk[]
): HierarchicalChunk[] {
  if (sentenceNumbers.length === 0) return [];

  const ranked = evidenceChunks
    .map((chunk) => ({ chunk, overlap: chunkOverlap(sentenceTokens, chunk) }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5);

  return ranked
    .filter(({ chunk }) => {
      const localValues = numericValues(chunk.text);
      return sentenceNumbers.every((target) => canDeriveFromLocalEvidence(target, localValues));
    })
    .map((item) => item.chunk);
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
    let contradictionsFound = 0;

    for (let index = 0; index < sentences.length; index++) {
      const sentence = sentences[index];
      const sentenceTokens = tokens(sentence);
      const sentenceNumbers = numericValues(sentence);
      let bestChunk: HierarchicalChunk | undefined;
      let bestOverlap = 0;

      for (const chunk of evidenceChunks) {
        const overlap = chunkOverlap(sentenceTokens, chunk);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestChunk = chunk;
        }
      }

      const proofChunks = numericProofChunks(sentenceNumbers, sentenceTokens, evidenceChunks);
      const numbersSupported = sentenceNumbers.length === 0 || proofChunks.length > 0;
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

      const lexicalSupporting = evidenceChunks
        .filter((chunk) => sentenceTokens.some((token) => chunk.text.toLowerCase().includes(token)));
      const combinedSupporting = Array.from(new Map(
        [...proofChunks, ...lexicalSupporting]
          .map((chunk) => [chunk.chunkId, chunk] as const)
      ).values()).slice(0, 3);

      const supportingChunkIds = supported && !refusal
        ? combinedSupporting.map((chunk) => chunk.chunkId)
        : [];

      if (supported && !refusal) {
        const supporting = combinedSupporting.length ? combinedSupporting : (bestChunk ? [bestChunk] : []);
        for (const chunk of supporting) {
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
          : supported && sentenceNumbers.length > 0 && proofChunks.length > 0
            ? 'Supported by retrieved document evidence; derived numeric values are reproducible from operands in the same relevant evidence chunk.'
            : supported
              ? 'Supported by retrieved document evidence.'
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
