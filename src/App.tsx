/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DocumentSidebar } from './components/DocumentSidebar';
import { ChatArea } from './components/ChatArea';
import { SpecializedAIConfig } from './components/SpecializedAIConfig';
import { KnowledgeVersioningView } from './components/KnowledgeVersioningView';
import { EvaluationCenter } from './components/EvaluationCenter';
import { DeveloperPlatform } from './components/DeveloperPlatform';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { TestSuiteModal } from './components/TestSuiteModal';
import { NewKnowledgeBaseModal } from './components/NewKnowledgeBaseModal';
import {
  KnowledgeBase,
  KnowledgeDocument,
  SpecializedAI,
  EvaluationTestCase,
  TestResultItem,
} from './types';
import { AlertCircle, X } from 'lucide-react';

export default function App() {
  const [activeKb, setActiveKb] = useState<KnowledgeBase | null>(null);
  const [allKbs, setAllKbs] = useState<{ id: string; name: string; documentCount: number }[]>([]);
  const [currentTab, setCurrentTab] = useState<ActiveTab>('playground');

  // Loading states
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);
  const [isRunningEvaluation, setIsRunningEvaluation] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Modals state
  const [viewingDocument, setViewingDocument] = useState<KnowledgeDocument | null>(null);
  const [viewingInitialPage, setViewingInitialPage] = useState<number>(1);
  const [isNewKbModalOpen, setIsNewKbModalOpen] = useState(false);
  const [isTestSuiteModalOpen, setIsTestSuiteModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<TestResultItem[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Fetch active knowledge base on mount
  const fetchActiveKb = useCallback(async () => {
    try {
      const res = await fetch('/api/kb');
      if (!res.ok) throw new Error('Failed to load active knowledge base');
      const data = await res.json();
      setActiveKb(data.kb);
      setAllKbs(data.allKbs || []);
    } catch (err: any) {
      console.error('Fetch KB error:', err);
      setGlobalError(err.message || 'Failed to connect to Knowledge AI server.');
    }
  }, []);

  useEffect(() => {
    fetchActiveKb();
  }, [fetchActiveKb]);

  // Upload PDF files
  const handleUploadFiles = async (files: FileList | File[]) => {
    setIsUploading(true);
    setGlobalError(null);

    const formData = new FormData();
    const fileArray = Array.from(files);
    fileArray.forEach((f) => {
      formData.append('files', f);
    });

    try {
      const res = await fetch('/api/kb/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload and process PDF documents');
      }

      if (data.kb) {
        setActiveKb(data.kb);
      }
      fetchActiveKb();
    } catch (err: any) {
      console.error('Upload error:', err);
      setGlobalError(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Load sample documents
  const handleLoadSampleDocs = async () => {
    setIsLoadingSamples(true);
    setGlobalError(null);
    try {
      const res = await fetch('/api/kb/documents/sample', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load sample documents');
      }
      if (data.kb) {
        setActiveKb(data.kb);
      }
      fetchActiveKb();
    } catch (err: any) {
      console.error('Load samples error:', err);
      setGlobalError(err.message || 'Failed to load sample documents');
    } finally {
      setIsLoadingSamples(false);
    }
  };

  // Remove document
  const handleRemoveDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/kb/documents/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove document');
      if (data.kb) {
        setActiveKb(data.kb);
      }
      fetchActiveKb();
    } catch (err: any) {
      console.error('Remove document error:', err);
      setGlobalError(err.message || 'Failed to remove document');
    }
  };

  // Retry failed document
  const handleRetryDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/kb/documents/${id}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retry document');
      if (data.kb) {
        setActiveKb(data.kb);
      }
      fetchActiveKb();
    } catch (err: any) {
      console.error('Retry document error:', err);
      setGlobalError(err.message || 'Failed to retry document');
    }
  };

  // Send Chat message
  const handleSendMessage = async (question: string) => {
    if (!question.trim() || isSending) return;
    setIsSending(true);
    setGlobalError(null);

    // Optimistically show user message
    const tempUserMsg = {
      id: 'temp_user_' + Date.now(),
      role: 'user' as const,
      content: question,
      timestamp: Date.now(),
    };

    if (activeKb) {
      setActiveKb({
        ...activeKb,
        chatHistory: [...activeKb.chatHistory, tempUserMsg],
      });
    }

    try {
      const res = await fetch('/api/kb/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get answer from documents');
      }

      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setGlobalError(err.message || 'Error querying documents');
      fetchActiveKb();
    } finally {
      setIsSending(false);
    }
  };

  // Clear Chat history
  const handleClearChat = async () => {
    try {
      const res = await fetch('/api/kb/chat', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear chat');
      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Clear chat error:', err);
      setGlobalError(err.message || 'Failed to clear chat');
    }
  };

  // Switch active Knowledge Base
  const handleSwitchKb = async (id: string) => {
    try {
      const res = await fetch('/api/kb/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to switch knowledge base');
      setActiveKb(data.kb);
      setAllKbs(data.allKbs || []);
    } catch (err: any) {
      console.error('Switch KB error:', err);
      setGlobalError(err.message || 'Failed to switch knowledge base');
    }
  };

  // Create new Knowledge Base
  const handleCreateKb = async (name: string, description?: string) => {
    try {
      const res = await fetch('/api/kb/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create knowledge base');
      setActiveKb(data.kb);
      setAllKbs(data.allKbs || []);
    } catch (err: any) {
      console.error('Create KB error:', err);
      setGlobalError(err.message || 'Failed to create knowledge base');
    }
  };

  // Update Knowledge Base details
  const handleUpdateKbDetails = async (name: string, description: string) => {
    if (!activeKb) return;
    try {
      const res = await fetch(`/api/kb/${activeKb.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update knowledge base');
      setActiveKb(data.kb);
      setAllKbs(data.allKbs || []);
    } catch (err: any) {
      console.error('Update KB error:', err);
      setGlobalError(err.message || 'Failed to update knowledge base');
    }
  };

  // Save Specialized AI Configuration
  const handleSaveAiConfig = async (updated: Partial<SpecializedAI>) => {
    if (!activeKb) return;
    setIsSavingAiConfig(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/kb/${activeKb.id}/ai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update Specialized AI configuration');
      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Save AI config error:', err);
      setGlobalError(err.message || 'Failed to update Specialized AI');
    } finally {
      setIsSavingAiConfig(false);
    }
  };

  // Create Knowledge Version Snapshot
  const handleCreateVersion = async (label: string) => {
    if (!activeKb) return;
    try {
      const res = await fetch(`/api/kb/${activeKb.id}/versions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create snapshot');
      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Create version error:', err);
      setGlobalError(err.message || 'Failed to create version snapshot');
    }
  };

  // Rollback to a specific Version Snapshot
  const handleRollbackVersion = async (versionId: string) => {
    if (!activeKb) return;
    try {
      const res = await fetch(`/api/kb/${activeKb.id}/versions/${versionId}/rollback`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rollback version');
      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Rollback error:', err);
      setGlobalError(err.message || 'Failed to rollback version');
    }
  };

  // Run AI Evaluation Benchmark Suite
  const handleRunEvaluation = async () => {
    if (!activeKb) return;
    setIsRunningEvaluation(true);
    setGlobalError(null);
    try {
      const res = await fetch(`/api/kb/${activeKb.id}/evaluations/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute evaluation suite');
      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Evaluation run error:', err);
      setGlobalError(err.message || 'Failed to run evaluation benchmark');
    } finally {
      setIsRunningEvaluation(false);
    }
  };

  // Add custom evaluation test case
  const handleAddTestCase = async (tc: Omit<EvaluationTestCase, 'id'>) => {
    if (!activeKb) return;
    try {
      const res = await fetch(`/api/kb/${activeKb.id}/evaluations/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tc),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add test case');
      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Add test case error:', err);
      setGlobalError(err.message || 'Failed to add test case');
    }
  };

  // Delete custom evaluation test case
  const handleDeleteTestCase = async (id: string) => {
    if (!activeKb) return;
    try {
      const res = await fetch(`/api/kb/${activeKb.id}/evaluations/test-cases/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete test case');
      if (data.kb) {
        setActiveKb(data.kb);
      }
    } catch (err: any) {
      console.error('Delete test case error:', err);
      setGlobalError(err.message || 'Failed to delete test case');
    }
  };

  // Run Acceptance Test Suite (10-pts)
  const handleRunTestSuite = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/kb/run-tests', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test suite failed');
      setTestResults(data.results || []);
    } catch (err: any) {
      console.error('Test runner error:', err);
      setGlobalError(err.message || 'Failed to execute test suite');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleOpenTestSuiteModal = () => {
    setIsTestSuiteModalOpen(true);
    if (testResults.length === 0) {
      handleRunTestSuite();
    }
  };

  // Jump directly to citation page inside DocumentViewerModal
  const handleViewDocumentPage = (docName: string, pageNumber: number) => {
    if (!activeKb) return;
    const doc = activeKb.documents.find((d) => d.filename === docName);
    if (doc) {
      setViewingInitialPage(pageNumber);
      setViewingDocument(doc);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans antialiased">
      {/* Top Header with Navigation Tabs */}
      <Header
        activeKb={activeKb}
        allKbs={allKbs}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onNewKb={() => setIsNewKbModalOpen(true)}
        onSwitchKb={handleSwitchKb}
        onOpenTestSuite={handleOpenTestSuiteModal}
        isTesting={isRunningTests}
      />

      {/* Global Error Banner */}
      {globalError && (
        <div
          id="global-error-banner"
          className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-xs text-red-700 animate-in fade-in shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{globalError}</span>
          </div>
          <button
            onClick={() => setGlobalError(null)}
            className="text-red-500 hover:text-red-800 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Tab Workspaces */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tab 1: Grounded Playground (Chat + Document Quickbar) */}
        {currentTab === 'playground' && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full">
            <DocumentSidebar
              documents={activeKb?.documents || []}
              onUploadFiles={handleUploadFiles}
              onRemoveDocument={handleRemoveDocument}
              onRetryDocument={handleRetryDocument}
              onLoadSampleDocs={handleLoadSampleDocs}
              onViewDocument={(doc) => {
                setViewingInitialPage(1);
                setViewingDocument(doc);
              }}
              isUploading={isUploading}
              isLoadingSamples={isLoadingSamples}
            />

            <ChatArea
              messages={activeKb?.chatHistory || []}
              documents={activeKb?.documents || []}
              specializedAi={activeKb?.specializedAi}
              versionTag={activeKb?.currentVersion || 'v1.0'}
              processingStatus={activeKb?.processingStatus || 'empty'}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              onLoadSampleDocs={handleLoadSampleDocs}
              onViewDocumentPage={handleViewDocumentPage}
              isSending={isSending}
            />
          </div>
        )}

        {/* Tab 2: Knowledge Base & Versions */}
        {currentTab === 'knowledge' && activeKb && (
          <KnowledgeVersioningView
            activeKb={activeKb}
            onUploadFiles={handleUploadFiles}
            onRemoveDocument={handleRemoveDocument}
            onRetryDocument={handleRetryDocument}
            onLoadSampleDocs={handleLoadSampleDocs}
            onViewDocument={(doc) => {
              setViewingInitialPage(1);
              setViewingDocument(doc);
            }}
            onCreateVersion={handleCreateVersion}
            onRollbackVersion={handleRollbackVersion}
            onUpdateKbDetails={handleUpdateKbDetails}
            isUploading={isUploading}
            isLoadingSamples={isLoadingSamples}
          />
        )}

        {/* Tab 3: Specialized AI Configuration */}
        {currentTab === 'config' && activeKb && (
          <SpecializedAIConfig
            specializedAi={
              activeKb.specializedAi || {
                id: `ai_${activeKb.id}`,
                kbId: activeKb.id,
                name: 'Specialized AI',
                description: '',
                roleDefinition: '',
                responseStyle: 'detailed',
                citationMode: 'standard',
                strictRefusal: true,
                confidenceThreshold: 85,
                createdAt: activeKb.createdDate,
                updatedAt: activeKb.updatedAt,
              }
            }
            kbName={activeKb.name}
            currentVersion={activeKb.currentVersion || 'v1.0'}
            onSaveAiConfig={handleSaveAiConfig}
            isSaving={isSavingAiConfig}
          />
        )}

        {/* Tab 4: Evaluation Benchmark Center */}
        {currentTab === 'evaluations' && activeKb && (
          <EvaluationCenter
            activeKb={activeKb}
            onRunEvaluation={handleRunEvaluation}
            onAddTestCase={handleAddTestCase}
            onDeleteTestCase={handleDeleteTestCase}
            isRunningEvaluation={isRunningEvaluation}
          />
        )}

        {/* Tab 5: Developer Platform & REST API */}
        {currentTab === 'developer' && (
          <DeveloperPlatform activeKb={activeKb} />
        )}
      </div>

      {/* Document Content / Pages Inspector Modal */}
      <DocumentViewerModal
        document={viewingDocument}
        initialPageNumber={viewingInitialPage}
        onClose={() => setViewingDocument(null)}
      />

      {/* Acceptance Test Suite Modal */}
      <TestSuiteModal
        isOpen={isTestSuiteModalOpen}
        onClose={() => setIsTestSuiteModalOpen(false)}
        results={testResults}
        onRunTests={handleRunTestSuite}
        isRunning={isRunningTests}
      />

      {/* New Knowledge Base Modal */}
      <NewKnowledgeBaseModal
        isOpen={isNewKbModalOpen}
        onClose={() => setIsNewKbModalOpen(false)}
        onCreate={handleCreateKb}
      />
    </div>
  );
}
