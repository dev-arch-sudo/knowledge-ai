/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic evidence-only answer synthesis for provider outages and explicit
 * no-model runs. It extracts the smallest useful answer from retrieved evidence
 * instead of returning whole chunks verbatim.
 */

import { QuestionUnderstandingProfile, RerankedEvidenceItem } from './types.js';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'of', 'to', 'in', 'on', 'at',
  'for', 'from', 'with', 'and', 'or', 'but', 'as', 'by', 'what', 'which', 'who', 'where', 'when', 'why',
  'how', 'many', 'much', 'does', 'do', 'did', 'has', 'have', 'had', 'it', 'its', 'this', 'that', 'these',
  'those', 'about', 'tell', 'me', 'please', 'located', 'company', 'document', 'documents',
]);

const TOKEN_EQUIVALENTS: Record<string, string[]> = {
  time: ['minute', 'minutes', 'duration'],
  minute: ['time', 'minutes', 'duration'],
  minutes: ['time', 'minute', 'duration'],
  location: ['country', 'city', 'region'],
  country: ['location', 'located'],
  employee: ['employees', 'staff', 'staffing'],
  employees: ['employee', 'staff', 'staffing'],
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}%$.-]+/gu, ' ').trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandedTokens(text: string): string[] {
  const base = tokens(text);
  return unique(base.flatMap((token) => [token, ...(TOKEN_EQUIVALENTS[token] || [])]));
}

function intentTokens(question: string, profile: QuestionUnderstandingProfile): string[] {
  const lower = question.toLowerCase();
  const intents: string[] = [];

  if (/\bwhere\b|\bd[oó]nde\b|कहाँ|कहा|कता/.test(lower) ||
      (profile.attributes || []).some((attribute) => ['location', 'country', 'city', 'region'].includes(attribute))) {
    intents.push('location', 'country', 'city', 'region');
  }

  if (/\b(response\s+time|initial\s+response|how\s+long)\b/.test(lower) ||
      (profile.attributes || []).some((attribute) => ['time', 'response time', 'duration'].includes(attribute))) {
    intents.push('time', 'minutes', 'duration');
  }

  if (/\b(how\s+many\s+employees?|employee\s+count|staff\s+count)\b/.test(lower) ||
      (profile.attributes || []).some((attribute) => ['count', 'quantity'].includes(attribute))) {
    intents.push('employee', 'employees', 'count', 'staff', 'staffing');
  }

  return unique(intents);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function cleanCell(value: string): string {
  return value.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cleanCell);
}

function isDividerCell(value: string): boolean {
  return /^:?-{3,}:?$/.test(value.trim());
}

function isDividerRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every(isDividerCell);
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function parseMultilineTables(text: string): ParsedTable[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tables: ParsedTable[] = [];

  for (let i = 0; i < lines.length - 2; i++) {
    if (!lines[i].startsWith('|') || !lines[i + 1].startsWith('|')) continue;
    const headers = parseTableRow(lines[i]);
    const divider = parseTableRow(lines[i + 1]);
    if (!isDividerRow(divider) || headers.length < 2) continue;

    const rows: string[][] = [];
    let cursor = i + 2;
    while (cursor < lines.length && lines[cursor].startsWith('|')) {
      const row = parseTableRow(lines[cursor]);
      if (row.length === headers.length && !isDividerRow(row)) rows.push(row);
      cursor += 1;
    }
    if (rows.length) tables.push({ headers, rows });
  }

  return tables;
}

/** Parse markdown tables after retrieval has flattened line breaks into spaces. */
function parseFlattenedTables(text: string): ParsedTable[] {
  if (!text.includes('|')) return [];
  const cells = text.split('|').map(cleanCell).filter(Boolean);
  const tables: ParsedTable[] = [];

  for (let i = 0; i < cells.length; i++) {
    if (!isDividerCell(cells[i])) continue;
    let dividerEnd = i;
    while (dividerEnd + 1 < cells.length && isDividerCell(cells[dividerEnd + 1])) dividerEnd += 1;
    const width = dividerEnd - i + 1;
    if (width < 2 || i < width) {
      i = dividerEnd;
      continue;
    }

    const headers = cells.slice(i - width, i);
    if (headers.some((header) => !header || isDividerCell(header))) {
      i = dividerEnd;
      continue;
    }

    const rows: string[][] = [];
    let cursor = dividerEnd + 1;
    while (cursor + width <= cells.length) {
      const row = cells.slice(cursor, cursor + width);
      if (row.some(isDividerCell)) break;
      rows.push(row);
      cursor += width;
      if (rows.length >= 50) break;
    }

    if (rows.length) tables.push({ headers, rows });
    i = dividerEnd;
  }

  return tables;
}

function tablesFromEvidence(text: string): ParsedTable[] {
  const multiline = parseMultilineTables(text);
  const flattened = parseFlattenedTables(text);
  const keyed = new Map<string, ParsedTable>();
  for (const table of [...multiline, ...flattened]) {
    const key = `${table.headers.join('|')}::${table.rows.map((row) => row.join('|')).join('::')}`;
    keyed.set(key, table);
  }
  return Array.from(keyed.values());
}

function headerScore(
  questionTokens: string[],
  question: string,
  header: string,
  semanticIntents: string[]
): number {
  const headerTokens = expandedTokens(header);
  const overlap = headerTokens.filter((token) => questionTokens.includes(token)).length;
  const exact = normalize(question).includes(normalize(header)) ? 5 : 0;
  let intentBoost = 0;

  if (semanticIntents.includes('location') && /\b(country|city|region|location)\b/i.test(header)) intentBoost += 10;
  if (semanticIntents.includes('minutes') && /\b(time|minute|minutes|duration)\b/i.test(header)) intentBoost += 8;
  if (semanticIntents.includes('employees') && /\b(employee|employees|staff|count)\b/i.test(header)) intentBoost += 8;

  return overlap * 4 + exact + intentBoost;
}

function tableLookup(
  question: string,
  profile: QuestionUnderstandingProfile,
  evidence: RerankedEvidenceItem[]
): string | null {
  if (/^\s*who\b/i.test(question)) return null;

  const semanticIntents = intentTokens(question, profile);
  const questionTokens = unique([
    ...expandedTokens(question),
    ...semanticIntents,
    ...(profile.entities || []).flatMap(expandedTokens),
    ...(profile.attributes || []).flatMap(expandedTokens),
  ]);

  type Match = { answer: string; score: number };
  const matches: Match[] = [];

  for (const item of evidence.slice(0, 6)) {
    for (const table of tablesFromEvidence(item.chunk.text)) {
      const columnScores = table.headers.map((header, index) => ({
        index,
        header,
        score: headerScore(questionTokens, question, header, semanticIntents),
      }));
      const requestedColumn = columnScores.sort((a, b) => b.score - a.score)[0];
      if (!requestedColumn || requestedColumn.score <= 0) continue;

      for (const row of table.rows) {
        const rowText = row.join(' ');
        const rowTokens = expandedTokens(rowText);
        const entityMatches = (profile.entities || []).filter((entity) =>
          normalize(rowText).includes(normalize(entity))
        ).length;
        const tokenMatches = questionTokens.filter((token) => rowTokens.includes(token)).length;
        const score = entityMatches * 10 + tokenMatches * 2 + requestedColumn.score;
        if (score <= requestedColumn.score) continue;

        const label = row[0] || 'Result';
        const value = row[requestedColumn.index];
        if (!value || value === label || isDividerCell(value)) continue;
        matches.push({ answer: `${label}: ${requestedColumn.header} is ${value}.`, score });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches[0]?.answer || null;
}

function looksLikeFlattenedTable(text: string): boolean {
  const pipeCount = (text.match(/\|/g) || []).length;
  return pipeCount >= 4 && /(?:^|\s)-{3,}(?:\s|$)/.test(text);
}

function sentenceCandidates(text: string): string[] {
  const withoutTables = text
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith('|')) return false;
      if (looksLikeFlattenedTable(trimmed)) return false;
      if (/^#{1,6}\s/.test(trimmed)) return false;
      if (/^(structured table|section|specification):/i.test(trimmed)) return false;
      return true;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutTables
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 8 && sentence.length <= 420 && !looksLikeFlattenedTable(sentence));
}

function sentenceLookup(
  question: string,
  profile: QuestionUnderstandingProfile,
  evidence: RerankedEvidenceItem[]
): string | null {
  const questionTokens = unique([...expandedTokens(question), ...intentTokens(question, profile)]);
  const entityTokens = unique((profile.entities || []).flatMap(expandedTokens));
  const attributeTokens = unique((profile.attributes || []).flatMap(expandedTokens));

  const candidates = evidence.slice(0, 6).flatMap((item, evidenceIndex) =>
    sentenceCandidates(item.chunk.text).map((sentence) => {
      const sentenceTokens = expandedTokens(sentence);
      const questionOverlap = questionTokens.filter((token) => sentenceTokens.includes(token)).length;
      const entityOverlap = entityTokens.filter((token) => sentenceTokens.includes(token)).length;
      const attributeOverlap = attributeTokens.filter((token) => sentenceTokens.includes(token)).length;
      const score = questionOverlap * 3 + entityOverlap * 5 + attributeOverlap * 4 - evidenceIndex * 0.15;
      return { sentence, score };
    })
  );

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score <= 0) return null;
  return best.sentence;
}

export function deterministicSynthesizer(
  profile: QuestionUnderstandingProfile,
  rerankedItems: RerankedEvidenceItem[]
): string {
  const evidence = rerankedItems.slice(0, 6);
  if (!evidence.length) {
    return "I couldn't find enough evidence in the uploaded documents to answer that reliably.";
  }

  const question = profile.normalizedQuestion;

  if (/^\s*who\b/i.test(question)) {
    const relationalAnswer = sentenceLookup(question, profile, evidence);
    if (relationalAnswer) return relationalAnswer;
  }

  const tableAnswer = tableLookup(question, profile, evidence);
  if (tableAnswer) return tableAnswer;

  const sentenceAnswer = sentenceLookup(question, profile, evidence);
  if (sentenceAnswer) return sentenceAnswer;

  const fallback = sentenceCandidates(evidence[0].chunk.text)[0];
  if (fallback) return fallback;

  if (looksLikeFlattenedTable(evidence[0].chunk.text) || evidence[0].chunk.text.includes('| ---')) {
    return "I couldn't isolate a concise answer from the retrieved table evidence reliably.";
  }

  const compact = evidence[0].chunk.text.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 280).trim();
}
