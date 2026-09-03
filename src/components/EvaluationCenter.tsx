import React, { useState } from 'react';
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  FileText,
  Quote,
  Target,
  BarChart2,
  FileCheck,
} from 'lucide-react';
import {
  KnowledgeBase,
  EvaluationRun,
  EvaluationTestCase,
  TestCaseResult,
} from '../types';

interface EvaluationCenterProps {
  activeKb: KnowledgeBase;
  onRunEvaluation: () => Promise<void>;
  onAddTestCase: (tc: Omit<EvaluationTestCase, 'id'>) => Promise<void>;
  onDeleteTestCase: (id: string) => Promise<void>;
  isRunningEvaluation: boolean;
}

export const EvaluationCenter: React.FC<EvaluationCenterProps> = ({
  activeKb,
  onRunEvaluation,
  onAddTestCase,
  onDeleteTestCase,
  isRunningEvaluation,
}) => {
  const [activeTab, setActiveTab] = useState<'latest' | 'test-cases' | 'history'>('latest');
  const [isAddingTestCase, setIsAddingTestCase] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState<'grounded' | 'cross-document' | 'negative-refusal'>('grounded');
  const [newExpectedBehavior, setNewExpectedBehavior] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newMustRefuse, setNewMustRefuse] = useState(false);
  const [isSubmittingTestCase, setIsSubmittingTestCase] = useState(false);
  const [expandedResultIdx, setExpandedResultIdx] = useState<number | null>(null);

  const runs = activeKb.evaluationRuns || [];
  const latestRun: EvaluationRun | null = runs.length > 0 ? runs[runs.length - 1] : null;
  const testCases = activeKb.testCases || [];

  const handleAddTestCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setIsSubmittingTestCase(true);
    try {
      const kwList = newKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      await onAddTestCase({
        kbId: activeKb.id,
        question: newQuestion.trim(),
        category: newCategory,
        expectedBehavior: newExpectedBehavior.trim() || 'Verify against documents',
        expectedKeywords: kwList.length > 0 ? kwList : undefined,
        mustRefuse: newMustRefuse || newCategory === 'negative-refusal',
      });

      setNewQuestion('');
      setNewExpectedBehavior('');
      setNewKeywords('');
      setNewMustRefuse(false);
      setIsAddingTestCase(false);
    } finally {
      setIsSubmittingTestCase(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'grounded':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Factual Recall
          </span>
        );
      case 'cross-document':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Cross-Document
          </span>
        );
      case 'negative-refusal':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Negative Refusal
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {cat}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                AI Evaluation & Grounding Benchmark
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Test factual recall, multi-document synthesis, and strict negative-refusal guardrails
              against &ldquo;{activeKb.name}&rdquo;.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-run-evaluation"
              onClick={onRunEvaluation}
              disabled={isRunningEvaluation}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isRunningEvaluation ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isRunningEvaluation ? 'Evaluating Suite...' : 'Run Benchmark Suite'}</span>
            </button>
          </div>
        </div>

        {/* Scorecards */}
        {latestRun ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Overall Accuracy
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-2xl font-black ${
                    latestRun.accuracyScore >= 80 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {latestRun.accuracyScore}%
                </span>
                <span className="text-xs text-slate-400">
                  {latestRun.passedCount}/{latestRun.totalTests} passed
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Factual Recall
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">
                  {latestRun.groundedScore}%
                </span>
                <span className="text-xs text-slate-400">Grounded</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Refusal Precision
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-amber-600">
                  {latestRun.refusalScore}%
                </span>
                <span className="text-xs text-slate-400">Out-of-domain</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Multi-Doc Synthesis
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-600">
                  {latestRun.crossDocScore}%
                </span>
                <span className="text-xs text-slate-400">Cross-Doc</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-xs">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-900">No evaluation runs yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Run the benchmark suite to test if the Specialized AI correctly retrieves document facts,
              synthesizes multi-document procedures, and rejects ungrounded queries.
            </p>
            <button
              onClick={onRunEvaluation}
              disabled={isRunningEvaluation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run First Benchmark</span>
            </button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('latest')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'latest'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Latest Run Details ({latestRun?.results.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('test-cases')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'test-cases'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Test Suite Cases ({testCases.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Run History ({runs.length})
          </button>
        </div>

        {/* TAB 1: Latest Run Details */}
        {activeTab === 'latest' && (
          <div className="space-y-3">
            {latestRun ? (
              latestRun.results.map((res, idx) => {
                const isExpanded = expandedResultIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`border rounded-xl p-4 bg-white transition-all ${
                      res.passed
                        ? 'border-slate-200 hover:border-slate-300'
                        : 'border-red-200 bg-red-50/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900">
                              {res.question}
                            </span>
                            {getCategoryBadge(res.category)}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {res.reason || res.expectedBehavior}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto text-xs shrink-0">
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {res.latencyMs} ms
                        </span>
                        <button
                          onClick={() => setExpandedResultIdx(isExpanded ? null : idx)}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <span>{isExpanded ? 'Hide Answer' : 'View Answer'}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-2">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                            Actual AI Answer:
                          </span>
                          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {res.actualAnswer}
                          </p>
                        </div>

                        {res.citations && res.citations.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                              Citations:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {res.citations.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                                >
                                  <Quote className="w-2.5 h-2.5 text-slate-400" />
                                  {c.documentName} (p. {c.pageNumber})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Click &ldquo;Run Benchmark Suite&rdquo; to execute evaluation tests.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Test Suite Cases */}
        {activeTab === 'test-cases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-800">
                  Evaluation Test Cases ({testCases.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Standardized test questions that assess grounding, cross-referencing, and refusal.
                </p>
              </div>
              <button
                onClick={() => setIsAddingTestCase(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Test Case</span>
              </button>
            </div>

            {isAddingTestCase && (
              <form
                onSubmit={handleAddTestCaseSubmit}
                className="bg-white border border-indigo-200 rounded-xl p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Add Evaluation Test Case
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingTestCase(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Test Question
                    </label>
                    <input
                      type="text"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="e.g. What is the emergency shutoff protocol?"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) =>
                        setNewCategory(
                          e.target.value as 'grounded' | 'cross-document' | 'negative-refusal'
                        )
                      }
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="grounded">Factual Recall</option>
                      <option value="cross-document">Cross-Document</option>
                      <option value="negative-refusal">Negative Refusal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Expected Behavior / Success Criteria
                  </label>
                  <input
                    type="text"
                    value={newExpectedBehavior}
                    onChange={(e) => setNewExpectedBehavior(e.target.value)}
                    placeholder="e.g. Must state emergency stop lever located on console and cite Page 3"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Expected Keywords (comma-separated, optional)
                  </label>
                  <input
                    type="text"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    placeholder="e.g. 50 PSI, safety, lever"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="chk-must-refuse"
                    type="checkbox"
                    checked={newMustRefuse}
                    onChange={(e) => setNewMustRefuse(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="chk-must-refuse" className="text-xs text-slate-700 cursor-pointer">
                    Must explicitly refuse (for out-of-domain knowledge queries)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingTestCase(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTestCase || !newQuestion.trim()}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                  >
                    Add Test Case
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {testCases.map((tc) => (
                <div
                  key={tc.id}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-start gap-3">
                    <Target className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900">{tc.question}</span>
                        {getCategoryBadge(tc.category)}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{tc.expectedBehavior}</p>
                      {tc.expectedKeywords && tc.expectedKeywords.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                          <span>Keywords:</span>
                          <span className="font-mono text-slate-600">
                            {tc.expectedKeywords.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteTestCase(tc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete test case"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: History */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {runs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No evaluation runs recorded.</div>
            ) : (
              runs
                .slice()
                .reverse()
                .map((run) => (
                  <div
                    key={run.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {run.versionTag}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">
                          {run.passedCount} / {run.totalTests} tests passed
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        {new Date(run.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-lg font-bold ${
                          run.accuracyScore >= 80 ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {run.accuracyScore}%
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
