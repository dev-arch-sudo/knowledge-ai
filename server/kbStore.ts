import fs from 'fs';
import path from 'path';
import {
  KnowledgeBase,
  KnowledgeDocument,
  ChatMessage,
  SpecializedAI,
  KnowledgeVersion,
  EvaluationTestCase,
  EvaluationRun,
} from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'knowledge_bases.json');

function createDefaultSpecializedAI(kbId: string, kbName: string): SpecializedAI {
  return {
    id: 'ai_' + Math.random().toString(36).substring(2, 10),
    kbId,
    name: `${kbName} Specialist`,
    description: `Specialized AI grounded exclusively in the knowledge base "${kbName}".`,
    roleDefinition: `You are an expert domain specialist and advisor for ${kbName}. Provide rigorous, document-grounded answers based exclusively on the provided reference materials.`,
    systemPromptModifier: `Maintain strict accuracy and professional tone. Always prioritize safety standards, technical specifications, and explicit facts from the documents.`,
    responseStyle: 'detailed',
    citationMode: 'standard',
    strictRefusal: true,
    confidenceThreshold: 85,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createDefaultTestCases(kbId: string): EvaluationTestCase[] {
  return [
    {
      id: 'tc_1',
      kbId,
      category: 'grounded',
      question: 'What pressure does the machine operate at under nominal conditions?',
      expectedBehavior: 'Must cite exact grounded operating pressure (50 PSI) from equipment manual.',
      expectedKeywords: ['50 PSI', 'PSI'],
      mustRefuse: false,
    },
    {
      id: 'tc_2',
      kbId,
      category: 'grounded',
      question: 'Who is authorized and responsible for maintaining the system?',
      expectedBehavior: 'Must identify the Facility Chief Engineer and authorized technicians.',
      expectedKeywords: ['Chief Engineer', 'engineer'],
      mustRefuse: false,
    },
    {
      id: 'tc_3',
      kbId,
      category: 'cross-document',
      question: 'According to both the manual and the safety protocols, what checklist steps must be verified before initial startup?',
      expectedBehavior: 'Must synthesize items from both manual and safety documents (e.g. couplings, ventilation, eye protection, electrical grounding).',
      expectedKeywords: ['ventilation', 'couplings', 'inspection', 'safety'],
      mustRefuse: false,
    },
    {
      id: 'tc_4',
      kbId,
      category: 'negative-refusal',
      question: 'What is the current population of Nepal?',
      expectedBehavior: 'Must strictly refuse because general world knowledge is outside the uploaded documents.',
      mustRefuse: true,
    },
    {
      id: 'tc_5',
      kbId,
      category: 'negative-refusal',
      question: 'What was the third-quarter corporate EBITDA for 2024?',
      expectedBehavior: 'Must explicitly state that financial metrics are not present in the uploaded documents.',
      mustRefuse: true,
    },
  ];
}

class KnowledgeBaseStore {
  private kbs: Map<string, KnowledgeBase> = new Map();
  private activeKbId: string = 'kb_default';

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.kbs)) {
          for (const kb of parsed.kbs) {
            // Ensure Phase 2 schema backfill
            this.ensurePhase2Schema(kb);
            this.kbs.set(kb.id, kb);
          }
          if (parsed.activeKbId && this.kbs.has(parsed.activeKbId)) {
            this.activeKbId = parsed.activeKbId;
          }
        }
      }
    } catch (err) {
      console.warn('Could not load persistent KB data, starting fresh:', err);
    }

    if (this.kbs.size === 0) {
      const defaultKbId = 'kb_default';
      const defaultKb: KnowledgeBase = {
        id: defaultKbId,
        name: 'Default Knowledge Base',
        description: 'Core repository for operational specifications, technical manuals, and safety protocols.',
        createdDate: Date.now(),
        updatedAt: Date.now(),
        currentVersion: 'v1.0',
        versions: [
          {
            id: 'ver_' + Math.random().toString(36).substring(2, 8),
            versionNumber: 1,
            versionTag: 'v1.0',
            label: 'Initial Knowledge Base setup',
            timestamp: Date.now(),
            documentCount: 0,
            totalPages: 0,
            documents: [],
            isCurrent: true,
          },
        ],
        documents: [],
        processingStatus: 'empty',
        chatHistory: [],
        specializedAi: createDefaultSpecializedAI(defaultKbId, 'Default Knowledge Base'),
        testCases: createDefaultTestCases(defaultKbId),
        evaluationRuns: [],
      };
      this.kbs.set(defaultKb.id, defaultKb);
      this.activeKbId = defaultKb.id;
      this.saveToDisk();
    }
  }

  private ensurePhase2Schema(kb: any): void {
    if (!kb.specializedAi) {
      kb.specializedAi = createDefaultSpecializedAI(kb.id, kb.name);
    }
    if (!kb.currentVersion) {
      kb.currentVersion = 'v1.0';
    }
    if (!Array.isArray(kb.versions) || kb.versions.length === 0) {
      kb.versions = [
        {
          id: 'ver_' + Math.random().toString(36).substring(2, 8),
          versionNumber: 1,
          versionTag: kb.currentVersion || 'v1.0',
          label: 'Baseline Version',
          timestamp: kb.createdDate || Date.now(),
          documentCount: kb.documents?.length || 0,
          totalPages: (kb.documents || []).reduce((acc: number, d: any) => acc + (d.pageCount || 0), 0),
          documents: kb.documents || [],
          isCurrent: true,
        },
      ];
    }
    if (!Array.isArray(kb.testCases)) {
      kb.testCases = createDefaultTestCases(kb.id);
    }
    if (!Array.isArray(kb.evaluationRuns)) {
      kb.evaluationRuns = [];
    }
    if (!kb.updatedAt) {
      kb.updatedAt = kb.createdDate || Date.now();
    }
    if (!kb.accountId) {
      kb.accountId = 'acc_default';
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        activeKbId: this.activeKbId,
        kbs: Array.from(this.kbs.values()),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save KB store to disk:', err);
    }
  }

  getActiveKB(): KnowledgeBase {
    return this.kbs.get(this.activeKbId) || Array.from(this.kbs.values())[0];
  }

  getKB(id: string): KnowledgeBase | undefined {
    return this.kbs.get(id);
  }

  getKBByAiId(aiId: string): KnowledgeBase | undefined {
    for (const kb of this.kbs.values()) {
      if (kb.specializedAi?.id === aiId) {
        return kb;
      }
    }
    return undefined;
  }

  getSpecializedAIById(aiId: string): { ai: SpecializedAI; kb: KnowledgeBase } | null {
    for (const kb of this.kbs.values()) {
      if (kb.specializedAi?.id === aiId) {
        return { ai: kb.specializedAi, kb };
      }
    }
    return null;
  }

  listKBs(): {
    id: string;
    name: string;
    description?: string;
    documentCount: number;
    currentVersion: string;
    aiName: string;
    createdDate: number;
    updatedAt: number;
    accountId?: string;
  }[] {
    return Array.from(this.kbs.values()).map((kb) => ({
      id: kb.id,
      name: kb.name,
      description: kb.description,
      documentCount: kb.documents.length,
      currentVersion: kb.currentVersion,
      aiName: kb.specializedAi?.name || `${kb.name} Specialist`,
      createdDate: kb.createdDate,
      updatedAt: kb.updatedAt || kb.createdDate,
      accountId: kb.accountId || 'acc_default',
    }));
  }

  createKB(name: string, description?: string, accountId: string = 'acc_default'): KnowledgeBase {
    const id = 'kb_' + Math.random().toString(36).substring(2, 10);
    const cleanName = name.trim() || `Knowledge Base ${this.kbs.size + 1}`;
    const newKb: KnowledgeBase = {
      id,
      accountId,
      name: cleanName,
      description: description?.trim() || `Custom domain knowledge repository for ${cleanName}.`,
      createdDate: Date.now(),
      updatedAt: Date.now(),
      currentVersion: 'v1.0',
      versions: [
        {
          id: 'ver_' + Math.random().toString(36).substring(2, 8),
          versionNumber: 1,
          versionTag: 'v1.0',
          label: 'Initial Knowledge Base snapshot',
          timestamp: Date.now(),
          documentCount: 0,
          totalPages: 0,
          documents: [],
          isCurrent: true,
        },
      ],
      documents: [],
      processingStatus: 'empty',
      chatHistory: [],
      specializedAi: createDefaultSpecializedAI(id, cleanName),
      testCases: createDefaultTestCases(id),
      evaluationRuns: [],
    };

    this.kbs.set(id, newKb);
    this.activeKbId = id;
    this.saveToDisk();
    return newKb;
  }

  updateKB(id: string, updates: { name?: string; description?: string }): KnowledgeBase | null {
    const kb = this.kbs.get(id);
    if (!kb) return null;
    if (updates.name && updates.name.trim()) kb.name = updates.name.trim();
    if (updates.description !== undefined) kb.description = updates.description.trim();
    kb.updatedAt = Date.now();
    this.saveToDisk();
    return kb;
  }

  deleteKB(id: string): boolean {
    if (this.kbs.size <= 1) {
      throw new Error('Cannot delete the last remaining knowledge base.');
    }
    const deleted = this.kbs.delete(id);
    if (deleted) {
      if (this.activeKbId === id) {
        this.activeKbId = Array.from(this.kbs.keys())[0];
      }
      this.saveToDisk();
    }
    return deleted;
  }

  setActiveKB(id: string): boolean {
    if (this.kbs.has(id)) {
      this.activeKbId = id;
      this.saveToDisk();
      return true;
    }
    return false;
  }

  updateSpecializedAI(kbId: string, updates: Partial<SpecializedAI>): SpecializedAI | null {
    const kb = this.kbs.get(kbId);
    if (!kb) return null;

    kb.specializedAi = {
      ...kb.specializedAi,
      ...updates,
      updatedAt: Date.now(),
    };
    kb.updatedAt = Date.now();
    this.saveToDisk();
    return kb.specializedAi;
  }

  createVersion(
    kbId: string,
    label: string,
    customTag?: string,
    makeActive: boolean = false
  ): KnowledgeVersion {
    const kb = this.kbs.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

    const nextNum = (kb.versions?.length || 0) + 1;
    const versionTag = customTag || `v1.${nextNum - 1}`;
    const totalPages = kb.documents.reduce((acc, d) => acc + (d.pageCount || 0), 0);

    if (makeActive) {
      kb.versions.forEach((v) => (v.isCurrent = false));
    }

    const newVersion: KnowledgeVersion = {
      id: 'ver_' + Math.random().toString(36).substring(2, 8),
      versionNumber: nextNum,
      versionTag,
      label: label.trim() || `Version ${versionTag}`,
      timestamp: Date.now(),
      documentCount: kb.documents.length,
      totalPages,
      documents: JSON.parse(JSON.stringify(kb.documents)),
      isCurrent: makeActive,
    };

    if (makeActive) {
      kb.currentVersion = versionTag;
    }

    kb.versions.unshift(newVersion);
    kb.updatedAt = Date.now();
    this.saveToDisk();
    return newVersion;
  }

  createVersionSnapshot(kbId: string, label: string): KnowledgeVersion {
    const kb = this.kbs.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

    const nextNum = (kb.versions?.length || 0) + 1;
    const versionTag = `v${nextNum}.0`;
    const totalPages = kb.documents.reduce((acc, d) => acc + (d.pageCount || 0), 0);

    // Mark previous as not current
    kb.versions.forEach((v) => (v.isCurrent = false));

    const newVersion: KnowledgeVersion = {
      id: 'ver_' + Math.random().toString(36).substring(2, 8),
      versionNumber: nextNum,
      versionTag,
      label: label.trim() || `Snapshot ${versionTag}`,
      timestamp: Date.now(),
      documentCount: kb.documents.length,
      totalPages,
      documents: JSON.parse(JSON.stringify(kb.documents)), // deep clone documents snapshot
      isCurrent: true,
    };

    kb.versions.unshift(newVersion);
    kb.currentVersion = versionTag;
    kb.updatedAt = Date.now();
    this.saveToDisk();
    return newVersion;
  }

  rollbackToVersion(kbId: string, versionId: string): KnowledgeBase {
    const kb = this.kbs.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

    const targetVersion = kb.versions.find((v) => v.id === versionId || v.versionTag === versionId);
    if (!targetVersion) {
      throw new Error(`Target version ${versionId} not found`);
    }

    // Restore documents from snapshot
    kb.documents = JSON.parse(JSON.stringify(targetVersion.documents));
    kb.versions.forEach((v) => (v.isCurrent = v.id === targetVersion.id));
    kb.currentVersion = targetVersion.versionTag;
    kb.updatedAt = Date.now();
    this.updateKBStatus(kb);
    this.saveToDisk();
    return kb;
  }

  addDocument(kbId: string, doc: KnowledgeDocument): void {
    const kb = this.kbs.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);

    // Remove any existing doc with identical filename or id
    kb.documents = kb.documents.filter((d) => d.id !== doc.id && d.filename !== doc.filename);
    kb.documents.push(doc);
    kb.updatedAt = Date.now();
    this.updateKBStatus(kb);
    this.saveToDisk();
  }

  removeDocument(kbId: string, docId: string): boolean {
    const kb = this.kbs.get(kbId);
    if (!kb) return false;

    const initialLen = kb.documents.length;
    kb.documents = kb.documents.filter((d) => d.id !== docId);
    kb.updatedAt = Date.now();
    this.updateKBStatus(kb);
    this.saveToDisk();
    return kb.documents.length < initialLen;
  }

  updateDocumentStatus(
    kbId: string,
    docId: string,
    status: KnowledgeDocument['processingStatus'],
    errorMessage?: string
  ): void {
    const kb = this.kbs.get(kbId);
    if (!kb) return;

    const doc = kb.documents.find((d) => d.id === docId);
    if (doc) {
      doc.processingStatus = status;
      if (errorMessage) doc.errorMessage = errorMessage;
      kb.updatedAt = Date.now();
      this.updateKBStatus(kb);
      this.saveToDisk();
    }
  }

  addChatMessage(kbId: string, message: ChatMessage): void {
    const kb = this.kbs.get(kbId);
    if (!kb) return;
    kb.chatHistory.push(message);
    this.saveToDisk();
  }

  clearChat(kbId: string): void {
    const kb = this.kbs.get(kbId);
    if (!kb) return;
    kb.chatHistory = [];
    this.saveToDisk();
  }

  // Evaluation methods
  addTestCase(kbId: string, testCase: Omit<EvaluationTestCase, 'id' | 'kbId'>): EvaluationTestCase {
    const kb = this.kbs.get(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);
    if (!kb.testCases) kb.testCases = [];

    const newCase: EvaluationTestCase = {
      id: 'tc_' + Math.random().toString(36).substring(2, 10),
      kbId,
      ...testCase,
    };
    kb.testCases.push(newCase);
    kb.updatedAt = Date.now();
    this.saveToDisk();
    return newCase;
  }

  removeTestCase(kbId: string, testCaseId: string): boolean {
    const kb = this.kbs.get(kbId);
    if (!kb || !kb.testCases) return false;
    const initialLen = kb.testCases.length;
    kb.testCases = kb.testCases.filter((tc) => tc.id !== testCaseId);
    kb.updatedAt = Date.now();
    this.saveToDisk();
    return kb.testCases.length < initialLen;
  }

  recordEvaluationRun(kbId: string, run: EvaluationRun): void {
    const kb = this.kbs.get(kbId);
    if (!kb) return;
    if (!kb.evaluationRuns) kb.evaluationRuns = [];
    kb.evaluationRuns.unshift(run);
    // Keep last 25 runs
    if (kb.evaluationRuns.length > 25) {
      kb.evaluationRuns = kb.evaluationRuns.slice(0, 25);
    }
    kb.updatedAt = Date.now();
    this.saveToDisk();
  }

  private updateKBStatus(kb: KnowledgeBase): void {
    if (kb.documents.length === 0) {
      kb.processingStatus = 'empty';
    } else if (
      kb.documents.some((d) => d.processingStatus === 'processing' || d.processingStatus === 'pending')
    ) {
      kb.processingStatus = 'processing';
    } else if (
      kb.documents.some((d) => d.processingStatus === 'failed') &&
      !kb.documents.some((d) => d.processingStatus === 'processed')
    ) {
      kb.processingStatus = 'error';
    } else {
      kb.processingStatus = 'ready';
    }
  }
}

export const kbStore = new KnowledgeBaseStore();

