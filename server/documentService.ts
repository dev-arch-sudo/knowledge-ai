import { createRequire } from 'module';
import { KnowledgeDocument, DocumentPage } from '../src/types.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export async function parsePdfBuffer(
  filename: string,
  buffer: Buffer
): Promise<{ pageCount: number; pages: DocumentPage[]; summary: string }> {
  let parser: any = null;
  try {
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();

    const pageCount = parsed.total || (parsed.pages ? parsed.pages.length : 1);
    const pages: DocumentPage[] = [];

    if (parsed.pages && parsed.pages.length > 0) {
      for (const p of parsed.pages) {
        pages.push({
          pageNumber: p.num || pages.length + 1,
          text: (p.text || '').trim(),
        });
      }
    } else {
      // Fallback if pages array wasn't populated directly
      const fullText = (parsed.text || '').trim();
      pages.push({
        pageNumber: 1,
        text: fullText,
      });
    }

    // Generate a quick concise summary of the document for indexing
    const firstPageSnippet = pages[0]?.text.slice(0, 300).replace(/\s+/g, ' ') || 'Document processed';
    const summary = `${filename} (${pageCount} page${pageCount > 1 ? 's' : ''}) - Initial section: "${firstPageSnippet}..."`;

    return {
      pageCount,
      pages,
      summary,
    };
  } catch (err: any) {
    console.error(`Error parsing PDF ${filename}:`, err);
    throw new Error(`Failed to parse PDF: ${err.message || 'Corrupted or unreadable format'}`);
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch (dErr) {
        // Ignore destroy error
      }
    }
  }
}

export function createKnowledgeDocument(
  filename: string,
  buffer: Buffer,
  pageCount: number,
  pages: DocumentPage[],
  summary: string
): KnowledgeDocument {
  const id = 'doc_' + Math.random().toString(36).substring(2, 10);
  return {
    id,
    filename,
    fileType: 'application/pdf',
    fileSize: buffer.length,
    uploadTimestamp: Date.now(),
    processingStatus: 'processed',
    pageCount,
    pages,
    summary,
  };
}
