# Knowledge AI — Current AI Architecture

This document describes the architecture that exists in the repository today. It is intentionally descriptive, not aspirational. The code is the source of truth.

## 1. Current architecture diagram

```text
NORMAL PRODUCT PATH

React UI
  ├─ Documents sidebar / upload
  └─ Ask UI
       │
       ├─ POST /api/kb/documents/upload
       │      ↓
       │   multer (PDF only, memory upload)
       │      ↓
       │   pdf-parse
       │      ↓
       │   page text + page numbers + simple summary
       │      ↓
       │   KnowledgeDocument
       │      ↓
       │   JSON-backed KnowledgeBaseStore
       │
       └─ POST /api/kb/chat
              ↓
          conversational query resolver
              ↓
          rebuild in-memory HybridRagIndex from KB documents
              ↓
          heuristic first-stage retrieval
          (keyword + entity + number + phrase/bigram overlap)
              ↓ top 12
          heuristic reranker
              ↓ top 5
          evidence sufficiency heuristic
              ├─ insufficient → refusal
              └─ sufficient
                    ↓
                evidence context builder
                    ↓
                Gemini 3.8 Flash when configured
                OR deterministic evidence-first fallback
                    ↓
                lexical/numeric claim verification
                    ↓
                top retrieved chunks used as citations
                    ↓
                answer + sources + diagnostic telemetry
```

```text
ADVANCED / COGNITIVE PATH

question
  ↓
question understanding + multilingual normalization
  ↓
information-need planner
  ↓
hierarchical index + subordinate RAG + evidence fusion
  + optional graph-derived evidence + structured tables
  ↓
heuristic reranking / corrective retrieval
  ↓
evidence sufficiency
  ↓
table arithmetic when applicable
  ↓
Gemini OR deterministic synthesizer
  ↓
claim verifier
  ↓
citations + cognitive telemetry
```

The normal `/api/kb/chat` path and the newer cognitive engine are related but are **not one unified retrieval pipeline**. This duplication is an architectural risk because a quality improvement in one stack does not automatically improve the other.

## 2. Current ingestion pipeline

1. `server.ts` accepts up to 10 uploaded files using Multer memory storage.
2. File size is limited to 25 MB per file.
3. Upload validation currently accepts PDFs only.
4. `server/documentService.ts` uses `pdf-parse` (`PDFParse.getText()`).
5. Parsed text is stored page-by-page as `{ pageNumber, text }`.
6. If the parser does not expose page objects, the full text becomes page 1.
7. A lightweight summary is generated from the first 300 characters of page 1.
8. `createKnowledgeDocument()` creates a `KnowledgeDocument` with document metadata and parsed pages.
9. `kbStore.addDocument()` persists the document in `data/knowledge_bases.json`.
10. No embeddings, dense vectors, or persistent retrieval index are created during ingestion.

### Parsing strengths

- Real PDF extraction exists.
- Page numbers are retained.
- The advanced cognitive parser can infer headings, sections, tables, specifications, and an outline from parsed page text.

### Parsing limitations

- PDF only.
- No OCR path for scanned PDFs.
- No DOCX/HTML/text ingestion abstraction.
- The base ingestion record does not preserve bounding boxes, paragraph coordinates, caption relationships, or native PDF structure.
- Heading/table structure is reconstructed heuristically later rather than stored as canonical ingestion metadata.

## 3. Chunking and metadata

There are currently two chunking strategies.

### Main product RAG (`server/ragPipeline.ts`)

- Operates page-by-page.
- Detects likely headings with simple textual rules.
- Blank lines flush paragraph chunks.
- There is no fixed overlap between these paragraph chunks.
- Metadata includes:
  - chunk ID
  - tenant ID
  - knowledge-base ID
  - document ID/name
  - page number
  - section title
  - text
  - estimated token count
  - content hash
  - extracted entities
  - extracted numbers

### Cognitive hierarchical index (`server/cognitiveEngine/hierarchicalIndex.ts`)

- L1: document overview.
- L2: inferred section chunk.
- L3: 250-word chunks with 50-word overlap inside a section.
- L4: extracted table/specification fact records.
- Metadata additionally includes hierarchy level, parent/children relationships, table data, token lists, entities, and numbers.

The cognitive approach is closer to the desired structure-aware design, but the main user chat does not use it as its sole canonical index.

## 4. Embeddings and vector storage

**No production embedding model is currently used.**

There is therefore currently no:

- embedding provider abstraction
- embedding model name/revision
- embedding dimension
- vector normalization contract
- cosine/dot-product/L2 similarity configuration
- vector database or persistent dense-vector index

The `semanticScore` field in `server/ragPipeline.ts` is currently derived from phrase/bigram overlap. It is **not a neural semantic embedding score**.

This naming should be treated carefully during future evaluation so we do not mistake lexical phrase overlap for dense semantic retrieval.

## 5. Current retrieval

### Main product path

`HybridRagIndex.search()` computes a weighted score from:

- keyword/token overlap: 50%
- entity overlap: 25%
- exact number overlap: 15%
- phrase/bigram overlap (currently named semantic score): 10%

The normal chat path requests the top 12 first-stage candidates.

This is a useful exact/lexical baseline, especially for names, IDs, and numbers, but it is not BM25 and it is not dense semantic retrieval.

### Advanced cognitive path

The cognitive engine combines:

- hierarchical chunks
- evidence fusion
- subordinate RAG
- structured tables
- knowledge-graph-derived relationships
- one corrective re-retrieval attempt when needed

This is richer, but its extra complexity is not yet justified by retrieval-only measurements across a realistic benchmark.

## 6. Current reranking

Reranking exists, but it is heuristic rather than model-based.

`rerankCandidates()` boosts:

- the first-stage combined score
- exact entity matches
- section-title overlap
- exact query phrase matches

The main path reranks to top 5 for answer context.

There is no cross-encoder/reranker model abstraction yet.

## 7. Context construction and generation

In the normal Gemini path, each selected chunk is rendered with:

- chunk ID
- document name
- page
- section
- raw chunk text

The system prompt instructs the model to use only supplied evidence and to refuse when the evidence is insufficient.

Current real live LLM integration:

- Google Gemini (`gemini-3.8-flash`)

Current fallback:

- deterministic evidence-first answer synthesis

There is no general model-provider interface yet. The mediator provider adapter is a simulation/test harness and is explicitly labeled as simulated; it is not a second live generation provider.

## 8. Evidence sufficiency and refusal

Both major RAG paths implement evidence-sufficiency logic.

The current logic is heuristic and based primarily on lexical/retrieval scores. It is useful as a guardrail, but its numerical score is not a calibrated probability of correctness.

The product should prefer categorical wording such as:

- Strong evidence
- Partial evidence
- Insufficient evidence

until confidence calibration is actually measured.

## 9. Claim verification

Verification exists in both stacks.

The newer cognitive claim verifier:

- splits the answer into claims/sentences
- checks lexical overlap against retrieved chunks
- checks numeric support
- supports locally reproducible arithmetic such as sums/differences/ratios
- associates supporting chunk IDs
- generates citations from supporting evidence

This is a good deterministic verification baseline.

### Important trust gap

Verification is currently **diagnostic, not a hard final-answer gate** in the cognitive coordinator. `allClaimsSupported` and `groundingScore` are recorded, but the coordinator can still return a generated answer while `isFoundInDocuments` is based only on retrieval sufficiency.

The older main `geminiService` has the same class of problem: unsupported claims can set `GROUNDING_FAILURE` in telemetry while the response still returns `isFoundInDocuments: true`.

A future change should make major unsupported claims trigger repair, abstention, or a lower evidence status before the answer reaches the user.

## 10. Citation behavior

### Main product path

The model is asked to return sources, but the final response does not trust those model-generated citations. Instead, the service creates citations from the top three reranked chunks.

That avoids fabricated model page numbers, but it also means a citation can be merely relevant rather than the exact supporting passage for a particular claim.

### Cognitive path

The newer claim verifier links supported claims to evidence chunks and creates citations from those chunks. This is closer to the desired architecture.

One remaining fallback can still add the top evidence chunk when no claim-linked citation was produced, which should eventually be removed or made explicit because relevance is not identical to support.

## 11. Evaluation infrastructure

Implemented today:

- benchmark-leakage guard
- deterministic unseen-corpus benchmark
- live Gemini unseen-corpus diagnostic benchmark
- arithmetic grounding regression guard
- deterministic synthesis regression guard
- older corpus-specific/golden benchmark suites
- evaluation UI and custom test cases

The current unseen benchmark measures useful end-to-end metrics, but its retrieval-hit metric is not a true ranked retrieval metric. It can infer a hit from final citations rather than asking whether the correct source passage appeared at rank 1/5/10.

Before comparing embedding models, the project therefore needs a retrieval-only benchmark with manually verified evidence targets and ranked metrics such as Recall@K and MRR.

## 12. Telemetry and observability

The system already captures substantial diagnostics:

- original/contextualized question
- candidates and scores
- reranked evidence
- evidence sufficiency
- selected evidence
- generated answer
- claim verification
- citations
- provider/engine name
- latency fields

Limitations:

- some timing fields are placeholders (`fusionMs`/`rerankingMs` can be zero)
- token usage/cost is not measured correctly in the cognitive path
- traces can contain user questions, document excerpts, selected evidence, and full answers

For a private-document product, production telemetry needs configurable redaction/retention and must not silently persist confidential source text.

## 13. Persistence, tenancy, and auth

Current persistence is JSON-file based (`data/knowledge_bases.json`) with in-process Maps.

The code contains API-key, governance, tenant, quota, and SaaS experiments, but the normal product routes still rely on a server-global active knowledge base. There is not yet a complete authenticated user/workspace request boundary around `/api/kb`, upload, and chat.

This is a significant privacy/isolation risk for any real multi-user deployment.

## 14. Frontend

Implemented well:

- document upload/listing
- ask/answer workflow
- visible sources with document/page
- document viewer integration
- evaluation/diagnostic tooling
- advanced engineering screens separated into their own views

Still misleading or too strong in places:

- copy such as `0 Hallucinations Enforced`
- copy implying answers cannot hallucinate
- heuristic confidence values can look more scientific than they are

The normal product should converge on:

```text
Documents
Ask
Answer
Sources
Evidence status
Why this answer
```

Advanced cognitive/RAG terminology should stay in diagnostics/admin views.

## 15. What is implemented well

1. Evidence-first generation is already a real design principle, not just UI copy.
2. Unsupported-question refusal exists and is regression-tested.
3. Page/document metadata is preserved through retrieval and citations.
4. Deterministic fallback works without a cloud model and is now concise.
5. Arithmetic claims can be verified from local evidence operands.
6. Conversational query resolution avoids treating previous assistant output as authoritative evidence.
7. The code has useful diagnostics and benchmarks.
8. Corpus-specific answer leakage was removed from production cognitive reasoning.

## 16. Simulated / placeholder / misleading pieces

- No dense embeddings despite `semantic` naming in the lexical retriever.
- No true vector store.
- No model-based reranker.
- Mediator multi-provider adapter is simulated, not live provider diversity.
- Some telemetry timing fields are placeholders.
- Cognitive token accounting records a query as a token-like usage item rather than actual provider token usage.
- Confidence values are heuristic, not calibrated probabilities.
- Knowledge graph retrieval exists, but its incremental value has not been isolated by evaluation.

## 17. Highest-value next improvements

### 1. Build a true retrieval-only benchmark — **do first**

Problem: current end-to-end retrieval-hit measurement is too indirect for model comparison.

Measure:

- Recall@1
- Recall@5
- Recall@10
- MRR
- multi-source evidence coverage
- false-positive sufficiency for unsupported questions

Hugging Face: **No.** This is the measuring instrument required before adding an embedding model.

### 2. Introduce an embedding-provider abstraction + dense retrieval experiment

Problem: current retrieval cannot bridge low-overlap paraphrases reliably.

Hugging Face category: **Sentence embedding / bi-encoder retrieval model.**

First candidates should be small/medium and evaluated against the baseline rather than selected by popularity.

### 3. Add a reranker abstraction and evaluate a cross-encoder

Problem: broad retrieval should optimize recall while final context needs precision.

Hugging Face category: **Cross-encoder / text-ranking model.**

Use only if it measurably improves final evidence ranking/citation quality enough to justify latency.

### 4. Enforce verification as a hard trust boundary

Problem: the system can know a generated claim is unsupported and still return it.

Initial implementation should remain deterministic and conservative.

Hugging Face category later: **NLI / entailment classifier** can be evaluated as an additional verifier, but should not replace deterministic checks until benchmarked.

### 5. Unify the production retrieval boundary

Problem: main chat and cognitive engine have overlapping indexes/retrievers, making quality work easy to duplicate or bypass.

Create simple internal retrieval interfaces and migrate incrementally rather than rewriting both systems.

Hugging Face: only indirectly, through the embedding/reranker adapters behind those interfaces.

## 18. Hugging Face role by component

| Improvement | Use HF now? | Appropriate category |
|---|---|---|
| Retrieval benchmark | No | N/A |
| Dense semantic retrieval | After baseline | Sentence Transformer / bi-encoder |
| Reranking | After retrieval baseline | Cross-encoder reranker |
| Claim verification | Later experiment | NLI / textual entailment classifier |
| Generation provider | Much later | Instruction-tuned causal LLM |
| Query classification/routing | Only if heuristics become a measured problem | Text classification |

## 19. Phased implementation plan

### Phase A — measurement foundation

1. Freeze a manually verified retrieval dataset.
2. Measure the current production retriever at K=1/5/10 and MRR.
3. Add it to CI and document the baseline.

### Phase B — provider boundary for embeddings

1. Add a small `EmbeddingProvider` contract.
2. Add a deterministic/no-op test provider for unit tests.
3. Add one Hugging Face/Sentence Transformers implementation.
4. Store provider metadata: provider/model/revision/dimension/normalization/similarity contract.
5. Compare dense-only vs current lexical baseline; do not replace anything yet.

### Phase C — hybrid retrieval experiment

1. Retrieve a wider union of lexical + dense candidates.
2. Measure Recall@K and latency.
3. Keep hybrid only if it improves difficult cases without unacceptable false positives.

### Phase D — reranking experiment

1. Introduce a `Reranker` interface.
2. Add one small cross-encoder implementation.
3. Compare heuristic vs model reranking on the same frozen dataset.
4. Measure final context quality, answer grounding, latency, and cost.

### Phase E — hard grounding gate

1. Treat unsupported important claims as a response failure, not merely telemetry.
2. Attempt one evidence-constrained repair or abstain.
3. Add adversarial regression cases where retrieval is relevant but generation introduces an unsupported detail.

### Phase F — consolidate production boundaries

1. Move normal chat and advanced cognitive retrieval behind shared interfaces.
2. Preserve advanced graph/corrective features as optional strategies.
3. Remove duplicated indexing only after behavior is covered by benchmarks.

### Phase G — privacy and production isolation

1. Real authenticated workspace boundary.
2. Persistent tenant-scoped document/index storage.
3. Configurable telemetry redaction/retention.
4. Explicit cloud/private execution modes.

## 20. What should NOT be changed yet

- Do not fine-tune an LLM.
- Do not add a second generation provider merely for provider count.
- Do not replace Gemini while the live baseline is incomplete.
- Do not introduce LangChain/LlamaIndex solely as an abstraction layer.
- Do not introduce a vector database before the embedding/retrieval contract is clear.
- Do not expand GraphRAG until ordinary retrieval failures show a graph-shaped need.
- Do not split the backend into microservices.
- Do not delete the existing deterministic fallback or current lexical retriever; both are valuable baselines.
- Do not advertise heuristic confidence as a calibrated percentage.
- Do not make privacy/local claims while document evidence is still sent to Gemini in cloud mode.

## 21. Immediate implementation decision

The next change is intentionally **not a new model**.

We first add a retrieval-only benchmark against the production retrieval path. The current lexical/entity/number retriever becomes the baseline. Only after we have exact ranked metrics will a Hugging Face embedding model be introduced and judged against that baseline.
