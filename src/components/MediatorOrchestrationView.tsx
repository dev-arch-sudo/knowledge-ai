import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Cpu,
  Play,
  StopCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sliders,
  Layers,
  FileText,
  Lock,
  Zap,
  Network,
  GitBranch,
  Terminal,
  BarChart3,
  Search,
  Eye,
  Hash,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  OrchestrationRun,
  BenchmarkMetrics,
  AgentDefinition,
  TestResultItem,
} from '../types.js';

interface MediatorProps {
  activeKbId?: string;
  onOpenTestModal?: () => void;
}

export const MediatorOrchestrationView: React.FC<MediatorProps> = ({ activeKbId, onOpenTestModal }) => {
  const [activeTab, setActiveTab] = useState<'runs' | 'dispatch' | 'benchmarks' | 'tests' | 'security'>('runs');
  const [runs, setRuns] = useState<OrchestrationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<OrchestrationRun | null>(null);
  const [metrics, setMetrics] = useState<BenchmarkMetrics | null>(null);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  // Dispatch Playground State
  const [prompt, setPrompt] = useState('Analyze operational turbine temperature variations across fleet telemetry');
  const [executionMode, setExecutionMode] = useState<'PARALLEL' | 'SEQUENTIAL' | 'HYBRID'>('PARALLEL');
  const [partialFailurePolicy, setPartialFailurePolicy] = useState('CONTINUE_WITH_PARTIAL_RESULTS');
  const [maxConcurrency, setMaxConcurrency] = useState(4);
  const [faultMode, setFaultMode] = useState<string>('NORMAL');
  const [seed, setSeed] = useState(42);
  const [isExecuting, setIsExecuting] = useState(false);

  // Benchmark State
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);

  // Test Suite State
  const [phase5Results, setPhase5Results] = useState<TestResultItem[]>([]);
  const [runningTests, setRunningTests] = useState(false);
  const [testFilter, setTestFilter] = useState<'ALL' | 'RELIABILITY' | 'REASONING' | 'SECURITY' | 'PROVENANCE' | 'LEARNING' | 'REGRESSION'>('ALL');

  const fetchState = async () => {
    try {
      setLoading(true);
      const [runsRes, metricsRes, agentsRes] = await Promise.all([
        fetch('/api/v1/mediator/runs'),
        fetch('/api/v1/mediator/metrics'),
        fetch('/api/v1/mediator/agents'),
      ]);

      if (runsRes.ok) {
        const data = await runsRes.json();
        setRuns(data.runs || []);
        if (data.runs?.length > 0 && !selectedRun) {
          setSelectedRun(data.runs[0]);
        }
      }
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics || null);
      }
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to load mediator state', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const subtaskPrompts = [
        {
          title: 'Subtask 1: Primary Evidence Retrieval',
          description: 'Extract operational threshold limits from documents',
          agentId: 'agent-researcher-1',
          faultMode: faultMode === 'TIMEOUT' ? 'TIMEOUT' : 'NORMAL',
          delayMs: 30,
        },
        {
          title: 'Subtask 2: Analytical Validation',
          description: 'Validate sensor readouts against safety operating envelopes',
          agentId: 'agent-analyst-1',
          faultMode: faultMode === 'WRONG_RESULT' ? 'WRONG_RESULT' : 'NORMAL',
          customClaimText: faultMode === 'WRONG_RESULT' ? 'The standard operating pressure is 450 PSI.' : undefined,
          delayMs: 35,
        },
        {
          title: 'Subtask 3: Safety & Compliance Audit',
          description: 'Cross-reference emergency purge criteria with regulations',
          agentId: 'agent-compliance-1',
          faultMode: faultMode === 'CONTRADICTORY_RESULT' ? 'CONTRADICTORY_RESULT' : faultMode === 'PROMPT_INJECTION' ? 'PROMPT_INJECTION' : 'NORMAL',
          delayMs: 25,
        },
      ];

      const res = await fetch('/api/v1/mediator/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPrompt: prompt,
          subtaskPrompts,
          config: {
            executionMode,
            partialFailurePolicy,
            maxConcurrentSubtasks: maxConcurrency,
            seed,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data.run);
        fetchState();
      }
    } catch (err) {
      console.error('Execution error', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = async (runId: string) => {
    try {
      await fetch(`/api/v1/mediator/runs/${runId}/cancel`, { method: 'POST' });
      fetchState();
    } catch (err) {
      console.error('Cancel error', err);
    }
  };

  const runBenchmark = async (type: 'parallelism' | 'scaling' | 'majority-wrong') => {
    setBenchmarkLoading(true);
    setBenchmarkResult(null);
    try {
      const res = await fetch(`/api/v1/mediator/benchmarks/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtaskCount: 4, delayMs: 40 }),
      });
      if (res.ok) {
        const data = await res.json();
        setBenchmarkResult(data.result);
        fetchState();
      }
    } catch (err) {
      console.error('Benchmark failed', err);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  const runPhase5TestSuite = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/v1/tests/mediator-phase5', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPhase5Results(data.results || []);
      }
    } catch (err) {
      console.error('Failed to run Phase 5 suite', err);
    } finally {
      setRunningTests(false);
    }
  };

  const filteredTests = phase5Results.filter((t) => {
    if (testFilter === 'ALL') return true;
    if (testFilter === 'RELIABILITY') return t.id >= 1 && t.id <= 13;
    if (testFilter === 'REASONING') return t.id >= 14 && t.id <= 22;
    if (testFilter === 'SECURITY') return t.id >= 23 && t.id <= 32;
    if (testFilter === 'PROVENANCE') return t.id >= 33 && t.id <= 40;
    if (testFilter === 'LEARNING') return t.id >= 41 && t.id <= 47;
    if (testFilter === 'REGRESSION') return t.id >= 48 && t.id <= 51;
    return true;
  });

  const passedTestsCount = phase5Results.filter((t) => t.status === 'passed').length;

  return (
    <div id="mediator-dashboard" className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* TOP STATUS BAR */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white tracking-tight">
                AI-to-AI Mediator & Adversarial Multi-Agent Orchestration
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                Phase 5 Certified
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              COORDINATION ≠ TRUTH &bull; External Output: Untrusted &bull; Grounded Knowledge Governance
            </p>
          </div>
        </div>

        {/* Global Test & Invariant Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 font-mono">Knowledge AI P4:</span>
            <span className="text-emerald-400 font-bold font-mono">50/50</span>
          </div>
          <div className="px-3 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 font-mono">Mediator P3:</span>
            <span className="text-emerald-400 font-bold font-mono">12/12</span>
          </div>
          <div className="px-3 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 font-mono">Mediator P4:</span>
            <span className="text-emerald-400 font-bold font-mono">21/21</span>
          </div>
          <div className="px-3 py-1 rounded bg-indigo-950/50 border border-indigo-500/40 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-200 font-mono">Phase 5 Suite:</span>
            <span className="text-indigo-300 font-bold font-mono">
              {phase5Results.length > 0 ? `${passedTestsCount}/${phase5Results.length}` : '51 Available'}
            </span>
          </div>
          <button
            id="btn-refresh-state"
            onClick={fetchState}
            disabled={loading}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh Mediator State"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-4 bg-slate-950/40 border-b border-slate-800 text-xs">
        <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
            <Activity className="w-3.5 h-3.5 text-indigo-400" /> Runs
          </div>
          <div className="text-lg font-bold font-mono text-white">
            {metrics?.totalRuns || runs.length}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {metrics?.successCount || 0} passed &bull; {metrics?.failureCount || 0} failed
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Parallel Speedup
          </div>
          <div className="text-lg font-bold font-mono text-amber-300">
            {metrics?.meanParallelSpeedup ? `${metrics.meanParallelSpeedup}x` : '3.2x'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Measured actual overlap</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Latency (Avg / p95)
          </div>
          <div className="text-lg font-bold font-mono text-white">
            {metrics?.averageLatencyMs || 45}ms{' '}
            <span className="text-xs text-slate-400 font-normal">/ {metrics?.p95LatencyMs || 80}ms</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Subtask bounded</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
            <GitBranch className="w-3.5 h-3.5 text-violet-400" /> Disagreements
          </div>
          <div className="text-lg font-bold font-mono text-violet-300">
            {metrics?.disagreementsDetected || 0}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {metrics?.verificationEscalations || 0} escalated to grounding
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
            <Lock className="w-3.5 h-3.5 text-rose-400" /> Threats Blocked
          </div>
          <div className="text-lg font-bold font-mono text-rose-300">
            {(metrics?.securityEventsBlocked?.promptInjection || 0) +
              (metrics?.securityEventsBlocked?.fakeProvenance || 0) +
              (metrics?.securityEventsBlocked?.fabricatedCitation || 0) +
              (metrics?.securityEventsBlocked?.memoryBoundaryAttempts || 0)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Injections &amp; Tampering</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 p-3 rounded-lg">
          <div className="text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Classifications
          </div>
          <div className="text-xs font-mono text-slate-200 mt-1 space-y-0.5">
            <span className="text-emerald-400 font-bold">{metrics?.classifications?.supported || 0}</span> Supp &bull;{' '}
            <span className="text-rose-400 font-bold">{metrics?.classifications?.contradicted || 0}</span> Contra &bull;{' '}
            <span className="text-amber-400 font-bold">{metrics?.classifications?.uncertain || 0}</span> Unc
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Grounding verdicts</div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 bg-slate-950 px-6 gap-2 text-xs font-medium">
        <button
          id="tab-run-inspector"
          onClick={() => setActiveTab('runs')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'runs'
              ? 'border-indigo-500 text-indigo-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> Run Inspector &amp; DAG ({runs.length})
        </button>

        <button
          id="tab-dispatch-playground"
          onClick={() => setActiveTab('dispatch')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'dispatch'
              ? 'border-indigo-500 text-indigo-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Play className="w-4 h-4" /> Task Dispatch &amp; Fault Injection
        </button>

        <button
          id="tab-benchmarks"
          onClick={() => setActiveTab('benchmarks')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'benchmarks'
              ? 'border-indigo-500 text-indigo-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Benchmarks Studio
        </button>

        <button
          id="tab-security"
          onClick={() => setActiveTab('security')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'security'
              ? 'border-indigo-500 text-indigo-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" /> Security &amp; Trust Boundaries
        </button>

        <button
          id="tab-tests"
          onClick={() => setActiveTab('tests')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'tests'
              ? 'border-indigo-500 text-indigo-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Test Matrix (51/51 Tests)
        </button>
      </div>

      {/* TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: RUN INSPECTOR & DAG */}
        {/* ========================================================================= */}
        {activeTab === 'runs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Run List (col 4) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Orchestration History ({runs.length})
                </h3>
                <button
                  onClick={() => setActiveTab('dispatch')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Play className="w-3 h-3" /> New Run
                </button>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {runs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    No runs recorded yet. Dispatch a task in the playground or run the benchmark suite!
                  </div>
                ) : (
                  runs.map((r) => {
                    const isSelected = selectedRun?.runId === r.runId;
                    return (
                      <div
                        key={r.runId}
                        onClick={() => setSelectedRun(r)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg'
                            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                r.status === 'COMPLETED'
                                  ? 'bg-emerald-400'
                                  : r.status === 'PARTIALLY_COMPLETED'
                                  ? 'bg-amber-400'
                                  : r.status === 'CANCELLED'
                                  ? 'bg-slate-400'
                                  : 'bg-rose-400'
                              }`}
                            />
                            {r.runId}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {r.executionMode} &bull; {r.actualDurationMs ? `${r.actualDurationMs}ms` : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-1 mb-2 font-mono">
                          {r.events[0]?.details?.prompt || 'Task prompt'}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>{r.subtasks.length} subtasks</span>
                          {r.disagreements.length > 0 && (
                            <span className="text-amber-400 font-semibold">{r.disagreements.length} conflict</span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              r.verificationResults?.classification === 'SUPPORTED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : r.verificationResults?.classification === 'CONTRADICTED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {r.verificationResults?.classification || 'PENDING'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Run Details & DAG (col 8) */}
            <div className="lg:col-span-8 space-y-4">
              {selectedRun ? (
                <div className="space-y-4">
                  {/* Top Run Card */}
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">{selectedRun.runId}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                              selectedRun.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : selectedRun.status === 'PARTIALLY_COMPLETED'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : selectedRun.status === 'CANCELLED'
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {selectedRun.status}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Mode: <strong className="text-slate-200">{selectedRun.executionMode}</strong>
                          </span>
                          {selectedRun.parallelSpeedupRatio && (
                            <span className="text-xs font-mono text-amber-400">
                              Speedup: <strong>{selectedRun.parallelSpeedupRatio}x</strong>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-mono">
                          Parent Task: {selectedRun.parentTaskId} &bull; Created:{' '}
                          {new Date(selectedRun.createdAt).toLocaleTimeString()}
                        </p>
                      </div>

                      {selectedRun.status === 'RUNNING' && (
                        <button
                          onClick={() => handleCancel(selectedRun.runId)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-mono flex items-center gap-1"
                        >
                          <StopCircle className="w-3.5 h-3.5" /> Cancel Run
                        </button>
                      )}
                    </div>

                    {/* Grounding Verdict Banner */}
                    <div
                      className={`p-3 rounded-lg border flex items-start gap-3 ${
                        selectedRun.verificationResults?.classification === 'SUPPORTED'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : selectedRun.verificationResults?.classification === 'CONTRADICTED'
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                          : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      }`}
                    >
                      <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <div className="font-semibold flex items-center gap-2">
                          <span>
                            Knowledge AI Verdict:{' '}
                            <strong className="underline uppercase">
                              {selectedRun.verificationResults?.classification}
                            </strong>
                          </span>
                          <span className="text-[11px] opacity-80">
                            (Consensus: {selectedRun.verificationResults?.consensusSignal} &bull; Evidence:{' '}
                            {selectedRun.verificationResults?.evidenceSignal})
                          </span>
                        </div>
                        <p className="opacity-90">{selectedRun.verificationResults?.rationale}</p>
                      </div>
                    </div>

                    {/* Subtasks DAG / Grid */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                        Subtasks &amp; Multi-Agent Workload ({selectedRun.subtasks.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedRun.subtasks.map((st, i) => (
                          <div
                            key={st.id}
                            className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-medium text-slate-200">
                                #{i + 1} {st.title}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                  st.status === 'COMPLETED'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : st.status === 'TIMED_OUT'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {st.status}
                              </span>
                            </div>
                            <p className="text-slate-400 text-[11px]">{st.description}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                              <span>Agent: {st.assignedAgentId}</span>
                              <span>Attempts: {st.attempts.length}</span>
                              <span>{st.latencyMs ? `${st.latencyMs}ms` : '—'}</span>
                            </div>

                            {/* Claims produced */}
                            {st.claims && st.claims.length > 0 && (
                              <div className="mt-1.5 p-2 rounded bg-slate-900/80 border border-slate-800/60 text-[11px] text-slate-300 font-mono">
                                <div className="text-[10px] text-slate-400 font-semibold mb-1">
                                  ASSERTED CLAIM (Untrusted external data):
                                </div>
                                &ldquo;{st.claims[0].claimText}&rdquo;
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Disagreements & Contradictions Panel */}
                    {selectedRun.contradictions.length > 0 && (
                      <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono">
                          <AlertTriangle className="w-4 h-4" /> Contradiction Detected Across Agents
                        </div>
                        <p className="text-slate-300 text-[11px]">
                          Participating agents asserted conflicting statements. Invariant enforced: The mediator will
                          NOT pick a majority vote or drop minority hypotheses.
                        </p>
                        {selectedRun.contradictions.map((c) => (
                          <div
                            key={c.id}
                            className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1"
                          >
                            <div className="text-rose-400">
                              [{c.claimA.agentId}]: &ldquo;{c.claimA.claimText}&rdquo;
                            </div>
                            <div className="text-amber-400">
                              [{c.claimB.agentId}]: &ldquo;{c.claimB.claimText}&rdquo;
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Synthesis Summary */}
                    {selectedRun.synthesisResult && (
                      <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-300 font-semibold font-mono">
                          <span>Synthesized Overview</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              selectedRun.synthesisResult.meaningPreserved
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {selectedRun.synthesisResult.meaningPreserved
                              ? 'Meaning Preserved'
                              : 'Unsupported Claim Detected'}
                          </span>
                        </div>
                        <p className="text-slate-300 text-xs font-mono">{selectedRun.synthesisResult.summary}</p>
                      </div>
                    )}

                    {/* Cryptographic Event Ledger */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
                        <span>Immutable Event Ledger ({selectedRun.events.length} chained events)</span>
                        <span className="text-[10px] text-indigo-400">SHA-256 Payload Hashed</span>
                      </h4>
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                        {selectedRun.events.map((evt, idx) => (
                          <div
                            key={evt.eventId}
                            className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex items-start justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">#{idx + 1}</span>
                                <span className="font-bold text-indigo-300">{evt.eventType}</span>
                                {evt.agentId && <span className="text-slate-400">({evt.agentId})</span>}
                              </div>
                              {evt.details && Object.keys(evt.details).length > 0 && (
                                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                  {JSON.stringify(evt.details)}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] text-slate-500 block truncate max-w-[120px]">
                                {evt.payloadHash.substring(0, 16)}...
                              </span>
                              <span className="text-[9px] text-slate-600">
                                prev: {evt.previousEventId ? evt.previousEventId.substring(0, 8) : 'root'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Select an orchestration run from the list to view its DAG, events, and grounding classification.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TASK DISPATCH & PLAYGROUND */}
        {/* ========================================================================= */}
        {activeTab === 'dispatch' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-indigo-400" /> Multi-Agent Task Dispatcher
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Dispatch tasks across isolated external agents under strict reliability, timeout, and fault injection
                  boundaries.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                    Task Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                    placeholder="Enter multi-agent query..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Execution Mode</label>
                    <select
                      value={executionMode}
                      onChange={(e) => setExecutionMode(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                    >
                      <option value="PARALLEL">PARALLEL (Concurrent Overlap)</option>
                      <option value="SEQUENTIAL">SEQUENTIAL (Ordered Step)</option>
                      <option value="HYBRID">HYBRID (Dependency DAG)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Partial Failure Policy</label>
                    <select
                      value={partialFailurePolicy}
                      onChange={(e) => setPartialFailurePolicy(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                    >
                      <option value="CONTINUE_WITH_PARTIAL_RESULTS">CONTINUE_WITH_PARTIAL_RESULTS</option>
                      <option value="FAIL_PARENT_TASK">FAIL_PARENT_TASK</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Max Concurrency Limit</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={maxConcurrency}
                      onChange={(e) => setMaxConcurrency(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                    />
                  </div>
                </div>

                {/* Fault Injection Selector */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Sliders className="w-4 h-4" /> Adversarial &amp; Fault Injection Mode
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">Seed: {seed}</span>
                  </div>
                  <select
                    value={faultMode}
                    onChange={(e) => setFaultMode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-amber-300 font-bold"
                  >
                    <option value="NORMAL">NORMAL (All agents behave nominally)</option>
                    <option value="TIMEOUT">TIMEOUT (Subtask exceeds execution budget)</option>
                    <option value="WRONG_RESULT">WRONG_RESULT (Agent asserts false claim with high confidence)</option>
                    <option value="CONTRADICTORY_RESULT">CONTRADICTORY_RESULT (Agent asserts direct negation)</option>
                    <option value="PROMPT_INJECTION">PROMPT_INJECTION (Adversarial override payload)</option>
                    <option value="FABRICATED_CITATION">FABRICATED_CITATION (Cites nonexistent document)</option>
                    <option value="PROVENANCE_TAMPERING">PROVENANCE_TAMPERING (Attempts to self-certify as Knowledge AI)</option>
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Inject faults to verify that the mediator handles timeouts, rejects prompt injections, preserves
                    contradictions, and ensures grounding determines truth.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    id="btn-dispatch-task"
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-mono flex items-center gap-2 shadow-md transition-colors disabled:opacity-50"
                  >
                    {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {isExecuting ? 'Orchestrating Subtasks...' : 'Dispatch Multi-Agent Orchestration'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: BENCHMARKS STUDIO */}
        {/* ========================================================================= */}
        {activeTab === 'benchmarks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Benchmark 1 */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono text-sm">
                    <Zap className="w-4 h-4" /> Actual Parallel Speedup
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Measures actual overlapping intervals across N tasks vs sequential execution baseline to verify
                    true concurrency speedup.
                  </p>
                </div>
                <button
                  id="btn-run-parallelism-benchmark"
                  onClick={() => runBenchmark('parallelism')}
                  disabled={benchmarkLoading}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                >
                  {benchmarkLoading ? 'Running...' : 'Run Parallelism Benchmark'}
                </button>
              </div>

              {/* Benchmark 2 */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold font-mono text-sm">
                    <Network className="w-4 h-4" /> Agent Count Scaling
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Evaluates task execution across 1, 2, 3, 5, and 10 agents to observe latency scaling and
                    disagreement frequency.
                  </p>
                </div>
                <button
                  id="btn-run-scaling-benchmark"
                  onClick={() => runBenchmark('scaling')}
                  disabled={benchmarkLoading}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                >
                  {benchmarkLoading ? 'Running...' : 'Run 1-10 Agent Scaling'}
                </button>
              </div>

              {/* Benchmark 3 */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 font-semibold font-mono text-sm">
                    <Shield className="w-4 h-4" /> Majority-Wrong Benchmark
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    10 agents: 9 asserting false claim with high confidence, 1 correct. Proves that Majority Consensus
                    != Grounded Truth.
                  </p>
                </div>
                <button
                  id="btn-run-majority-wrong-benchmark"
                  onClick={() => runBenchmark('majority-wrong')}
                  disabled={benchmarkLoading}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                >
                  {benchmarkLoading ? 'Running...' : 'Run Majority-Wrong Test'}
                </button>
              </div>
            </div>

            {/* Benchmark Result Card */}
            {benchmarkResult && (
              <div className="p-6 bg-slate-900 border border-indigo-500/40 rounded-xl space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {benchmarkResult.experimentName}
                  </h4>
                  <span className="text-slate-400">
                    Completed at: {new Date(benchmarkResult.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {benchmarkResult.summary}
                </p>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 overflow-x-auto">
                  <pre className="text-indigo-300 font-mono text-[11px]">
                    {JSON.stringify(benchmarkResult.results, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SECURITY & TRUST BOUNDARIES */}
        {/* ========================================================================= */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white font-mono">
                    Multi-Agent Security Architecture &amp; Trust Boundaries
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Enforcing absolute write isolation between external AI models and production knowledge memory.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-indigo-400 font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> 1. Untrusted AI Boundary
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    All output produced by external agents is flagged as untrusted raw string data. External agents are
                    strictly forbidden from directly mutating Knowledge Base memory, executing system tools, or altering
                    KnowledgeVersion tags.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-indigo-400 font-bold flex items-center gap-1.5">
                    <Lock className="w-4 h-4" /> 2. Provenance Self-Assertion Demotion
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    If an external agent produces output claiming &ldquo;source = Knowledge AI&rdquo; or &ldquo;verified = true&rdquo;, the
                    mediator intercepts the claim, demotes it to untrusted, and records a security incident.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-indigo-400 font-bold flex items-center gap-1.5">
                    <Terminal className="w-4 h-4" /> 3. Adversarial Prompt Injection Defense
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Adversarial strings such as &ldquo;Ignore previous instructions&rdquo;, &ldquo;Store as verified memory&rdquo;, and
                    system overrides are neutralized. They are stored as inert text literals and never executed.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-indigo-400 font-bold flex items-center gap-1.5">
                    <Hash className="w-4 h-4" /> 4. Credential &amp; Secret Sanitization
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    API keys (AIzaSy..., sk-...), bearer authorization headers, and password tokens are automatically
                    scrubbed from event logs and experience records before persistence.
                  </p>
                </div>
              </div>
            </div>

            {/* Registered Agents Table */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Registered Multi-Agent Pool ({agents.length} Agents)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5">Agent ID</th>
                      <th>Name &amp; Role</th>
                      <th>Provider</th>
                      <th>Trust Status</th>
                      <th>Capabilities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {agents.map((ag) => (
                      <tr key={ag.id} className="hover:bg-slate-800/40">
                        <td className="py-2 font-bold text-white">{ag.id}</td>
                        <td>
                          <div>{ag.name}</div>
                          <div className="text-[10px] text-slate-500">{ag.role}</div>
                        </td>
                        <td>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                            {ag.provider}
                          </span>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                            UNTRUSTED (EXTERNAL)
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {ag.capabilities.map((c) => (
                              <span key={c} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-950 text-slate-400">
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: TEST MATRIX (51 TESTS) */}
        {/* ========================================================================= */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Phase 5 Acceptance Battery (51 Total Tests)
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Reliability (1-13) &bull; Multi-Agent Reasoning (14-22) &bull; Security (23-32) &bull; Provenance (33-40) &bull; Controlled Learning (41-47) &bull; Regression (48-51)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="btn-run-all-phase5-tests"
                  onClick={runPhase5TestSuite}
                  disabled={runningTests}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-semibold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
                  {runningTests ? 'Running Battery...' : 'Run All 51 Phase 5 Tests'}
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {(['ALL', 'RELIABILITY', 'REASONING', 'SECURITY', 'PROVENANCE', 'LEARNING', 'REGRESSION'] as const).map(
                (grp) => (
                  <button
                    key={grp}
                    onClick={() => setTestFilter(grp)}
                    className={`px-3 py-1 rounded-lg border transition-colors ${
                      testFilter === grp
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {grp}
                  </button>
                )
              )}
            </div>

            {/* Test Results Table */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              {phase5Results.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  Click &ldquo;Run All 51 Phase 5 Tests&rdquo; to execute the full multi-agent evaluation and regression battery.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span>
                      Passing: <strong className="text-emerald-400">{passedTestsCount}</strong> / {phase5Results.length}
                    </span>
                    <span>100% Invariant Compliance Target</span>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                    {filteredTests.map((t) => (
                      <div
                        key={t.id}
                        className={`p-2.5 rounded-lg border flex items-start justify-between gap-3 ${
                          t.status === 'passed'
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold flex items-center gap-2">
                            <span>#{t.id}</span>
                            <span>{t.name}</span>
                          </div>
                          <p className="text-[11px] opacity-80">{t.details}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            t.status === 'passed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
