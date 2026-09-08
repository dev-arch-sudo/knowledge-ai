/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProductionLimitationItem } from './phase7Types.js';

export const ProductionLimitations: ProductionLimitationItem[] = [
  {
    id: 'LIM-01',
    category: 'Provider Integration',
    description: 'Deterministic mock providers emulate external AI responses, latency variances, timeouts, and adversarial prompt injections without making external egress network calls in acceptance suites.',
    status: 'TESTED',
    mitigation: 'Production adapters connect to live LLM providers using strict timeout budgets and rate-limited client proxies.',
    impactLevel: 'LOW',
  },
  {
    id: 'LIM-02',
    category: 'Persistence Engine',
    description: 'Current persistence operates as an in-memory document, memory, and experience store backed by SHA-256 chained event ledgers. Container restart resets volatile state unless durable external SQL/Firestore is attached.',
    status: 'TESTED',
    mitigation: 'System includes persistence failure simulation and audit export, with pluggable storage adapter interfaces.',
    impactLevel: 'MEDIUM',
  },
  {
    id: 'LIM-03',
    category: 'Real-world High Concurrency',
    description: 'Multi-agent concurrency testing has been validated up to 100 concurrent task runs within sandboxed single-container limits.',
    status: 'TESTED',
    mitigation: 'Bounded backpressure queue (maxQueueDepth=200) sheds excess load before memory exhaustion occurs.',
    impactLevel: 'LOW',
  },
  {
    id: 'LIM-04',
    category: 'Dynamic Live Cloud Scaling',
    description: 'Horizontal autoscaling across multi-region Kubernetes/Cloud Run worker nodes relies on container runtime orchestration rather than in-process agent clustering.',
    status: 'ASSUMED',
    mitigation: 'Orchestration runs are keyed by runId with deterministic replay and state serialization for distributed worker pickups.',
    impactLevel: 'MEDIUM',
  },
  {
    id: 'LIM-05',
    category: 'Multi-Tenant Hardware Isolation',
    description: 'Tenant isolation is enforced cryptographically and logically by accountId, apiKey, and task workspace boundaries rather than hardware sandboxing (e.g. gVisor/Firecracker VMs).',
    status: 'TESTED',
    mitigation: 'Cross-tenant access attempts are strictly rejected at the authentication, memory retrieval, and task intake layers.',
    impactLevel: 'LOW',
  },
  {
    id: 'LIM-06',
    category: 'External Provider Cost Variance',
    description: 'Token usage metrics and agent call counts are tracked per task run, but actual monetary billing relies on provider pricing schedules.',
    status: 'ASSUMED',
    mitigation: 'Budget controllers enforce strict maxAgent, maxTokens, and maxEscalationRound ceilings before calls are dispatched.',
    impactLevel: 'LOW',
  },
  {
    id: 'LIM-07',
    category: 'Long-term Cold Storage Tiering',
    description: 'Archival of historical event ledgers past 1,000,000 events has not been benchmarked under live multi-gigabyte sequential disk reads.',
    status: 'NOT_TESTED',
    mitigation: 'Ledger chunking and snapshot-based checkpointing are recommended for enterprise multi-month audit logs.',
    impactLevel: 'MEDIUM',
  },
  {
    id: 'LIM-08',
    category: 'Provider Invoicing API Coupling',
    description: 'Live token costs are marked strictly as UNKNOWN unless explicitly returned by the upstream provider. Monetary estimates are never fabricated.',
    status: 'TESTED',
    mitigation: 'Budget controllers enforce max token and request thresholds prior to dispatch.',
    impactLevel: 'LOW',
  },
  {
    id: 'LIM-09',
    category: 'Single-Node In-Memory Persistence',
    description: 'State machine runs, active traces, and in-memory caches reside in process memory. Multi-container clustering requires external state synchronization (e.g. Cloud SQL / Firestore).',
    status: 'TESTED',
    mitigation: 'Isolated backup/restore verification pipeline enables complete state snapshotting and restoration.',
    impactLevel: 'MEDIUM',
  },
];

export function getProductionLimitations(): ProductionLimitationItem[] {
  return [...ProductionLimitations];
}
