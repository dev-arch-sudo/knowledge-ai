export interface DocumentPage {
  pageNumber: number;
  text: string;
}

export type DocumentProcessingStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface KnowledgeDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadTimestamp: number;
  processingStatus: DocumentProcessingStatus;
  errorMessage?: string;
  pageCount: number;
  pages?: DocumentPage[];
  geminiFileRef?: string;
  summary?: string;
}

export interface Citation {
  documentId?: string;
  documentName: string;
  pageNumber?: number | string;
  sectionHeading?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  citations?: Citation[];
  isFoundInDocuments?: boolean;
}

export type ResponseStyle = 'concise' | 'detailed' | 'bullet-points' | 'executive-summary';
export type CitationMode = 'standard' | 'strict-snippets' | 'academic';

export interface SpecializedAI {
  id: string;
  kbId: string;
  name: string;
  description: string;
  roleDefinition: string;
  systemPromptModifier?: string;
  responseStyle: ResponseStyle;
  citationMode: CitationMode;
  strictRefusal: boolean;
  confidenceThreshold?: number;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeVersion {
  id: string;
  versionNumber: number;
  versionTag: string;
  label: string;
  timestamp: number;
  documentCount: number;
  totalPages: number;
  documents: KnowledgeDocument[];
  isCurrent: boolean;
}

export type EvaluationCategory = 'grounded' | 'cross-document' | 'negative-refusal' | 'custom';

export interface EvaluationTestCase {
  id: string;
  kbId: string;
  category: EvaluationCategory;
  question: string;
  expectedBehavior: string;
  expectedKeywords?: string[];
  mustRefuse?: boolean;
}

export interface TestCaseResult {
  testCaseId: string;
  question: string;
  category: EvaluationCategory;
  expectedBehavior: string;
  actualAnswer: string;
  citations: Citation[];
  isFoundInDocuments: boolean;
  passed: boolean;
  reason: string;
  latencyMs: number;
}

export interface EvaluationRun {
  id: string;
  kbId: string;
  versionTag: string;
  timestamp: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  accuracyScore: number;
  groundedScore: number;
  crossDocScore: number;
  refusalScore: number;
  results: TestCaseResult[];
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdDate: number;
  updatedAt: number;
  currentVersion: string;
  versions: KnowledgeVersion[];
  documents: KnowledgeDocument[];
  processingStatus: 'empty' | 'processing' | 'ready' | 'error';
  chatHistory: ChatMessage[];
  specializedAi: SpecializedAI;
  testCases?: EvaluationTestCase[];
  evaluationRuns?: EvaluationRun[];
  accountId?: string;
}

export interface TestResultItem {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  details?: string;
  expected?: string;
  actual?: string;
}

export interface ApiKey {
  id: string;
  accountId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  maskedKey: string;
  environment: 'live' | 'test';
  scopes: string[];
  status: 'active' | 'revoked';
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

export interface ApiUsage {
  id: string;
  requestId: string;
  apiKeyId: string;
  accountId: string;
  aiId: string;
  endpoint: string;
  timestamp: number;
  status: number;
  latencyMs: number;
  refused: boolean;
  grounded: boolean;
  errorCode?: string;
}

export interface ApiSource {
  document_id?: string;
  document_name: string;
  page?: number;
  section?: string;
  excerpt?: string;
}

export interface ApiChatRequest {
  ai_id: string;
  message: string;
  conversation_id?: string;
}

export interface ApiChatResponse {
  id: string;
  request_id: string;
  ai_id: string;
  conversation_id?: string;
  answer: string;
  grounded: boolean;
  refused: boolean;
  conflict_detected?: boolean;
  knowledge_version: string;
  sources: ApiSource[];
}

export interface ApiErrorResponse {
  error: {
    code:
      | 'INVALID_REQUEST'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'AI_NOT_FOUND'
      | 'KNOWLEDGE_BASE_NOT_FOUND'
      | 'KNOWLEDGE_NOT_READY'
      | 'RATE_LIMITED'
      | 'PROCESSING_ERROR'
      | 'AI_ERROR'
      | 'INTERNAL_ERROR';
    message: string;
  };
  request_id?: string;
}

export interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  refusedRequests: number;
  errorRequests: number;
  averageLatencyMs: number;
  recentLogs: ApiUsage[];
}

