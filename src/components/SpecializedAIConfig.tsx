import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Save,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  FileText,
  AlignLeft,
  List,
  Briefcase,
  Quote,
  GraduationCap,
  Scale,
  RefreshCw,
} from 'lucide-react';
import { SpecializedAI, ResponseStyle, CitationMode } from '../types';

interface SpecializedAIConfigProps {
  specializedAi: SpecializedAI;
  kbName: string;
  currentVersion: string;
  onSaveAiConfig: (updated: Partial<SpecializedAI>) => Promise<void>;
  isSaving: boolean;
}

export const SpecializedAIConfig: React.FC<SpecializedAIConfigProps> = ({
  specializedAi,
  kbName,
  currentVersion,
  onSaveAiConfig,
  isSaving,
}) => {
  const [name, setName] = useState(specializedAi.name || '');
  const [description, setDescription] = useState(specializedAi.description || '');
  const [roleDefinition, setRoleDefinition] = useState(specializedAi.roleDefinition || '');
  const [systemPromptModifier, setSystemPromptModifier] = useState(
    specializedAi.systemPromptModifier || ''
  );
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(
    specializedAi.responseStyle || 'detailed'
  );
  const [citationMode, setCitationMode] = useState<CitationMode>(
    specializedAi.citationMode || 'standard'
  );
  const [strictRefusal, setStrictRefusal] = useState(
    specializedAi.strictRefusal !== undefined ? specializedAi.strictRefusal : true
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    specializedAi.confidenceThreshold || 85
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setName(specializedAi.name || '');
    setDescription(specializedAi.description || '');
    setRoleDefinition(specializedAi.roleDefinition || '');
    setSystemPromptModifier(specializedAi.systemPromptModifier || '');
    setResponseStyle(specializedAi.responseStyle || 'detailed');
    setCitationMode(specializedAi.citationMode || 'standard');
    setStrictRefusal(specializedAi.strictRefusal !== undefined ? specializedAi.strictRefusal : true);
    setConfidenceThreshold(specializedAi.confidenceThreshold || 85);
  }, [specializedAi]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    await onSaveAiConfig({
      name: name.trim(),
      description: description.trim(),
      roleDefinition: roleDefinition.trim(),
      systemPromptModifier: systemPromptModifier.trim(),
      responseStyle,
      citationMode,
      strictRefusal,
      confidenceThreshold,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const responseStylesList: {
    id: ResponseStyle;
    label: string;
    icon: React.ReactNode;
    desc: string;
  }[] = [
    {
      id: 'concise',
      label: 'Concise & Direct',
      icon: <AlignLeft className="w-4 h-4" />,
      desc: 'Crisp 2-3 sentence answers focusing purely on key values, parameters, and facts.',
    },
    {
      id: 'detailed',
      label: 'Comprehensive & Detailed',
      icon: <FileText className="w-4 h-4" />,
      desc: 'In-depth answers including operating context, nuances, and complete explanations from the documents.',
    },
    {
      id: 'bullet-points',
      label: 'Structured Bullet Points',
      icon: <List className="w-4 h-4" />,
      desc: 'Clear scannable breakdown formatted with bold sub-headers and itemized lists.',
    },
    {
      id: 'executive-summary',
      label: 'Executive Summary',
      icon: <Briefcase className="w-4 h-4" />,
      desc: 'TL;DR headline followed by strategic takeaways and operational conclusions.',
    },
  ];

  const citationModesList: {
    id: CitationMode;
    label: string;
    icon: React.ReactNode;
    desc: string;
  }[] = [
    {
      id: 'standard',
      label: 'Standard Grounding',
      icon: <Quote className="w-4 h-4" />,
      desc: 'Includes document filename, page number, and section heading.',
    },
    {
      id: 'strict-snippets',
      label: 'Verbatim Snippet Excerpts',
      icon: <Scale className="w-4 h-4" />,
      desc: 'Requires verbatim quoted snippets for every claim made.',
    },
    {
      id: 'academic',
      label: 'Formal Reference',
      icon: <GraduationCap className="w-4 h-4" />,
      desc: 'Academic style citations including document, page, section, and context snippet.',
    },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Specialized AI Configuration
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Active on {currentVersion}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Customize the reasoning personality, response structure, and strictness of the AI
              attached to &ldquo;{kbName}&rdquo;.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Settings saved!
              </span>
            )}
            <button
              id="btn-save-ai-config"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Identity Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-500" />
              Identity & Role Definition
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Specialized AI Name
                </label>
                <input
                  id="ai-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Industrial Equipment Specialist"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The display title for this specialized agent.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  AI Description
                </label>
                <input
                  id="ai-description-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Expert advisor for Apex-1000 technical operations and safety standards"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Brief description of this AI&apos;s purpose and knowledge scope.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Role Persona & Base Instructions
              </label>
              <textarea
                id="ai-role-definition-input"
                rows={3}
                value={roleDefinition}
                onChange={(e) => setRoleDefinition(e.target.value)}
                placeholder="e.g. You are a senior pneumatic operations engineer and maintenance supervisor..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Defines the domain expertise, reasoning perspective, and professional framing of the AI.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Domain Directives & Constraints (Optional System Prompt Modifiers)
              </label>
              <textarea
                id="ai-system-prompt-modifier-input"
                rows={2}
                value={systemPromptModifier}
                onChange={(e) => setSystemPromptModifier(e.target.value)}
                placeholder="e.g. Always emphasize OSHA safety protocols and specify torque and PSI tolerances in bold."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Appended to the grounding prompt to enforce domain-specific formatting or safety standards.
              </p>
            </div>
          </div>

          {/* Response Style Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-slate-500" />
                Response Style & Formatting
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose how the Specialized AI formats answers to fit your workflow.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {responseStylesList.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setResponseStyle(st.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    responseStyle === st.id
                      ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 text-slate-900'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`p-1.5 rounded-md ${
                        responseStyle === st.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {st.icon}
                    </span>
                    <span className="text-xs font-semibold">{st.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{st.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Citation Mode Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Quote className="w-4 h-4 text-slate-500" />
                Citation Verification Mode
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Control the depth of source citations attached to every grounded answer.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {citationModesList.map((cm) => (
                <button
                  key={cm.id}
                  type="button"
                  onClick={() => setCitationMode(cm.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    citationMode === cm.id
                      ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 text-slate-900'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`p-1.5 rounded-md ${
                        citationMode === cm.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cm.icon}
                    </span>
                    <span className="text-xs font-semibold">{cm.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{cm.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Grounding Strictness & Refusal Guards */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              Grounding Strictness & Refusal Enforcement
            </h3>

            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label htmlFor="toggle-strict-refusal" className="text-xs font-semibold text-slate-900 block cursor-pointer">
                  Strict Refusal Guard (Mandatory Grounding)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  When enabled, queries that cannot be directly substantiated by the documents are
                  explicitly rejected with{' '}
                  <span className="font-mono text-[10px] bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                    &ldquo;I couldn&apos;t find enough information...&rdquo;
                  </span>{' '}
                  rather than attempting general model speculation.
                </p>
              </div>
              <input
                id="toggle-strict-refusal"
                type="checkbox"
                checked={strictRefusal}
                onChange={(e) => setStrictRefusal(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span>Grounding Confidence Threshold</span>
                <span className="font-semibold text-indigo-600">{confidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>50% (Permissive)</span>
                <span>85% (Recommended)</span>
                <span>99% (Ultra-strict)</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
