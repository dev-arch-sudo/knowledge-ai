import React, { useState } from 'react';
import { X, Database, Plus } from 'lucide-react';

interface NewKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const NewKnowledgeBaseModal: React.FC<NewKnowledgeBaseModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [kbName, setKbName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbName.trim()) return;
    onCreate(kbName.trim());
    setKbName('');
    onClose();
  };

  return (
    <div
      id="new-kb-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="new-kb-modal"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-900 text-white shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Create Knowledge Base</h3>
              <p className="text-xs text-slate-500">
                Isolate documents into a distinct knowledge instance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <label
            htmlFor="kb-name-input"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Knowledge Base Name
          </label>
          <input
            type="text"
            id="kb-name-input"
            required
            autoFocus
            value={kbName}
            onChange={(e) => setKbName(e.target.value)}
            placeholder="e.g., Engineering Operations, Legal Contracts..."
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all"
          />

          <p className="text-[11px] text-slate-500 mt-2">
            Each knowledge base maintains its own document collection and grounded conversation
            history.
          </p>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!kbName.trim()}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Knowledge Base</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
