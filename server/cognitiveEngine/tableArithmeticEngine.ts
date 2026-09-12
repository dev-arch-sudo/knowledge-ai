/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generic deterministic table arithmetic engine.
 * All operands are derived from extracted document tables at runtime.
 */

import { ExtractedStructuredTable, ParsedTableRow } from './complexPdfParser.js';

export interface ArithmeticExecutionResult {
  isApplicable: boolean;
  operation: 'SUM' | 'DIFFERENCE' | 'PRODUCT' | 'RATIO' | 'PERCENTAGE' | 'RANK_SELECTION' | 'AGGREGATE_TABLE' | 'CUSTOM';
  operands: Array<{ label: string; value: number; unit?: string }>;
  computedValue: number | string;
  formattedFormula: string;
  stepByStepProof: string;
  groundedAnswer: string;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9%\s.-]/g, ' ').split(/\s+/).filter((word) => word.length > 2);
}

function relevance(query: string, text: string): number {
  const queryWords = words(query);
  if (!queryWords.length) return 0;
  const lower = text.toLowerCase();
  return queryWords.filter((word) => lower.includes(word)).length / queryWords.length;
}

function numericColumns(table: ExtractedStructuredTable): string[] {
  return table.columns
    .filter((column) => column.type === 'number' || column.type === 'percentage')
    .map((column) => column.name);
}

function rowLabel(row: ParsedTableRow): string {
  const firstText = Object.values(row).find((value) => typeof value === 'string' && value.trim().length > 0);
  return firstText ? String(firstText) : 'Row';
}

function numberFrom(row: ParsedTableRow, column: string): number | null {
  const raw = row[column];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.replace(/[,$%]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export class TableArithmeticEngine {
  public evaluateArithmeticOrTabularQuery(
    question: string,
    extractedTables: ExtractedStructuredTable[] = []
  ): ArithmeticExecutionResult | null {
    if (!extractedTables.length) return null;
    const q = question.toLowerCase();
    const wantsMath = /\b(total|sum|combined|average|mean|difference|how many more|how much more|ratio|percentage|percent|largest|highest|most|smallest|lowest|least|second largest|second highest)\b/.test(q);
    if (!wantsMath) return null;

    const rankedTables = extractedTables
      .map((table) => ({ table, score: relevance(question, `${table.title || ''} ${table.summary} ${table.columns.map((column) => column.name).join(' ')}`) }))
      .sort((a, b) => b.score - a.score);

    for (const { table } of rankedTables) {
      const columns = numericColumns(table);
      if (!columns.length || table.rows.length === 0) continue;

      const rankedColumns = columns
        .map((column) => ({ column, score: relevance(question, column) }))
        .sort((a, b) => b.score - a.score);
      const column = rankedColumns[0].column;
      const values = table.rows
        .map((row) => ({ label: rowLabel(row), value: numberFrom(row, column), row }))
        .filter((item): item is { label: string; value: number; row: ParsedTableRow } => item.value !== null);
      if (!values.length) continue;

      const mentionedRows = values.filter((item) => q.includes(item.label.toLowerCase()));
      const selected = mentionedRows.length >= 1 ? mentionedRows : values;

      if (/\b(second largest|second highest|2nd largest|2nd highest)\b/.test(q) && values.length >= 2) {
        const ordered = [...values].sort((a, b) => b.value - a.value);
        const winner = ordered[1];
        return {
          isApplicable: true,
          operation: 'RANK_SELECTION',
          operands: ordered.map((item) => ({ label: item.label, value: item.value })),
          computedValue: `${winner.label} (${winner.value})`,
          formattedFormula: ordered.map((item, index) => `#${index + 1} ${item.label}: ${item.value}`).join(' > '),
          stepByStepProof: `Read ${column} from table "${table.title || 'Table'}" on page ${table.pageNumber}, sort descending, and select rank 2.`,
          groundedAnswer: `Based on **${table.title || `the table on page ${table.pageNumber}`}**, the second-highest **${column}** is **${winner.label}** with **${winner.value}**.`,
        };
      }

      if (/\b(largest|highest|most|maximum)\b/.test(q)) {
        const winner = [...selected].sort((a, b) => b.value - a.value)[0];
        return {
          isApplicable: true,
          operation: 'RANK_SELECTION',
          operands: selected.map((item) => ({ label: item.label, value: item.value })),
          computedValue: `${winner.label} (${winner.value})`,
          formattedFormula: `MAX(${column}) = ${winner.value}`,
          stepByStepProof: `Read ${column} from table "${table.title || 'Table'}" and select the maximum value.`,
          groundedAnswer: `Based on **${table.title || `the table on page ${table.pageNumber}`}**, **${winner.label}** has the highest **${column}** at **${winner.value}**.`,
        };
      }

      if (/\b(smallest|lowest|least|minimum)\b/.test(q)) {
        const winner = [...selected].sort((a, b) => a.value - b.value)[0];
        return {
          isApplicable: true,
          operation: 'RANK_SELECTION',
          operands: selected.map((item) => ({ label: item.label, value: item.value })),
          computedValue: `${winner.label} (${winner.value})`,
          formattedFormula: `MIN(${column}) = ${winner.value}`,
          stepByStepProof: `Read ${column} from table "${table.title || 'Table'}" and select the minimum value.`,
          groundedAnswer: `Based on **${table.title || `the table on page ${table.pageNumber}`}**, **${winner.label}** has the lowest **${column}** at **${winner.value}**.`,
        };
      }

      if (/\b(difference|how many more|how much more)\b/.test(q) && selected.length >= 2) {
        const [first, second] = selected.slice(0, 2);
        const difference = Math.abs(first.value - second.value);
        return {
          isApplicable: true,
          operation: 'DIFFERENCE',
          operands: [
            { label: first.label, value: first.value },
            { label: second.label, value: second.value },
          ],
          computedValue: difference,
          formattedFormula: `|${first.value} - ${second.value}| = ${difference}`,
          stepByStepProof: `Read ${first.label}=${first.value} and ${second.label}=${second.value} from ${column}, then compute the absolute difference.`,
          groundedAnswer: `The difference in **${column}** between **${first.label}** and **${second.label}** is **${difference}**.`,
        };
      }

      if (/\b(percentage|percent)\b/.test(q) && selected.length >= 1) {
        const numerator = selected[0];
        const total = values.reduce((sum, item) => sum + item.value, 0);
        if (total !== 0) {
          const percentage = (numerator.value / total) * 100;
          return {
            isApplicable: true,
            operation: 'PERCENTAGE',
            operands: [
              { label: numerator.label, value: numerator.value },
              { label: `Total ${column}`, value: total },
            ],
            computedValue: percentage,
            formattedFormula: `${numerator.value} / ${total} × 100 = ${percentage.toFixed(2)}%`,
            stepByStepProof: `Sum ${column} across the table (${total}), divide ${numerator.label}'s value (${numerator.value}) by that total, then multiply by 100.`,
            groundedAnswer: `**${numerator.label}** represents **${percentage.toFixed(2)}%** of the table total for **${column}**.`,
          };
        }
      }

      if (/\b(average|mean)\b/.test(q)) {
        const average = selected.reduce((sum, item) => sum + item.value, 0) / selected.length;
        return {
          isApplicable: true,
          operation: 'AGGREGATE_TABLE',
          operands: selected.map((item) => ({ label: item.label, value: item.value })),
          computedValue: average,
          formattedFormula: `AVG(${column}) = ${average.toFixed(2)}`,
          stepByStepProof: `Read ${selected.length} values from ${column} and divide their sum by ${selected.length}.`,
          groundedAnswer: `Based on **${table.title || `the table on page ${table.pageNumber}`}**, the average **${column}** is **${average.toFixed(2)}**.`,
        };
      }

      if (/\b(total|sum|combined)\b/.test(q)) {
        const total = selected.reduce((sum, item) => sum + item.value, 0);
        return {
          isApplicable: true,
          operation: 'AGGREGATE_TABLE',
          operands: selected.map((item) => ({ label: item.label, value: item.value })),
          computedValue: total,
          formattedFormula: selected.map((item) => item.value).join(' + ') + ` = ${total}`,
          stepByStepProof: `Read ${column} from ${selected.length} matching table rows and sum the values.`,
          groundedAnswer: `Based on **${table.title || `the table on page ${table.pageNumber}`}**, the combined **${column}** is **${total}**.`,
        };
      }
    }

    return null;
  }
}

export const tableArithmeticEngine = new TableArithmeticEngine();
