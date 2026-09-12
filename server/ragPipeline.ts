/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Corpus-agnostic hybrid RAG pipeline.
 * Retrieval and reranking operate only on terms/entities/numbers derived from
 * the query and uploaded documents; no benchmark/domain facts are encoded.
 */

import crypto from 'crypto';
import { KnowledgeDocument } from '../src/types.js';
import {
  DocumentChunk,
  CandidateChunk,
  RerankedChunk,
  EvidenceSufficiency,
  ClaimGroundingVerification,
} from './ragTypes.js';

function cleanText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function extractNumbers(text: string): number[] {
  return Array.from(new Set(
    (text.match(/-?\b\d+(?:\.\d+)?\b/g) || [])
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value))
  ));
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>();

  const codes = text.match(/\b[A-Z]{2,}[A-Z0-9\-]*\d+[A-Z0-9\-]*\b/g) || [];
  for (const code of codes) entities.add(code);

  const properRuns = text.match(/\b(?:[A-Z][A-Za-z0-9&'\-]*)(?:\s+[A-Z][A-Za-z0-9&'\-]*){0,4}\b/g) || [];
  for (const candidate of properRuns) {
    const cleaned = candidate.trim();
    if (cleaned.length >= 3 && !GENERIC_QUESTION_STARTERS.has(cleaned.toLowerCase())) entities.add(cleaned);
  }

  const quantities = text.match(/\b\d+(?:\.\d+)?\s*(?:%|kg|g|lb|lbs|kwh|wh|kw|mw|m\/s|km\/h|hours?|days?|minutes?|seconds?|ms|gb|mb|tb|usd|npr|eur|dollars?)\b/gi) || [];
  for (const quantity of quantities) entities.add(quantity.toLowerCase());

  return Array.from(entities).slice(0, 40);
}

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%\.\-\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function termOverlap(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (lower.includes(token)) hits += 1;
  }
  return hits / queryTokens.length;
}

export function chunkDocument(
  doc: KnowledgeDocument,
  tenantId: string = 'acc_default',
  knowledgeBaseId: string = 'kb_default'
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  if (!doc.pages || doc.pages.length === 0) return chunks;

  for (const page of doc.pages) {
    const rawText = cleanText(page.text || '');
    if (!rawText) continue;

    const lines = rawText.split('\n');
    let currentSection = `Page ${page.pageNumber}`;
    let currentParagraph: string[] = [];

    const flush = () => {
      if (currentParagraph.length === 0) return;
      const text = currentParagraph.join('\n').trim();
      currentParagraph = [];
      if (text.length < 15) return;

      const hash = computeHash(`${doc.id}-${page.pageNumber}-${currentSection}-${text}`);
      chunks.push({
        chunkId: `chk_${hash}`,
        tenantId,
        knowledgeBaseId,
        documentId: doc.id,
        documentName: doc.filename,
        pageNumber: page.pageNumber,
        sectionTitle: currentSection,
        text,
        tokenCountEstimate: Math.ceil(text.split(/\s+/).length * 1.3),
        contentHash: hash,
        entities: extractEntities(`${currentSection} ${text}`),
        numbers: extractNumbers(text),
      });
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flush();
        continue;
      }

      const isHeader =
        /^#{1,6}\s+/.test(trimmed) ||
        /^(?:section|chapter)\s+\d+/i.test(trimmed) ||
        (trimmed.endsWith(':') && trimmed.length < 80) ||
        (trimmed.length < 70 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed));

      if (isHeader) {
        flush();
        currentSection = trimmed.replace(/^#{1,6}\s+/, '').replace(/:$/, '');
      } else {
        currentParagraph.push(trimmed);
      }
    }
    flush();
  }

  return chunks;
}

export class HybridRagIndex {
  private chunksByTenantKb: Map<string, DocumentChunk[]> = new Map();

  private getKey(tenantId: string, kbId: string): string {
    return `${tenantId}::${kbId}`;
  }

  public indexDocuments(
    documents: KnowledgeDocument[],
    tenantId: string = 'acc_default',
    knowledgeBaseId: string = 'kb_default'
  ): void {
    const chunks = documents.flatMap((doc) => chunkDocument(doc, tenantId, knowledgeBaseId));
    this.chunksByTenantKb.set(this.getKey(tenantId, knowledgeBaseId), chunks);
  }

  public getChunks(tenantId: string = 'acc_default', kbId: string = 'kb_default'): DocumentChunk[] {
    return this.chunksByTenantKb.get(this.getKey(tenantId, kbId)) || [];
  }

  public search(
    query: string,
    tenantId: string = 'acc_default',
    kbId: string = 'kb_default',
    topK: number = 10
  ): CandidateChunk[] {
    const chunks = this.getChunks(tenantId, kbId);
    if (chunks.length === 0) return [];

    const queryTokens = normalizeTokens(query);
    const queryEntities = extractEntities(query).map((entity) => entity.toLowerCase());
    const queryNumbers = extractNumbers(query);
    const candidates: CandidateChunk[] = [];

    for (const chunk of chunks) {
      const searchable = `${chunk.sectionTitle} ${chunk.text}`;
      const lower = searchable.toLowerCase();
      const chunkEntities = chunk.entities.map((entity) => entity.toLowerCase());

      const keywordScore = termOverlap(queryTokens, searchable);

      let matchedEntities = 0;
      for (const entity of queryEntities) {
        if (lower.includes(entity) || chunkEntities.some((candidate) => candidate.includes(entity) || entity.includes(candidate))) {
          matchedEntities += 1;
        }
      }
      const entityScore = queryEntities.length ? matchedEntities / queryEntities.length : 0;

      let matchedNumbers = 0;
      for (const number of queryNumbers) {
        if (chunk.numbers.some((candidate) => Math.abs(candidate - number) < 1e-9)) matchedNumbers += 1;
      }
      const numberScore = queryNumbers.length ? matchedNumbers / queryNumbers.length : 0;

      const queryBigrams = queryTokens.slice(0, -1).map((token, index) => `${token} ${queryTokens[index + 1]}`);
      const bigramHits = queryBigrams.filter((bigram) => lower.includes(bigram)).length;
      const semanticScore = queryBigrams.length ? bigramHits / queryBigrams.length : keywordScore;

      const combinedScore =
        keywordScore * 0.5 +
        entityScore * 0.25 +
        numberScore * 0.15 +
        semanticScore * 0.1;

      if (combinedScore >= 0.05) {
        const reasons: string[] = [];
        if (keywordScore > 0) reasons.push(`keyword_overlap=${keywordScore.toFixed(2)}`);
        if (entityScore > 0) reasons.push(`entity_overlap=${entityScore.toFixed(2)}`);
        if (numberScore > 0) reasons.push(`number_overlap=${numberScore.toFixed(2)}`);
        if (semanticScore > 0) reasons.push(`phrase_overlap=${semanticScore.toFixed(2)}`);

        candidates.push({
          chunk,
          semanticScore,
          keywordScore,
          exactScore: entityScore + numberScore,
          combinedScore,
          matchReasons: reasons,
        });
      }
    }

    candidates.sort((a, b) => b.combinedScore - a.combinedScore);
    return candidates.slice(0, topK);
  }
}

export const hybridRagIndex = new HybridRagIndex();

export function rerankCandidates(
  query: string,
  candidates: CandidateChunk[],
  topN: number = 4
): RerankedChunk[] {
  const queryTokens = normalizeTokens(query);
  const entities = extractEntities(query).map((entity) => entity.toLowerCase());
  const scored = candidates.map((candidate) => {
    const searchable = `${candidate.chunk.sectionTitle} ${candidate.chunk.text}`.toLowerCase();
    let score = candidate.combinedScore * 10;
    const explanation: string[] = [...candidate.matchReasons];

    for (const entity of entities) {
      if (searchable.includes(entity)) {
        score += 2.5;
        explanation.push(`exact_entity=${entity}`);
      }
    }

    const sectionOverlap = termOverlap(queryTokens, candidate.chunk.sectionTitle);
    if (sectionOverlap > 0) {
      score += sectionOverlap * 3;
      explanation.push(`section_overlap=${sectionOverlap.toFixed(2)}`);
    }

    const phrase = queryTokens.join(' ');
    if (phrase.length > 5 && searchable.includes(phrase)) {
      score += 4;
      explanation.push('exact_phrase');
    }

    return { chunk: candidate.chunk, score, explanation: explanation.join(', ') || 'hybrid_score' };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((item, index) => ({
    chunk: item.chunk,
    rerankScore: item.score,
    rank: index + 1,
    confidence: Math.min(1, Math.max(0.1, item.score / 12)),
    relevanceExplanation: item.explanation,
  }));
}

export function checkEvidenceSufficiency(query: string, reranked: RerankedChunk[]): EvidenceSufficiency {
  if (reranked.length === 0) {
    return {
      isSufficient: false,
      sufficiencyScore: 0,
      reason: 'No matching evidence found in the uploaded documents.',
      suggestedAction: 'ABSTAIN_INSUFFICIENT',
    };
  }

  const top = reranked[0];
  const queryTokens = normalizeTokens(query);
  const lexicalCoverage = termOverlap(queryTokens, `${top.chunk.sectionTitle} ${top.chunk.text}`);
  const evidenceStrength = Math.min(1, (top.rerankScore / 10) * 0.65 + lexicalCoverage * 0.35);

  if (evidenceStrength < 0.28) {
    return {
      isSufficient: false,
      sufficiencyScore: evidenceStrength,
      reason: 'Retrieved evidence is too weak to support a reliable answer.',
      suggestedAction: 'ABSTAIN_INSUFFICIENT',
    };
  }

  return {
    isSufficient: true,
    sufficiencyScore: evidenceStrength,
    reason: `Evidence passed the sufficiency threshold (${evidenceStrength.toFixed(2)}).`,
    suggestedAction: 'ANSWER',
  };
}

export function verifyClaimsAgainstEvidence(
  answer: string,
  evidenceChunks: RerankedChunk[]
): {
  groundingScore: number;
  verifications: ClaimGroundingVerification[];
  unsupportedClaims: string[];
} {
  const sentences = answer
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 10 && !sentence.startsWith('#'));

  if (sentences.length === 0) {
    return { groundingScore: 1, verifications: [], unsupportedClaims: [] };
  }

  const evidenceText = evidenceChunks.map((item) => item.chunk.text).join(' ').toLowerCase();
  const verifications: ClaimGroundingVerification[] = [];
  const unsupportedClaims: string[] = [];

  for (const sentence of sentences) {
    const numbers = extractNumbers(sentence);
    const numbersSupported = numbers.every((number) =>
      evidenceChunks.some((item) => item.chunk.numbers.some((candidate) => Math.abs(candidate - number) < 1e-9))
    );
    const words = normalizeTokens(sentence).filter((word) => word.length > 3);
    const overlap = words.length ? words.filter((word) => evidenceText.includes(word)).length / words.length : 1;
    const supported = numbersSupported && overlap >= 0.45;

    const supporting = evidenceChunks.filter((item) =>
      normalizeTokens(sentence).some((word) => word.length > 3 && item.chunk.text.toLowerCase().includes(word))
    );

    verifications.push({
      claim: sentence,
      supported,
      confidence: supported ? Math.min(1, 0.6 + overlap * 0.4) : Math.max(0.1, overlap * 0.4),
      supportingChunkIds: supporting.map((item) => item.chunk.chunkId),
      supportingSnippets: supporting.map((item) => item.chunk.text.substring(0, 140)),
    });
    if (!supported) unsupportedClaims.push(sentence);
  }

  const supportedCount = verifications.filter((item) => item.supported).length;
  return {
    groundingScore: verifications.length ? supportedCount / verifications.length : 1,
    verifications,
    unsupportedClaims,
  };
}

const GENERIC_QUESTION_STARTERS = new Set([
  'what', 'when', 'where', 'which', 'who', 'why', 'how', 'tell', 'compare', 'does', 'do', 'is', 'are', 'can', 'could', 'would', 'please',
]);

const STOP_WORDS = new Set([
  'what', 'is', 'the', 'of', 'in', 'and', 'to', 'a', 'an', 'are', 'for', 'on', 'does', 'do',
  'at', 'by', 'with', 'from', 'who', 'how', 'when', 'where', 'which', 'it', 'this', 'that',
  'be', 'tell', 'me', 'about', 'can', 'you', 'please', 'give', 'according', 'document', 'uploaded',
  'have', 'has', 'will', 'there', 'was', 'were', 'their', 'its', 'our', 'your', 'into', 'than',
]);
