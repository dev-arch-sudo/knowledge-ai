# Knowledge AI

**Trustworthy answers from your private documents.**

Knowledge AI is a document-grounded assistant for teams. Upload company knowledge, ask questions in natural language, and receive answers backed by retrieved evidence and citations. When the available documents do not support an answer, the system is designed to abstain instead of guessing.

## Product promise

Knowledge AI should make four things easy:

1. **Bring your knowledge** — create a workspace and upload authoritative documents.
2. **Ask naturally** — ask direct, follow-up, comparison, numerical, and multilingual questions.
3. **Verify the answer** — see the supporting document, page, section, and evidence snippet.
4. **Trust the boundary** — unsupported questions should be refused clearly rather than answered from unverified model knowledge.

The advanced RAG, GraphRAG, corrective retrieval, memory, orchestration, and telemetry systems exist to support that promise. They are implementation details, not the primary user experience.

## Core workflow

```text
Create workspace
      ↓
Upload documents
      ↓
Index and structure knowledge
      ↓
Ask a question
      ↓
Retrieve + rerank evidence
      ↓
Check evidence sufficiency
      ↓
Generate an evidence-backed answer
      ↓
Verify claims + show citations
```

## Trust principles

- Uploaded and approved workspace documents are the authoritative source of truth.
- Retrieval must run for every factual document question.
- Model output must not silently replace missing evidence with general knowledge.
- Answers should expose verifiable citations.
- Unsupported or out-of-domain questions should abstain.
- Benchmarks must measure real retrieval and generation behavior; benchmark answers must not be hard-coded into the production reasoning path.
- Simulated provider metrics must be explicitly labeled as simulated.
- Production telemetry must distinguish measured values from estimates.

## Current architecture

The project currently includes:

- React 19 + Vite frontend
- Express + TypeScript backend
- PDF ingestion and document workspaces
- hybrid retrieval and reranking
- hierarchical indexing
- knowledge-graph retrieval
- corrective RAG / re-retrieval
- structured-table arithmetic
- claim verification and citations
- conversational query resolution
- multilingual query support
- evaluation and benchmark tooling
- memory and learning experiments
- multi-tenant / API platform experiments

Gemini is currently the primary live LLM path. A deterministic grounded generator is used as a fallback when no Gemini key is available or generation fails.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Set a Gemini API key in `.env` when you want live model generation:

```env
GEMINI_API_KEY=your_key_here
```

Quality checks:

```bash
npm run lint
npm run build
```

## Product priorities

Development should prioritize, in order:

1. Retrieval correctness
2. Citation correctness
3. Unsupported-question refusal accuracy
4. Hallucination reduction
5. Honest telemetry
6. Secure private-workspace boundaries
7. Reliable provider failover
8. User experience
9. Additional model providers

Adding more AI providers is valuable only after the baseline system is measured honestly. A second provider should primarily improve failover, difficult-query verification, or disagreement detection—not add complexity without measurable gains.

## Success metrics

The product should be evaluated on metrics such as:

- answer correctness
- retrieval recall / hit rate
- citation precision
- claim grounding rate
- unsupported-question refusal accuracy
- false-refusal rate
- hallucination rate
- conversational follow-up accuracy
- multilingual retrieval quality
- latency and provider failure rate

See `docs/PRODUCT_DIRECTION.md` and `docs/EFFECTIVENESS_AUDIT.md` for the product contract and current audit findings.
