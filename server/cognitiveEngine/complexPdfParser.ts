/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Corpus-agnostic PDF text structure parser.
 * Extracts headings, pipe tables, aligned records, and key-value specs only
 * from the supplied document text. No domain facts are synthesized in code.
 */

export interface ParsedTableColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'percentage';
}

export interface ParsedTableRow {
  [columnName: string]: string | number | null;
}

export interface ExtractedStructuredTable {
  id: string;
  pageNumber: number;
  title?: string;
  columns: ParsedTableColumn[];
  rows: ParsedTableRow[];
  rawMarkdown: string;
  summary: string;
}

export interface ExtractedKeyValueSpec {
  key: string;
  value: string;
  numericValue?: number;
  unit?: string;
  pageNumber: number;
  sectionTitle: string;
}

export interface DocumentSectionNode {
  id: string;
  title: string;
  level: number;
  pageNumber: number;
  breadcrumbs: string[];
  content: string;
  tables: ExtractedStructuredTable[];
  specs: ExtractedKeyValueSpec[];
  subsections: DocumentSectionNode[];
}

export interface ComplexPdfParseResult {
  title: string;
  pageCount: number;
  outline: DocumentSectionNode[];
  tables: ExtractedStructuredTable[];
  specs: ExtractedKeyValueSpec[];
  reconstructedText: string;
}

function inferColumnType(values: Array<string | number | null>): ParsedTableColumn['type'] {
  const nonEmpty = values.filter((value) => value !== null && String(value).trim() !== '');
  if (nonEmpty.length === 0) return 'string';
  if (nonEmpty.every((value) => /^-?\d+(?:\.\d+)?%$/.test(String(value).trim()))) return 'percentage';
  if (nonEmpty.every((value) => !Number.isNaN(Number(String(value).replace(/[,$%]/g, ''))))) return 'number';
  if (nonEmpty.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()))) return 'date';
  return 'string';
}

function normalizeCell(value: string): string | number {
  const cleaned = value.trim();
  const numeric = cleaned.replace(/[,$]/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(numeric)) return Number(numeric);
  return cleaned;
}

export class ComplexPdfParser {
  public parseDocumentPages(
    filename: string = 'Document',
    pages: Array<{ pageNumber: number; text?: string; content?: string }> = []
  ): ComplexPdfParseResult {
    const tables: ExtractedStructuredTable[] = [];
    const specs: ExtractedKeyValueSpec[] = [];
    const outline: DocumentSectionNode[] = [];
    const safeFilename = filename || 'Document';
    let docTitle = safeFilename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

    let currentL1: DocumentSectionNode | null = null;
    let currentL2: DocumentSectionNode | null = null;

    pages.forEach((page) => {
      const raw = page.text || page.content || '';
      const text = this.reconstructColumnFlow(raw);
      const pageTables = this.extractTablesFromText(text, page.pageNumber);
      tables.push(...pageTables);

      const lines = text.split('\n');
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (!line) continue;

        if (page.pageNumber === 1 && index < 6 && line.length >= 4 && line.length <= 100 && !line.includes('|')) {
          if (/^(#\s*)?[A-Z][A-Za-z0-9 &'()\-:]+$/.test(line) && !line.endsWith('.')) {
            docTitle = line.replace(/^#+\s*/, '');
          }
        }

        const markdownHeading = line.match(/^(#{1,3})\s+(.+)$/);
        const numberedH1 = /^(?:section|chapter)\s+\d+\b|^\d+\.\s+\S+/i.test(line);
        const allCaps = line.length >= 5 && line.length <= 70 && line === line.toUpperCase() && /[A-Z]/.test(line) && !line.includes('|');
        const numberedH2 = /^\d+\.\d+\s+\S+/.test(line);

        if ((markdownHeading && markdownHeading[1].length === 1) || numberedH1 || allCaps) {
          const title = markdownHeading ? markdownHeading[2].trim() : line.replace(/^#+\s*/, '');
          currentL1 = {
            id: `sec_h1_${page.pageNumber}_${outline.length + 1}`,
            title,
            level: 1,
            pageNumber: page.pageNumber,
            breadcrumbs: [docTitle, title],
            content: '',
            tables: [],
            specs: [],
            subsections: [],
          };
          outline.push(currentL1);
          currentL2 = null;
          continue;
        }

        if ((markdownHeading && markdownHeading[1].length >= 2) || numberedH2) {
          const title = markdownHeading ? markdownHeading[2].trim() : line.replace(/^#+\s*/, '');
          if (!currentL1) {
            currentL1 = {
              id: `sec_h1_${page.pageNumber}_${outline.length + 1}`,
              title: docTitle,
              level: 1,
              pageNumber: page.pageNumber,
              breadcrumbs: [docTitle],
              content: '',
              tables: [],
              specs: [],
              subsections: [],
            };
            outline.push(currentL1);
          }
          currentL2 = {
            id: `sec_h2_${page.pageNumber}_${currentL1.subsections.length + 1}`,
            title,
            level: 2,
            pageNumber: page.pageNumber,
            breadcrumbs: [docTitle, currentL1.title, title],
            content: '',
            tables: [],
            specs: [],
            subsections: [],
          };
          currentL1.subsections.push(currentL2);
          continue;
        }

        if (currentL2) currentL2.content += `${line}\n`;
        else if (currentL1) currentL1.content += `${line}\n`;
      }

      const sectionName = currentL2?.title || currentL1?.title || 'General';
      const pageSpecs = this.extractKeyValueSpecs(text, page.pageNumber, sectionName);
      specs.push(...pageSpecs);
      if (currentL2) {
        currentL2.tables.push(...pageTables);
        currentL2.specs.push(...pageSpecs);
      } else if (currentL1) {
        currentL1.tables.push(...pageTables);
        currentL1.specs.push(...pageSpecs);
      }
    });

    if (outline.length === 0) {
      outline.push({
        id: 'sec_h1_default',
        title: docTitle,
        level: 1,
        pageNumber: 1,
        breadcrumbs: [docTitle],
        content: pages.map((page) => page.text || page.content || '').join('\n\n'),
        tables,
        specs,
        subsections: [],
      });
    }

    return {
      title: docTitle,
      pageCount: pages.length,
      outline,
      tables,
      specs,
      reconstructedText: pages
        .map((page) => `--- Page ${page.pageNumber} ---\n${page.text || page.content || ''}`)
        .join('\n\n'),
    };
  }

  public reconstructColumnFlow(rawPageText: string): string {
    const lines = rawPageText.split('\n');
    if (lines.length < 10) return rawPageText;

    const splitCandidates = lines.filter((line) => /\S\s{6,}\S/.test(line));
    if (splitCandidates.length / lines.length <= 0.35) return rawPageText;

    const left: string[] = [];
    const right: string[] = [];
    for (const line of lines) {
      const parts = line.split(/\s{4,}/);
      left.push((parts[0] || '').trim());
      if (parts.length > 1) right.push(parts.slice(1).join(' ').trim());
    }
    return `${left.join('\n')}\n\n${right.join('\n')}`;
  }

  public extractTablesFromText(text: string, pageNumber: number): ExtractedStructuredTable[] {
    const tables: ExtractedStructuredTable[] = [];
    const lines = text.split('\n');
    let tableLines: string[] = [];
    let title = '';

    const flush = () => {
      if (tableLines.length >= 2) {
        const parsed = this.parseTableLines(tableLines, pageNumber, title || `Table on Page ${pageNumber}`);
        if (parsed) tables.push(parsed);
      }
      tableLines = [];
      title = '';
    };

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      const pipeCount = (line.match(/\|/g) || []).length;
      if (pipeCount >= 2) {
        if (tableLines.length === 0 && index > 0) {
          const previous = lines[index - 1].trim().replace(/^[#*-]\s*/, '');
          if (previous && !previous.includes('|') && previous.length < 100) title = previous;
        }
        tableLines.push(line);
      } else if (tableLines.length > 0) {
        flush();
      }
    }
    flush();

    tables.push(...this.detectAlignedRecords(text, pageNumber));
    return tables;
  }

  private parseTableLines(lines: string[], pageNumber: number, title: string): ExtractedStructuredTable | null {
    const meaningful = lines.filter((line) => !/^\|?\s*:?-{3,}/.test(line));
    if (meaningful.length < 2) return null;

    const parseCells = (line: string) => line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

    const headers = parseCells(meaningful[0]).filter(Boolean);
    if (headers.length < 2) return null;

    const rows: ParsedTableRow[] = [];
    for (const line of meaningful.slice(1)) {
      const cells = parseCells(line);
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      const row: ParsedTableRow = {};
      headers.forEach((header, index) => {
        row[header] = normalizeCell(cells[index] ?? '');
      });
      rows.push(row);
    }
    if (rows.length === 0) return null;

    const columns: ParsedTableColumn[] = headers.map((name) => ({
      name,
      type: inferColumnType(rows.map((row) => row[name])),
    }));

    const rawMarkdown = [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? '')).join(' | ')} |`),
    ].join('\n');

    return {
      id: `table_p${pageNumber}_${Math.random().toString(36).slice(2, 8)}`,
      pageNumber,
      title,
      columns,
      rows,
      rawMarkdown,
      summary: `${title} (${rows.length} rows, ${columns.length} columns: ${headers.join(', ')})`,
    };
  }

  private detectAlignedRecords(text: string, pageNumber: number): ExtractedStructuredTable[] {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const records: ParsedTableRow[] = [];

    for (const line of lines) {
      const fields = line.split(/\s{3,}|\t+/).map((part) => part.trim()).filter(Boolean);
      if (fields.length < 3 || fields.length > 8) continue;
      if (fields.some((field) => field.length > 80)) continue;
      records.push({
        Entity: fields[0],
        Attributes: fields.slice(1).join(' | '),
      });
    }

    if (records.length < 3) return [];
    return [{
      id: `table_aligned_p${pageNumber}_${Math.random().toString(36).slice(2, 8)}`,
      pageNumber,
      title: `Aligned Records (Page ${pageNumber})`,
      columns: [
        { name: 'Entity', type: 'string' },
        { name: 'Attributes', type: 'string' },
      ],
      rows: records,
      rawMarkdown: records.map((row) => `- **${row.Entity}**: ${row.Attributes}`).join('\n'),
      summary: `Aligned Records (${records.length} records)`,
    }];
  }

  public extractKeyValueSpecs(text: string, pageNumber: number, sectionTitle: string): ExtractedKeyValueSpec[] {
    const specs: ExtractedKeyValueSpec[] = [];
    const regex = /^(?:[*-]\s*)?([A-Za-z0-9][A-Za-z0-9\s/()._\-]{1,50}):\s*(.{1,120})$/;

    for (const line of text.split('\n')) {
      const match = line.trim().match(regex);
      if (!match) continue;
      const key = match[1].trim();
      const value = match[2].trim();
      if (!key || !value || key.toLowerCase().startsWith('http')) continue;

      const numericMatch = value.match(/^([+-]?\d+(?:\.\d+)?)\s*([A-Za-z°/%²³$]+)?/);
      const numericValue = numericMatch ? Number.parseFloat(numericMatch[1]) : undefined;
      specs.push({
        key,
        value,
        numericValue: numericValue !== undefined && Number.isFinite(numericValue) ? numericValue : undefined,
        unit: numericMatch?.[2],
        pageNumber,
        sectionTitle,
      });
    }

    return specs;
  }
}

export const complexPdfParser = new ComplexPdfParser();
