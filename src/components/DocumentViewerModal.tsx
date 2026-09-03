import React, { useState } from 'react';
import { X, FileText, ChevronRight, Layers, FileCheck } from 'lucide-react';
import { KnowledgeDocument } from '../types';

interface DocumentViewerModalProps {
  document: KnowledgeDocument | null;
  initialPageNumber?: number;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  initialPageNumber = 1,
  onClose,
}) => {
  const [selectedPage, setSelectedPage] = useState<number>(initialPageNumber);

  React.useEffect(() => {
    if (initialPageNumber) {
      setSelectedPage(initialPageNumber);
    }
  }, [initialPageNumber, document]);

  if (!document) return null;

  const pages = document.pages || [];
  const currentPageData = pages.find((p) => p.pageNumber === selectedPage) || pages[0];

  return (
    <div
      id="document-viewer-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="document-viewer-modal"
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-slate-900 text-white shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {document.filename}
              </h3>
              <p className="text-xs text-slate-500">
                {document.pageCount} page{document.pageCount === 1 ? '' : 's'} •{' '}
                {(document.fileSize / 1024).toFixed(1)} KB • Uploaded{' '}
                {new Date(document.uploadTimestamp).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            id="btn-close-doc-viewer"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Page Selector Sidebar */}
          <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 p-3 overflow-y-auto space-y-1.5 shrink-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Pages</span>
            </div>
            {pages.map((p) => (
              <button
                key={p.pageNumber}
                onClick={() => setSelectedPage(p.pageNumber)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                  selectedPage === p.pageNumber
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <span>Page {p.pageNumber}</span>
                <ChevronRight
                  className={`w-3.5 h-3.5 ${
                    selectedPage === p.pageNumber ? 'text-white' : 'text-slate-400'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Extracted Page Text Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 text-xs text-slate-500 font-medium">
              <span>Extracted Text Representation</span>
              <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                Page {selectedPage} of {document.pageCount}
              </span>
            </div>

            {currentPageData ? (
              <div className="prose prose-slate max-w-none text-xs md:text-sm whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-800 leading-relaxed overflow-x-auto">
                {currentPageData.text || 'No text extracted from this page.'}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Page text not found.</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>Fully indexed for grounded search & verification</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
