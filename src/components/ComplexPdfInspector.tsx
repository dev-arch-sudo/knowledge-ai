/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Complex PDF & Structured Tables Inspector
 * Visualizes hierarchical table-of-contents (TOC), extracted structured tables,
 * column schema types, and interactive deterministic arithmetic calculations.
 */

import React, { useState, useEffect } from 'react';
import {
  Table as TableIcon,
  RotateCw,
  Search,
  Calculator,
  ListTree,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Hash,
  Filter,
} from 'lucide-react';

interface OutlineNode {
  id: string;
  title: string;
  level: number;
  pageNumber: number;
  documentName: string;
}

interface TableColumn {
  name: string;
  dataType: 'string' | 'number' | 'date';
}

interface StructuredTable {
  id: string;
  title: string;
  pageNumber: number;
  documentName: string;
  sectionTitle: string;
  columns: TableColumn[];
  rows: Record<string, any>[];
  rawMarkdown: string;
}

export const ComplexPdfInspector: React.FC = () => {
  const [tables, setTables] = useState<StructuredTable[]>([]);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'outline'>('tables');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Math sandbox state
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT'>('SUM');
  const [mathResult, setMathResult] = useState<{ value: number; proof: string } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tRes, oRes] = await Promise.all([
        fetch('/api/v1/cognitive/tables'),
        fetch('/api/v1/cognitive/outline'),
      ]);
      const tData = await tRes.json();
      const oData = await oRes.json();

      if (tRes.ok && tData.success) {
        setTables(tData.tables || []);
        if (tData.tables.length > 0 && !selectedTableId) {
          setSelectedTableId(tData.tables[0].id);
          const firstNumericCol = tData.tables[0].columns.find((c: TableColumn) => c.dataType === 'number');
          if (firstNumericCol) setSelectedColumn(firstNumericCol.name);
        }
      }

      if (oRes.ok && oData.success) {
        setOutline(oData.outline || []);
      }
    } catch (err) {
      console.error('Failed to load tables or outline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentTable = tables.find((t) => t.id === selectedTableId) || tables[0];

  // Update selected column when table changes
  useEffect(() => {
    if (currentTable) {
      const numericCol = currentTable.columns.find((c) => c.dataType === 'number');
      if (numericCol) {
        setSelectedColumn(numericCol.name);
      } else if (currentTable.columns.length > 0) {
        setSelectedColumn(currentTable.columns[0].name);
      }
      setMathResult(null);
    }
  }, [selectedTableId]);

  // Execute interactive table math
  const handleCalculate = () => {
    if (!currentTable || !selectedColumn) return;

    const values: number[] = [];
    for (const row of currentTable.rows) {
      const rawVal = row[selectedColumn];
      if (rawVal !== undefined && rawVal !== null) {
        const cleaned = String(rawVal).replace(/[^0-9.-]+/g, '');
        const num = parseFloat(cleaned);
        if (!isNaN(num)) {
          values.push(num);
        }
      }
    }

    if (values.length === 0) {
      setMathResult({
        value: 0,
        proof: `No numeric values detected in column "${selectedColumn}".`,
      });
      return;
    }

    let val = 0;
    let proof = '';

    switch (selectedOperation) {
      case 'SUM':
        val = values.reduce((a, b) => a + b, 0);
        proof = `SUM: ${values.join(' + ')} = ${val}`;
        break;
      case 'AVG':
        val = values.reduce((a, b) => a + b, 0) / values.length;
        proof = `AVG: (${values.join(' + ')}) / ${values.length} = ${val.toFixed(2)}`;
        break;
      case 'MIN':
        val = Math.min(...values);
        proof = `MIN: min(${values.join(', ')}) = ${val}`;
        break;
      case 'MAX':
        val = Math.max(...values);
        proof = `MAX: max(${values.join(', ')}) = ${val}`;
        break;
      case 'COUNT':
        val = values.length;
        proof = `COUNT: ${values.length} non-empty numeric entries.`;
        break;
    }

    setMathResult({ value: val, proof });
  };

  return (
    <div id="complex-pdf-inspector" className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Complex PDF Parser & Structured Tables Engine
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Extracts layout-aware data structures: tabular grids, column datatypes, technical specifications, and document outline hierarchy.
          </p>
        </div>

        {/* View Switcher + Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab('tables')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === 'tables'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Structured Tables ({tables.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('outline')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === 'outline'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListTree className="w-3.5 h-3.5 text-purple-600" />
              <span>Document Outline ({outline.length})</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {activeTab === 'tables' ? (
        <div className="space-y-6">
          {/* Table Selector Pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-slate-500 mr-1">Extracted Tables:</span>
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTableId(t.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  currentTable?.id === t.id
                    ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <span>{t.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  currentTable?.id === t.id ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  p. {t.pageNumber}
                </span>
              </button>
            ))}
          </div>

          {currentTable && (
            <>
              {/* Interactive Deterministic Math Engine Sandbox */}
              <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-slate-50 rounded-xl border border-indigo-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Deterministic Table Arithmetic & Aggregation Sandbox
                  </h4>
                </div>
                <p className="text-[11px] text-slate-600 mb-3">
                  Compute provable mathematical operations directly over column values from this table without probabilistic LLM hallucination.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
                    <span className="text-slate-400 font-semibold">Column:</span>
                    <select
                      value={selectedColumn}
                      onChange={(e) => setSelectedColumn(e.target.value)}
                      className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                    >
                      {currentTable.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.dataType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
                    <span className="text-slate-400 font-semibold">Operation:</span>
                    <select
                      value={selectedOperation}
                      onChange={(e) => setSelectedOperation(e.target.value as any)}
                      className="bg-transparent font-semibold text-indigo-700 focus:outline-hidden cursor-pointer"
                    >
                      <option value="SUM">SUM (Total)</option>
                      <option value="AVG">AVG (Average)</option>
                      <option value="MIN">MIN (Minimum)</option>
                      <option value="MAX">MAX (Maximum)</option>
                      <option value="COUNT">COUNT (Rows)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleCalculate}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Calculate</span>
                  </button>
                </div>

                {mathResult && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-indigo-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Mathematical Proof:
                      </span>
                      <span className="font-mono text-slate-700 text-xs">{mathResult.proof}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-indigo-500 uppercase font-semibold block">Result</span>
                      <span className="text-base font-bold font-mono text-indigo-700">
                        {typeof mathResult.value === 'number' ? mathResult.value.toLocaleString() : mathResult.value}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Table Metadata & Data Grid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Card Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{currentTable.title}</h4>
                    <span className="text-xs text-slate-500">
                      Found in {currentTable.sectionTitle} • Page {currentTable.pageNumber} • {currentTable.rows.length} rows, {currentTable.columns.length} columns
                    </span>
                  </div>

                  {/* Column Schema Pills */}
                  <div className="flex flex-wrap gap-1">
                    {currentTable.columns.map((c) => (
                      <span
                        key={c.name}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 flex items-center gap-1"
                      >
                        <Hash className="w-2.5 h-2.5 text-indigo-400" />
                        <span>{c.name}:</span>
                        <span className="font-semibold text-indigo-700">{c.dataType}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Data Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200 text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 w-12 text-slate-400">#</th>
                        {currentTable.columns.map((col) => (
                          <th key={col.name} className="px-4 py-2.5">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentTable.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-4 py-2 text-slate-400 font-mono text-[10px]">{rIdx + 1}</td>
                          {currentTable.columns.map((col) => {
                            const val = row[col.name];
                            return (
                              <td key={col.name} className="px-4 py-2 font-medium text-slate-800">
                                {val !== undefined && val !== null ? String(val) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Outline TOC View */
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
            <ListTree className="w-4 h-4 text-purple-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Document Structural Hierarchy (TOC)
            </h4>
          </div>

          {outline.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No document outline detected. Upload a structured PDF document to parse headings.
            </div>
          ) : (
            <div className="space-y-2">
              {outline.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-xs"
                  style={{ marginLeft: `${(item.level - 1) * 20}px` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span className={`font-semibold ${item.level === 1 ? 'text-slate-900 text-sm' : 'text-slate-700'}`}>
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-100">
                    Page {item.pageNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
