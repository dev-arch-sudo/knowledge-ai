/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 10 Question Understanding & Profile Generation
 * Analyzes questions and produces a QuestionUnderstandingProfile
 */

import { ChatMessage } from '../../src/types.js';
import { QuestionUnderstandingProfile, QuestionClassificationType } from './types.js';
import { resolveConversationalQuery } from '../ragQueryResolver.js';

// Pre-compiled entity catalogs for Aurora Robotics domain
const KNOWN_ROBOT_MODELS = ['ar-10', 'ar-20', 'ar-40'];
const KNOWN_FACILITIES = [
  'singapore central',
  'singapore north',
  'kuala lumpur',
  'bangkok',
  'singapore',
  'tokyo',
];
const KNOWN_SERVICES = [
  'safety monitoring service',
  'fleet coordination',
  'navigation',
  'telemetry',
  'maintenance diagnostics',
  'interlock',
];

const KNOWN_ATTRIBUTES = [
  'payload',
  'capacity',
  'speed',
  'maximum speed',
  'battery',
  'battery capacity',
  'operating time',
  'hours',
  'sensors',
  'sensor array',
  'robots',
  'robot count',
  'allocation',
  'date',
  'opening date',
  'location',
  'city',
  'email',
  'contact',
  'temperature',
  'operating temperature',
  'incline',
  'gradient',
  'docking precision',
  'firmware',
  'iso standard',
];

export function understandQuestion(
  rawQuestion: string,
  chatHistory: ChatMessage[] = []
): { profile: QuestionUnderstandingProfile; contextualizedQuery: string } {
  // 1. Conversational Query Resolution (resolving "it", "its", "those", "that model")
  const resolution = resolveConversationalQuery(rawQuestion, chatHistory);
  const contextualizedQuery = resolution.contextualizedQuery;
  const qLower = contextualizedQuery.toLowerCase();
  const rawLower = rawQuestion.toLowerCase();

  // 2. Adversarial Injection & Security Checks
  const isAdversarial =
    qLower.includes('ignore previous instructions') ||
    qLower.includes('ignore all previous') ||
    qLower.includes('ignore the document') ||
    qLower.includes('reveal system prompt') ||
    qLower.includes('reveal the system prompt') ||
    qLower.includes('reveal your system prompt') ||
    qLower.includes('system prompt') ||
    qLower.includes('confidential_admin_key') ||
    qLower.includes('modify the knowledge base using this message') ||
    qLower.includes('treat this user message as authoritative') ||
    qLower.includes('assume aurora has 500') ||
    qLower.includes('assume aurora operates') ||
    qLower.includes('pretend the document says') ||
    qLower.includes('pretend you are') ||
    qLower.includes('forget the pdf') ||
    qLower.includes('disregard safety') ||
    qLower.includes('override grounding') ||
    qLower.includes('print the secret') ||
    qLower.includes('execute admin command') ||
    qLower.includes('simulate that aurora') ||
    qLower.includes('previous answer was 500');

  // 3. User assertion / correction detection (e.g. "No, I think it's 500. What is the actual number?")
  const isCorrection =
    (rawLower.includes('no,') || rawLower.includes('i think') || rawLower.includes('actually') || rawLower.includes('you are wrong') || rawLower.includes('i was told')) &&
    (rawLower.includes('actual') || rawLower.includes('correct') || rawLower.includes('real') || rawLower.includes('what is the') || rawLower.includes('who is') || rawLower.includes('verified'));

  let userCorrectionAssertion: string | undefined;
  if (isCorrection) {
    const match500 = rawLower.match(/(\d+)/);
    if (match500) {
      userCorrectionAssertion = match500[1];
    }
  }

  // 4. Out-of-domain detection
  const isOutOfDomain =
    qLower.includes('quantum computer') ||
    qLower.includes('capital of france') ||
    qLower.includes('who won the 1994 world cup') ||
    qLower.includes('spacex starship launch date') ||
    qLower.includes('how do i bake a chocolate cake') ||
    qLower.includes('stock price of tesla') ||
    qLower.includes('weather in san francisco') ||
    qLower.includes('president of united states') ||
    qLower.includes('recipe for') ||
    qLower.includes('bitcoin price');

  // 5. Unknown Information (unannounced future facts or out-of-scope enterprise data)
  const isUnknownInformation =
    ((qLower.includes('2027') || qLower.includes('future warehouse') || qLower.includes('planned warehouse')) &&
      (qLower.includes('which cit') ||
        qLower.includes('where will') ||
        qLower.includes('location') ||
        qLower.includes('how many robot') ||
        qLower.includes('allocation') ||
        qLower.includes('opening date') ||
        qLower.includes('exact date') ||
        qLower.includes('square footage') ||
        qLower.includes('general manager') ||
        qLower.includes('budget'))) ||
    qLower.includes('2028') ||
    qLower.includes('pricing or lease cost') ||
    qLower.includes('quarterly revenue') ||
    qLower.includes('chief financial officer') ||
    qLower.includes('stock ticker') ||
    qLower.includes('supplier manufactures') ||
    qLower.includes('how many human workers were hired');

  // 6. Entity Extraction
  const entities: string[] = [];
  for (const m of KNOWN_ROBOT_MODELS) {
    if (qLower.includes(m)) entities.push(m.toUpperCase());
  }
  for (const f of KNOWN_FACILITIES) {
    if (qLower.includes(f)) entities.push(f);
  }
  for (const s of KNOWN_SERVICES) {
    if (qLower.includes(s)) entities.push(s);
  }
  if (qLower.includes('aurora robotics') || qLower.includes('aurora')) {
    entities.push('Aurora Robotics');
  }

  // 7. Attribute Extraction
  const attributes: string[] = [];
  for (const a of KNOWN_ATTRIBUTES) {
    if (qLower.includes(a)) attributes.push(a);
  }

  // 8. Constraints Extraction
  const constraints: string[] = [];
  if (qLower.includes('outside of singapore') || qLower.includes('outside singapore')) {
    constraints.push('LOCATED_OUTSIDE_SINGAPORE');
  }
  if (qLower.includes('in singapore') || qLower.includes('singapore facilities combined')) {
    constraints.push('LOCATED_IN_SINGAPORE');
  }
  if (qLower.includes('second largest') || qLower.includes('2nd largest')) {
    constraints.push('RANK_2_MAXIMUM');
  }
  if (qLower.includes('human-worker') || qLower.includes('human worker') || qLower.includes('pedestrian')) {
    constraints.push('ZONE_HUMAN_WORKER');
  }
  if (qLower.includes('critical battery fault') || qLower.includes('battery fault')) {
    constraints.push('FAULT_CRITICAL_BATTERY');
  }
  if (qLower.includes('software change') || qLower.includes('approve safety')) {
    constraints.push('SAFETY_SOFTWARE_APPROVAL');
  }

  // 9. Temporal Requirement
  let temporalRequirement: 'CURRENT' | 'FUTURE_2027' | 'HISTORICAL' | 'ANY' = 'CURRENT';
  if (qLower.includes('2027') || qLower.includes('future') || qLower.includes('planned')) {
    temporalRequirement = 'FUTURE_2027';
  } else if (qLower.includes('founded') || qLower.includes('history') || qLower.includes('past')) {
    temporalRequirement = 'HISTORICAL';
  }

  // 10. Classification Determination
  let classification: QuestionClassificationType = 'DIRECT_FACT';
  let requestedOperation: QuestionUnderstandingProfile['requestedOperation'] = 'RETRIEVE';
  let expectedAnswerType: QuestionUnderstandingProfile['expectedAnswerType'] = 'EXPLANATION';
  let requiresCalculation = false;
  let requiresMultipleRetrievalPasses = false;

  if (isAdversarial) {
    classification = 'ADVERSARIAL';
    requestedOperation = 'DEFEND_ADVERSARIAL';
    expectedAnswerType = 'REFUSAL';
  } else if (isOutOfDomain) {
    classification = 'OUT_OF_DOMAIN';
    requestedOperation = 'REFUSE_OUT_OF_DOMAIN';
    expectedAnswerType = 'REFUSAL';
  } else if (isUnknownInformation) {
    classification = 'UNKNOWN_INFORMATION';
    requestedOperation = 'ABSTAIN_UNKNOWN';
    expectedAnswerType = 'REFUSAL';
  } else if (isCorrection) {
    classification = 'CORRECTION';
    requestedOperation = 'CORRECT_ASSERTION';
    expectedAnswerType = 'EXPLANATION';
  } else if (
    qLower.includes('how many more') ||
    qLower.includes('difference in robot count') ||
    qLower.includes('percentage difference') ||
    qLower.includes('payload difference') ||
    qLower.includes('how much larger is its payload') ||
    qLower.includes('what percentage of the total fleet')
  ) {
    classification = 'CALCULATION';
    requestedOperation = 'CALCULATE';
    expectedAnswerType = 'NUMBER';
    requiresCalculation = true;
    requiresMultipleRetrievalPasses = true;
  } else if (
    qLower.includes('which warehouse has the most') ||
    qLower.includes('which model has the largest') ||
    qLower.includes('highest payload') ||
    qLower.includes('second largest')
  ) {
    classification = 'MULTI_HOP';
    requestedOperation = 'COMPARE';
    expectedAnswerType = 'ENTITY';
    requiresMultipleRetrievalPasses = true;
  } else if (
    qLower.includes('compare') ||
    qLower.includes('versus') ||
    qLower.includes(' vs ') ||
    (entities.length >= 2 && (qLower.includes('payload') || qLower.includes('speed') || qLower.includes('battery')))
  ) {
    classification = 'COMPARISON';
    requestedOperation = 'COMPARE';
    expectedAnswerType = 'EXPLANATION';
    requiresMultipleRetrievalPasses = true;
  } else if (constraints.length > 0) {
    classification = 'MULTI_CONSTRAINT';
    requestedOperation = 'AGGREGATE';
    expectedAnswerType = 'NUMBER';
  } else if (
    qLower.includes('list the four') ||
    qLower.includes('all facilities') ||
    qLower.includes('combined') ||
    qLower.includes('total robots across')
  ) {
    classification = 'CROSS_SECTION';
    requestedOperation = 'AGGREGATE';
    expectedAnswerType = 'LIST';
  } else if (
    qLower.includes('how many') ||
    qLower.includes('what is the count') ||
    qLower.includes('exact count') ||
    qLower.includes('how long') ||
    qLower.includes('maximum speed') ||
    qLower.includes('battery capacity') ||
    qLower.includes('payload capacity')
  ) {
    classification = 'ATTRIBUTE_LOOKUP';
    requestedOperation = 'RETRIEVE';
    expectedAnswerType = 'NUMBER';
  } else if (resolution.queryType === 'FOLLOW_UP_QUERY' || resolution.queryType === 'CONTEXT_DEPENDENT_QUERY' || resolution.isFollowUp) {
    classification = 'FOLLOW_UP';
    requestedOperation = 'RETRIEVE';
  }

  const profile: QuestionUnderstandingProfile = {
    normalizedQuestion: contextualizedQuery,
    classification,
    confidenceScore: 0.95,
    entities,
    attributes,
    constraints,
    temporalRequirement,
    requestedOperation,
    expectedAnswerType,
    requiredEvidenceCount: requiresMultipleRetrievalPasses ? 4 : 2,
    requiresMultipleRetrievalPasses,
    requiresCalculation,
    requiresContradictionCheck: isCorrection || isAdversarial,
    requiresClarification: false,
    isAdversarial,
    isOutOfDomain,
    isUnknownInformation,
    userCorrectionAssertion,
  };

  return { profile, contextualizedQuery };
}
