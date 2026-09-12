/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Corpus-agnostic information-need planner.
 */

import {
  QuestionUnderstandingProfile,
  InformationNeedPlan,
  ReasoningMode,
  RetrievalStrategy,
} from './types.js';

export function planInformationNeed(profile: QuestionUnderstandingProfile): InformationNeedPlan {
  const question = profile.normalizedQuestion;
  const lower = question.toLowerCase();

  let reasoningMode: ReasoningMode = 'DIRECT';
  if (profile.requiresCalculation || profile.classification === 'CALCULATION') {
    reasoningMode = 'ANALYTICAL';
  } else if (profile.classification === 'MULTI_HOP' || profile.requiresMultipleRetrievalPasses) {
    reasoningMode = 'MULTI_HOP';
  } else if (
    profile.classification === 'CROSS_SECTION' ||
    profile.classification === 'AGGREGATION' ||
    profile.classification === 'COMPARISON'
  ) {
    reasoningMode = 'SYNTHESIS';
  } else if (profile.classification === 'MULTI_CONSTRAINT') {
    reasoningMode = 'ANALYTICAL';
  }

  const strategies = new Set<RetrievalStrategy>(['BM25_LEXICAL', 'SEMANTIC_DENSE']);
  if (profile.entities.length > 0) strategies.add('EXACT_ENTITY');
  if (profile.expectedAnswerType === 'NUMBER' || profile.requiresCalculation) strategies.add('NUMERIC');
  if (profile.attributes.some((attribute) => ['capacity', 'limit', 'price', 'cost', 'count', 'total', 'percentage', 'date', 'duration'].includes(attribute))) {
    strategies.add('TABLE_AWARE');
  }
  if (reasoningMode === 'SYNTHESIS' || reasoningMode === 'MULTI_HOP' || reasoningMode === 'ANALYTICAL') {
    strategies.add('HIERARCHICAL');
    strategies.add('QUERY_EXPANSION');
  }

  const operations: InformationNeedPlan['plannedOperations'] = ['RETRIEVE', 'VERIFY'];
  if (profile.classification === 'COMPARISON' || profile.classification === 'MULTI_HOP') operations.unshift('COMPARE');
  if (profile.requiresCalculation) operations.unshift('CALCULATE');
  if (profile.classification === 'CROSS_SECTION' || profile.classification === 'AGGREGATION') operations.unshift('AGGREGATE');

  const subQueries = [question];
  if (profile.requiresMultipleRetrievalPasses && profile.entities.length > 1) {
    for (const entity of profile.entities.slice(0, 4)) {
      const attributeText = profile.attributes.length ? ` ${profile.attributes.join(' ')}` : '';
      subQueries.push(`${entity}${attributeText}`.trim());
    }
  }

  if (/\b(total|sum|combined|average|percentage|ratio|difference)\b/.test(lower) && profile.attributes.length > 0) {
    subQueries.push(`${profile.attributes.join(' ')} values needed for calculation`);
  }

  let deterministicCalculation: InformationNeedPlan['deterministicCalculation'] | undefined;
  if (profile.requiresCalculation) {
    const operation: NonNullable<InformationNeedPlan['deterministicCalculation']>['operation'] =
      /\b(percentage|percent)\b/.test(lower) ? 'PERCENTAGE' :
      /\b(ratio)\b/.test(lower) ? 'RATIO' :
      /\b(difference|how many more|how much more)\b/.test(lower) ? 'DIFFERENCE' :
      /\b(count)\b/.test(lower) ? 'COUNT' : 'SUM';

    deterministicCalculation = {
      operation,
      operands: profile.entities.slice(0, 4).map((entity) => ({ label: entity, entity })),
    };
  }

  return {
    primaryEntity: profile.entities[0],
    secondaryEntities: profile.entities.slice(1),
    targetAttributes: profile.attributes,
    subQueries,
    reasoningMode,
    selectedRetrievalStrategies: Array.from(strategies),
    plannedOperations: operations,
    deterministicCalculation,
    iterationLimit: profile.requiresMultipleRetrievalPasses ? 2 : 1,
  };
}
