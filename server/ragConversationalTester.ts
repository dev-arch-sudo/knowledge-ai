/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 9.5 8-Turn Conversational Reproduction & Verification Suite
 * Executes the exact 8-turn sequence specified in Phase 9.5:
 * 1. "How many active robots does Aurora Robotics currently have?" -> Expected: 300
 * 2. "How many of those are AR-40?" -> Expected: 50
 * 3. "What is the payload capacity of the AR-40?" -> Expected: 40 kg
 * 4. "What is its maximum speed?" -> Expected: 2.5 m/s
 * 5. "What is its battery capacity?" -> Expected: 12.0 kWh
 * 6. "How long does the AR-40 operate?" -> Expected: ~12 hours
 * 7. "How many warehouses does Aurora Robotics currently operate?" -> Expected: 4
 * 8. "Which warehouse has the most robots?" -> Expected: Singapore Central, 120 robots
 *
 * Tests both:
 * - Conversational Accumulation Mode (history passed into subsequent turns)
 * - Isolated Single-Turn Mode (baseline without history)
 */

import { ChatMessage, KnowledgeDocument } from '../src/types.js';
import { getOrInitCorpusDoc } from './ragBenchmarkRunner.js';
import { answerQuestionWithGroundedDocs } from './geminiService.js';

export interface TurnExecutionResult {
  turnNumber: number;
  question: string;
  contextualizedQuery?: string;
  expectedFact: string;
  expectedKeywords: string[];
  actualAnswer: string;
  passed: boolean;
  grounded: boolean;
  failureReason?: string;
  sources: Array<{ documentName: string; pageNumber: number; sectionHeading: string }>;
  durationMs: number;
}

export interface ConversationalSequenceResult {
  passedTurns: number;
  totalTurns: number;
  allPassed: boolean;
  mode: 'CONVERSATIONAL_ACCUMULATION' | 'ISOLATED_SINGLE_TURN';
  turns: TurnExecutionResult[];
  overallDurationMs: number;
}

const EIGHT_TURN_SPEC = [
  {
    turnNumber: 1,
    question: 'How many active robots does Aurora Robotics currently have?',
    expectedFact: '300 active robots',
    expectedKeywords: ['300'],
  },
  {
    turnNumber: 2,
    question: 'How many of those are AR-40?',
    expectedFact: '50 AR-40 robots (resolving "those" to active robots)',
    expectedKeywords: ['50', 'AR-40'],
  },
  {
    turnNumber: 3,
    question: 'What is the payload capacity of the AR-40?',
    expectedFact: '40 kg (or 40 kilograms)',
    expectedKeywords: ['40 kg', '40 kilograms'],
  },
  {
    turnNumber: 4,
    question: 'What is its maximum speed?',
    expectedFact: '2.5 m/s (resolving "its" to AR-40, not AR-10 3.2 m/s)',
    expectedKeywords: ['2.5 m/s'],
  },
  {
    turnNumber: 5,
    question: 'What is its battery capacity?',
    expectedFact: '12.0 kWh (resolving "its" to AR-40, not AR-10 4.0 kWh)',
    expectedKeywords: ['12.0 kWh', '12'],
  },
  {
    turnNumber: 6,
    question: 'How long does the AR-40 operate?',
    expectedFact: 'approximately 12 hours (continuous operating time)',
    expectedKeywords: ['12 hours', '12'],
  },
  {
    turnNumber: 7,
    question: 'How many warehouses does Aurora Robotics currently operate?',
    expectedFact: '4 currently operational warehouses',
    expectedKeywords: ['4'],
  },
  {
    turnNumber: 8,
    question: 'Which warehouse has the most robots?',
    expectedFact: 'Singapore Central Logistics Hub with 120 robots',
    expectedKeywords: ['Singapore Central', '120'],
  },
];

export async function runEightTurnConversationalSequence(
  mode: 'CONVERSATIONAL_ACCUMULATION' | 'ISOLATED_SINGLE_TURN' = 'CONVERSATIONAL_ACCUMULATION'
): Promise<ConversationalSequenceResult> {
  const corpusDoc = await getOrInitCorpusDoc();
  const startTime = Date.now();
  const turns: TurnExecutionResult[] = [];
  const accumulatedHistory: ChatMessage[] = [];

  for (const item of EIGHT_TURN_SPEC) {
    const turnStart = Date.now();
    const historyForTurn = mode === 'CONVERSATIONAL_ACCUMULATION' ? [...accumulatedHistory] : [];

    const groundedRes = await answerQuestionWithGroundedDocs(
      item.question,
      [corpusDoc],
      historyForTurn,
      undefined,
      undefined,
      'acc_benchmark',
      'kb_aurora',
      `req_turn_${item.turnNumber}`
    );

    const answerLower = groundedRes.answer.toLowerCase();
    let passed = true;
    const failures: string[] = [];

    // Keyword verification
    for (const kw of item.expectedKeywords) {
      if (!answerLower.includes(kw.toLowerCase())) {
        passed = false;
        failures.push(`Missing keyword "${kw}".`);
      }
    }

    // Check for stale answer repetition in Turn 2 (e.g. repeating 300 active robots instead of 50 AR-40)
    if (item.turnNumber === 2) {
      if (answerLower.includes('300 currently active robots') && !answerLower.includes('50')) {
        passed = false;
        failures.push('Stale repetition detected: repeated Turn 1 answer without filtering to 50 AR-40.');
      }
    }

    // Check for wrong model speed in Turn 4 (e.g. 3.2 m/s for AR-10 instead of 2.5 m/s for AR-40)
    if (item.turnNumber === 4) {
      if (answerLower.includes('3.2 m/s') && !answerLower.includes('2.5 m/s')) {
        passed = false;
        failures.push('Pronominal error: reported AR-10 speed (3.2 m/s) instead of AR-40 (2.5 m/s).');
      }
    }

    // Check for wrong battery in Turn 5 (e.g. 4.0 kWh for AR-10 instead of 12.0 kWh for AR-40)
    if (item.turnNumber === 5) {
      if (answerLower.includes('4.0 kwh') && !answerLower.includes('12')) {
        passed = false;
        failures.push('Pronominal error: reported AR-10 battery (4.0 kWh) instead of AR-40 (12.0 kWh).');
      }
    }

    turns.push({
      turnNumber: item.turnNumber,
      question: item.question,
      contextualizedQuery: groundedRes.diagnosticTrace?.contextualizedQuery,
      expectedFact: item.expectedFact,
      expectedKeywords: item.expectedKeywords,
      actualAnswer: groundedRes.answer,
      passed,
      grounded: groundedRes.isFoundInDocuments,
      failureReason: failures.length > 0 ? failures.join(' ') : undefined,
      sources: groundedRes.sources.map((s) => ({
        documentName: s.documentName,
        pageNumber: typeof s.pageNumber === 'number' ? s.pageNumber : 1,
        sectionHeading: s.sectionHeading || 'Section',
      })),
      durationMs: Date.now() - turnStart,
    });

    // Append to accumulated conversation history
    accumulatedHistory.push({
      id: `msg_user_${item.turnNumber}`,
      role: 'user',
      content: item.question,
      timestamp: Date.now(),
    });
    accumulatedHistory.push({
      id: `msg_asst_${item.turnNumber}`,
      role: 'assistant',
      content: groundedRes.answer,
      timestamp: Date.now(),
    });
  }

  const passedTurns = turns.filter((t) => t.passed).length;

  return {
    passedTurns,
    totalTurns: turns.length,
    allPassed: passedTurns === turns.length,
    mode,
    turns,
    overallDurationMs: Date.now() - startTime,
  };
}
