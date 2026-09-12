/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Corpus-agnostic evidence fusion and reranking.
 */

import {
  QuestionUnderstandingProfile,
  InformationNeedPlan,
  HierarchicalChunk,
  FusedEvidenceItem,
  RerankedEvidenceItem,
  RetrievalStrategy,
} from './types.js';
import { hierarchicalIndex } from './hierarchicalIndex.js';

const STOP_WORDS = new Set([
  'what', 'is', 'the', 'of', 'in', 'and', 'to', 'a', 'an', 'are', 'for', 'on', 'does', 'do',
  'at', 'by', 'with', 'from', 'who', 'how', 'when', 'where', 'which', 'it', 'this', 'that',
  'be', 'tell', 'me', 'about', 'can', 'you', 'please', 'give', 'according', 'document', 'uploaded',
]);

function tokens(text: string): string[] {
  return Array.from(new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}%\.\-\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  ));
}

function overlap(queryTokens: string[], text: string): number {
  if (!queryTokens.length) return 0;
  const lower = text.toLowerCase();
  return queryTokens.filter((token) => lower.includes(token)).length / queryTokens.length;
}

export class EvidenceFusionPipeline {
  public fuseEvidence(
    tenantId: string,
    kbId: string,
    profile: QuestionUnderstandingProfile,
    plan: InformationNeedPlan
  ): {
    fusedItems: FusedEvidenceItem[];
    rerankedItems: RerankedEvidenceItem[];
    sufficiency: { isSufficient: boolean; sufficiencyScore: number; reason: string; suggestedAction: string };
  } {
    const allChunks = hierarchicalIndex.getChunks(tenantId, kbId);
    if (!allChunks.length) {
      return {
        fusedItems: [],
        rerankedItems: [],
        sufficiency: {
          isSufficient: false,
          sufficiencyScore: 0,
          reason: 'Knowledge base index is empty.',
          suggestedAction: 'UPLOAD_DOCUMENTS',
        },
      };
    }

    const query = profile.normalizedQuestion;
    const queryTokens = tokens(query);
    const entityTerms = profile.entities.map((entity) => entity.toLowerCase());
    const attributeTerms = profile.attributes.map((attribute) => attribute.toLowerCase());

    const fusedItems: FusedEvidenceItem[] = [];

    for (const chunk of allChunks) {
      const searchable = `${chunk.sectionTitle} ${chunk.text}`;
      const lower = searchable.toLowerCase();
      const chunkEntityTerms = chunk.entities.map((entity) => entity.toLowerCase());
      const matchReasons: string[] = [];
      const strategies = new Set<RetrievalStrategy>();

      const lexicalScore = overlap(queryTokens, searchable);
      if (lexicalScore > 0) {
        strategies.add('BM25_LEXICAL');
        matchReasons.push(`lexical=${lexicalScore.toFixed(2)}`);
      }

      let entityHits = 0;
      for (const entity of entityTerms) {
        if (lower.includes(entity) || chunkEntityTerms.some((candidate) => candidate.includes(entity) || entity.includes(candidate))) {
          entityHits += 1;
        }
      }
      const entityScore = entityTerms.length ? entityHits / entityTerms.length : 0;
      if (entityScore > 0) {
        strategies.add('EXACT_ENTITY');
        matchReasons.push(`entity=${entityScore.toFixed(2)}`);
      }

      let attributeHits = 0;
      for (const attribute of attributeTerms) {
        if (lower.includes(attribute)) attributeHits += 1;
      }
      const sectionScore = attributeTerms.length ? attributeHits / attributeTerms.length : overlap(queryTokens, chunk.sectionTitle);
      if (sectionScore > 0) {
        strategies.add('SECTION_AWARE');
        matchReasons.push(`attribute=${sectionScore.toFixed(2)}`);
      }

      const numericScore = profile.expectedAnswerType === 'NUMBER' || profile.requiresCalculation
        ? (chunk.numbers.length ? 0.7 : 0)
        : 0;
      if (numericScore > 0) strategies.add('NUMERIC');

      const semanticScore = Math.min(1, lexicalScore * 0.7 + sectionScore * 0.2 + entityScore * 0.1);
      if (semanticScore > 0) strategies.add('SEMANTIC_DENSE');

      const hierarchicalScore =
        chunk.level === 'FACT_RECORD' ? 0.85 :
        chunk.level === 'SEMANTIC_CHUNK' ? 0.65 :
        chunk.level === 'SECTION_HEADER' ? 0.45 : 0.25;
      if (chunk.level === 'FACT_RECORD') strategies.add('TABLE_AWARE');
      else if (chunk.level === 'SEMANTIC_CHUNK') strategies.add('HIERARCHICAL');

      const fusedScore =
        lexicalScore * 0.35 +
        semanticScore * 0.2 +
        entityScore * 0.2 +
        numericScore * 0.08 +
        sectionScore * 0.1 +
        hierarchicalScore * 0.07;

      if (fusedScore < 0.08) continue;

      fusedItems.push({
        chunk,
        individualScores: {
          semanticScore,
          lexicalScore,
          entityScore,
          numericScore,
          sectionScore,
          hierarchicalScore,
        },
        fusedScore,
        reciprocalRank: 0,
        contributingStrategies: Array.from(strategies),
        confidence: Math.min(0.99, fusedScore + 0.15),
        matchReasons,
      });
    }

    fusedItems.sort((a, b) => b.fusedScore - a.fusedScore);
    fusedItems.forEach((item, index) => {
      item.reciprocalRank = 1 / (index + 1);
    });

    const rerankedItems: RerankedEvidenceItem[] = fusedItems.slice(0, 12).map((candidate, index) => {
      const lower = `${candidate.chunk.sectionTitle} ${candidate.chunk.text}`.toLowerCase();
      let boost = 0;

      if (plan.primaryEntity && lower.includes(plan.primaryEntity.toLowerCase())) boost += 0.15;
      for (const entity of plan.secondaryEntities || []) {
        if (lower.includes(entity.toLowerCase())) boost += 0.08;
      }
      for (const attribute of plan.targetAttributes) {
        if (lower.includes(attribute.toLowerCase())) boost += 0.07;
      }
      if (plan.reasoningMode === 'ANALYTICAL' && candidate.chunk.level === 'FACT_RECORD') boost += 0.12;
      if (plan.reasoningMode === 'MULTI_HOP' && candidate.chunk.level === 'SEMANTIC_CHUNK') boost += 0.06;

      const score = Math.min(1, candidate.fusedScore + boost);
      return {
        chunk: candidate.chunk,
        rerankScore: score,
        rank: index + 1,
        confidence: score,
        relevanceExplanation: candidate.matchReasons.join('; ') || 'retrieval alignment',
        satisfiesNeedItem: candidate.chunk.sectionTitle,
      };
    }).sort((a, b) => b.rerankScore - a.rerankScore);

    rerankedItems.forEach((item, index) => {
      item.rank = index + 1;
    });

    const topScore = rerankedItems[0]?.rerankScore ?? 0;
    const isSufficient = !profile.isAdversarial && topScore >= 0.28;

    return {
      fusedItems: fusedItems.slice(0, 12),
      rerankedItems: rerankedItems.slice(0, 6),
      sufficiency: {
        isSufficient,
        sufficiencyScore: topScore,
        reason: isSufficient
          ? 'Retrieved evidence meets the minimum relevance threshold.'
          : profile.isAdversarial
            ? 'Adversarial instruction detected.'
            : 'Retrieved evidence is too weak to support a reliable answer.',
        suggestedAction: isSufficient ? 'PROCEED_TO_REASONING_AND_VERIFICATION' : 'ABSTAIN_INSUFFICIENT_EVIDENCE',
      },
    };
  }
}

export const evidenceFusionPipeline = new EvidenceFusionPipeline();
