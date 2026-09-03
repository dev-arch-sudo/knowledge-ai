import React, { useState, useRef } from 'react';
import {
  GitCommit,
  RotateCcw,
  Plus,
  FileText,
  UploadCloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  BookOpen,
  Calendar,
  Layers,
  History,
  Tag,
  ChevronDown,
  ChevronRight,
  Eye,
  Check,
  Edit2,
} from 'lucide-react';
import { KnowledgeBase, KnowledgeDocument, KnowledgeVersion } from '../types';

interface KnowledgeVersioningViewProps {
  activeKb: KnowledgeBase;
  onUploadFiles: (files: FileList | File[]) => void;
  onRemoveDocument: (id: string) => void;
  onRetryDocument: (id: string) => void;
  onLoadSampleDocs: () => void;
  onViewDocument: (doc: KnowledgeDocument) => void;
  onCreateVersion: (label: string) => Promise<void>;
  onRollbackVersion: (versionId: string) => Promise<void>;
  onUpdateKbDetails: (name: string, description: string) => Promise<void>;
  isUploading: boolean;
  isLoadingSamples: boolean;
}

export const KnowledgeVersioningView: React.FC<KnowledgeVersioningViewProps> = ({
  activeKb,
  onUploadFiles,
  onRemoveDocument,
  onRetryDocument,
  onLoadSampleDocs,
  onViewDocument,
  onCreateVersion,
  onRollbackVersion,
  onUpdateKbDetails,
  isUploading,
  isLoadingSamples,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [isSubmittingSnapshot, setIsSubmittingSnapshot] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [isRollingBackId, setIsRollingBackId] = useState<string | null>(null);

  // Editing KB details state
  const [isEditingKb, setIsEditingKb] = useState(false);
  const [editName, setEditName] = useState(activeKb.name);
  const [editDesc, setEditDesc] = useState(activeKb.description || '');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndUpload(droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadError(null);
      validateAndUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const validateAndUpload = (files: File[]) => {
    const invalidFiles = files.filter(
      (f) => !f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf'
    );
    if (invalidFiles.length > 0) {
      setUploadError(`Unsupported format for "${invalidFiles[0].name}". Only PDF documents are supported.`);
      return;
    }
    const oversizedFiles = files.filter((f) => f.size > 25 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setUploadError(`"${oversizedFiles[0].name}" exceeds 25MB limit.`);
      return;
    }
    onUploadFiles(files);
  };

  const handleCreateSnapshotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotLabel.trim()) return;
    setIsSubmittingSnapshot(true);
    try {
      await onCreateVersion(snapshotLabel.trim());
      setSnapshotLabel('');
      setIsCreatingSnapshot(false);
    } finally {
      setIsSubmittingSnapshot(false);
    }
  };

  const handleRollback = async (vId: string) => {
    if (window.confirm('Restore documents to this version snapshot? Current active documents will be replaced with this version.')) {
      setIsRollingBackId(vId);
      try {
        await onRollbackVersion(vId);
      } finally {
        setIsRollingBackId(null);
      }
    }
  };

  const handleSaveKbDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSavingDetails(true);
    try {
      await onUpdateKbDetails(editName.trim(), editDesc.trim());
      setIsEditingKb(false);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const totalPages = (activeKb.documents || []).reduce((acc, d) => acc + (d.pageCount || 0), 0);
  const versions = activeKb.versions || [];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Overview & Metadata Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  <BookOpen className="w-4 h-4" />
                </span>
                {!isEditingKb ? (
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      {activeKb.name}
                    </h2>
                    <button
                      onClick={() => {
                        setEditName(activeKb.name);
                        setEditDesc(activeKb.description || '');
                        setIsEditingKb(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Edit knowledge base details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveKbDetails} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-sm font-semibold px-2 py-1 border border-indigo-500 rounded-md focus:outline-hidden"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isSavingDetails}
                      className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-md font-medium"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingKb(false)}
                      className="px-2.5 py-1 text-xs text-slate-600 border border-slate-200 rounded-md"
                    >
                      Cancel
                    </button>
                  </form>
                )}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {activeKb.currentVersion || 'v1.0'}
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-2xl">
                {activeKb.description || 'Isolated document repository powering your Specialized AI.'}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 text-xs shrink-0 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Documents
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {activeKb.documents?.length || 0}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Indexed Pages
                </span>
                <span className="font-bold text-slate-800 text-sm">{totalPages}</span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Version
                </span>
                <span className="font-bold text-indigo-600 text-sm">
                  {activeKb.currentVersion || 'v1.0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Active Documents Collection */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Active Knowledge Documents ({activeKb.documents?.length || 0})
              </h3>
              <p className="text-xs text-slate-500">
                Uploaded PDFs in this Knowledge Base used for grounding.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-load-samples-kb-view"
                onClick={onLoadSampleDocs}
                disabled={isLoadingSamples}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                {isLoadingSamples ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Load Sample Manuals</span>
              </button>

              <button
                id="btn-upload-more-kb-view"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                {isUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Upload PDF</span>
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Upload Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
            }`}
          >
            <UploadCloud className="w-6 h-6 mx-auto text-slate-400 mb-1" />
            <p className="text-xs font-medium text-slate-700">
              Drag and drop PDF files here, or <span className="text-indigo-600">browse files</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports multi-page PDFs up to 25MB each.
            </p>
          </div>

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Documents Table */}
          {(!activeKb.documents || activeKb.documents.length === 0) ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No documents in this Knowledge Base yet. Upload PDFs or load sample manuals above.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Document Name</th>
                    <th className="py-2.5 px-3">Pages</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {activeKb.documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate max-w-xs">{doc.filename}</span>
                      </td>
                      <td className="py-2.5 px-3">{doc.pageCount || 0} pages</td>
                      <td className="py-2.5 px-3 text-slate-500">{formatFileSize(doc.fileSize)}</td>
                      <td className="py-2.5 px-3">
                        {doc.processingStatus === 'processed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Processed
                          </span>
                        )}
                        {doc.processingStatus === 'processing' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                            Processing
                          </span>
                        )}
                        {doc.processingStatus === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1">
                        <button
                          onClick={() => onViewDocument(doc)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                          title="Inspect pages"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {doc.processingStatus === 'failed' && (
                          <button
                            onClick={() => onRetryDocument(doc.id)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Retry document"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveDocument(doc.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Knowledge Versioning & Rollback */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Knowledge Version History & Snapshots
              </h3>
              <p className="text-xs text-slate-500">
                Create immutable version snapshots of your documents and roll back at any time.
              </p>
            </div>

            <button
              id="btn-create-snapshot"
              onClick={() => setIsCreatingSnapshot(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Create Version Snapshot</span>
            </button>
          </div>

          {/* Snapshot Creation Modal / Bar */}
          {isCreatingSnapshot && (
            <form
              onSubmit={handleCreateSnapshotSubmit}
              className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-950 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  New Version Snapshot
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingSnapshot(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Commit Description / Change Summary
                </label>
                <input
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="e.g. Added Q3 Operations Addendum and updated safety protocols"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingSnapshot(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSnapshot || !snapshotLabel.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmittingSnapshot ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Commit Snapshot</span>
                </button>
              </div>
            </form>
          )}

          {/* Version History List */}
          <div className="space-y-3">
            {versions.map((ver) => {
              const isCurrent = ver.versionTag === activeKb.currentVersion || ver.isCurrent;
              const isExpanded = expandedVersionId === ver.id;
              const isRollingBack = isRollingBackId === ver.id;

              return (
                <div
                  key={ver.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isCurrent
                      ? 'border-indigo-300 bg-indigo-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg text-xs font-bold ${
                          isCurrent
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {ver.versionTag}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-slate-900">
                            {ver.label || `Snapshot ${ver.versionTag}`}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Active / Live
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(ver.timestamp).toLocaleString()}
                          </span>
                          <span>•</span>
                          <span>{ver.documentCount} document(s)</span>
                          <span>•</span>
                          <span>{ver.totalPages} total page(s)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() =>
                          setExpandedVersionId(isExpanded ? null : ver.id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span>{isExpanded ? 'Hide Docs' : 'View Snapshot Docs'}</span>
                      </button>

                      {!isCurrent && (
                        <button
                          onClick={() => handleRollback(ver.id)}
                          disabled={isRollingBack}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
                          title="Restore Knowledge Base to this version"
                        >
                          {isRollingBack ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Rollback</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Document Snapshot details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                      <p className="text-[11px] font-medium text-slate-500 mb-2">
                        Documents stored in {ver.versionTag}:
                      </p>
                      {ver.documents && ver.documents.length > 0 ? (
                        <ul className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          {ver.documents.map((d, idx) => (
                            <li
                              key={idx}
                              className="flex items-center justify-between text-slate-700"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                {d.filename}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {d.pageCount} pages ({formatFileSize(d.fileSize)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-400 italic text-[11px]">
                          No documents were present in this initial snapshot.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
