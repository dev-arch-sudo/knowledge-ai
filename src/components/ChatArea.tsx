import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  FileText,
  Bookmark,
  ArrowRight,
  ShieldCheck,
  Info,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { ChatMessage, Citation, KnowledgeDocument, SpecializedAI } from '../types';

interface ChatAreaProps {
  messages: ChatMessage[];
  documents: KnowledgeDocument[];
  specializedAi?: SpecializedAI;
  versionTag?: string;
  processingStatus: 'empty' | 'processing' | 'ready' | 'error';
  onSendMessage: (question: string) => void;
  onClearChat: () => void;
  onLoadSampleDocs: () => void;
  onViewDocumentPage?: (docName: string, pageNumber: number) => void;
  isSending: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  documents,
  specializedAi,
  versionTag = 'v1.0',
  processingStatus,
  onSendMessage,
  onClearChat,
  onLoadSampleDocs,
  onViewDocumentPage,
  isSending,
}) => {
  const [inputQuestion, setInputQuestion] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isSending || processingStatus !== 'ready') return;
    onSendMessage(inputQuestion.trim());
    setInputQuestion('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePromptSuggestion = (promptText: string) => {
    if (isSending || processingStatus !== 'ready') return;
    onSendMessage(promptText);
  };

  const processedCount = documents.filter((d) => d.processingStatus === 'processed').length;

  return (
    <main id="main-chat-area" className="flex-1 flex flex-col h-full bg-slate-100/50 overflow-hidden">
      {/* Chat Area Header with Specialized AI Persona Details */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-2xs shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {specializedAi?.name || 'Specialized AI Playground'}
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {versionTag}
            </span>
            {specializedAi?.responseStyle && (
              <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 capitalize">
                Style: {specializedAi.responseStyle.replace('-', ' ')}
              </span>
            )}
            {specializedAi?.strictRefusal && (
              <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Strict Refusal Guard Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {specializedAi?.description ||
              'Strict document-grounded assistant. Answers cite source documents and page numbers.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {processingStatus === 'ready' && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {processedCount} Doc{processedCount === 1 ? '' : 's'} Ready
            </span>
          )}
          {messages.length > 0 && (
            <button
              id="btn-clear-conversation"
              onClick={onClearChat}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
              title="Clear current conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {/* Empty State: No Documents */}
        {processingStatus === 'empty' && (
          <div
            id="empty-state-no-documents"
            className="max-w-xl mx-auto my-12 p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Upload your first document
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              Add one or more PDFs to create your knowledge base. The AI will strictly ground every
              answer in your uploaded files without hallucinating.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onLoadSampleDocs}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Sample Documents (Instant Test)</span>
              </button>
            </div>
          </div>
        )}

        {/* Empty State: Processing Documents */}
        {processingStatus === 'processing' && (
          <div
            id="empty-state-processing"
            className="max-w-md mx-auto my-12 p-8 text-center bg-white border border-amber-200 rounded-2xl shadow-xs"
          >
            <Loader2 className="w-10 h-10 text-amber-600 animate-spin mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">
              Your knowledge base is being prepared.
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Extracting document pages and text structures. When processing is complete, you can
              start asking questions.
            </p>
          </div>
        )}

        {/* Empty State: Documents Ready but No Messages */}
        {processingStatus === 'ready' && messages.length === 0 && (
          <div
            id="empty-state-ready-prompts"
            className="max-w-2xl mx-auto my-8 p-6 bg-white border border-slate-200 rounded-2xl shadow-xs"
          >
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Knowledge Base Ready • 0 Hallucinations Enforced</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Ask questions grounded in your documents
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Try these sample questions to test document-grounding, exact multi-page citations,
              multi-document synthesis, and negative rejection:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => handlePromptSuggestion('What pressure does the machine operate at?')}
                className="text-left p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50 transition-all text-xs text-slate-800 group"
              >
                <span className="font-semibold text-slate-900 block mb-1">
                  1. Operating Pressure Test
                </span>
                <span className="text-slate-500 group-hover:text-slate-700 flex items-center justify-between">
                  &ldquo;What pressure does the machine operate at?&rdquo;
                  <ArrowRight className="w-3 h-3 shrink-0 ml-1 text-slate-400 group-hover:text-slate-800" />
                </span>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion('Who is responsible for maintaining the system?')
                }
                className="text-left p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50 transition-all text-xs text-slate-800 group"
              >
                <span className="font-semibold text-slate-900 block mb-1">
                  2. Maintenance Responsibility
                </span>
                <span className="text-slate-500 group-hover:text-slate-700 flex items-center justify-between">
                  &ldquo;Who is responsible for maintaining the system?&rdquo;
                  <ArrowRight className="w-3 h-3 shrink-0 ml-1 text-slate-400 group-hover:text-slate-800" />
                </span>
              </button>

              <button
                onClick={() =>
                  handlePromptSuggestion(
                    'According to the company manual and safety guide, what must be checked before installation?'
                  )
                }
                className="text-left p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50 transition-all text-xs text-slate-800 group"
              >
                <span className="font-semibold text-slate-900 block mb-1">
                  3. Multi-Document Synthesis
                </span>
                <span className="text-slate-500 group-hover:text-slate-700 flex items-center justify-between">
                  &ldquo;What must be checked before installation?&rdquo;
                  <ArrowRight className="w-3 h-3 shrink-0 ml-1 text-slate-400 group-hover:text-slate-800" />
                </span>
              </button>

              <button
                onClick={() => handlePromptSuggestion('What is the population of Nepal?')}
                className="text-left p-3 rounded-xl border border-red-200 hover:border-red-400 bg-red-50/30 hover:bg-red-50/60 transition-all text-xs text-slate-800 group"
              >
                <span className="font-semibold text-red-900 block mb-1">
                  4. Negative Hallucination Test
                </span>
                <span className="text-red-700 flex items-center justify-between">
                  &ldquo;What is the population of Nepal?&rdquo;
                  <ArrowRight className="w-3 h-3 shrink-0 ml-1 text-red-400 group-hover:text-red-700" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Message List */}
        {messages.map((message) => (
          <div
            key={message.id}
            id={`chat-message-${message.id}`}
            className={`flex flex-col ${
              message.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Sender Label & Timestamp */}
            <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">
                {message.role === 'user' ? 'You' : 'Knowledge AI'}
              </span>
              <span>•</span>
              <span>
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {message.role === 'assistant' && message.isFoundInDocuments === false && (
                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-medium text-[10px]">
                  Ungrounded Refusal
                </span>
              )}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-2xl rounded-2xl p-4 shadow-2xs ${
                message.role === 'user'
                  ? 'bg-slate-900 text-white rounded-br-xs'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
              }`}
            >
              <div className="markdown-body text-xs md:text-sm leading-relaxed">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>

              {/* Citations & Sources Block */}
              {message.role === 'assistant' &&
                message.citations &&
                message.citations.length > 0 && (
                  <div
                    id={`citations-container-${message.id}`}
                    className="mt-4 pt-3 border-t border-slate-100"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2.5">
                      <Bookmark className="w-3.5 h-3.5 text-slate-500" />
                      <span>Document Sources ({message.citations.length})</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {message.citations.map((citation, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between font-medium text-slate-900">
                            <span className="truncate" title={citation.documentName}>
                              [{citation.documentName}]
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[11px] text-slate-600 font-mono">
                                Page {citation.pageNumber || 'N/A'}
                              </span>
                              {onViewDocumentPage && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onViewDocumentPage(
                                      citation.documentName,
                                      Number(citation.pageNumber) || 1
                                    )
                                  }
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 hover:underline cursor-pointer"
                                  title="View page excerpt in document"
                                >
                                  <span>View Page</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {citation.sectionHeading && (
                            <p className="text-[11px] text-slate-600 font-medium">
                              {citation.sectionHeading}
                            </p>
                          )}

                          {citation.snippet && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5 border-l-2 border-slate-300 pl-2 line-clamp-2">
                              &ldquo;{citation.snippet}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        ))}

        {/* Streaming/Generating state */}
        {isSending && (
          <div id="chat-generating-indicator" className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-900 text-white">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs p-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-800" />
                <span>Searching documents & generating grounded response...</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Verifying citations against uploaded PDF pages
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-xs">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end gap-2.5">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              id="chat-input-textarea"
              rows={2}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || processingStatus !== 'ready'}
              placeholder={
                processingStatus === 'ready'
                  ? 'Ask anything about your documents... (Press Enter to send, Shift+Enter for new line)'
                  : processingStatus === 'processing'
                  ? 'Please wait until your documents finish processing...'
                  : 'Add one or more PDFs before asking questions...'
              }
              className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 focus:ring-1 focus:ring-slate-800 disabled:bg-slate-50 disabled:cursor-not-allowed transition-all"
            />
          </div>

          <button
            type="submit"
            id="btn-send-message"
            disabled={!inputQuestion.trim() || isSending || processingStatus !== 'ready'}
            className="h-10 px-4 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs shrink-0"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        </form>

        <div className="max-w-4xl mx-auto flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
          <span>Grounding Engine Active • Model: Gemini 3.8 Flash</span>
          <span>Zero-Hallucination Policy Enforced</span>
        </div>
      </div>
    </main>
  );
};
