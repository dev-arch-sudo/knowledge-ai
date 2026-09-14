import { KnowledgeDocument } from '../../src/types.js';

export interface RetrievalEvidenceTarget {
  documentName: string;
  pageNumber: number;
  contains: string[];
}

export interface RetrievalBenchmarkCase {
  id: string;
  category:
    | 'DIRECT'
    | 'PARAPHRASE'
    | 'EXACT_TERM'
    | 'NUMBER'
    | 'TABLE'
    | 'MULTI_SOURCE'
    | 'NO_EVIDENCE';
  question: string;
  expectedSources: RetrievalEvidenceTarget[];
  shouldHaveEvidence: boolean;
  notes: string;
}

/**
 * Stable unseen retrieval corpus used to compare retrieval implementations.
 *
 * This corpus intentionally lives outside production code. The questions and
 * evidence targets are manually verified here so retrieval models can be
 * compared without changing the expected answers to suit a model.
 */
export const retrievalBenchmarkDocuments: KnowledgeDocument[] = [
  {
    id: 'retrieval_people_handbook',
    filename: 'people-handbook.pdf',
    fileType: 'application/pdf',
    fileSize: 12000,
    uploadTimestamp: 1,
    processingStatus: 'processed',
    pageCount: 2,
    summary: 'Lattice Harbor employee leave, remote-work, and expense-approval policies.',
    pages: [
      {
        pageNumber: 1,
        text: `# PEOPLE & LEAVE POLICY

Annual Leave: Full-time employees receive 24 paid annual-leave days per calendar year after completing a 90-day probation period.
Carry-over: Employees may carry over at most 5 unused annual-leave days, and carried days must be used by March 31 of the following year.
Sick Leave: Full-time employees receive 10 paid sick-leave days each calendar year.

# REMOTE WORK POLICY

Eligible employees may work remotely up to 3 days per week. Tuesday is the company-wide collaboration day and is normally worked from an office unless an exception is approved by a department head.
`,
      },
      {
        pageNumber: 2,
        text: `# EXPENSE APPROVAL POLICY

Expenses below $250 require approval from the employee's direct manager.
Expenses from $250 through $2,000 require approval from the department head.
Expenses above $2,000 require approval from the Finance Director.
Receipts are required for any reimbursable expense above $25.
`,
      },
    ],
  },
  {
    id: 'retrieval_support_guide',
    filename: 'support-guide.pdf',
    fileType: 'application/pdf',
    fileSize: 14000,
    uploadTimestamp: 2,
    processingStatus: 'processed',
    pageCount: 2,
    summary: 'Lattice Harbor customer support tiers, escalation, and retention rules.',
    pages: [
      {
        pageNumber: 1,
        text: `# CUSTOMER SUPPORT TIERS

Service Tier Matrix
| Tier | Initial Response Minutes | Availability | Included Projects |
| --- | --- | --- | --- |
| Standard | 480 | Business hours | 2 |
| Priority | 120 | 06:00-22:00 UTC | 6 |
| Critical | 30 | 24/7 | 15 |

Critical-tier incidents that remain unresolved for 90 minutes are escalated to the Incident Commander.
`,
      },
      {
        pageNumber: 2,
        text: `# DATA & CASE RETENTION

Support case transcripts are retained for 45 days after a case is closed.
Diagnostic attachments are retained for 14 days after case closure.
Customers may request earlier deletion when contractual and legal requirements permit it.
`,
      },
    ],
  },
  {
    id: 'retrieval_office_guide',
    filename: 'office-guide.pdf',
    fileType: 'application/pdf',
    fileSize: 15000,
    uploadTimestamp: 3,
    processingStatus: 'processed',
    pageCount: 2,
    summary: 'Lattice Harbor office locations, staffing, opening dates, and regional data rules.',
    pages: [
      {
        pageNumber: 1,
        text: `# OFFICE DIRECTORY

Office Staffing Table
| Office | Country | Employees | Opened |
| --- | --- | --- | --- |
| Harbor Point | Portugal | 84 | 2024-02-12 |
| Summit House | Canada | 61 | 2023-09-18 |
| Meridian Works | Japan | 43 | 2025-05-06 |
`,
      },
      {
        pageNumber: 2,
        text: `# REGIONAL DATA POLICY

European Union customer data is processed only in the Frankfurt region.
Japanese customer support recordings are stored in the Tokyo region.
Canadian customer billing records are stored in the Montreal region.
`,
      },
    ],
  },
  {
    id: 'retrieval_security_handbook',
    filename: 'security-handbook.pdf',
    fileType: 'application/pdf',
    fileSize: 13000,
    uploadTimestamp: 4,
    processingStatus: 'processed',
    pageCount: 2,
    summary: 'Lattice Harbor identity, device, incident, and encryption controls.',
    pages: [
      {
        pageNumber: 1,
        text: `# IDENTITY & DEVICE SECURITY

Multi-factor authentication is mandatory for all workforce accounts.
Hardware security keys are required for administrators and production engineers.
Company laptops automatically lock after 10 minutes of inactivity.
Lost or stolen devices must be reported to the Security Operations team within 30 minutes of discovery.
`,
      },
      {
        pageNumber: 2,
        text: `# DATA PROTECTION & INCIDENTS

Customer exports must be encrypted with AES-256 before being stored outside managed application databases.
Production secrets are rotated every 90 days.
A confirmed severity-one security incident must be reported to the Chief Security Officer immediately and the incident bridge must be opened within 15 minutes.
`,
      },
    ],
  },
];

const target = (documentName: string, pageNumber: number, ...contains: string[]): RetrievalEvidenceTarget => ({
  documentName,
  pageNumber,
  contains,
});

export const retrievalBenchmarkCases: RetrievalBenchmarkCase[] = [
  {
    id: 'direct-leave-allowance', category: 'DIRECT',
    question: 'How many paid annual-leave days do full-time employees receive?',
    expectedSources: [target('people-handbook.pdf', 1, '24 paid annual-leave days')], shouldHaveEvidence: true,
    notes: 'Direct factual lookup.',
  },
  {
    id: 'paraphrase-vacation', category: 'PARAPHRASE',
    question: 'What yearly paid vacation allowance is provided to permanent staff?',
    expectedSources: [target('people-handbook.pdf', 1, '24 paid annual-leave days')], shouldHaveEvidence: true,
    notes: 'Low lexical overlap: vacation/permanent staff vs annual leave/full-time employees.',
  },
  {
    id: 'direct-carry-over', category: 'DIRECT',
    question: 'What is the maximum annual leave carry-over?',
    expectedSources: [target('people-handbook.pdf', 1, 'carry over at most 5')], shouldHaveEvidence: true,
    notes: 'Direct policy limit.',
  },
  {
    id: 'number-carry-deadline', category: 'NUMBER',
    question: 'By what date must carried leave be used?',
    expectedSources: [target('people-handbook.pdf', 1, 'March 31')], shouldHaveEvidence: true,
    notes: 'Date retrieval.',
  },
  {
    id: 'direct-sick-leave', category: 'DIRECT',
    question: 'How many paid sick-leave days are provided each year?',
    expectedSources: [target('people-handbook.pdf', 1, '10 paid sick-leave days')], shouldHaveEvidence: true,
    notes: 'Direct factual lookup.',
  },
  {
    id: 'paraphrase-work-from-home', category: 'PARAPHRASE',
    question: 'How often can an eligible employee work from home during a normal week?',
    expectedSources: [target('people-handbook.pdf', 1, 'remotely up to 3 days per week')], shouldHaveEvidence: true,
    notes: 'Terminology mismatch: work from home vs remotely.',
  },
  {
    id: 'exact-collaboration-day', category: 'EXACT_TERM',
    question: 'Which day is the company-wide collaboration day?',
    expectedSources: [target('people-handbook.pdf', 1, 'Tuesday is the company-wide collaboration day')], shouldHaveEvidence: true,
    notes: 'Exact phrase retrieval.',
  },
  {
    id: 'number-expense-direct-manager', category: 'NUMBER',
    question: 'Who approves an expense below $250?',
    expectedSources: [target('people-handbook.pdf', 2, 'below $250', 'direct manager')], shouldHaveEvidence: true,
    notes: 'Exact threshold + role.',
  },
  {
    id: 'number-expense-finance-director', category: 'NUMBER',
    question: 'Who approves expenses above $2,000?',
    expectedSources: [target('people-handbook.pdf', 2, 'above $2,000', 'Finance Director')], shouldHaveEvidence: true,
    notes: 'Exact number/entity retrieval.',
  },
  {
    id: 'direct-receipt-threshold', category: 'DIRECT',
    question: 'When is a receipt required for reimbursement?',
    expectedSources: [target('people-handbook.pdf', 2, 'above $25')], shouldHaveEvidence: true,
    notes: 'Policy threshold.',
  },
  {
    id: 'table-critical-response', category: 'TABLE',
    question: 'What is the initial response time for Critical support?',
    expectedSources: [target('support-guide.pdf', 1, 'Critical', '30')], shouldHaveEvidence: true,
    notes: 'Table row lookup.',
  },
  {
    id: 'paraphrase-highest-urgency-response', category: 'PARAPHRASE',
    question: 'How quickly should the highest-urgency support request be acknowledged?',
    expectedSources: [target('support-guide.pdf', 1, 'Critical', '30')], shouldHaveEvidence: true,
    notes: 'Semantic paraphrase intended to expose lexical-retrieval weakness.',
  },
  {
    id: 'table-priority-availability', category: 'TABLE',
    question: 'During which UTC hours is Priority support available?',
    expectedSources: [target('support-guide.pdf', 1, 'Priority', '06:00-22:00 UTC')], shouldHaveEvidence: true,
    notes: 'Table cell lookup with exact tier name.',
  },
  {
    id: 'direct-escalation-owner', category: 'DIRECT',
    question: 'Who receives an unresolved Critical incident after 90 minutes?',
    expectedSources: [target('support-guide.pdf', 1, '90 minutes', 'Incident Commander')], shouldHaveEvidence: true,
    notes: 'Relationship in prose near a table.',
  },
  {
    id: 'direct-transcript-retention', category: 'DIRECT',
    question: 'How long are support case transcripts retained after closure?',
    expectedSources: [target('support-guide.pdf', 2, '45 days')], shouldHaveEvidence: true,
    notes: 'Retention duration.',
  },
  {
    id: 'paraphrase-diagnostics-retention', category: 'PARAPHRASE',
    question: 'For how long do we keep troubleshooting files attached to a closed case?',
    expectedSources: [target('support-guide.pdf', 2, 'Diagnostic attachments', '14 days')], shouldHaveEvidence: true,
    notes: 'Terminology mismatch: troubleshooting files vs diagnostic attachments.',
  },
  {
    id: 'table-meridian-country', category: 'TABLE',
    question: 'Which country is Meridian Works in?',
    expectedSources: [target('office-guide.pdf', 1, 'Meridian Works', 'Japan')], shouldHaveEvidence: true,
    notes: 'Named row + attribute.',
  },
  {
    id: 'table-summit-employees', category: 'TABLE',
    question: 'How many employees work at Summit House?',
    expectedSources: [target('office-guide.pdf', 1, 'Summit House', '61')], shouldHaveEvidence: true,
    notes: 'Named row + numeric attribute.',
  },
  {
    id: 'number-harbor-opened', category: 'NUMBER',
    question: 'When did Harbor Point open?',
    expectedSources: [target('office-guide.pdf', 1, 'Harbor Point', '2024-02-12')], shouldHaveEvidence: true,
    notes: 'Date in table.',
  },
  {
    id: 'paraphrase-eu-processing', category: 'PARAPHRASE',
    question: 'Where are records for EU customers handled?',
    expectedSources: [target('office-guide.pdf', 2, 'European Union customer data', 'Frankfurt')], shouldHaveEvidence: true,
    notes: 'EU/records/handled vs European Union/customer data/processed.',
  },
  {
    id: 'direct-japan-recordings', category: 'DIRECT',
    question: 'Where are Japanese customer support recordings stored?',
    expectedSources: [target('office-guide.pdf', 2, 'Japanese customer support recordings', 'Tokyo')], shouldHaveEvidence: true,
    notes: 'Direct regional data lookup.',
  },
  {
    id: 'paraphrase-canada-billing', category: 'PARAPHRASE',
    question: 'Which region holds invoicing information for Canadian customers?',
    expectedSources: [target('office-guide.pdf', 2, 'Canadian customer billing records', 'Montreal')], shouldHaveEvidence: true,
    notes: 'Invoicing information vs billing records.',
  },
  {
    id: 'direct-mfa', category: 'DIRECT',
    question: 'Is multi-factor authentication required for workforce accounts?',
    expectedSources: [target('security-handbook.pdf', 1, 'Multi-factor authentication is mandatory')], shouldHaveEvidence: true,
    notes: 'Direct security-control lookup.',
  },
  {
    id: 'paraphrase-admin-authenticator', category: 'PARAPHRASE',
    question: 'What physical authenticator must privileged engineering staff use?',
    expectedSources: [target('security-handbook.pdf', 1, 'Hardware security keys', 'production engineers')], shouldHaveEvidence: true,
    notes: 'Physical authenticator / privileged engineering staff paraphrase.',
  },
  {
    id: 'number-device-lock', category: 'NUMBER',
    question: 'After how much inactivity does a company laptop lock itself?',
    expectedSources: [target('security-handbook.pdf', 1, '10 minutes of inactivity')], shouldHaveEvidence: true,
    notes: 'Timeout duration.',
  },
  {
    id: 'paraphrase-lost-device-report', category: 'PARAPHRASE',
    question: 'How soon must Security be told about a missing company computer?',
    expectedSources: [target('security-handbook.pdf', 1, 'Lost or stolen devices', 'within 30 minutes')], shouldHaveEvidence: true,
    notes: 'Missing computer vs lost device; Security vs Security Operations.',
  },
  {
    id: 'exact-encryption', category: 'EXACT_TERM',
    question: 'Which encryption standard is required for customer exports?',
    expectedSources: [target('security-handbook.pdf', 2, 'AES-256')], shouldHaveEvidence: true,
    notes: 'Exact technical term should favor lexical retrieval.',
  },
  {
    id: 'multi-source-leave-and-retention', category: 'MULTI_SOURCE',
    question: 'What are the annual leave allowance and the support transcript retention period?',
    expectedSources: [
      target('people-handbook.pdf', 1, '24 paid annual-leave days'),
      target('support-guide.pdf', 2, '45 days'),
    ], shouldHaveEvidence: true,
    notes: 'Requires two source passages from different documents.',
  },
  {
    id: 'multi-source-remote-and-recording-region', category: 'MULTI_SOURCE',
    question: 'How many remote-work days are allowed, and where are Japanese support recordings stored?',
    expectedSources: [
      target('people-handbook.pdf', 1, 'remotely up to 3 days per week'),
      target('office-guide.pdf', 2, 'Japanese customer support recordings', 'Tokyo'),
    ], shouldHaveEvidence: true,
    notes: 'Two-document retrieval coverage.',
  },
  {
    id: 'no-evidence-ceo-address', category: 'NO_EVIDENCE',
    question: 'What is the CEO home address?', expectedSources: [], shouldHaveEvidence: false,
    notes: 'Unsupported personal information.',
  },
  {
    id: 'no-evidence-revenue', category: 'NO_EVIDENCE',
    question: 'What is the 2027 company revenue target?', expectedSources: [], shouldHaveEvidence: false,
    notes: 'Unsupported finance question.',
  },
  {
    id: 'no-evidence-health-insurer', category: 'NO_EVIDENCE',
    question: 'Which health insurance provider does the company use?', expectedSources: [], shouldHaveEvidence: false,
    notes: 'Unsupported benefits question.',
  },
  {
    id: 'no-evidence-office-rent', category: 'NO_EVIDENCE',
    question: 'What is the monthly rent for Harbor Point?', expectedSources: [], shouldHaveEvidence: false,
    notes: 'Entity overlaps with corpus but requested attribute is absent.',
  },
  {
    id: 'no-evidence-password-length', category: 'NO_EVIDENCE',
    question: 'What is the minimum password length?', expectedSources: [], shouldHaveEvidence: false,
    notes: 'Security domain is relevant but the requested control is absent.',
  },
  {
    id: 'no-evidence-critical-price', category: 'NO_EVIDENCE',
    question: 'How much does the Critical support tier cost?', expectedSources: [], shouldHaveEvidence: false,
    notes: 'Named tier exists, requested pricing evidence does not.',
  },
];
