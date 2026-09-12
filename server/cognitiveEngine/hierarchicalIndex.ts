/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Corpus-agnostic hierarchical document index.
 * Production indexing must derive all chunks, entities, numbers, tables, and
 * specifications from the uploaded document itself.
 */

import { KnowledgeDocument } from '../../src/types.js';
import { HierarchicalChunk, HierarchicalLevel } from './types.js';
import {
  complexPdfParser,
  ExtractedStructuredTable,
  DocumentSectionNode,
} from './complexPdfParser.js';
import { knowledgeGraphEngine } from './knowledgeGraphEngine.js';

function tokenize(text: string): string[] {
  return Array.from(
    new Set(text.toLowerCase().match(/\b[a-z0-9][a-z0-9\-\.]*\b/g) || [])
  );
}

function extractNumbers(text: string): number[] {
  return (text.match(/-?\b\d+(?:\.\d+)?\b/g) || [])
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
}

function extractCandidateEntities(text: string): string[] {
  const entities = new Set<string>();

  const properNounRuns = text.match(/\b(?:[A-Z][A-Za-z0-9&'\-]*)(?:\s+[A-Z][A-Za-z0-9&'\-]*){0,4}\b/g) || [];
  for (const candidate of properNounRuns) {
    const cleaned = candidate.trim();
    if (cleaned.length >= 3) entities.add(cleaned);
  }

  const codeLike = text.match(/\b[A-Z]{2,}[A-Z0-9\-]*\d+[A-Z0-9\-]*\b/g) || [];
  for (const candidate of codeLike) entities.add(candidate);

  return Array.from(entities).slice(0, 40);
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (trimmed.length > 80) return false;
  if (trimmed.length < 3) return false;
  return trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

export class HierarchicalDocumentIndex {
  private chunks: Map<string, HierarchicalChunk[]> = new Map();
  private extractedTables: Map<string, ExtractedStructuredTable[]> = new Map();
  private documentOutlines: Map<string, DocumentSectionNode[]> = new Map();

  public indexDocument(tenantId: string, kbId: string, doc: KnowledgeDocument): void {
    const key = `${tenantId}:${kbId}`;
    const docChunks: HierarchicalChunk[] = [];
    const docId = doc.id || `doc_${Date.now()}`;
    const docName = doc.filename || (doc as any).name || 'Document.pdf';
    const pages = doc.pages || [];
    const allText = pages.map((page) => page.text || '').join('\n');
    const overviewText = (doc.summary && doc.summary.trim())
      ? doc.summary.trim()
      : allText.replace(/\s+/g, ' ').trim().slice(0, 1200);

    const level1Chunk: HierarchicalChunk = {
      chunkId: `${docId}_L1_overview`,
      documentId: docId,
      documentName: docName,
      level: 'DOCUMENT_OVERVIEW',
      pageNumber: 1,
      sectionTitle: 'Document Overview',
      text: overviewText || `Document: ${docName}`,
      tokens: tokenize(overviewText || docName).slice(0, 120),
      entities: extractCandidateEntities(overviewText || docName),
      numbers: extractNumbers(overviewText),
      childrenIds: [],
    };
    docChunks.push(level1Chunk);

    for (const page of pages) {
      const pageText = page.text || '';
      const lines = pageText.split('\n');
      let currentSection = `Page ${page.pageNumber}`;
      let sectionBuffer: string[] = [];

      const flushSection = (title: string, content: string) => {
        const trimmedContent = content.trim();
        if (!trimmedContent) return;

        const safeTitle = title.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 40) || 'section';
        const l2Id = `${docId}_L2_p${page.pageNumber}_${safeTitle}`;
        const entities = extractCandidateEntities(`${title}\n${trimmedContent}`);
        const numbers = extractNumbers(trimmedContent);

        const l2Chunk: HierarchicalChunk = {
          chunkId: l2Id,
          documentId: docId,
          documentName: docName,
          level: 'SECTION_HEADER',
          parentId: level1Chunk.chunkId,
          pageNumber: page.pageNumber,
          sectionTitle: title,
          text: `Section: ${title}. ${trimmedContent.slice(0, 700)}`,
          tokens: tokenize(`${title} ${trimmedContent}`).slice(0, 160),
          entities,
          numbers,
          childrenIds: [],
        };
        docChunks.push(l2Chunk);
        level1Chunk.childrenIds?.push(l2Id);

        const words = trimmedContent.split(/\s+/);
        const chunkSize = 250;
        const overlap = 50;
        let chunkIndex = 0;

        for (let start = 0; start < words.length; start += chunkSize - overlap) {
          const chunkWords = words.slice(start, start + chunkSize);
          if (chunkWords.length === 0) break;
          const chunkText = chunkWords.join(' ');
          const l3Id = `${docId}_L3_p${page.pageNumber}_${safeTitle}_${chunkIndex++}`;
          const l3Chunk: HierarchicalChunk = {
            chunkId: l3Id,
            documentId: docId,
            documentName: docName,
            level: 'SEMANTIC_CHUNK',
            parentId: l2Id,
            pageNumber: page.pageNumber,
            sectionTitle: title,
            text: chunkText,
            tokens: tokenize(chunkText),
            entities: extractCandidateEntities(chunkText),
            numbers: extractNumbers(chunkText),
          };
          docChunks.push(l3Chunk);
          l2Chunk.childrenIds?.push(l3Id);
          if (start + chunkSize >= words.length) break;
        }
      };

      for (const line of lines) {
        if (isLikelyHeading(line)) {
          if (sectionBuffer.length > 0) {
            flushSection(currentSection, sectionBuffer.join('\n'));
            sectionBuffer = [];
          }
          currentSection = line.trim().replace(/^#{1,6}\s*/, '');
        } else {
          sectionBuffer.push(line);
        }
      }

      if (sectionBuffer.length > 0) {
        flushSection(currentSection, sectionBuffer.join('\n'));
      }
    }

    const parseResult = complexPdfParser.parseDocumentPages(docName, pages);
    this.extractedTables.set(key, parseResult.tables);
    this.documentOutlines.set(key, parseResult.outline);

    knowledgeGraphEngine.extractAndIndexDocument(tenantId, kbId, docName, pages);

    parseResult.tables.forEach((table, index) => {
      const numbers: number[] = [];
      for (const row of table.rows) {
        for (const value of Object.values(row)) {
          if (typeof value === 'number' && Number.isFinite(value)) numbers.push(value);
          if (typeof value === 'string') numbers.push(...extractNumbers(value));
        }
      }

      docChunks.push({
        chunkId: `${docId}_L4_table_${index}`,
        documentId: docId,
        documentName: docName,
        level: 'FACT_RECORD',
        pageNumber: table.pageNumber,
        sectionTitle: table.title || 'Structured Table',
        text: `Structured Table: ${table.title || 'Data Table'} (Page ${table.pageNumber})\n${table.rawMarkdown}`,
        tokens: tokenize(`${table.title || ''} ${table.summary} ${table.rawMarkdown}`),
        entities: Array.from(new Set([
          ...table.columns.map((column) => column.name),
          ...extractCandidateEntities(table.rawMarkdown),
        ])).slice(0, 40),
        numbers,
        tableData: table.rows,
      });
    });

    parseResult.specs.forEach((spec, index) => {
      const text = `${spec.key}: ${spec.value}`;
      docChunks.push({
        chunkId: `${docId}_L4_spec_${index}`,
        documentId: docId,
        documentName: docName,
        level: 'FACT_RECORD',
        pageNumber: spec.pageNumber,
        sectionTitle: spec.sectionTitle,
        text: `Specification: ${text} (Page ${spec.pageNumber})`,
        tokens: tokenize(text),
        entities: Array.from(new Set([spec.key, ...extractCandidateEntities(text)])).slice(0, 20),
        numbers: spec.numericValue !== undefined ? [spec.numericValue] : extractNumbers(String(spec.value)),
      });
    });

    const existing = this.chunks.get(key) || [];
    const filtered = existing.filter((chunk) => chunk.documentId !== docId);
    this.chunks.set(key, [...filtered, ...docChunks]);
  }

  public getStructuredTables(tenantId: string, kbId: string): ExtractedStructuredTable[] {
    return this.extractedTables.get(`${tenantId}:${kbId}`) || [];
  }

  public getDocumentOutline(tenantId: string, kbId: string): DocumentSectionNode[] {
    return this.documentOutlines.get(`${tenantId}:${kbId}`) || [];
  }

  public getChunks(tenantId: string, kbId: string, levelFilter?: HierarchicalLevel): HierarchicalChunk[] {
    const chunks = this.chunks.get(`${tenantId}:${kbId}`) || [];
    return levelFilter ? chunks.filter((chunk) => chunk.level === levelFilter) : chunks;
  }
}

export const hierarchicalIndex = new HierarchicalDocumentIndex();
