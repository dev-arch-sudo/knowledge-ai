import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Terminal,
  FileCode,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  Plus,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  RefreshCw,
  ExternalLink,
  Code2,
  Layers,
  Database,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  KnowledgeBase,
  ApiKey,
  ApiUsage,
  TestResultItem,
  ApiChatResponse,
} from '../types';

interface DeveloperPlatformProps {
  activeKb: KnowledgeBase | null;
}

type DevSubTab = 'keys' | 'playground' | 'docs' | 'usage' | 'tests';

export const DeveloperPlatform: React.FC<DeveloperPlatformProps> = ({ activeKb }) => {
  const [subTab, setSubTab] = useState<DevSubTab>('keys');

  // API Keys state
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [hasCopiedKey, setHasCopiedKey] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  // Playground state
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState<'chat' | 'get_ai' | 'get_kb' | 'health'>('chat');
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [customKeyInput, setCustomKeyInput] = useState<string>('');
  const [playgroundMessage, setPlaygroundMessage] = useState('What pressure does the machine operate at under nominal conditions?');
  const [playgroundConversationId, setPlaygroundConversationId] = useState('');
  const [isExecutingPlayground, setIsExecutingPlayground] = useState(false);
  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);
  const [playgroundStatus, setPlaygroundStatus] = useState<number | null>(null);
  const [playgroundLatency, setPlaygroundLatency] = useState<number | null>(null);
  const [playgroundRequestId, setPlaygroundRequestId] = useState<string | null>(null);
  const [hasCopiedCurl, setHasCopiedCurl] = useState(false);
  const [hasCopiedJson, setHasCopiedJson] = useState(false);

  // Usage state
  const [usageStats, setUsageStats] = useState<{
    totalRequests: number;
    averageLatencyMs: number;
    recentLogs: ApiUsage[];
  } | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Docs state
  const [docsLanguage, setDocsLanguage] = useState<'curl' | 'js' | 'python'>('curl');

  // Phase 3 Acceptance Tests state
  const [acceptanceTests, setAcceptanceTests] = useState<TestResultItem[]>([]);
  const [isRunningAcceptanceTests, setIsRunningAcceptanceTests] = useState(false);
  const [testSummary, setTestSummary] = useState<{ passed: number; total: number } | null>(null);

  // Fetch API Keys
  const fetchKeys = useCallback(async () => {
    setIsLoadingKeys(true);
    try {
      const res = await fetch('/api/v1/developer/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        if (data.keys && data.keys.length > 0 && !selectedKeyId) {
          const firstActive = data.keys.find((k: ApiKey) => k.status === 'active');
          if (firstActive) setSelectedKeyId(firstActive.id);
        }
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setIsLoadingKeys(false);
    }
  }, [selectedKeyId]);

  // Fetch Usage
  const fetchUsage = useCallback(async () => {
    setIsLoadingUsage(true);
    try {
      const res = await fetch('/api/v1/developer/usage');
      if (res.ok) {
        const data = await res.json();
        setUsageStats(data);
      }
    } catch (err) {
      console.error('Failed to load usage stats:', err);
    } finally {
      setIsLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchUsage();
  }, [fetchKeys, fetchUsage]);

  // Create Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim() || 'API Key',
          environment: newKeyEnv,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedSecret(data.secret);
        setCustomKeyInput(data.secret);
        setNewKeyName('');
        fetchKeys();
      }
    } catch (err) {
      console.error('Create key error:', err);
    }
  };

  // Revoke Key
  const handleRevokeKey = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/developer/keys/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setKeyToRevoke(null);
        fetchKeys();
      }
    } catch (err) {
      console.error('Revoke key error:', err);
    }
  };

  // Run Playground Request
  const handleExecutePlayground = async () => {
    setIsExecutingPlayground(true);
    setPlaygroundResponse(null);
    setPlaygroundStatus(null);
    setPlaygroundLatency(null);
    setPlaygroundRequestId(null);

    const activeKeySecret = customKeyInput.trim() || createdSecret || 'kn_live_demo_sample_token';
    const aiId = activeKb?.specializedAi?.id || 'ai_default';
    const startTime = Date.now();

    try {
      let url = '';
      let options: RequestInit = {};

      if (playgroundEndpoint === 'chat') {
        url = '/api/v1/chat';
        options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKeySecret}`,
          },
          body: JSON.stringify({
            ai_id: aiId,
            message: playgroundMessage,
            conversation_id: playgroundConversationId || undefined,
          }),
        };
      } else if (playgroundEndpoint === 'get_ai') {
        url = `/api/v1/ai/${aiId}`;
        options = {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${activeKeySecret}`,
          },
        };
      } else if (playgroundEndpoint === 'get_kb') {
        url = `/api/v1/ai/${aiId}/knowledge`;
        options = {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${activeKeySecret}`,
          },
        };
      } else {
        url = '/api/v1/health';
        options = { method: 'GET' };
      }

      const res = await fetch(url, options);
      const latency = Date.now() - startTime;
      const data = await res.json();

      setPlaygroundStatus(res.status);
      setPlaygroundLatency(latency);
      setPlaygroundResponse(data);
      setPlaygroundRequestId(res.headers.get('X-Request-ID') || data.request_id || null);

      // Refresh usage tab stats
      fetchUsage();
    } catch (err: any) {
      setPlaygroundStatus(500);
      setPlaygroundResponse({ error: { code: 'NETWORK_ERROR', message: err.message } });
    } finally {
      setIsExecutingPlayground(false);
    }
  };

  // Run Phase 3 Tests
  const handleRunAcceptanceTests = async () => {
    setIsRunningAcceptanceTests(true);
    try {
      const res = await fetch('/api/v1/tests/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAcceptanceTests(data.results || []);
        const passed = (data.results || []).filter((t: TestResultItem) => t.status === 'passed').length;
        setTestSummary({ passed, total: data.results.length });
      }
    } catch (err) {
      console.error('Test execution error:', err);
    } finally {
      setIsRunningAcceptanceTests(false);
    }
  };

  const copyToClipboard = (text: string, isKey = false) => {
    navigator.clipboard.writeText(text);
    if (isKey) {
      setHasCopiedKey(true);
      setTimeout(() => setHasCopiedKey(false), 2500);
    }
  };

  // Generate cURL preview
  const getCurlSnippet = () => {
    const activeKey = customKeyInput.trim() || (createdSecret ? createdSecret : 'kn_live_your_key_here');
    const aiId = activeKb?.specializedAi?.id || 'ai_default';

    if (playgroundEndpoint === 'chat') {
      return `curl -X POST "https://your-domain.com/api/v1/chat" \\
  -H "Authorization: Bearer ${activeKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ai_id": "${aiId}",
    "message": "${playgroundMessage.replace(/"/g, '\\"')}"
  }'`;
    } else if (playgroundEndpoint === 'get_ai') {
      return `curl -X GET "https://your-domain.com/api/v1/ai/${aiId}" \\
  -H "Authorization: Bearer ${activeKey}"`;
    } else if (playgroundEndpoint === 'get_kb') {
      return `curl -X GET "https://your-domain.com/api/v1/ai/${aiId}/knowledge" \\
  -H "Authorization: Bearer ${activeKey}"`;
    } else {
      return `curl -X GET "https://your-domain.com/api/v1/health"`;
    }
  };

  return (
    <div id="developer-platform-container" className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Platform Header Banner */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Developer Platform & REST API
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Phase 3 Production Ready
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Expose your persistent Specialized AI to external services via authenticated, isolated REST APIs.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Active AI Target info */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Target Specialized AI</div>
                <div className="font-mono font-semibold text-slate-800 text-xs">
                  {activeKb?.specializedAi?.id || 'No AI active'}
                </div>
              </div>
            </div>

            <button
              id="btn-run-acceptance-suite-header"
              onClick={() => {
                setSubTab('tests');
                handleRunAcceptanceTests();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Run API Tests</span>
            </button>
          </div>
        </div>

        {/* Developer Platform Sub-Navigation */}
        <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3">
          <button
            id="subtab-api-keys"
            onClick={() => setSubTab('keys')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'keys'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-200">
              {keys.filter((k) => k.status === 'active').length}
            </span>
          </button>

          <button
            id="subtab-playground"
            onClick={() => setSubTab('playground')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'playground'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API Playground</span>
          </button>

          <button
            id="subtab-docs"
            onClick={() => setSubTab('docs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'docs'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>API Documentation</span>
          </button>

          <button
            id="subtab-usage"
            onClick={() => {
              setSubTab('usage');
              fetchUsage();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'usage'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Observability & Logs</span>
          </button>

          <button
            id="subtab-tests"
            onClick={() => setSubTab('tests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'tests'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Acceptance Tests (20)</span>
            {testSummary && (
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                testSummary.passed === testSummary.total ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'
              }`}>
                {testSummary.passed}/{testSummary.total}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUBTAB 1: API KEYS */}
      {subTab === 'keys' && (
        <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
          {/* Newly created raw key modal alert */}
          {createdSecret && (
            <div
              id="new-key-secret-banner"
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 mt-0.5">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">
                      Save your secret API key immediately
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Please store this key securely. For security reasons, you will <strong>never be able to view it again</strong>. If lost, you will need to generate a new key.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="bg-white border border-emerald-300 font-mono text-xs px-3 py-1.5 rounded-lg text-emerald-950 font-semibold select-all">
                        {createdSecret}
                      </div>
                      <button
                        id="btn-copy-secret-key"
                        onClick={() => copyToClipboard(createdSecret, true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                      >
                        {hasCopiedKey ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Copy Secret Key</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setCreatedSecret(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1 rounded-md text-xs cursor-pointer font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Key Management Header Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">API Credentials & Access Tokens</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every request to the <code>/api/v1</code> endpoints requires a Bearer token in the <code>Authorization</code> header.
              </p>
            </div>
            <button
              id="btn-open-create-key-modal"
              onClick={() => setNewKeyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Key</span>
            </button>
          </div>

          {/* Keys Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Active & Revoked Keys</span>
              <button
                onClick={fetchKeys}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingKeys ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {keys.length === 0 ? (
              <div className="p-8 text-center">
                <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No API keys created yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Generate your first key to start accessing your Specialized AI via API.</p>
                <button
                  onClick={() => setNewKeyModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Generate Key</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-5 py-2.5">Key Name</th>
                      <th className="px-5 py-2.5">Masked Secret</th>
                      <th className="px-5 py-2.5">Environment</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Created</th>
                      <th className="px-5 py-2.5">Last Used</th>
                      <th className="px-5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {keys.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {k.name}
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {k.maskedKey}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              k.environment === 'live'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {k.environment}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {k.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              <span>Revoked</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {k.status === 'active' ? (
                            <button
                              id={`btn-revoke-key-${k.id}`}
                              onClick={() => setKeyToRevoke(k)}
                              className="text-rose-600 hover:text-rose-800 font-semibold text-xs inline-flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Revoke</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Revoked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Security Best Practices Card */}
          <div className="bg-slate-900 text-slate-300 rounded-xl p-5 text-xs space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Production Security Standards Enforced
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-[11px] text-slate-300">
              <div className="border-l-2 border-indigo-400 pl-3">
                <span className="font-bold text-white block">SHA-256 Hashed Persistence</span>
                Raw keys are never written to disk or logged. Only salted cryptographic hashes are retained.
              </div>
              <div className="border-l-2 border-emerald-400 pl-3">
                <span className="font-bold text-white block">Strict Tenant Isolation</span>
                Keys are hard-bound to their account. Cross-tenant access is rejected at the service layer with 403 Forbidden.
              </div>
              <div className="border-l-2 border-amber-400 pl-3">
                <span className="font-bold text-white block">Automated Rate Limiting</span>
                Each key is throttled at 100 requests per minute with deterministic <code>Retry-After</code> headers.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: API PLAYGROUND */}
      {subTab === 'playground' && (
        <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Request Configuration */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>API Request Builder</span>
                  <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    REST / JSON
                  </span>
                </h3>

                {/* Endpoint Selection */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Select Target Endpoint
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      id="endpoint-selector-chat"
                      type="button"
                      onClick={() => setPlaygroundEndpoint('chat')}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        playgroundEndpoint === 'chat'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                          POST
                        </span>
                        <span>/api/v1/chat</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-normal">Grounded AI Chat & Refusal</p>
                    </button>

                    <button
                      id="endpoint-selector-get-ai"
                      type="button"
                      onClick={() => setPlaygroundEndpoint('get_ai')}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        playgroundEndpoint === 'get_ai'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
                          GET
                        </span>
                        <span>/api/v1/ai/:ai_id</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-normal">AI Status & Metadata</p>
                    </button>

                    <button
                      id="endpoint-selector-get-kb"
                      type="button"
                      onClick={() => setPlaygroundEndpoint('get_kb')}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        playgroundEndpoint === 'get_kb'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
                          GET
                        </span>
                        <span>/api/v1/ai/:ai_id/knowledge</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-normal">Active Knowledge Snapshot</p>
                    </button>

                    <button
                      id="endpoint-selector-health"
                      type="button"
                      onClick={() => setPlaygroundEndpoint('health')}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        playgroundEndpoint === 'health'
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
                          GET
                        </span>
                        <span>/api/v1/health</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-normal">Liveness & Health</p>
                    </button>
                  </div>
                </div>

                {/* Authentication Token */}
                {playgroundEndpoint !== 'health' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                      <span>Authorization Token (Bearer)</span>
                      <span className="text-[10px] text-slate-500">
                        {customKeyInput ? 'Custom key active' : 'Enter key or paste below'}
                      </span>
                    </label>
                    <input
                      id="playground-input-bearer-key"
                      type="text"
                      placeholder="Paste raw secret: kn_live_..."
                      value={customKeyInput}
                      onChange={(e) => setCustomKeyInput(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Target AI ID */}
                {(playgroundEndpoint === 'chat' || playgroundEndpoint === 'get_ai' || playgroundEndpoint === 'get_kb') && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Specialized AI Identifier (<code>ai_id</code>)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={activeKb?.specializedAi?.id || 'ai_default'}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 select-all"
                    />
                  </div>
                )}

                {/* POST /chat Body Parameters */}
                {playgroundEndpoint === 'chat' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Message Body (<code>message</code>)
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPlaygroundMessage('What pressure does the machine operate at under nominal conditions?')}
                            className="text-[10px] text-indigo-600 hover:underline cursor-pointer"
                          >
                            [Grounded]
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlaygroundMessage('What is the current population of Nepal?')}
                            className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                          >
                            [Refusal]
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlaygroundMessage('According to both the manual and the safety protocols, what checklist steps must be verified?')}
                            className="text-[10px] text-emerald-600 hover:underline cursor-pointer"
                          >
                            [Synthesis]
                          </button>
                        </div>
                      </div>
                      <textarea
                        id="playground-input-message"
                        rows={3}
                        value={playgroundMessage}
                        onChange={(e) => setPlaygroundMessage(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500 font-sans"
                        placeholder="Enter question for the Specialized AI..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        Optional Conversation Scope (<code>conversation_id</code>)
                      </label>
                      <input
                        type="text"
                        placeholder="conv_user_session_123 (optional)"
                        value={playgroundConversationId}
                        onChange={(e) => setPlaygroundConversationId(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                {/* Execute Button */}
                <button
                  id="btn-execute-playground-request"
                  onClick={handleExecutePlayground}
                  disabled={isExecutingPlayground}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isExecutingPlayground ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching API Request...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Send API Request</span>
                    </>
                  )}
                </button>
              </div>

              {/* cURL Code Preview */}
              <div className="bg-slate-900 text-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-mono font-bold text-slate-400">Equivalent cURL</span>
                  <button
                    onClick={() => {
                      copyToClipboard(getCurlSnippet());
                      setHasCopiedCurl(true);
                      setTimeout(() => setHasCopiedCurl(false), 2000);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {hasCopiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{hasCopiedCurl ? 'Copied' : 'Copy cURL'}</span>
                  </button>
                </div>
                <pre className="mt-3 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {getCurlSnippet()}
                </pre>
              </div>
            </div>

            {/* Right Column: Live Response & Metadata */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs min-h-[460px] flex flex-col">
                {/* Response Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">API Response</h3>
                    {playgroundStatus !== null && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                          playgroundStatus >= 200 && playgroundStatus < 300
                            ? 'bg-emerald-100 text-emerald-800'
                            : playgroundStatus === 429
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {playgroundStatus} {playgroundStatus === 200 ? 'OK' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {playgroundLatency !== null && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {playgroundLatency}ms
                      </span>
                    )}
                    {playgroundResponse && (
                      <button
                        onClick={() => {
                          copyToClipboard(JSON.stringify(playgroundResponse, null, 2));
                          setHasCopiedJson(true);
                          setTimeout(() => setHasCopiedJson(false), 2000);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        {hasCopiedJson ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{hasCopiedJson ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata Badges if /chat response */}
                {playgroundResponse && playgroundResponse.answer !== undefined && (
                  <div className="py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        playgroundResponse.grounded
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Grounded: {String(playgroundResponse.grounded)}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        playgroundResponse.refused
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Refused: {String(playgroundResponse.refused)}
                    </span>

                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                      Version: {playgroundResponse.knowledge_version || 'v1.0'}
                    </span>

                    {playgroundRequestId && (
                      <span className="font-mono text-[10px] text-slate-400">
                        req: {playgroundRequestId}
                      </span>
                    )}
                  </div>
                )}

                {/* Formatted Sources Cards */}
                {playgroundResponse?.sources && playgroundResponse.sources.length > 0 && (
                  <div className="py-3 border-b border-slate-100">
                    <div className="text-[11px] font-bold text-slate-700 mb-2">
                      Cited Grounding Sources ({playgroundResponse.sources.length})
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {playgroundResponse.sources.map((src: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-indigo-700">{src.document_name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Page {src.page || 'N/A'}
                            </span>
                          </div>
                          {src.excerpt && (
                            <p className="text-[11px] text-slate-600 mt-1 italic line-clamp-2">
                              "{src.excerpt}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* JSON Body Display */}
                <div className="mt-3 flex-1 flex flex-col">
                  {playgroundResponse ? (
                    <pre
                      id="playground-response-json"
                      className="bg-slate-900 text-emerald-400 font-mono text-xs p-3.5 rounded-lg overflow-auto flex-1 max-h-[380px] leading-relaxed"
                    >
                      {JSON.stringify(playgroundResponse, null, 2)}
                    </pre>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <Terminal className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs font-medium">Ready to dispatch request</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Select an endpoint and click "Send API Request" to see real server response.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: API DOCUMENTATION */}
      {subTab === 'docs' && (
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Knowledge AI Developer API (v1)</h3>
              <p className="text-xs text-slate-500 mt-1">
                The REST API enables any external application, agent, or microservice to query the persistent Knowledge Base and receive grounded, citeable intelligence.
              </p>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold text-slate-600">Sample Code:</span>
              <button
                onClick={() => setDocsLanguage('curl')}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  docsLanguage === 'curl' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setDocsLanguage('js')}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  docsLanguage === 'js' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                JavaScript / Node.js
              </button>
              <button
                onClick={() => setDocsLanguage('python')}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  docsLanguage === 'python' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Python
              </button>
            </div>

            {/* Endpoint 1: POST /api/v1/chat */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-xs">
                    POST
                  </span>
                  <code className="text-sm font-bold text-slate-900">/api/v1/chat</code>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                  Core AI Chat
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Submits a question to the Specialized AI. Returns an answer strictly grounded in the AI's isolated knowledge base, complete with cited document pages and machine-readable refusal flags.
              </p>

              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-slate-800">Headers:</div>
                <div className="font-mono text-slate-600">Authorization: Bearer &lt;API_KEY&gt;</div>
                <div className="font-mono text-slate-600">Content-Type: application/json</div>
              </div>

              <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                {docsLanguage === 'curl' && (
`curl -X POST "https://your-domain.com/api/v1/chat" \\
  -H "Authorization: Bearer kn_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "ai_id": "${activeKb?.specializedAi?.id || 'ai_example'}",
    "message": "What pressure does the machine operate at?"
  }'`
                )}
                {docsLanguage === 'js' && (
`const response = await fetch("https://your-domain.com/api/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer kn_live_...",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    ai_id: "${activeKb?.specializedAi?.id || 'ai_example'}",
    message: "What pressure does the machine operate at?"
  })
});
const data = await response.json();
console.log(data.answer, data.grounded, data.sources);`
                )}
                {docsLanguage === 'python' && (
`import requests

res = requests.post(
  "https://your-domain.com/api/v1/chat",
  headers={"Authorization": "Bearer kn_live_..."},
  json={
    "ai_id": "${activeKb?.specializedAi?.id || 'ai_example'}",
    "message": "What pressure does the machine operate at?"
  }
)
data = res.json()
print(data["answer"], data["grounded"])`
                )}
              </div>
            </div>

            {/* Endpoint 2: GET /api/v1/ai/:ai_id */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold text-xs">
                    GET
                  </span>
                  <code className="text-sm font-bold text-slate-900">/api/v1/ai/:ai_id</code>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                  AI Metadata
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Retrieves status, name, description, and active knowledge version for a given Specialized AI.
              </p>
            </div>

            {/* Endpoint 3: GET /api/v1/ai/:ai_id/knowledge */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold text-xs">
                    GET
                  </span>
                  <code className="text-sm font-bold text-slate-900">/api/v1/ai/:ai_id/knowledge</code>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                  Knowledge Status
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Returns the total document count, page count, and update timestamp for the underlying knowledge base.
              </p>
            </div>

            {/* Error Code Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Standard Error Code Reference
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-2">HTTP Status</th>
                      <th className="px-4 py-2">Error Code</th>
                      <th className="px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="px-4 py-2 font-mono font-bold text-rose-600">400</td>
                      <td className="px-4 py-2 font-mono">INVALID_REQUEST</td>
                      <td className="px-4 py-2">Missing required parameters (e.g. <code>ai_id</code> or <code>message</code>).</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono font-bold text-rose-600">401</td>
                      <td className="px-4 py-2 font-mono">UNAUTHORIZED</td>
                      <td className="px-4 py-2">Missing or invalid Bearer token.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono font-bold text-rose-600">403</td>
                      <td className="px-4 py-2 font-mono">FORBIDDEN</td>
                      <td className="px-4 py-2">Revoked key or cross-tenant account access violation.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono font-bold text-rose-600">404</td>
                      <td className="px-4 py-2 font-mono">AI_NOT_FOUND</td>
                      <td className="px-4 py-2">The requested Specialized AI does not exist.</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono font-bold text-amber-600">429</td>
                      <td className="px-4 py-2 font-mono">RATE_LIMITED</td>
                      <td className="px-4 py-2">Exceeded rate quota (100 req/min). Inspect <code>Retry-After</code> header.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: OBSERVABILITY & USAGE */}
      {subTab === 'usage' && (
        <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
          {/* KPI Metrics row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total API Requests
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {usageStats?.totalRequests || 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Recorded across all keys</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Avg Response Latency
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {usageStats?.averageLatencyMs || 0}ms
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">End-to-end grounding pipeline</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Grounded Answers
              </span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {usageStats?.recentLogs?.filter((l) => l.grounded).length || 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Backed by verified source citations</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Refused Queries
              </span>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {usageStats?.recentLogs?.filter((l) => l.refused).length || 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Negative boundary protection triggered</p>
            </div>
          </div>

          {/* Recent Request Logs */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent API Request Traces
              </h4>
              <button
                onClick={fetchUsage}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingUsage ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {!usageStats?.recentLogs || usageStats.recentLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No API calls recorded yet. Send a request from the API Playground to see traces here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-5 py-2.5">Time</th>
                      <th className="px-5 py-2.5">Endpoint</th>
                      <th className="px-5 py-2.5">Target AI</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Latency</th>
                      <th className="px-5 py-2.5">Outcome</th>
                      <th className="px-5 py-2.5">Request ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usageStats.recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-2.5 text-slate-500 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-slate-800 font-semibold">
                          {log.endpoint}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-slate-600">
                          {log.aiId}
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className={`font-mono font-bold px-1.5 py-0.2 rounded text-[11px] ${
                              log.status === 200
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 font-mono text-slate-600">
                          {log.latencyMs}ms
                        </td>
                        <td className="px-5 py-2.5">
                          {log.grounded && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold mr-1">
                              Grounded
                            </span>
                          )}
                          {log.refused && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                              Refused
                            </span>
                          )}
                          {!log.grounded && !log.refused && log.status !== 200 && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 text-[10px] font-bold font-mono">
                              {log.errorCode || 'Error'}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-[10px] text-slate-400">
                          {log.requestId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 5: ACCEPTANCE TESTS (20 TESTS) */}
      {subTab === 'tests' && (
        <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Phase 3 API Acceptance Test Suite
                {testSummary && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    testSummary.passed === testSummary.total
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {testSummary.passed} / {testSummary.total} Passed
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Executes the 20 mandatory Phase 3 integration tests verifying security, tenant isolation, negative refusal, and grounding parity.
              </p>
            </div>

            <button
              id="btn-run-all-acceptance-tests"
              onClick={handleRunAcceptanceTests}
              disabled={isRunningAcceptanceTests}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isRunningAcceptanceTests ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Acceptance Suite...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run 20 Acceptance Tests</span>
                </>
              )}
            </button>
          </div>

          {/* Test Cards List */}
          <div className="space-y-2">
            {acceptanceTests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                <ShieldCheck className="w-10 h-10 text-indigo-400 mx-auto mb-2 opacity-60" />
                <h4 className="text-sm font-bold text-slate-800">No Acceptance Test Run Active</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Click the button above to run all 20 Phase 3 acceptance criteria against the live server endpoints.
                </p>
              </div>
            ) : (
              acceptanceTests.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white border rounded-xl p-3.5 text-xs transition-all shadow-2xs ${
                    t.status === 'passed'
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : t.status === 'failed'
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {t.status === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : t.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-bold text-slate-900">
                        Test {t.id}: {t.name}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        t.status === 'passed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  {t.details && (
                    <div className="mt-2 text-[11px] text-slate-600 pl-6.5 font-mono">
                      {t.details}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CREATE API KEY MODAL */}
      {newKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              Generate New API Key
            </h3>
            <p className="text-xs text-slate-500">
              Create an authenticated credential to access your Specialized AI through the REST API.
            </p>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Key Name / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer Support Microservice"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Environment Tier
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                      newKeyEnv === 'live' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="env"
                      checked={newKeyEnv === 'live'}
                      onChange={() => setNewKeyEnv('live')}
                    />
                    <div>
                      <div className="font-bold text-slate-900">Live (kn_live_*)</div>
                      <div className="text-[10px] text-slate-500">Production access</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                      newKeyEnv === 'test' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="env"
                      checked={newKeyEnv === 'test'}
                      onChange={() => setNewKeyEnv('test')}
                    />
                    <div>
                      <div className="font-bold text-slate-900">Test (kn_test_*)</div>
                      <div className="text-[10px] text-slate-500">Staging & testing</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewKeyModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={() => setNewKeyModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVOKE KEY CONFIRMATION MODAL */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Revoke API Key?
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to revoke key <strong>"{keyToRevoke.name}"</strong> (<code>{keyToRevoke.maskedKey}</code>)? Any external application utilizing this key will immediately be denied access (401/403).
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setKeyToRevoke(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                Keep Key
              </button>
              <button
                id="btn-confirm-revoke-key"
                onClick={() => handleRevokeKey(keyToRevoke.id)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                Revoke Key Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
