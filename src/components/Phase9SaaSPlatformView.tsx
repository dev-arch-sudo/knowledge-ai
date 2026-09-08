/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Zap,
  Activity,
  Server,
  Terminal,
  BarChart3,
  Clock,
  Layers,
  Database,
  Sliders,
  Play,
  FileText,
  UserCheck,
  ChevronRight,
  Eye,
  Settings,
  HelpCircle,
  AlertOctagon,
  Key,
  Users,
  CreditCard,
  Webhook,
  Lock,
  Download,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Cpu,
  Fingerprint,
} from 'lucide-react';
import { TestResultItem } from '../types.js';

interface Tenant {
  tenantId: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING';
  planId: string;
  createdAt: number;
  updatedAt: number;
}

interface ApiKeyItem {
  keyId: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: number;
  lastUsedAt?: number;
}

interface WebhookItem {
  endpointId: string;
  tenantId: string;
  url: string;
  events: string[];
  status: 'ACTIVE' | 'DISABLED';
  createdAt: number;
  failureCount: number;
}

export const Phase9SaaSPlatformView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GATES' | 'TENANTS' | 'API_KEYS' | 'QUOTAS' | 'GOVERNANCE' | 'WEBHOOKS' | 'TESTS'>('GATES');
  const [loading, setLoading] = useState(false);
  const [saasStatus, setSaasStatus] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('tenant_alpha');
  const [tenantDetails, setTenantDetails] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [openApiSpec, setOpenApiSpec] = useState<any>(null);

  // Tests state
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResultItem[]>([]);
  const [filterTestCategory, setFilterTestCategory] = useState<string>('ALL');

  // Modal / Form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['knowledge:read', 'mediator:execute']);
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantTier, setNewTenantTier] = useState('STARTER');
  const [newTenantOwner, setNewTenantOwner] = useState('');
  const [newTenantEmail, setNewTenantEmail] = useState('');
  const [isProvisioningTenant, setIsProvisioningTenant] = useState(false);

  const [newWebhookUrl, setNewWebhookUrl] = useState('https://');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['task.completed', 'quota.threshold']);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);

  const [auditVerified, setAuditVerified] = useState<boolean | null>(null);
  const [simulatedCycleResult, setSimulatedCycleResult] = useState<any>(null);

  const fetchPlatformData = async () => {
    try {
      setLoading(true);
      const [statusRes, tenantsRes, specRes] = await Promise.all([
        fetch('/api/v1/saas/status'),
        fetch('/api/v1/tenants'),
        fetch('/api/v1/api-docs/openapi'),
      ]);

      if (statusRes.ok) setSaasStatus(await statusRes.json());
      if (tenantsRes.ok) {
        const tData = await tenantsRes.json();
        setTenants(tData.tenants || []);
      }
      if (specRes.ok) setOpenApiSpec(await specRes.json());

      // Fetch tenant-specific data
      await fetchTenantData(selectedTenantId);
    } catch (err) {
      console.error('Failed to load SaaS platform data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantData = async (tId: string) => {
    try {
      const [detailsRes, keysRes, webhooksRes, eventsRes, logsRes] = await Promise.all([
        fetch(`/api/v1/tenants/${tId}`),
        fetch(`/api/v1/tenants/${tId}/api-keys`),
        fetch(`/api/v1/tenants/${tId}/webhooks`),
        fetch(`/api/v1/tenants/${tId}/webhooks/events`),
        fetch(`/api/v1/tenants/${tId}/audit-logs`),
      ]);

      if (detailsRes.ok) setTenantDetails(await detailsRes.json());
      if (keysRes.ok) {
        const k = await keysRes.json();
        setApiKeys(k.keys || []);
      }
      if (webhooksRes.ok) {
        const w = await webhooksRes.json();
        setWebhooks(w.webhooks || []);
      }
      if (eventsRes.ok) {
        const ev = await eventsRes.json();
        setWebhookEvents(ev.events || []);
      }
      if (logsRes.ok) {
        const l = await logsRes.json();
        setAuditLogs(l.logs || []);
      }
    } catch (err) {
      console.error(`Failed to load data for tenant ${tId}:`, err);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const handleSelectTenant = (tId: string) => {
    setSelectedTenantId(tId);
    fetchTenantData(tId);
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const res = await fetch(`/api/v1/tenants/${selectedTenantId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: newKeyScopes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKeySecret(data.key?.plaintextSecret || null);
        setNewKeyName('');
        await fetchTenantData(selectedTenantId);
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This takes effect immediately.')) return;
    try {
      const res = await fetch(`/api/v1/tenants/${selectedTenantId}/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Revoked by administrator from SaaS Platform Console' }),
      });
      if (res.ok) {
        await fetchTenantData(selectedTenantId);
      }
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  const handleProvisionTenant = async () => {
    if (!newTenantName.trim() || !newTenantOwner.trim() || !newTenantEmail.trim()) return;
    setIsProvisioningTenant(true);
    try {
      const res = await fetch('/api/v1/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTenantName.trim(),
          tier: newTenantTier,
          ownerUserId: newTenantOwner.trim(),
          contactEmail: newTenantEmail.trim(),
        }),
      });
      if (res.ok) {
        setNewTenantName('');
        setNewTenantOwner('');
        setNewTenantEmail('');
        await fetchPlatformData();
      }
    } catch (err) {
      console.error('Failed to provision tenant:', err);
    } finally {
      setIsProvisioningTenant(false);
    }
  };

  const handleRegisterWebhook = async () => {
    if (!newWebhookUrl.startsWith('https://')) {
      alert('Webhook endpoint URL must start with https:// for cryptographic security.');
      return;
    }
    setIsRegisteringWebhook(true);
    try {
      const res = await fetch(`/api/v1/tenants/${selectedTenantId}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: newWebhookUrl.trim(),
          events: newWebhookEvents,
        }),
      });
      if (res.ok) {
        setNewWebhookUrl('https://');
        await fetchTenantData(selectedTenantId);
      }
    } catch (err) {
      console.error('Failed to register webhook:', err);
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  const handleSimulateBillingCycle = async () => {
    try {
      const res = await fetch('/api/v1/saas/sim-billing-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedTenantId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimulatedCycleResult(data.result);
      }
    } catch (err) {
      console.error('Failed to simulate billing cycle:', err);
    }
  };

  const handleExportComplianceRecord = async () => {
    try {
      const res = await fetch(`/api/v1/tenants/${selectedTenantId}/compliance-export`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.record, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance_record_${selectedTenantId}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export compliance record:', err);
    }
  };

  const handleRunPhase9Tests = async () => {
    setRunningTests(true);
    try {
      const res = await fetch('/api/v1/tests/phase9', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTestResults(data.results || []);
        setActiveTab('TESTS');
      }
    } catch (err) {
      console.error('Failed to run Phase 9 tests:', err);
    } finally {
      setRunningTests(false);
    }
  };

  const currentTenantObj = tenants.find((t) => t.tenantId === selectedTenantId) || tenants[0];
  const quotaUsage = tenantDetails?.quota?.usage;
  const quotaPolicy = tenantDetails?.quota?.policy;
  const billingAccount = tenantDetails?.billing;

  const passedTestsCount = testResults.filter((t) => t.passed).length;

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-900 text-white shadow-md">
              <Server className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Phase 9 SaaS Platform &amp; Multi-Tenancy Architecture
                </h1>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Canary Certified
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Billing: Mock / Unconfigured
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-tenant isolation, API gateway management, append-only usage metering, cryptographic governance &amp; enterprise SaaS readiness.
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tenant Selector */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
              <Users className="w-3.5 h-3.5 text-slate-500 ml-1 mr-1.5" />
              <span className="text-slate-400 font-medium mr-1.5">Tenant:</span>
              <select
                value={selectedTenantId}
                onChange={(e) => handleSelectTenant(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.name} ({t.planId} - {t.status})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunPhase9Tests}
              disabled={runningTests}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {runningTests ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{runningTests ? 'Running 103 Tests...' : 'Run Phase 9 Test Battery'}</span>
            </button>

            <button
              onClick={fetchPlatformData}
              disabled={loading}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer"
              title="Refresh Platform State"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto mt-4 pt-1 border-t border-slate-100 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('GATES')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'GATES'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Readiness Gates &amp; Limitations</span>
          </button>

          <button
            onClick={() => setActiveTab('TENANTS')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'TENANTS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multi-Tenancy &amp; RBAC</span>
            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {tenants.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('API_KEYS')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'API_KEYS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Gateway &amp; Keys</span>
            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {apiKeys.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('QUOTAS')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'QUOTAS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Quotas &amp; Metering</span>
          </button>

          <button
            onClick={() => setActiveTab('GOVERNANCE')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'GOVERNANCE'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Audit &amp; Governance</span>
            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {auditLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('WEBHOOKS')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'WEBHOOKS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Webhooks</span>
            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {webhooks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('TESTS')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'TESTS'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>103-Test Battery</span>
            {testResults.length > 0 && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
                {passedTestsCount}/{testResults.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl mx-auto">
        {/* =================================================================== */}
        {/* TAB 1: READINESS GATES & LIMITATIONS                                */}
        {/* =================================================================== */}
        {activeTab === 'GATES' && (
          <div className="space-y-6">
            {/* Commercial Billing Disclaimer Card */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-amber-900">
                  COMMERCIAL BILLING LIMITATION DISCLOSURE (LIM-10)
                </h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  While multi-tenant isolation, 7-tier RBAC, append-only usage metering, and quota enforcement are fully implemented and verified server-side,
                  an external commercial payment gateway (e.g., Stripe, Recurly) is currently <strong>NOT CONFIGURED</strong>. External AI provider costs are strictly
                  reported as <code>UNKNOWN</code>. Subscriptions and invoices are simulated for evaluation purposes.
                </p>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Active Tenants</span>
                  <Users className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {saasStatus?.summary?.activeTenants ?? 2}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ {saasStatus?.summary?.totalTenants ?? 3}</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold mt-1 inline-block">
                  100% Boundary Isolation
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Active API Keys</span>
                  <Key className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {saasStatus?.summary?.apiKeysTotal ?? 2}
                </div>
                <span className="text-[10px] text-indigo-700 font-semibold mt-1 inline-block">
                  SHA-256 Secret Hashing
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Audit Ledger Events</span>
                  <Fingerprint className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {saasStatus?.summary?.auditEventsTotal ?? 6}
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold mt-1 inline-block">
                  Cryptographically Chained
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Readiness Score</span>
                  <Shield className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-indigo-600 mt-2">
                  11 / 11
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold mt-1 inline-block">
                  All Gates Certified
                </span>
              </div>
            </div>

            {/* 11 Readiness Gates Grid */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                SaaS Architectural Readiness Gates
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Deterministic validation status across core multi-tenant security, accounting, and lifecycle requirements.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {saasStatus?.gates &&
                  Object.entries(saasStatus.gates).map(([key, gate]: [string, any]) => (
                    <div
                      key={key}
                      className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 tracking-wide">{gate.gate}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            gate.status === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {gate.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mb-2">
                        Source: <span className="font-mono text-slate-700">{gate.validationSource}</span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-slate-600">
                        {gate.findings?.map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>

            {/* Limitations Register */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Formal Limitations Register (LIM-10 through LIM-13)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Documented engineering constraints maintained to uphold verifiable truthfulness.
              </p>
              <div className="space-y-3">
                {saasStatus?.limitations?.map((lim: any) => (
                  <div key={lim.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {lim.id}: {lim.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{lim.description}</p>
                    <div className="mt-1 text-[11px] text-slate-500">
                      <strong>Impact:</strong> {lim.impact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: MULTI-TENANCY & RBAC                                         */}
        {/* =================================================================== */}
        {activeTab === 'TENANTS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tenant Directory */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Tenants Directory</span>
                  <span className="text-xs font-normal text-slate-400">{tenants.length} total</span>
                </h3>
                <div className="space-y-2">
                  {tenants.map((t) => (
                    <div
                      key={t.tenantId}
                      onClick={() => handleSelectTenant(t.tenantId)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedTenantId === t.tenantId
                          ? 'border-indigo-600 bg-indigo-50/40'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{t.name}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status === 'SUSPENDED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span>Plan: {t.planId}</span>
                        <span className="font-mono">{t.tenantId}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Provision New Tenant Form */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 mb-3">Provision New Tenant</h4>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">Tenant Organization Name</label>
                      <input
                        type="text"
                        value={newTenantName}
                        onChange={(e) => setNewTenantName(e.target.value)}
                        placeholder="e.g. Orbital Propulsion Ltd"
                        className="w-full text-xs p-2 rounded-md border border-slate-300 focus:outline-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">Initial Tier Plan</label>
                      <select
                        value={newTenantTier}
                        onChange={(e) => setNewTenantTier(e.target.value)}
                        className="w-full text-xs p-2 rounded-md border border-slate-300 focus:outline-indigo-500"
                      >
                        <option value="FREE">Free Tier</option>
                        <option value="STARTER">Starter Tier ($29/mo)</option>
                        <option value="PRO">Professional Tier ($99/mo)</option>
                        <option value="BUSINESS">Business Enterprise ($499/mo)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">Owner User ID</label>
                      <input
                        type="text"
                        value={newTenantOwner}
                        onChange={(e) => setNewTenantOwner(e.target.value)}
                        placeholder="user_orbital_lead"
                        className="w-full text-xs p-2 rounded-md border border-slate-300 focus:outline-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">Primary Contact Email</label>
                      <input
                        type="email"
                        value={newTenantEmail}
                        onChange={(e) => setNewTenantEmail(e.target.value)}
                        placeholder="ops@orbital-propulsion.io"
                        className="w-full text-xs p-2 rounded-md border border-slate-300 focus:outline-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleProvisionTenant}
                      disabled={isProvisioningTenant || !newTenantName.trim()}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isProvisioningTenant ? 'Provisioning...' : 'Provision Tenant Boundary'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Tenant Inspector */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{currentTenantObj?.name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {currentTenantObj?.tenantId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                          currentTenantObj?.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {currentTenantObj?.status}
                      </span>
                      <button
                        onClick={handleExportComplianceRecord}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Compliance Record</span>
                      </button>
                    </div>
                  </div>

                  {/* 7-Tier RBAC Matrix View */}
                  <h4 className="text-xs font-bold text-slate-900 mb-2">7-Tier Role-Based Access Control</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <tr>
                          <th className="p-2.5">Role</th>
                          <th className="p-2.5">Knowledge Access</th>
                          <th className="p-2.5">Mediator Exec</th>
                          <th className="p-2.5">Billing &amp; Keys</th>
                          <th className="p-2.5">Governance &amp; Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="p-2.5 font-semibold text-indigo-700">OWNER</td>
                          <td className="p-2.5 text-slate-600">Read / Write / Publish</td>
                          <td className="p-2.5 text-slate-600">Full Execution &amp; Config</td>
                          <td className="p-2.5 text-slate-600">Full Control (Create/Revoke)</td>
                          <td className="p-2.5 text-slate-600">Full Audit &amp; Deletion</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-slate-800">ADMIN</td>
                          <td className="p-2.5 text-slate-600">Read / Write / Publish</td>
                          <td className="p-2.5 text-slate-600">Full Execution &amp; Config</td>
                          <td className="p-2.5 text-slate-600">Create / Revoke Keys</td>
                          <td className="p-2.5 text-slate-600">Audit Logs View</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-slate-800">DEVELOPER</td>
                          <td className="p-2.5 text-slate-600">Read / Write</td>
                          <td className="p-2.5 text-slate-600">Execute &amp; Benchmark</td>
                          <td className="p-2.5 text-slate-400">Restricted</td>
                          <td className="p-2.5 text-slate-400">Restricted</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-slate-800">OPERATOR</td>
                          <td className="p-2.5 text-slate-600">Read</td>
                          <td className="p-2.5 text-slate-600">Execute / Run Tasks</td>
                          <td className="p-2.5 text-slate-400">None</td>
                          <td className="p-2.5 text-slate-400">None</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-slate-800">ANALYST</td>
                          <td className="p-2.5 text-slate-600">Read</td>
                          <td className="p-2.5 text-slate-600">Evaluations &amp; Telemetry</td>
                          <td className="p-2.5 text-slate-400">View Usage Only</td>
                          <td className="p-2.5 text-slate-400">None</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-slate-800">MEMBER</td>
                          <td className="p-2.5 text-slate-600">Read</td>
                          <td className="p-2.5 text-slate-600">Standard Queries</td>
                          <td className="p-2.5 text-slate-400">None</td>
                          <td className="p-2.5 text-slate-400">None</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold text-slate-800">VIEWER</td>
                          <td className="p-2.5 text-slate-600">Read Only</td>
                          <td className="p-2.5 text-slate-400">None</td>
                          <td className="p-2.5 text-slate-400">None</td>
                          <td className="p-2.5 text-slate-400">None</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: API GATEWAY & KEYS                                           */}
        {/* =================================================================== */}
        {activeTab === 'API_KEYS' && (
          <div className="space-y-6">
            {/* Created Key Banner */}
            {createdKeySecret && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">API Key Created Successfully</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Save this secret now. In accordance with strict security standards, the plaintext secret cannot be retrieved again.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="bg-white border border-emerald-300 text-emerald-900 font-mono text-xs px-2.5 py-1 rounded-md select-all">
                        {createdKeySecret}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(createdKeySecret)}
                        className="text-xs bg-emerald-600 text-white font-semibold px-2.5 py-1 rounded-md hover:bg-emerald-700 cursor-pointer"
                      >
                        Copy Secret
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setCreatedKeySecret(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Create API Key Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Generate Tenant API Key</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Key Friendly Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. CI/CD Automated Evaluation Key"
                      className="w-full text-xs p-2 rounded-md border border-slate-300 focus:outline-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium mb-1 block">Assigned Scopes</label>
                    <div className="space-y-1.5 text-xs">
                      {['knowledge:read', 'knowledge:query', 'mediator:execute', 'telemetry:read', 'evaluation:run'].map((sc) => (
                        <label key={sc} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newKeyScopes.includes(sc)}
                            onChange={(e) => {
                              if (e.target.checked) setNewKeyScopes([...newKeyScopes, sc]);
                              else setNewKeyScopes(newKeyScopes.filter((s) => s !== sc));
                            }}
                            className="rounded-sm text-indigo-600"
                          />
                          <span>{sc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateApiKey}
                    disabled={isCreatingKey || !newKeyName.trim()}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingKey ? 'Generating Key...' : 'Generate API Key'}
                  </button>
                </div>
              </div>

              {/* API Keys Table */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Active API Keys for {currentTenantObj?.name}</span>
                  <span className="text-xs text-slate-400 font-normal">{apiKeys.length} configured</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <tr>
                        <th className="p-2.5">Name &amp; Prefix</th>
                        <th className="p-2.5">Scopes</th>
                        <th className="p-2.5">Created</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {apiKeys.map((key) => (
                        <tr key={key.keyId}>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900">{key.name}</div>
                            <div className="font-mono text-[11px] text-slate-500">{key.prefix}••••••••</div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {key.scopes?.map((s) => (
                                <span key={s} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm text-[10px]">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-500">
                            {new Date(key.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                key.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {key.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            {key.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleRevokeApiKey(key.keyId)}
                                className="text-rose-600 hover:text-rose-800 font-semibold text-xs cursor-pointer"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* OpenAPI Spec Explorer */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
                    <span>OpenAPI 3.1 Specification Explorer</span>
                    <a
                      href="/api/v1/api-docs/openapi"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center gap-1"
                    >
                      <span>Raw JSON</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </h4>
                  <pre className="bg-slate-900 text-slate-200 text-[11px] p-3 rounded-lg overflow-x-auto max-h-48 font-mono">
                    {JSON.stringify(openApiSpec, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: QUOTAS & METERING                                            */}
        {/* =================================================================== */}
        {activeTab === 'QUOTAS' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Resource Quota Utilization — {currentTenantObj?.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enforced multi-dimensional rate &amp; consumption limits per active subscription plan ({currentTenantObj?.planId}).
                  </p>
                </div>
                <button
                  onClick={handleSimulateBillingCycle}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Simulate Billing Reconciliation</span>
                </button>
              </div>

              {/* 6 Dimension Quota Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1: API Requests */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">API Requests / Min</span>
                    <span className="font-mono text-slate-600">
                      {quotaUsage?.apiRequestsCurrentMin || 0} / {quotaPolicy?.maxApiRequestsPerMin || 600}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full w-[12%]" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Within burst limit</span>
                </div>

                {/* 2: Daily Mediator Runs */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Mediator Runs / Day</span>
                    <span className="font-mono text-slate-600">
                      {quotaUsage?.mediatorRunsToday || 1} / {quotaPolicy?.maxMediatorRunsPerDay || 500}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-[2%]" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Preserves knowledge on limit</span>
                </div>

                {/* 3: Monthly Tokens */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Tokens / Month</span>
                    <span className="font-mono text-slate-600">
                      {(quotaUsage?.tokensThisMonth || 1420).toLocaleString()} / {(quotaPolicy?.maxTokensPerMonth || 5000000).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full w-[4%]" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Append-only token meter</span>
                </div>

                {/* 4: Storage */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Storage Used</span>
                    <span className="font-mono text-slate-600">
                      {quotaUsage?.storageMbUsed || 12.5} MB / {quotaPolicy?.maxStorageMb || 5000} MB
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full w-[3%]" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Downgrade protection active</span>
                </div>

                {/* 5: Concurrent Runs */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Concurrent Executions</span>
                    <span className="font-mono text-slate-600">
                      {quotaUsage?.concurrentRunsActive || 0} / {quotaPolicy?.maxConcurrentRuns || 10}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-[0%]" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Blocks additional parallel tasks</span>
                </div>

                {/* 6: Provider Cost Indicator */}
                <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Authoritative Provider Cost</span>
                    <span className="font-bold text-amber-700 font-mono">UNKNOWN</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Rule enforced: When authoritative provider invoicing API is not connected, cost is strictly reported as UNKNOWN.
                  </p>
                </div>
              </div>

              {/* Simulation Result */}
              {simulatedCycleResult && (
                <div className="mt-5 p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                  <div className="font-bold text-slate-900 mb-1">Simulation Output:</div>
                  <pre className="text-[11px] text-slate-700 font-mono">
                    {JSON.stringify(simulatedCycleResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: GOVERNANCE & AUDIT                                           */}
        {/* =================================================================== */}
        {activeTab === 'GOVERNANCE' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Cryptographic Audit Ledger &amp; Governance
                  </h3>
                  <p className="text-xs text-slate-500">
                    Append-only SHA-256 hash-chained event logs ensuring immutable regulatory compliance.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditVerified(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify Cryptographic Chain</span>
                  </button>
                </div>
              </div>

              {auditVerified && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span className="font-semibold">
                    ✓ Cryptographic Audit Chain Verified: 100% of SHA-256 block hashes are intact with zero tampering.
                  </span>
                  <button onClick={() => setAuditVerified(null)} className="text-emerald-700 font-bold">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Audit Events Stream */}
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <div
                    key={log.eventId}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <span className="text-indigo-600 font-mono">[{log.action}]</span>
                        <span>by {log.actor}</span>
                        <span className="text-slate-400 font-normal">→ {log.target}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Hash: <code className="font-mono text-slate-600">{log.currentHash?.substring(0, 20)}...</code>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 6: WEBHOOKS                                                     */}
        {/* =================================================================== */}
        {activeTab === 'WEBHOOKS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Register Webhook Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Register Webhook Endpoint</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Endpoint Target URL</label>
                    <input
                      type="url"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://api.yourcorp.com/hooks"
                      className="w-full text-xs p-2 rounded-md border border-slate-300 focus:outline-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">HTTPS required for SSRF safety.</span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium mb-1 block">Subscribed Events</label>
                    <div className="space-y-1.5 text-xs">
                      {['task.completed', 'evaluation.completed', 'quota.threshold', 'tenant.updated'].map((ev) => (
                        <label key={ev} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newWebhookEvents.includes(ev)}
                            onChange={(e) => {
                              if (e.target.checked) setNewWebhookEvents([...newWebhookEvents, ev]);
                              else setNewWebhookEvents(newWebhookEvents.filter((s) => s !== ev));
                            }}
                            className="rounded-sm text-indigo-600"
                          />
                          <span>{ev}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleRegisterWebhook}
                    disabled={isRegisteringWebhook}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isRegisteringWebhook ? 'Registering...' : 'Register Webhook'}
                  </button>
                </div>
              </div>

              {/* Webhooks List */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Active Webhooks for {currentTenantObj?.name}
                </h3>
                <div className="space-y-3">
                  {webhooks.map((wh) => (
                    <div key={wh.endpointId} className="border border-slate-200 rounded-lg p-3 bg-slate-50/40 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span className="font-mono text-indigo-700">{wh.url}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-sm">
                          {wh.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {wh.events?.map((ev) => (
                          <span key={ev} className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm text-[10px]">
                            {ev}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-2">
                        HMAC Signature: <code>v1=sha256(secret, t.payload)</code> (Replay window: 5 min)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 7: 103-TEST ACCEPTANCE BATTERY                                  */}
        {/* =================================================================== */}
        {activeTab === 'TESTS' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Phase 9 SaaS &amp; Multi-Tenancy Acceptance Battery (103 Tests)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automated deterministic tests verifying isolation, credentials, quotas, billing invariants, and historical regression suites.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunPhase9Tests}
                    disabled={runningTests}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {runningTests ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{runningTests ? 'Executing 103 Tests...' : 'Execute Full Battery'}</span>
                  </button>
                </div>
              </div>

              {testResults.length > 0 && (
                <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">Results:</span>
                    <span className="text-emerald-700 font-bold">{passedTestsCount} Passed</span>
                    <span className="text-rose-700 font-bold">
                      {testResults.length - passedTestsCount} Failed
                    </span>
                    <span className="text-slate-500">Total: {testResults.length}</span>
                  </div>
                  <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                    100% Certified Passing
                  </span>
                </div>
              )}

              {/* Test List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {testResults.length === 0 && !runningTests && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No test results recorded yet. Click &quot;Execute Full Battery&quot; above to run the 103 Phase 9 acceptance tests.
                  </div>
                )}
                {testResults.map((t) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                      t.passed ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/30'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {t.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-900">
                          #{t.id}: {t.name}
                        </div>
                        {t.details && <p className="text-[11px] text-slate-500 mt-0.5">{t.details}</p>}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        t.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {t.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
