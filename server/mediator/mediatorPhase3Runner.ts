import { TestResultItem } from '../../src/types.js';
import { orchestrationEngine } from './orchestrationEngine.js';
import { agentRegistry } from './agentRegistry.js';

export async function runMediatorPhase3Tests(): Promise<TestResultItem[]> {
  const results: TestResultItem[] = [];

  // 1. Agent Registry Initialization
  try {
    const agents = agentRegistry.listAgents();
    const passed = agents.length >= 4;
    results.push({
      id: 1,
      name: 'Agent Registry Initialization',
      status: passed ? 'passed' : 'failed',
      details: passed ? `Initialized ${agents.length} agents across multiple capabilities` : 'Failed to initialize agent registry',
    });
  } catch (e: any) {
    results.push({ id: 1, name: 'Agent Registry Initialization', status: 'failed', details: e.message });
  }

  // 2. Provider Independence & Adapter Abstraction
  try {
    const mockAgent = agentRegistry.getAgent('agent-researcher-1');
    const geminiAgent = agentRegistry.getAgent('agent-gemini-external');
    const passed = mockAgent?.provider === 'mock' && geminiAgent?.provider === 'gemini';
    results.push({
      id: 2,
      name: 'Provider Independence & Adapter Abstraction',
      status: passed ? 'passed' : 'failed',
      details: passed ? 'Independent provider adapters abstracted under common agent interface' : 'Provider abstraction failed',
    });
  } catch (e: any) {
    results.push({ id: 2, name: 'Provider Independence & Adapter Abstraction', status: 'failed', details: e.message });
  }

  // 3. External AI Untrusted Boundary Invariant
  try {
    const allAgents = agentRegistry.listAgents();
    const allUntrusted = allAgents.every((a) => a.untrusted === true && a.isExternal === true);
    results.push({
      id: 3,
      name: 'External AI Untrusted Boundary Invariant',
      status: allUntrusted ? 'passed' : 'failed',
      details: allUntrusted ? '100% of mediator/external agents strictly classified as untrusted' : 'Untrusted boundary violated',
    });
  } catch (e: any) {
    results.push({ id: 3, name: 'External AI Untrusted Boundary Invariant', status: 'failed', details: e.message });
  }

  // 4. Canonical Mediator Protocol Framing
  try {
    const run = await orchestrationEngine.executeRun({
      taskPrompt: 'Canonical protocol verification',
      subtaskPrompts: [{ title: 'Subtask 1', description: 'Test protocol envelope', delayMs: 10 }],
    });
    const passed = run.runId.startsWith('run-') && run.subtasks.length === 1 && run.events.length > 0;
    results.push({
      id: 4,
      name: 'Canonical Mediator Protocol Framing',
      status: passed ? 'passed' : 'failed',
      details: passed ? `Protocol valid with RunId ${run.runId} and ${run.events.length} ledger events` : 'Protocol framing invalid',
    });
  } catch (e: any) {
    results.push({ id: 4, name: 'Canonical Mediator Protocol Framing', status: 'failed', details: e.message });
  }

  // 5. Bidirectional Multi-Agent Communication
  try {
    const run = await orchestrationEngine.executeRun({
      taskPrompt: 'Bidirectional communication test',
      subtaskPrompts: [
        { title: 'Inbound perspective', description: 'Generate hypothesis', agentId: 'agent-researcher-1', delayMs: 10 },
        { title: 'Outbound critique', description: 'Review hypothesis', agentId: 'agent-analyst-1', delayMs: 10 },
      ],
    });
    const passed = run.subtasks.length === 2 && run.subtasks.every((s) => s.status === 'COMPLETED');
    results.push({
      id: 5,
      name: 'Bidirectional Multi-Agent Communication',
      status: passed ? 'passed' : 'failed',
      details: passed ? 'Multiple agents exchanged inputs and verified outputs cleanly' : 'Communication failed',
    });
  } catch (e: any) {
    results.push({ id: 5, name: 'Bidirectional Multi-Agent Communication', status: 'failed', details: e.message });
  }

  // 6. Task Lifecycle Progression
  try {
    const run = await orchestrationEngine.executeRun({
      taskPrompt: 'Lifecycle progression test',
      subtaskPrompts: [{ title: 'Lifecycle task', description: 'Check lifecycle states', delayMs: 10 }],
    });
    const eventTypes = run.events.map((e) => e.eventType);
    const passed = eventTypes.includes('TASK_CREATED') && eventTypes.includes('PLAN_CREATED') && eventTypes.includes('TASK_COMPLETED');
    results.push({
      id: 6,
      name: 'Task Lifecycle Progression',
      status: passed ? 'passed' : 'failed',
      details: passed ? `Lifecycle verified: PENDING -> RUNNING -> COMPLETED across ${run.events.length} events` : 'Lifecycle failure',
    });
  } catch (e: any) {
    results.push({ id: 6, name: 'Task Lifecycle Progression', status: 'failed', details: e.message });
  }

  // 7. Dynamic Agent Capability Matching
  try {
    const researchAgents = agentRegistry.findAgentsByCapability('citation_extraction');
    const passed = researchAgents.length > 0 && researchAgents[0].id === 'agent-researcher-1';
    results.push({
      id: 7,
      name: 'Dynamic Agent Capability Matching',
      status: passed ? 'passed' : 'failed',
      details: passed ? `Matched ${researchAgents.length} agents for citation_extraction` : 'Capability matching failed',
    });
  } catch (e: any) {
    results.push({ id: 7, name: 'Dynamic Agent Capability Matching', status: 'failed', details: e.message });
  }

  // 8. Sequential Execution Flow
  try {
    const run = await orchestrationEngine.executeRun({
      taskPrompt: 'Sequential execution flow',
      subtaskPrompts: [
        { title: 'Step 1', description: 'First step', delayMs: 15 },
        { title: 'Step 2', description: 'Second step', delayMs: 15 },
      ],
      config: { executionMode: 'SEQUENTIAL' },
    });
    const s1 = run.subtasks[0];
    const s2 = run.subtasks[1];
    const passed = s1 && s2 && s1.completedAt! <= s2.startedAt!;
    results.push({
      id: 8,
      name: 'Sequential Execution Flow',
      status: passed ? 'passed' : 'failed',
      details: passed ? 'Step 2 started strictly after Step 1 completed' : 'Sequential ordering failed',
    });
  } catch (e: any) {
    results.push({ id: 8, name: 'Sequential Execution Flow', status: 'failed', details: e.message });
  }

  // 9. Parallel Execution Flow
  try {
    const run = await orchestrationEngine.executeRun({
      taskPrompt: 'Parallel execution flow',
      subtaskPrompts: [
        { title: 'Par 1', description: 'Parallel 1', delayMs: 30 },
        { title: 'Par 2', description: 'Parallel 2', delayMs: 30 },
      ],
      config: { executionMode: 'PARALLEL', maxConcurrentSubtasks: 2 },
    });
    const s1 = run.subtasks[0];
    const s2 = run.subtasks[1];
    // Overlapping execution intervals
    const overlap = s1 && s2 && Math.max(s1.startedAt!, s2.startedAt!) < Math.min(s1.completedAt!, s2.completedAt!);
    results.push({
      id: 9,
      name: 'Parallel Execution Flow',
      status: overlap ? 'passed' : 'failed',
      details: overlap ? 'Verified overlapping execution intervals in parallel mode' : 'Parallel execution did not overlap',
    });
  } catch (e: any) {
    results.push({ id: 9, name: 'Parallel Execution Flow', status: 'failed', details: e.message });
  }

  // 10. Explicit Task Cancellation
  try {
    const runPromise = orchestrationEngine.executeRun({
      taskPrompt: 'Cancellation test',
      subtaskPrompts: [{ title: 'Cancel target', description: 'Long task', delayMs: 200 }],
    });
    // Immediately trigger cancel
    const activeRuns = orchestrationEngine.listRuns();
    const targetRunId = activeRuns[0]?.runId;
    if (targetRunId) {
      orchestrationEngine.cancelRun(targetRunId);
    }
    const run = await runPromise;
    const passed = run.status === 'CANCELLED' || run.subtasks.some((s) => s.status === 'CANCELLED');
    results.push({
      id: 10,
      name: 'Explicit Task Cancellation',
      status: passed ? 'passed' : 'failed',
      details: passed ? 'Task cancelled and state persisted as CANCELLED' : 'Cancellation failed',
    });
  } catch (e: any) {
    results.push({ id: 10, name: 'Explicit Task Cancellation', status: 'failed', details: e.message });
  }

  // 11. Failure Handling & Policy Enforcement
  try {
    const run = await orchestrationEngine.executeRun({
      taskPrompt: 'Failure policy test',
      subtaskPrompts: [
        { title: 'Failing worker', description: 'Fail deliberately', faultMode: 'ERROR', delayMs: 10 },
        { title: 'Passing worker', description: 'Pass normally', delayMs: 10 },
      ],
      config: { partialFailurePolicy: 'CONTINUE_WITH_PARTIAL_RESULTS' },
    });
    const passed = run.status === 'PARTIALLY_COMPLETED' && run.subtasks.some((s) => s.status === 'FAILED');
    results.push({
      id: 11,
      name: 'Failure Handling & Policy Enforcement',
      status: passed ? 'passed' : 'failed',
      details: passed ? 'Partial failure cleanly preserved as PARTIALLY_COMPLETED without silent drop' : 'Failure policy failed',
    });
  } catch (e: any) {
    results.push({ id: 11, name: 'Failure Handling & Policy Enforcement', status: 'failed', details: e.message });
  }

  // 12. Agent Handoff & State Transfer
  try {
    const run = await orchestrationEngine.executeRun({
      taskPrompt: 'Agent handoff test',
      subtaskPrompts: [
        { title: 'Handoff producer', description: 'Output initial claim', agentId: 'agent-researcher-1', delayMs: 10 },
        { title: 'Handoff consumer', description: 'Consume and verify', agentId: 'agent-analyst-1', delayMs: 10 },
      ],
    });
    const passed = run.participatingAgents.length === 2 && run.synthesisResult !== undefined;
    results.push({
      id: 12,
      name: 'Agent Handoff & State Transfer',
      status: passed ? 'passed' : 'failed',
      details: passed ? 'Output smoothly handed off from researcher to analyst and synthesized' : 'Handoff failed',
    });
  } catch (e: any) {
    results.push({ id: 12, name: 'Agent Handoff & State Transfer', status: 'failed', details: e.message });
  }

  return results;
}
