import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Archive,
  Play,
  RotateCw,
  Clock,
  History,
  AlertTriangle,
  Plus,
  Filter,
  Check,
  X,
  Search,
  Sliders,
  Layers,
  FileCheck2,
  FileSpreadsheet,
  Activity,
  ArrowRight,
  TrendingUp,
  Cpu,
  ChevronRight,
  UserCheck,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import {
  KnowledgeBase,
  Memory,
  Experience,
  SandboxScenario,
  SandboxRun,
  LearningCandidate,
  ImprovementProposal,
  MemoryAuditLog,
  Phase4DashboardMetrics,
  MemoryType,
  MemoryStatus,
  ExperienceSource,
  TestResultItem,
} from '../types';

interface Phase4Props {
  activeKb: KnowledgeBase | null;
}

export const Phase4LearningSandbox: React.FC<Phase4Props> = ({ activeKb }) => {
  const [activeSubTab, setActiveSubTab] = useState<'memories' | 'experiences' | 'sandbox' | 'tests'>('memories');
  const [metrics, setMetrics] = useState<Phase4DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Memory state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [auditLogs, setAuditLogs] = useState<MemoryAuditLog[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showCreateMemoryModal, setShowCreateMemoryModal] = useState(false);
  const [showRejectMemoryModal, setShowRejectMemoryModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // New Memory Form
  const [newMemType, setNewMemType] = useState<MemoryType>('PROCEDURAL');
  const [newMemContent, setNewMemContent] = useState('');
  const [newMemSummary, setNewMemSummary] = useState('');
  const [newMemConfidence, setNewMemConfidence] = useState(90);
  const [newMemStatus, setNewMemStatus] = useState<MemoryStatus>('CANDIDATE');
  const [newMemTags, setNewMemTags] = useState('pressure, maintenance');

  // Experience state
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [expSourceFilter, setExpSourceFilter] = useState<string>('ALL');

  // Sandbox & Learning state
  const [scenarios, setScenarios] = useState<SandboxScenario[]>([]);
  const [runs, setRuns] = useState<SandboxRun[]>([]);
  const [candidates, setCandidates] = useState<LearningCandidate[]>([]);
  const [proposals, setProposals] = useState<ImprovementProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<ImprovementProposal | null>(null);
  const [showCreateScenarioModal, setShowCreateScenarioModal] = useState(false);
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [generatingCandidate, setGeneratingCandidate] = useState(false);
  const [evaluatingProposal, setEvaluatingProposal] = useState(false);
  const [proposalRejectModalId, setProposalRejectModalId] = useState<string | null>(null);
  const [proposalRejectReason, setProposalRejectReason] = useState('');

  // New Scenario Form
  const [scenName, setScenName] = useState('');
  const [scenDesc, setScenDesc] = useState('');
  const [scenInput, setScenInput] = useState('');
  const [scenExpectedBehavior, setScenExpectedBehavior] = useState('');
  const [scenExpectedOutcome, setScenExpectedOutcome] = useState('');
  const [scenCriteria, setScenCriteria] = useState('');
  const [scenDifficulty, setScenDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | 'EDGE_CASE'>('MEDIUM');

  // Acceptance Tests
  const [testResults, setTestResults] = useState<TestResultItem[]>([]);
  const [testsRunning, setTestsRunning] = useState(false);

  // Load metrics & initial data
  const refreshAll = async () => {
    if (!activeKb) return;
    setLoading(true);
    try {
      const [mRes, memRes, expRes, scenRes, candRes, propRes] = await Promise.all([
        fetch('/api/phase4/dashboard').then((r) => r.json()),
        fetch('/api/phase4/memories').then((r) => r.json()),
        fetch('/api/phase4/experiences').then((r) => r.json()),
        fetch('/api/phase4/sandbox/scenarios').then((r) => r.json()),
        fetch('/api/phase4/learning/candidates').then((r) => r.json()),
        fetch('/api/phase4/learning/proposals').then((r) => r.json()),
      ]);

      if (mRes.metrics) setMetrics(mRes.metrics);
      if (memRes.memories) setMemories(memRes.memories);
      if (expRes.experiences) setExperiences(expRes.experiences);
      if (scenRes.scenarios) setScenarios(scenRes.scenarios);
      if (candRes.candidates) setCandidates(candRes.candidates);
      if (propRes.proposals) {
        setProposals(propRes.proposals);
        if (propRes.proposals.length > 0 && !selectedProposal) {
          setSelectedProposal(propRes.proposals[0]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Phase 4 data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [activeKb?.id]);

  // Handle Verify Memory
  const handleVerifyMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/phase4/memories/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: 'Lead Domain Engineer' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(`Memory verified successfully.`);
      refreshAll();
    } catch (e: any) {
      alert(`Error verifying memory: ${e.message}`);
    }
  };

  // Handle Reject Memory
  const handleRejectMemory = async () => {
    if (!showRejectMemoryModal || !rejectionReason.trim()) return;
    try {
      const res = await fetch(`/api/phase4/memories/${showRejectMemoryModal}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason, reviewer: 'Lead Domain Engineer' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowRejectMemoryModal(null);
      setRejectionReason('');
      setActionMessage(`Memory rejected with documented reason.`);
      refreshAll();
    } catch (e: any) {
      alert(`Error rejecting memory: ${e.message}`);
    }
  };

  // Handle Archive Memory
  const handleArchiveMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/phase4/memories/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Routine operational deprecation' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(`Memory moved to archive.`);
      refreshAll();
    } catch (e: any) {
      alert(`Error archiving memory: ${e.message}`);
    }
  };

  // Handle Create Memory
  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/phase4/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newMemType,
          content: newMemContent,
          summary: newMemSummary,
          confidence: newMemConfidence / 100,
          status: newMemStatus,
          tags: newMemTags.split(',').map((t) => t.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreateMemoryModal(false);
      setNewMemContent('');
      setNewMemSummary('');
      setActionMessage(`Memory ${data.memory.id} created.`);
      refreshAll();
    } catch (e: any) {
      alert(`Error creating memory: ${e.message}`);
    }
  };

  // Handle Create Scenario
  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/phase4/sandbox/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scenName,
          description: scenDesc,
          userInput: scenInput,
          expectedBehavior: scenExpectedBehavior,
          expectedOutcome: scenExpectedOutcome,
          evaluationCriteria: scenCriteria,
          difficulty: scenDifficulty,
          tags: ['sandbox', scenDifficulty.toLowerCase()],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreateScenarioModal(false);
      setScenName('');
      setScenDesc('');
      setScenInput('');
      setActionMessage(`Sandbox scenario created.`);
      refreshAll();
    } catch (e: any) {
      alert(`Error creating scenario: ${e.message}`);
    }
  };

  // Handle Run Single Scenario
  const handleRunScenario = async (scenarioId: string) => {
    setRunningScenarioId(scenarioId);
    try {
      const res = await fetch('/api/phase4/sandbox/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(`Sandbox run completed: Score ${data.run.score}/100 (${data.run.finalOutcome})`);
      refreshAll();
    } catch (e: any) {
      alert(`Scenario run failed: ${e.message}`);
    } finally {
      setRunningScenarioId(null);
    }
  };

  // Handle Run Batch Battery
  const handleRunBatch = async () => {
    setBatchRunning(true);
    try {
      const res = await fetch('/api/phase4/sandbox/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repeatCount: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const b = data.batchResult;
      setActionMessage(`Batch regression finished: ${b.totalRuns} runs, ${b.successRate}% success rate, ${b.averageScore} avg score.`);
      refreshAll();
    } catch (e: any) {
      alert(`Batch regression failed: ${e.message}`);
    } finally {
      setBatchRunning(false);
    }
  };

  // Generate Learning Candidate
  const handleGenerateCandidate = async () => {
    setGeneratingCandidate(true);
    try {
      const res = await fetch('/api/phase4/learning/candidates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focusArea: 'Continuous Operational Grounding Refinement' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(`Candidate generated: ${data.candidate.id}`);
      refreshAll();
    } catch (e: any) {
      alert(`Error generating candidate: ${e.message}`);
    } finally {
      setGeneratingCandidate(false);
    }
  };

  // Build Scorecard & Proposal
  const handleBuildScorecard = async (candidateId: string) => {
    setEvaluatingProposal(true);
    try {
      const res = await fetch('/api/phase4/learning/proposals/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds: [candidateId],
          title: `Autonomous Continuous Learning Improvement Candidate`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedProposal(data.proposal);
      setActionMessage(`Improvement Proposal generated with Scorecard.`);
      refreshAll();
    } catch (e: any) {
      alert(`Error building scorecard: ${e.message}`);
    } finally {
      setEvaluatingProposal(false);
    }
  };

  // Approve Proposal
  const handleApproveProposal = async (proposalId: string) => {
    try {
      const res = await fetch(`/api/phase4/learning/proposals/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerName: 'Director of AI Safety (Human)' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMessage(`Proposal approved! Created immutable version snapshot: ${data.newVersionTag}`);
      refreshAll();
    } catch (e: any) {
      alert(`Approval error: ${e.message}`);
    }
  };

  // Reject Proposal
  const handleRejectProposal = async () => {
    if (!proposalRejectModalId || !proposalRejectReason.trim()) return;
    try {
      const res = await fetch(`/api/phase4/learning/proposals/${proposalRejectModalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: proposalRejectReason, reviewerName: 'Director of AI Safety (Human)' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposalRejectModalId(null);
      setProposalRejectReason('');
      setActionMessage(`Proposal rejected with documented rationale.`);
      refreshAll();
    } catch (e: any) {
      alert(`Rejection error: ${e.message}`);
    }
  };

  // Run 50 Acceptance Tests
  const handleRunAcceptanceTests = async () => {
    setTestsRunning(true);
    try {
      const res = await fetch('/api/v1/tests/phase4', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestResults(data.results || []);
    } catch (e: any) {
      alert(`Acceptance suite failed: ${e.message}`);
    } finally {
      setTestsRunning(false);
    }
  };

  // Filter memories
  const filteredMemories = memories.filter((m) => {
    if (selectedStatus !== 'ALL' && m.status !== selectedStatus) return false;
    if (selectedType !== 'ALL' && m.type !== selectedType) return false;
    return true;
  });

  // Filter experiences
  const filteredExperiences = experiences.filter((e) => {
    if (expSourceFilter !== 'ALL' && e.source !== expSourceFilter) return false;
    return true;
  });

  return (
    <div id="phase4-container" className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Banner with Executive Metrics */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-700 text-white">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Memory, Experience & Controlled Learning Sandbox
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    Phase 4
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Episodic memory governance, experience logging, isolated sandbox evaluations, and scorecard regression verification.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Verified Memories</span>
              <span className="text-base font-bold text-slate-900 mt-0.5">
                {metrics?.verifiedMemories || 0} <span className="text-[10px] font-normal text-slate-400">/ {metrics?.totalMemories || 0}</span>
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Logged Experiences</span>
              <span className="text-base font-bold text-slate-900 mt-0.5">
                {metrics?.totalExperiences || 0}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Sandbox Scenarios</span>
              <span className="text-base font-bold text-slate-900 mt-0.5">
                {metrics?.totalScenarios || 0} <span className="text-[10px] font-semibold text-emerald-600">({metrics?.sandboxSuccessRate || 100}%)</span>
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium">Active KB Version</span>
              <span className="text-base font-mono font-bold text-indigo-700 mt-0.5">
                {activeKb?.currentVersion || 'v1.0'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Flash Message */}
        {actionMessage && (
          <div className="mt-3 py-1.5 px-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {actionMessage}
            </span>
            <button onClick={() => setActionMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 border-t border-slate-100 pt-3">
          <button
            id="subtab-memories"
            onClick={() => setActiveSubTab('memories')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubTab === 'memories'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            Memory Governance ({memories.length})
          </button>
          <button
            id="subtab-experiences"
            onClick={() => setActiveSubTab('experiences')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubTab === 'experiences'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Experience Ledger ({experiences.length})
          </button>
          <button
            id="subtab-sandbox"
            onClick={() => setActiveSubTab('sandbox')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubTab === 'sandbox'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Sandbox & Controlled Learning
          </button>
          <button
            id="subtab-tests"
            onClick={() => setActiveSubTab('tests')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeSubTab === 'tests'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Acceptance Test Battery (50-Pts)
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ========================================================= */}
        {/* SUBTAB 1: MEMORY GOVERNANCE */}
        {/* ========================================================= */}
        {activeSubTab === 'memories' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Control bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 font-medium"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="VERIFIED">Verified Only</option>
                    <option value="CANDIDATE">Candidate (Review)</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Type:</span>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 font-medium"
                  >
                    <option value="ALL">All Types</option>
                    <option value="FACTUAL">Factual</option>
                    <option value="PROCEDURAL">Procedural</option>
                    <option value="PREFERENCE">Preference</option>
                    <option value="EPISODIC">Episodic</option>
                    <option value="REASONING">Reasoning</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const res = await fetch('/api/phase4/audit-logs');
                    const data = await res.json();
                    if (data.auditLogs) setAuditLogs(data.auditLogs);
                    setShowAuditModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  Audit Trail
                </button>
                <button
                  id="btn-create-memory"
                  onClick={() => setShowCreateMemoryModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Record Memory
                </button>
              </div>
            </div>

            {/* Memories List */}
            {filteredMemories.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Brain className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No Memories Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No memories match your active filter. Record a new memory or run chat interactions to observe system memories.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMemories.map((m) => (
                  <div
                    key={m.id}
                    id={`memory-card-${m.id}`}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md uppercase bg-slate-100 text-slate-700">
                          {m.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            m.status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : m.status === 'CANDIDATE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : m.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{m.summary}</h4>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px]">
                        {m.content}
                      </p>

                      {m.rejectionReason && (
                        <div className="mt-2 text-[11px] text-red-700 bg-red-50 p-2 rounded-md border border-red-200">
                          <strong>Rejection Rationale:</strong> {m.rejectionReason}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
                        <span>Confidence: <strong className="text-slate-700">{Math.round(m.confidence * 100)}%</strong></span>
                        <span>ID: <code className="text-[10px] text-slate-600">{m.id.substring(0, 12)}...</code></span>
                        {m.tags && m.tags.length > 0 && (
                          <span>Tags: {m.tags.join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                      {m.status === 'CANDIDATE' && (
                        <>
                          <button
                            onClick={() => handleVerifyMemory(m.id)}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" /> Verify
                          </button>
                          <button
                            onClick={() => setShowRejectMemoryModal(m.id)}
                            className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                      {m.status === 'VERIFIED' && (
                        <button
                          onClick={() => handleArchiveMemory(m.id)}
                          className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* SUBTAB 2: EXPERIENCE LEDGER */}
        {/* ========================================================= */}
        {activeSubTab === 'experiences' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Filter Bar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Source Filter:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  {['ALL', 'WEB', 'API', 'SANDBOX', 'HUMAN_FEEDBACK'].map((src) => (
                    <button
                      key={src}
                      onClick={() => setExpSourceFilter(src)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        expSourceFilter === src
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs text-slate-500">
                Showing <strong>{filteredExperiences.length}</strong> recorded operational experiences
              </span>
            </div>

            {/* Experiences Table */}
            <div className="space-y-3">
              {filteredExperiences.map((e) => (
                <div
                  key={e.id}
                  id={`experience-item-${e.id}`}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {e.source}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        KB Version: {e.knowledgeVersionId || 'v1.0'}
                      </span>
                      {e.sandboxRunId && (
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-mono">
                          Run: {e.sandboxRunId.substring(0, 10)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(e.timestamp || e.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Operational Situation
                      </span>
                      <p className="text-slate-800 leading-relaxed">{e.situation}</p>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Action Taken by AI
                      </span>
                      <p className="text-slate-800 leading-relaxed font-mono text-[11px]">{e.action}</p>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Result & Outcome
                      </span>
                      <p className="text-slate-800 leading-relaxed">{e.outcome}</p>
                      {e.feedback && (
                        <div className="mt-2 pt-2 border-t border-slate-200 text-indigo-700 font-semibold text-[11px]">
                          💬 Human Feedback: {e.feedback}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUBTAB 3: CONTROLLED LEARNING & SANDBOX */}
        {/* ========================================================= */}
        {activeSubTab === 'sandbox' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Section 1: Scenarios & Battery Runner */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Sandbox Evaluation Scenarios & Regression Battery
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Isolated test environments where AI responses run under virtual memory boundaries with write locks on production state.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunBatch}
                    disabled={batchRunning}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {batchRunning ? 'Running Battery...' : 'Run Regression Battery'}
                  </button>
                  <button
                    onClick={() => setShowCreateScenarioModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Scenario
                  </button>
                </div>
              </div>

              {/* Scenarios Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenarios.map((sc) => (
                  <div
                    key={sc.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase bg-indigo-100 text-indigo-800">
                          {sc.difficulty}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{sc.id}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{sc.name}</h4>
                      <p className="text-xs text-slate-600 mt-1">{sc.description}</p>

                      <div className="mt-3 bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                        <div>
                          <strong className="text-slate-500">Query:</strong> {sc.userInput}
                        </div>
                        <div>
                          <strong className="text-slate-500">Criteria:</strong> {sc.evaluationCriteria}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-end">
                      <button
                        onClick={() => handleRunScenario(sc.id)}
                        disabled={runningScenarioId === sc.id}
                        className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {runningScenarioId === sc.id ? 'Simulating...' : 'Run Isolated Scenario'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Learning Candidates & Improvement Scorecards */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Controlled Learning Candidates & Regression Scorecards
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Proposals synthesized from real operating experience. Rigorous scorecard comparisons prevent model regressions.
                  </p>
                </div>

                <button
                  onClick={handleGenerateCandidate}
                  disabled={generatingCandidate}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {generatingCandidate ? 'Synthesizing...' : 'Derive Candidate from Experiences'}
                </button>
              </div>

              {/* Candidates List */}
              {candidates.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Active Learning Candidates ({candidates.length})
                  </h4>
                  <div className="space-y-3">
                    {candidates.map((c) => (
                      <div
                        key={c.id}
                        className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                              {c.status}
                            </span>
                            <span className="text-xs font-semibold text-slate-900">Confidence: {Math.round(c.confidence * 100)}%</span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium">{c.proposedChange}</p>
                          <p className="text-[11px] text-slate-500 mt-1">{c.rationale}</p>
                        </div>

                        <button
                          onClick={() => handleBuildScorecard(c.id)}
                          disabled={evaluatingProposal}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {evaluatingProposal ? 'Running Scorecard...' : 'Run Scorecard Regression'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Proposal & Scorecard Card */}
              {selectedProposal ? (
                <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 uppercase">
                          {selectedProposal.status}
                        </span>
                        <span className="text-xs text-slate-500">Target Snapshot: <strong>{selectedProposal.targetVersionTag}</strong></span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">{selectedProposal.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{selectedProposal.proposedChanges}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedProposal.status === 'READY_FOR_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleApproveProposal(selectedProposal.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Human Approve Version
                          </button>
                          <button
                            onClick={() => setProposalRejectModalId(selectedProposal.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                      {selectedProposal.status === 'APPROVED' && (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Approved by {selectedProposal.approvedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scorecard Table */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                      Improvement Scorecard & Regression Safety Matrix
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[11px] text-slate-500 block">Baseline Accuracy</span>
                        <span className="text-base font-bold text-slate-800">{selectedProposal.scorecard.baselineScore}%</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                        <span className="text-[11px] text-emerald-700 block">Candidate Accuracy</span>
                        <span className="text-base font-bold text-emerald-800">{selectedProposal.scorecard.candidateScore}%</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[11px] text-slate-500 block">Regressions Detected</span>
                        <span className={`text-base font-bold ${selectedProposal.scorecard.regressionCount === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {selectedProposal.scorecard.regressionCount}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[11px] text-slate-500 block">Grounding / Refusal</span>
                        <span className="text-xs font-mono font-bold text-slate-800 block mt-1">
                          {selectedProposal.scorecard.groundingAfter}% / {selectedProposal.scorecard.refusalAfter}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Select a candidate above to generate an automated regression scorecard.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUBTAB 4: PHASE 4 ACCEPTANCE TEST BATTERY */}
        {/* ========================================================= */}
        {activeSubTab === 'tests' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Phase 4 Full Acceptance Test Suite (50 Automated Tests)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Exhaustive verification of Memory Governance, Conflict Detection, Sandbox Isolation, Provenance, and Scorecard Safety.
                </p>
              </div>

              <button
                id="btn-run-phase4-tests"
                onClick={handleRunAcceptanceTests}
                disabled={testsRunning}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {testsRunning ? (
                  <RotateCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>{testsRunning ? 'Running 50 Tests...' : 'Execute Phase 4 Suite'}</span>
              </button>
            </div>

            {testResults.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Results: {testResults.filter((r) => r.status === 'passed').length} / {testResults.length} Passed
                  </span>
                  <span className="text-emerald-700 font-semibold">100% Pass Rate Target</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto p-4 space-y-2">
                  {testResults.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                        t.status === 'passed'
                          ? 'bg-emerald-50/40 border-emerald-200 text-slate-900'
                          : 'bg-red-50/40 border-red-200 text-red-900'
                      }`}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                          <span>{t.name}</span>
                        </div>
                        {t.details && <p className="text-slate-600 mt-1 font-mono text-[11px]">{t.details}</p>}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          t.status === 'passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
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
        )}
      </div>

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                Memory Audit Trail & State Transitions
              </h3>
              <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-2 flex-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-700 font-mono text-[11px]">
                    {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '')}
                  </p>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Actor: <strong className="text-slate-600">{log.actor}</strong> | Resource: {log.resourceId}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectMemoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Reject Candidate Memory</h3>
            <p className="text-xs text-slate-500 mb-3">
              Documenting a rejection rationale is strictly required for governance and audit compliance.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Memory violates 55 PSI maximum safety threshold in operational manual."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectMemoryModal(null);
                  setRejectionReason('');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectMemory}
                disabled={!rejectionReason.trim()}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Reject Modal */}
      {proposalRejectModalId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Reject Improvement Proposal</h3>
            <p className="text-xs text-slate-500 mb-3">
              State the reason for rejecting this candidate snapshot.
            </p>
            <textarea
              rows={3}
              value={proposalRejectReason}
              onChange={(e) => setProposalRejectReason(e.target.value)}
              placeholder="e.g. Unacceptable regression in grounding or negative refusal benchmarks."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setProposalRejectModalId(null);
                  setProposalRejectReason('');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectProposal}
                disabled={!proposalRejectReason.trim()}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                Reject Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Memory Modal */}
      {showCreateMemoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateMemory} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Record Specialized AI Memory</h3>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Memory Type</label>
              <select
                value={newMemType}
                onChange={(e) => setNewMemType(e.target.value as MemoryType)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="PROCEDURAL">Procedural (Operation Steps)</option>
                <option value="FACTUAL">Factual (Verified Metric)</option>
                <option value="PREFERENCE">Preference (Format / Style)</option>
                <option value="EPISODIC">Episodic (Observed Incident)</option>
                <option value="REASONING">Reasoning (Heuristic)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Summary</label>
              <input
                required
                value={newMemSummary}
                onChange={(e) => setNewMemSummary(e.target.value)}
                placeholder="e.g. Sequential valve purge protocol on high-load line"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Content / Observation</label>
              <textarea
                required
                rows={3}
                value={newMemContent}
                onChange={(e) => setNewMemContent(e.target.value)}
                placeholder="e.g. Always verify secondary coupling seal before initiating pressure regulation."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                <select
                  value={newMemStatus}
                  onChange={(e) => setNewMemStatus(e.target.value as MemoryStatus)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="CANDIDATE">Candidate (Requires Review)</option>
                  <option value="VERIFIED">Verified (Ready for Prompt)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Confidence ({newMemConfidence}%)</label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={newMemConfidence}
                  onChange={(e) => setNewMemConfidence(Number(e.target.value))}
                  className="w-full mt-2 accent-indigo-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateMemoryModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                Save Memory
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Scenario Modal */}
      {showCreateScenarioModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateScenario} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Create Isolated Sandbox Scenario</h3>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Scenario Name</label>
              <input
                required
                value={scenName}
                onChange={(e) => setScenName(e.target.value)}
                placeholder="e.g. Sudden Overpressure Spike Transient"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
              <input
                required
                value={scenDesc}
                onChange={(e) => setScenDesc(e.target.value)}
                placeholder="e.g. Verifies strict refusal or grounded limits when line surges past 54 PSI."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Simulated User Input</label>
              <textarea
                required
                rows={2}
                value={scenInput}
                onChange={(e) => setScenInput(e.target.value)}
                placeholder="e.g. Pressure is fluctuating around 54 PSI. What is the allowable operating limit?"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Difficulty</label>
                <select
                  value={scenDifficulty}
                  onChange={(e) => setScenDifficulty(e.target.value as any)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                  <option value="EDGE_CASE">Edge Case</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Evaluation Criteria</label>
                <input
                  required
                  value={scenCriteria}
                  onChange={(e) => setScenCriteria(e.target.value)}
                  placeholder="e.g. Must cite 50 PSI nominal and 55 PSI maximum."
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateScenarioModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Create Scenario
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
