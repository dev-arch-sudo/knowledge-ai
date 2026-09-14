# Knowledge AI — Current Architecture Audit

Status: source-of-truth audit of `dev-arch-sudo/knowledge-ai` after upstream sync.

This document describes what the code actually does today. It intentionally separates implemented capabilities from labels that sound more advanced than the underlying mechanism.

## Product target

Knowledge AI should become a trustworthy private document assistant:

> Upload private documents, retrieve the strongest supporting evidence, answer only from that evidence, expose exact sources, and abstain when support is insufficient.

Normal product surface:

```text
Documents
Ask
Answer
Sources
Evidence level
Why this answer
```

Advanced retrieval, graph, orchestration, telemetry, and model diagnostics should remain developer/admin concerns.

---

## Current architecture diagram

```text
WEB/API
  |
  v
SpecializedAIService
  |
  +--> KB/document store (JSON on disk)
  +--> verified memory lookup
  |
  v
answerQuestionWithGroundedDocs()  <-- current primary production answering path
  |
  +--> conversational query resolver
  +--> HybridRagIndex (in-memory, rebuilt from documents per query)
  |      |
  |      +--> structure-aware paragraph chunks
  |      +--> lexical token overlap
  |      +--> exact entity overlap
  |      +--> exact number overlap
  |      +--> phrase/bigram overlap
  |
  +--> heuristic reranker
  +--> heuristic evidence-sufficiency gate
  +--> Gemini 3.8 Flash OR deterministic evidence synthesizer
  +--> lexical/numeric claim verifier
  +--> citations from top reranked chunks
  +--> in-memory diagnostic telemetry

Separate advanced cognitive path:

KnowledgeCognitiveEngine
  |
  +--> question understanding / planning
  +--> hierarchical index
  +--> evidence fusion
  +--> graph lookup
  +--> table arithmetic
  +--> corrective retrieval
  +--> Gemini or deterministic synthesis
  +--> claim verification / citations
  +--> cognitive telemetry
```

Important: there are currently two overlapping RAG implementations. The production web/API path is `SpecializedAIService -> answerQuestionWithGroundedDocs()`. The newer cognitive engine is an advanced/diagnostic path and is not the only source of truth for production chat behavior.

---

## 1. Document ingestion

Current flow:

```text
POST /api/kb/documents/upload
  -> multer memory upload
  -> PDF type/extension check
  -> pdf-parse
  -> page text extraction
  -> KnowledgeDocument
  -> kbStore JSON persistence
```

Current constraints:

- PDF only.
- Max 25 MB per file.
- Max 10 files per upload.
- Upload acceptance is `PDF MIME OR .pdf extension`; this is convenient but not strong content validation.
- Parser extracts page number + page text.
- Document summary is currently a first-page snippet, not an LLM-generated semantic summary.
- Original binary PDFs are not the canonical retrieval store; parsed page text is persisted in `data/knowledge_bases.json`.

## 2. Parsing

Primary parser: `server/documentService.ts` using `pdf-parse`.

Advanced structured parser: `server/cognitiveEngine/complexPdfParser.ts`.

The advanced path attempts to preserve/derive:

- headings/sections
- page numbers
- markdown-like tables
- key/value specifications
- outline structure

There is no OCR pipeline, layout-model pipeline, image/caption extraction, or DOCX/HTML ingestion yet.

## 3. Chunking

There are two chunkers.

### Production `ragPipeline.chunkDocument`

- Splits per page.
- Detects headings from markdown headings, section/chapter labels, short colon-terminated lines, and uppercase headings.
- Flushes text on blank lines/headings.
- Produces paragraph/section chunks rather than a fixed token window.
- Stores document id/name, page, section, content hash, token estimate, entities, numbers, tenant and KB ids.
- No configured overlap.
- No parent-child context expansion.

### Cognitive `hierarchicalIndex`

Builds four levels:

- L1 document overview
- L2 section header/context
- L3 semantic chunk
- L4 structured facts/tables/specifications

L3 currently uses approximately 250 words with 50-word overlap.

This is more structure-aware than the primary production chunker, but the project currently maintains both representations.

## 4. Metadata

Useful metadata already exists:

- tenant id / knowledge-base id (production chunk type)
- document id
- document name
- page number
- section title
- chunk id
- content hash
- extracted entities
- extracted numbers
- hierarchical parent/child ids in the cognitive index
- table/specification records in the cognitive index

Missing or incomplete metadata for the target architecture:

- heading hierarchy array/path
- stable source offsets into parsed text
- parser/version metadata
- embedding model/revision metadata
- document version on most chunks
- explicit parent-section retrieval metadata in the production path

## 5. Embeddings

There is currently **no real embedding model/provider in the production retrieval pipeline**.

There is no embedding dimension, normalization contract, model revision, vector cache, or query/document encoder.

Several fields/labels are named `semanticScore` / `SEMANTIC_DENSE`, but current scoring is derived from lexical token/bigram/section overlap. These names should not be interpreted as dense semantic embeddings.

## 6. Vector storage

There is currently **no vector database or persistent vector index**.

Both retrieval indexes are in-memory Maps and are reconstructed from current document text.

Consequently there is currently no vector similarity metric such as cosine, dot product, or L2 in production retrieval.

## 7. Initial retrieval

Primary production retrieval:

`HybridRagIndex.search(query, ..., topK=12)`

Signals:

- token/keyword overlap: 50%
- entity overlap: 25%
- exact-number overlap: 15%
- phrase/bigram overlap: 10%

This is useful lexical/exact retrieval, but it is not BM25 and it is not dense semantic retrieval despite comments/labels using those terms.

The cognitive evidence-fusion path similarly combines lexical, entity, attribute, numeric, section and hierarchy heuristics.

## 8. Reranking

Production reranker: `rerankCandidates()`.

Default flow:

```text
retrieve top 12
  -> heuristic rerank
  -> keep top 5
```

Boosts include:

- exact entity matches
- section-title overlap
- exact query phrase

There is currently no cross-encoder reranker and no learned relevance model.

## 9. Context construction

Production Gemini context includes the reranked chunks with:

- chunk id
- document name
- page
- section title
- chunk text

The model is explicitly instructed to use only retrieved evidence and return strict JSON.

The cognitive engine similarly builds an evidence block from its top six reranked items.

## 10. Model providers

Real provider currently integrated for generation:

- Gemini via `@google/genai`

Fallback:

- deterministic evidence-only local synthesis

There is no normalized `ModelProvider` abstraction yet. Gemini SDK details are still embedded directly in generation services.

The mediator `realProviderAdapter` is a simulation/test harness, not a real multi-provider production integration.

## 11. Generation

Primary production generation:

```text
sufficient evidence
  -> Gemini 3.8 Flash if configured
  -> otherwise deterministic evidence-first generator
```

Gemini is instructed to stay inside retrieved evidence and produce a JSON answer.

Provider failure falls back to deterministic synthesis.

## 12. Claim verification

Two verification implementations exist.

### Production verifier

`verifyClaimsAgainstEvidence()` in `server/ragPipeline.ts`:

- sentence-level claim splitting
- numeric presence check
- lexical overlap threshold
- supporting chunk ids/snippets

### Cognitive verifier

`server/cognitiveEngine/claimVerifier.ts` additionally supports bounded local arithmetic derivation from evidence.

Current critical issue: the production verifier can detect unsupported claims and set telemetry to `GROUNDING_FAILURE`, but the production response still returns the generated answer with `isFoundInDocuments: true`. Verification is therefore advisory rather than a hard safety boundary.

## 13. Citations

Production citations currently come from the top three reranked chunks once evidence sufficiency passes.

They include:

- document id/name
- page
- section
- snippet

Risk: a top retrieved chunk can be cited even if it does not directly support a particular generated claim. Citation selection and claim verification are not yet tightly coupled in the primary production path.

The cognitive verifier has a stronger claim-to-supporting-chunk mapping, but that is not yet the single production citation mechanism.

## 14. Evidence sufficiency / refusal

Production sufficiency is heuristic:

- no candidates -> refuse
- otherwise compute rerank/lexical evidence strength
- threshold currently about 0.28

Cognitive sufficiency similarly uses top rerank score thresholds.

Strength:

- unsupported/out-of-domain questions can abstain before generation.

Risk:

- scores are heuristic and should not be presented as calibrated probabilities.
- post-generation verification currently does not force abstention.

Recommended user-facing confidence vocabulary remains categorical, e.g. `Strong evidence`, `Partial evidence`, `Insufficient evidence`, until calibration exists.

## 15. Evaluation

Existing useful infrastructure:

- benchmark-leakage guard
- arithmetic grounding guard
- deterministic synthesis regression guard
- 20-case unseen synthetic corpus benchmark
- live Gemini benchmark
- older Aurora/golden benchmark suites

The unseen benchmark measures answer matching, retrieval hit, citation precision, refusal, grounding and latency.

Current limitation: retrieval evaluation is not yet a proper information-retrieval benchmark. `retrievalHit` mostly checks whether the expected document appears in final sources rather than measuring expected chunk/passages at ranks 1/5/10. There is no MRR/nDCG retrieval baseline yet.

This must be fixed before claiming a future embedding model improves retrieval.

## 16. Telemetry / observability

`RagTelemetryStore` captures:

- original and contextualized queries
- candidate scores
- reranked scores
- selected evidence
- sufficiency
- generated answer
- grounding verification
- citations
- engine/provider label
- failure class
- latency

The cognitive engine records a similar trace.

Privacy risk: traces can contain raw query text, evidence snippets, full selected evidence text and final answers. This is useful in development but too permissive for a privacy-sensitive production mode unless retention/redaction/configuration is added.

Timing limitation: the cognitive trace still has `fusionMs` and `rerankingMs` placeholders set to zero rather than true stage measurements.

## 17. Tenancy/auth/storage

Implemented:

- account-aware Specialized AI access checks
- API keys for `/api/v1/*`
- rate limiting
- tenant/KB-scoped in-memory retrieval keys
- conversation ownership checks

Risks:

- browser `/api/kb/*` routes are centered around a process-global active KB and are not a production-grade authenticated multi-user boundary.
- conversation ownership is in memory.
- KBs/API keys/usage/memory are filesystem JSON stores.
- synchronous JSON persistence will not scale safely to multi-instance deployment.

## 18. Frontend

The primary navigation has already been refocused toward understandable product concepts:

- Ask
- Documents
- Assistant Settings
- Quality
- Developers

Advanced systems remain visible but labeled as advanced/admin:

- Learning Lab
- Advanced Orchestration
- Answer Diagnostics

This is materially better than exposing engineering phase names as the product itself. Longer term, advanced tabs should probably live behind an explicit admin/developer mode rather than sharing the default top navigation.

---

# What is already implemented well

1. Evidence-first product direction is now explicit in both UX and code comments.
2. Fresh retrieval is run for every production query.
3. Query follow-up resolution does not treat prior assistant messages as authoritative document evidence.
4. Retrieval keeps useful document/page/section metadata.
5. Exact entity/number signals help technical IDs and tabular facts.
6. Evidence sufficiency exists before generation.
7. Deterministic fallback allows grounded operation when Gemini is unavailable.
8. Claim verification and failure classification already exist.
9. The unseen-corpus benchmark plus leakage guard are useful regression foundations.
10. Tenant/KB identifiers already flow into the retrieval layer, so future vector indexes can preserve isolation.

# Simulated / heuristic / placeholder areas

- `semanticScore` is lexical/phrase overlap, not an embedding score.
- `BM25_LEXICAL` labels do not currently use a BM25 implementation.
- reranking is hand-weighted heuristics, not a cross-encoder.
- provider orchestration adapter contains simulated provider behavior for test/admin scenarios.
- cognitive `fusionMs` and `rerankingMs` are telemetry placeholders.
- confidence values are heuristic scores, not calibrated probability-of-correctness.
- graph retrieval exists, but its measurable production advantage has not been established and it should not drive the normal product architecture yet.

# Highest-value next improvements

## P0 — Hard post-generation grounding gate

Problem: verifier can know a claim is unsupported while the answer is still returned as grounded.

Change:

```text
generate
  -> verify
  -> if fully supported: return
  -> otherwise one deterministic evidence-only repair
  -> reverify
  -> if still unsupported: refuse
```

Why first: directly closes a trust-contract violation without changing retrieval/model behavior.

Hugging Face: **No.** Existing verifier is sufficient to establish the control-flow safety boundary first.

## P1 — Build a true retrieval benchmark

Create 30–50 manually verified query -> relevant chunk/source judgments and measure:

- Recall@1
- Recall@5
- Recall@10
- MRR
- optionally nDCG

Why: required baseline before embeddings, rerankers, or chunk changes can be called improvements.

Hugging Face: **No model required.** This is evaluation infrastructure.

## P2 — Embedding provider abstraction + dense retrieval experiment

Introduce a provider boundary containing model metadata, query/document encoding distinction, dimension, normalization and similarity contract.

First HF task category: **Sentence Embeddings / asymmetric information retrieval bi-encoder**.

Current candidates worth benchmarking rather than blindly adopting:

- `intfloat/multilingual-e5-small` — multilingual, MIT, manageable first experimental candidate.
- `Alibaba-NLP/gte-multilingual-base` — multilingual/longer-context alternative, Apache-2.0.
- `BAAI/bge-m3` — powerful multilingual dense/sparse/multi-vector family but substantially heavier; not the first default for a local-first prototype.
- English-only lightweight baselines such as MiniLM can remain useful as speed controls, but multilingual behavior is already relevant to this project.

The final choice must come from this project's retrieval benchmark.

## P3 — Learned reranker behind an interface

Retrieve broadly, then cross-encode query+candidate passages.

HF task category: **Text Classification / Cross-Encoder Passage Reranking**.

Candidate to benchmark later:

- `BAAI/bge-reranker-v2-m3` for multilingual reranking; it is materially heavier than heuristic scoring and should only be adopted if final-context ranking improves enough to justify latency/memory.

## P4 — Unify citation selection with claim support + privacy-safe telemetry

Citations should come from claim-support mappings, not simply the top retrieved chunks. Production telemetry should have configurable redaction/retention and must not retain private evidence text by default in privacy mode.

HF task category for later verifier experimentation: **Natural Language Inference / entailment or cross-encoder relevance**. Do not add this model until the current lexical verifier has a benchmark exposing a real limitation.

---

# Phased implementation plan

## Phase A — Trust boundary (now)

1. Add hard grounding gate to the primary production path.
2. Add regression tests for:
   - supported generated answer accepted
   - unsupported answer repaired from evidence
   - irreparable unsupported answer refused
3. Re-run TypeScript/build/unseen benchmark.
4. Document metric impact and limitations.

## Phase B — Retrieval measurement

1. Extract a reusable benchmark corpus/fixture.
2. Add manually verified relevant chunk ids/source spans.
3. Add Recall@1/5/10 + MRR.
4. Freeze a lexical/heuristic baseline.

## Phase C — Embedding abstraction, no provider lock-in

1. Add `EmbeddingProvider` interface and metadata contract.
2. Add one local/hosted HF adapter behind it.
3. Cache document vectors keyed by content hash + model revision.
4. Compare dense vs current lexical baseline.
5. Add dense retrieval only if recall improves without unacceptable latency/memory cost.

## Phase D — Hybrid retrieval

1. Preserve exact lexical/entity/number retrieval.
2. Fuse dense + lexical candidates behind a `Retriever` abstraction.
3. Evaluate terminology mismatch, IDs, numbers and paraphrases separately.

## Phase E — Learned reranking

1. Introduce `Reranker` abstraction.
2. Evaluate heuristic baseline vs HF cross-encoder on the same candidate set.
3. Measure final-context recall, citation precision and latency.

## Phase F — Provider abstraction + optional open-source generation

Only after retrieval quality is measurable:

1. Normalize generation request/response types.
2. Wrap Gemini first without behavioral change.
3. Add optional Hugging Face/local provider later.
4. Compare answer/citation/grounding/cost/latency.

# What should NOT be changed yet

- Do not rewrite the app into microservices.
- Do not replace Gemini simply to become more open-source.
- Do not add a vector database before the embedding/retrieval benchmark proves the need and data shape.
- Do not add LangChain/LlamaIndex just to wrap simple internal interfaces.
- Do not fine-tune anything yet.
- Do not expand GraphRAG until a measured multi-hop/relationship retrieval failure justifies it.
- Do not remove exact lexical/entity/number retrieval when dense embeddings arrive; dense search is complementary, not a replacement.
- Do not show numeric confidence percentages to users until they are calibrated.
- Do not call the current `semanticScore` a real dense semantic score in product/technical claims.

# Architecture learning notes

- **Bi-encoder:** query and passages are encoded independently into vectors. Fast enough for first-stage retrieval because document vectors can be precomputed.
- **Cross-encoder:** query and candidate passage are encoded together. Usually better relevance judgment but much slower, so it belongs after first-stage retrieval.
- **Asymmetric retrieval:** short question -> longer supporting passage. This is Knowledge AI's dominant retrieval shape, so query/document-aware embedding models are preferable.
- **Hybrid retrieval:** combine dense semantic search with lexical/exact retrieval. Important here because policy names, codes, numbers and technical identifiers are often best handled lexically.
- **NLI/entailment:** asks whether evidence logically supports a claim. It may later improve verification, but adding it before a verifier benchmark would be premature.

The architectural rule going forward is:

```text
inspect -> explain -> implement -> test -> evaluate -> document -> commit
```

A model or framework is not an improvement until the benchmark shows that it solved a measured problem.