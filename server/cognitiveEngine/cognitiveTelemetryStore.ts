/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 10 Cognitive Telemetry Store
 * In-memory ring buffer of CognitiveExecutionTrace instances for observability.
 */

import { CognitiveExecutionTrace } from './types.js';

export class CognitiveTelemetryStore {
  private traces: CognitiveExecutionTrace[] = [];
  private readonly maxCapacity: number = 200;

  public recordTrace(trace: CognitiveExecutionTrace): void {
    this.traces.unshift(trace);
    if (this.traces.length > this.maxCapacity) {
      this.traces.pop();
    }
  }

  public getTraces(limit: number = 25, tenantId?: string): CognitiveExecutionTrace[] {
    let filtered = this.traces;
    if (tenantId) {
      filtered = filtered.filter((t) => t.tenantId === tenantId);
    }
    return filtered.slice(0, limit);
  }

  public getTraceById(id: string): CognitiveExecutionTrace | undefined {
    return this.traces.find((t) => t.id === id || t.requestId === id);
  }

  public getStatistics(tenantId?: string): {
    totalQueries: number;
    groundedRate: number;
    averageDurationMs: number;
    reasoningModeBreakdown: Record<string, number>;
    failureBreakdown: Record<string, number>;
  } {
    let filtered = this.traces;
    if (tenantId) {
      filtered = filtered.filter((t) => t.tenantId === tenantId);
    }
    const totalQueries = filtered.length;
    if (totalQueries === 0) {
      return {
        totalQueries: 0,
        groundedRate: 100,
        averageDurationMs: 0,
        reasoningModeBreakdown: {},
        failureBreakdown: {},
      };
    }
    const groundedCount = filtered.filter((t) => t.isFoundInDocuments).length;
    const totalDuration = filtered.reduce((acc, t) => acc + t.timingMs.totalMs, 0);

    const reasoningModeBreakdown: Record<string, number> = {};
    const failureBreakdown: Record<string, number> = {};

    for (const t of filtered) {
      reasoningModeBreakdown[t.reasoningMode] = (reasoningModeBreakdown[t.reasoningMode] || 0) + 1;
      failureBreakdown[t.failureClassification] = (failureBreakdown[t.failureClassification] || 0) + 1;
    }

    return {
      totalQueries,
      groundedRate: Math.round((groundedCount / totalQueries) * 100),
      averageDurationMs: Math.round(totalDuration / totalQueries),
      reasoningModeBreakdown,
      failureBreakdown,
    };
  }

  public clear(): void {
    this.traces = [];
  }
}

export const cognitiveTelemetryStore = new CognitiveTelemetryStore();
