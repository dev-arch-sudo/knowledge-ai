/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic corrective-RAG evaluator.
 */

import { QuestionUnderstandingProfile, RerankedEvidenceItem } from './types.js';

export type EvidenceGrade = 'CORRECT' | 'AMBIGUOUS' | 'INSUFFICIENT' | 'CONTRADICTORY';

export interface CorrectiveRagAssessment {
  grade: EvidenceGrade;
  confidenceScore: number;
  confidence?: number;
  gapAnalysis: string[];
  correctiveQueries: string[];
  contradictionResolution?: {
    conflictingStatements: string[];
    authoritativeResolution: string;
    reason: string;
  };
  reconciledFacts: string[];
}

const STOP_WORDS = new Set([
  'what', 'which', 'where', 'when', 'who', 'why', 'how', 'the', 'and', 'for', 'with', 'from',
  'this', 'that', 'there', 'does', 'are', 'was', 'were', 'into', 'about', 'tell', 'please',
]);

function terms(text: string): string[] {
  return Array.from(new Set(
    text.toLowerCase().replace(/[^a-z0-9%.-\s]/g, ' ').split(/\s+/)
      .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
  ));
}

function numbers(text: string): string[] {
  return text.match(/-?\b\d+(?:\.\d+)?\b/g) || [];
}

export class CorrectiveRagEngine {
  public assessEvidence(
    profile: QuestionUnderstandingProfile,
    evidenceItems: RerankedEvidenceItem[]
  ): CorrectiveRagAssessment {
    if (!evidenceItems.length) {
      return {
        grade: 'INSUFFICIENT',
        confidenceScore: 0,
        gapAnalysis: ['No matching evidence chunks were retrieved.'],
        correctiveQueries: [profile.normalizedQuestion],
        reconciledFacts: [],
      };
    }

    const evidenceText = evidenceItems.map((item) => item.chunk.text).join('\n').toLowerCase();
    const queryTerms = terms(profile.normalizedQuestion);
    const coveredTerms = queryTerms.filter((term) => evidenceText.includes(term));
    const coverage = queryTerms.length ? coveredTerms.length / queryTerms.length : 0;

    const missingEntities = profile.entities.filter(
      (entity) => !evidenceText.includes(entity.toLowerCase())
    );
    const missingAttributes = profile.attributes.filter(
      (attribute) => !evidenceText.includes(attribute.toLowerCase())
    );

    const correctiveQueries: string[] = [];
    for (const entity of missingEntities.slice(0, 3)) {
      correctiveQueries.push(`${entity} ${profile.attributes.join(' ')}`.trim());
    }
    if (!correctiveQueries.length && missingAttributes.length) {
      correctiveQueries.push(`${profile.entities.join(' ')} ${missingAttributes.join(' ')}`.trim());
    }

    if (profile.classification === 'CORRECTION' && profile.userCorrectionAssertion) {
      const asserted = profile.userCorrectionAssertion;
      const evidenceNumbers = new Set(numbers(evidenceText));
      if (!evidenceNumbers.has(asserted)) {
        return {
          grade: 'CONTRADICTORY',
          confidenceScore: 0.9,
          gapAnalysis: [`The user's asserted value (${asserted}) is not supported by the retrieved evidence.`],
          correctiveQueries: correctiveQueries.length ? correctiveQueries : [profile.normalizedQuestion],
          contradictionResolution: {
            conflictingStatements: [`User assertion includes ${asserted}`, 'Retrieved evidence does not substantiate that value.'],
            authoritativeResolution: 'Prefer values explicitly present in the retrieved document evidence.',
            reason: 'Uploaded document evidence is authoritative for grounded answering.',
          },
          reconciledFacts: [],
        };
      }
    }

    if (coverage < 0.2 && missingEntities.length > 0) {
      return {
        grade: 'INSUFFICIENT',
        confidenceScore: Math.max(0.1, coverage),
        gapAnalysis: [
          `Low query-term coverage (${coverage.toFixed(2)}).`,
          `Missing entities: ${missingEntities.join(', ')}`,
        ],
        correctiveQueries: correctiveQueries.length ? correctiveQueries : [profile.normalizedQuestion],
        reconciledFacts: [],
      };
    }

    if (missingEntities.length > 0 || missingAttributes.length > 0) {
      return {
        grade: 'AMBIGUOUS',
        confidenceScore: Math.max(0.45, coverage),
        gapAnalysis: [
          ...(missingEntities.length ? [`Missing explicit entity coverage: ${missingEntities.join(', ')}`] : []),
          ...(missingAttributes.length ? [`Missing attribute coverage: ${missingAttributes.join(', ')}`] : []),
        ],
        correctiveQueries,
        reconciledFacts: [],
      };
    }

    return {
      grade: 'CORRECT',
      confidenceScore: Math.min(0.98, 0.65 + coverage * 0.3),
      gapAnalysis: [],
      correctiveQueries: [],
      reconciledFacts: ['Retrieved evidence covers the primary entities and attributes required by the query.'],
    };
  }
}

export const correctiveRagEngine = new CorrectiveRagEngine();
