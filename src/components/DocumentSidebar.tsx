import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Eye,
  FileCheck,
  BookOpen,
} from 'lucide-react';
import { KnowledgeDocument, DocumentProcessingStatus } from '../types';

interface DocumentSidebarProps {
  documents: KnowledgeDocument[];
  onUploadFiles: (files: FileList | File[]) => void;
  onRemoveDocument: (id: string) => void;
  onRetryDocument: (id: string) => void;
  onLoadSampleDocs: () => void;
  onViewDocument: (doc: KnowledgeDocument) => void;
  isUploading: boolean;
  isLoadingSamples: boolean;
}

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  documents,
  onUploadFiles,
  onRemoveDocument,
  onRetryDocument,
  onLoadSampleDocs,
  onViewDocument,
  isUploading,
  isLoadingSamples,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
      e.target.value = ''; // Reset input
    }
  };

  const validateAndUpload = (files: File[]) => {
    const invalidFiles = files.filter(
      (f) => !f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf'
    );
    if (invalidFiles.length > 0) {
      setUploadError(
        `Unsupported format for "${invalidFiles[0].name}". Only PDF documents are supported.`
      );
      return;
    }

    const oversizedFiles = files.filter((f) => f.size > 25 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setUploadError(`"${oversizedFiles[0].name}" exceeds the 25MB file size limit.`);
      return;
    }

    onUploadFiles(files);
  };

  const totalPages = documents.reduce((acc, d) => acc + (d.pageCount || 0), 0);
  const processedCount = documents.filter((d) => d.processingStatus === 'processed').length;

  return (
    <aside
      id="document-sidebar"
      className="w-full md:w-72 lg:w-84 xl:w-92 bg-slate-50 border-r border-slate-200 flex flex-col h-auto md:h-full max-h-[40vh] md:max-h-full shrink-0"
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Knowledge Documents
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {processedCount}/{documents.length} ready
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {totalPages > 0
            ? `${totalPages} total page${totalPages === 1 ? '' : 's'} indexed for grounded answers`
            : 'No documents uploaded yet'}
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div
          id="pdf-drop-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-slate-800 bg-slate-100'
              : 'border-slate-200 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="pdf-file-input"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-2">
            {isUploading ? (
              <Loader2 className="w-7 h-7 text-slate-700 animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7 text-slate-400" />
            )}
            <div>
              <p className="text-xs font-medium text-slate-800">
                {isUploading ? 'Processing documents...' : 'Click to browse or drop PDFs here'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Multiple PDF files supported (up to 25MB each)
              </p>
            </div>
          </div>
        </div>

        {uploadError && (
          <div
            id="upload-error-alert"
            className="mt-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{uploadError}</p>
            </div>
            <button
              onClick={() => setUploadError(null)}
              className="text-red-500 hover:text-red-700 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Sample Button */}
        {documents.length === 0 && (
          <div className="mt-3">
            <button
              id="btn-load-sample-docs"
              onClick={onLoadSampleDocs}
              disabled={isLoadingSamples || isUploading}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {isLoadingSamples ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCheck className="w-3.5 h-3.5 text-slate-700" />
              )}
              <span>Load Sample Industrial Specs (2 PDFs)</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-1.5">
              Includes Apex-1000 Manual (50 PSI) & Safety Protocol
            </p>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1 px-1">
          <span>DOCUMENTS ({documents.length})</span>
          {documents.length > 0 && (
            <button
              id="btn-upload-more-pdfs"
              onClick={() => fileInputRef.current?.click()}
              className="text-slate-800 hover:text-slate-950 flex items-center gap-1 font-medium"
            >
              <Plus className="w-3 h-3" />
              <span>Add PDF</span>
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div
            id="sidebar-empty-documents"
            className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 bg-white"
          >
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-700">No documents added</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] mx-auto">
              Upload PDF documents or load sample specifications to create your knowledge base.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              id={`document-item-${doc.id}`}
              className="group bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold text-slate-900 truncate"
                      title={doc.filename}
                    >
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span>{doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    id={`btn-view-doc-${doc.id}`}
                    onClick={() => onViewDocument(doc)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    title="View extracted text & pages"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id={`btn-remove-doc-${doc.id}`}
                    onClick={() => onRemoveDocument(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove document from knowledge base"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                {doc.processingStatus === 'processed' && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>✓ Processed</span>
                  </span>
                )}

                {doc.processingStatus === 'processing' && (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Processing...</span>
                  </span>
                )}

                {doc.processingStatus === 'pending' && (
                  <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Queued</span>
                  </span>
                )}

                {doc.processingStatus === 'failed' && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Failed</span>
                    </span>
                    <button
                      onClick={() => onRetryDocument(doc.id)}
                      className="text-xs text-red-700 underline font-medium hover:text-red-900"
                    >
                      Click to retry
                    </button>
                  </div>
                )}

                <span className="text-[10px] text-slate-400">
                  {new Date(doc.uploadTimestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 text-center">
        <span>Knowledge Isolation Active • Phase 1 Core</span>
      </div>
    </aside>
  );
};
