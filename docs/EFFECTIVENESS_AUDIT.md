# Knowledge AI Effectiveness & Reality Audit

Status: **in progress**

This audit separates real product capability from simulation, fixtures, and benchmark-specific shortcuts. The goal is to answer one question honestly:

> If a team uploads its own documents, can it trust Knowledge AI to retrieve the right evidence, answer correctly, cite the right source, and refuse unsupported questions?

## Current verdict

The repository contains a real grounded-answer pipeline and substantial retrieval/evaluation infrastructure. However, benchmark contamination and simulated provider telemetry mean the existing internal scores must not yet be treated as proof of production effectiveness.

## Confirmed real capabilities

### Grounded answer pipeline

The current grounded path performs real document filtering, conversational query resolution, hybrid retrieval, reranking, evidence-sufficiency checks, model generation when a Gemini key is configured, deterministic fallback generation, claim checks, citations, and telemetry.

### Cognitive retrieval pipeline

The cognitive engine coordinates question understanding, planning, hierarchical retrieval, subordinate hybrid RAG, graph traversal, structured-table access, evidence verification, corrective re-retrieval, synthesis, and claim verification.

### Abstention behavior

Both the grounded and cognitive paths contain explicit insufficient-evidence / out-of-domain behavior rather than always forcing an answer.

## Reality gaps

### P0 — Benchmark contamination in the generic cognitive reasoning path

`server/cognitiveEngine/knowledgeCognitiveEngine.ts` currently contains many Aurora Robotics facts and expected benchmark answers directly in production reasoning branches. Examples include robot counts, battery capacities, warehouse locations, opening dates, safety limits, comparisons, and correction answers.

This means benchmark success can be inflated without proving retrieval quality.

**Required fix:** move benchmark-specific deterministic fixtures out of the generic production reasoning path. Production answers must be derived from retrieved evidence (or from a generic deterministic arithmetic/table engine), not from corpus-specific strings embedded in code.

Until this is fixed, Aurora benchmark scores are **not valid evidence of general product quality**.

### P0 — Provider adapter was simulation presented too similarly to real provider telemetry

The mediator provider adapter does not make live provider calls. It synthesizes output, latency, token usage, health profiles, and failover behavior.

**Action taken in this branch:** provider fixtures and responses are explicitly labeled `SIMULATED`, and comments state that the module is a simulation harness.

### P1 — Production provider abstraction is incomplete

Live grounded generation is coupled directly to Gemini rather than a stable provider interface. A second provider should not be added by duplicating model calls throughout the codebase.

**Required design:**

```text
LLMProvider
  generate()
  healthCheck()
  capabilities()

ProviderRouter
  primary provider
  fallback provider
  optional independent verifier
```

### P1 — Telemetry includes derived rather than independently measured stage timings

Some cognitive timing fields split one measured duration into fixed percentages for retrieval/fusion/reranking. These values are estimates, not direct timings.

**Required fix:** instrument each stage directly or label the values as estimates.

### P1 — Product surface exposes implementation phases before user value

The previous UI emphasized Phase 4 / Phase 9 / Phase 10, mediator architecture, and cognitive terminology.

**Action taken in this branch:** the header now centers `Ask`, `Documents`, `Assistant Settings`, `Quality`, and labels orchestration/diagnostics as advanced/admin tools.

### P1 — Persistence / scale boundaries

Some API key, usage, and rate-limit state is file-backed or in-memory. This is suitable for a prototype but not a horizontally scaled multi-instance SaaS.

### P2 — Server composition

`server.ts` has grown into a large integration surface with routes for knowledge, memory, learning, orchestration, SaaS, provider, testing, and cognitive systems. It should be modularized after correctness work so the refactor does not obscure behavior changes.

## Effectiveness metrics required before adding provider #2

A clean benchmark must run with corpus-specific shortcuts disabled/removed.

Track at least:

| Metric | Meaning |
| --- | --- |
| Answer correctness | Is the final answer factually supported? |
| Retrieval hit rate / recall | Did the correct evidence appear in retrieved candidates? |
| Reranking top-k recall | Did correct evidence survive reranking? |
| Citation precision | Do citations actually support the associated claims? |
| Claim grounding rate | What fraction of factual claims are supported? |
| Refusal accuracy | Does the system refuse genuinely unsupported questions? |
| False-refusal rate | Does it wrongly refuse answerable questions? |
| Hallucination rate | Does it introduce unsupported facts? |
| Follow-up accuracy | Does conversational resolution preserve the correct entity/topic? |
| Multilingual accuracy | Does non-English querying retrieve the same authoritative evidence? |
| Latency | End-to-end and real per-stage timing |
| Provider failure rate | Actual live-provider errors / rate limits / timeouts |

## Recommended evaluation sets

Use at least four datasets:

1. **Known-answer corpus** — factual questions with exact evidence locations.
2. **Unsupported questions** — plausible questions whose answers are intentionally absent.
3. **Adversarial / misleading questions** — false premises, prompt injection, conflicting claims.
4. **Unseen private corpus** — documents and questions never referenced by deterministic fixtures in the codebase.

The fourth set is essential. It is the closest test of whether the product generalizes to another company.

## Provider #2 decision gate

Do not add another model merely because it may be “smarter.” Add a provider only when an A/B evaluation shows a measurable benefit in one of these roles:

- fallback availability
- difficult-query answer quality
- independent claim verification
- disagreement detection
- multilingual quality
- cost/latency routing

The baseline provider and the candidate provider must be evaluated on the same retrieval evidence and same clean dataset.

## Definition of the next trustworthy milestone

Knowledge AI is ready for an external pilot when:

- benchmark-specific answer shortcuts are isolated from production execution
- CI passes lint/build on every change
- an unseen-corpus evaluation is repeatable
- citation correctness is measured
- refusal behavior is measured
- provider telemetry clearly distinguishes live vs simulated data
- the normal UI makes source inspection easy
- security boundaries for a private workspace are documented and tested

Only after those conditions should multi-provider verification and broader SaaS features become the main priority.
