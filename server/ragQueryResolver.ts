/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Corpus-agnostic conversational query resolution.
 * Resolves follow-up pronouns from recent conversation context without
 * injecting domain-specific entities or treating prior assistant text as evidence.
 */

import { ChatMessage } from '../src/types.js';

export type RagQueryType = 'DIRECT_QUERY' | 'FOLLOW_UP_QUERY' | 'CONTEXT_DEPENDENT_QUERY' | 'CORRECTION_QUERY' | 'AMBIGUOUS_QUERY';

export interface QueryResolutionResult {
  originalQuestion: string;
  contextualizedQuery: string;
  queryType: RagQueryType;
  resolvedEntities: string[];
  isFollowUp: boolean;
  resolutionExplanation: string;
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  const codes = text.match(/\b[A-Z]{2,}[A-Z0-9\-]*\d+[A-Z0-9\-]*\b/g) || [];
  codes.forEach((value) => entities.add(value));

  const properRuns = text.match(/\b(?:[A-Z][A-Za-z0-9&'\-]*)(?:\s+[A-Z][A-Za-z0-9&'\-]*){0,4}\b/g) || [];
  for (const value of properRuns) {
    const cleaned = value.trim();
    if (cleaned.length >= 3 && !/^(What|When|Where|Which|Who|Why|How|Tell|Compare|Does|Do|Is|Are|Can|Could|Would|Please)$/i.test(cleaned)) {
      entities.add(cleaned);
    }
  }
  return Array.from(entities).slice(0, 20);
}

function recentUserContext(history: ChatMessage[], currentQuestion: string): string[] {
  return history
    .filter((message) => message.role === 'user')
    .map((message) => (message.content || '').trim())
    .filter((text) => text && text !== currentQuestion)
    .slice(-6);
}

function chooseAntecedent(history: ChatMessage[], currentQuestion: string): string | undefined {
  const userTurns = recentUserContext(history, currentQuestion).reverse();
  for (const turn of userTurns) {
    const entities = extractEntities(turn);
    if (entities.length > 0) return entities[0];

    const nounPhraseMatch = turn.match(/(?:about|for|of|is|are|does|do)\s+(?:the\s+)?([a-z0-9][a-z0-9\-]*(?:\s+[a-z0-9][a-z0-9\-]*){0,4})(?:[?.!,]|$)/i);
    if (nounPhraseMatch) {
      const phrase = nounPhraseMatch[1].trim();
      if (phrase.length >= 3) return phrase;
    }
  }
  return undefined;
}

export function resolveConversationalQuery(
  question: string,
  chatHistory: ChatMessage[] = []
): QueryResolutionResult {
  const trimmed = question.trim();
  const lower = trimmed.toLowerCase();
  const antecedent = chooseAntecedent(chatHistory, trimmed);

  const correctionIntent = [
    'actually report',
    'actually state',
    'is that previous answer correct',
    'verify that from the document',
    'check that against the document',
    'what does the document actually say',
  ].some((phrase) => lower.includes(phrase));

  if (correctionIntent) {
    const rewritten = antecedent
      ? `What do the uploaded documents state about ${antecedent}?`
      : trimmed;
    return {
      originalQuestion: trimmed,
      contextualizedQuery: rewritten,
      queryType: 'CORRECTION_QUERY',
      resolvedEntities: antecedent ? [antecedent] : [],
      isFollowUp: true,
      resolutionExplanation: antecedent
        ? `Re-grounded the correction query on the recent user-mentioned entity: ${antecedent}.`
        : 'Detected a correction/verification query and preserved it for fresh retrieval.',
    };
  }

  const hasPronoun = /\b(it|its|they|them|their|those|these|that one|this one|that item|this item|that product|this product|that policy|this policy|that office|this office)\b/i.test(trimmed);
  if (hasPronoun && antecedent) {
    const possessive = `${antecedent}'s`;
    const rewritten = trimmed
      .replace(/\b(its|their)\b/gi, possessive)
      .replace(/\b(it|them|they|those|these|that one|this one|that item|this item|that product|this product|that policy|this policy|that office|this office)\b/gi, antecedent);

    return {
      originalQuestion: trimmed,
      contextualizedQuery: rewritten,
      queryType: 'FOLLOW_UP_QUERY',
      resolvedEntities: [antecedent],
      isFollowUp: true,
      resolutionExplanation: `Resolved conversational pronoun to recent user-mentioned entity: ${antecedent}.`,
    };
  }

  const elliptical = /^(and |what about |how about |what is the |what are the |how many |where is |when is |who is )/i.test(trimmed);
  if (elliptical && antecedent && recentUserContext(chatHistory, trimmed).length > 0) {
    const alreadyMentionsAntecedent = lower.includes(antecedent.toLowerCase());
    const rewritten = alreadyMentionsAntecedent ? trimmed : `${trimmed} for ${antecedent}`;
    return {
      originalQuestion: trimmed,
      contextualizedQuery: rewritten,
      queryType: 'CONTEXT_DEPENDENT_QUERY',
      resolvedEntities: [antecedent],
      isFollowUp: true,
      resolutionExplanation: `Expanded an elliptical follow-up using recent user context: ${antecedent}.`,
    };
  }

  const directEntities = extractEntities(trimmed);
  return {
    originalQuestion: trimmed,
    contextualizedQuery: trimmed,
    queryType: 'DIRECT_QUERY',
    resolvedEntities: directEntities,
    isFollowUp: false,
    resolutionExplanation: 'Direct standalone query; no conversational dependency detected.',
  };
}
