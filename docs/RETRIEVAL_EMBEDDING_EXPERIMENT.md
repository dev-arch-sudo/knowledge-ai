# Dense Retrieval Experiment — BGE Small

## Status

Measured and accepted as a successful retrieval experiment.

This PR still does **not** replace the production retriever. The production promotion should happen in a separate change so the experiment and the behavior change remain independently reviewable and reversible.

## Problem being tested

The frozen pre-embedding benchmark shows that the current heuristic retriever is useful but incomplete:

- candidate Recall@1: 75.00%
- candidate Recall@5: 87.88%
- candidate Recall@10: 90.91%
- candidate MRR: 82.58%
- candidate nDCG@10: 84.28%
- no-evidence abstention: 60.00%

Known retrieval misses include paraphrased maintenance responsibility and several safety/electrical passages. The heuristic reranker also sometimes moves an initially relevant passage down.

## Why a bi-encoder

A bi-encoder independently embeds the query and each document chunk. Retrieval then compares those vectors, here with cosine similarity. This is appropriate for first-stage retrieval because document vectors can be computed once and reused for many questions.

A cross-encoder is deliberately **not** introduced here. Cross-encoders jointly read a query and candidate passage and are usually better suited to reranking a smaller candidate set because they are more expensive per candidate.

## Candidate

First experimental provider:

- provider runtime: Hugging Face Transformers.js
- model runtime id: `Xenova/bge-small-en-v1.5`
- upstream model family: `BAAI/bge-small-en-v1.5`
- execution: local in the Node process
- vector dimension: 384
- normalization: L2 normalized by the feature-extraction pipeline
- comparison: cosine similarity
- maximum model positions: 512
- pooling: CLS token, matching the model's Sentence-Transformers pooling configuration

This model is intentionally small. The current judged benchmark is English, so the first experiment optimizes for a low-cost, locally reproducible baseline rather than immediately choosing a much larger multilingual model.

## Architecture boundary

```text
EmbeddingProvider
  └─ HuggingFaceBgeSmallEmbeddingProvider

Document chunks
  ↓ embedDocuments
normalized vectors

Question
  ↓ embedQuery
normalized vector
  ↓
DenseRetriever
  ↓ cosine similarity
ranked chunks
```

The retriever depends only on `EmbeddingProvider`; Hugging Face-specific loading stays inside the adapter.

## Compared systems

The same frozen retrieval judgments are evaluated against:

1. current heuristic candidate retriever
2. BGE dense retriever
3. reciprocal-rank fusion of heuristic + dense rankings

RRF is used instead of directly adding heuristic and cosine scores because the raw score scales have different meanings.

## Corrected benchmark result

The authoritative run uses the model's correct CLS-token pooling configuration. An earlier mean-pooled run was discarded and must not be used for comparison.

Benchmark scope:

- benchmark: `project-sample-documents-retrieval-v1`
- total cases: 49
- answerable cases: 44
- no-evidence cases: 5
- indexed chunks: 12
- embedding dimension: 384
- execution: local CPU
- dense indexing latency in CI: 2181 ms

### Overall answerable retrieval metrics

| Retriever | Recall@1 | Recall@5 | Recall@10 | MRR | nDCG@10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Heuristic baseline | 75.00% | 87.88% | 90.91% | 82.58% | 84.28% |
| BGE dense | 74.24% | 92.05% | 97.73% | 82.94% | 85.06% |
| Heuristic + BGE RRF hybrid | 74.24% | 97.73% | 100.00% | 83.67% | 86.95% |

### Interpretation

The experiment demonstrates a real retrieval gain.

Dense retrieval improves broad recall substantially over the heuristic baseline:

- Recall@5: 87.88% → 92.05%
- Recall@10: 90.91% → 97.73%

The hybrid RRF retriever is stronger overall:

- Recall@5: 87.88% → 97.73%
- Recall@10: 90.91% → 100.00%
- MRR: 82.58% → 83.67%
- nDCG@10: 84.28% → 86.95%

Recall@1 is slightly lower for dense/hybrid than the heuristic baseline, so the experiment does not justify replacing lexical retrieval with dense retrieval alone.

The category breakdown also explains why hybrid is preferred:

- Paraphrase Recall@5 improves to 100% for both dense and hybrid.
- Ambiguous retrieval improves strongly with dense semantics.
- Dense alone regresses on `TERMINOLOGY_MISMATCH` and some `MULTI_PASSAGE` behavior.
- Hybrid restores the heuristic strengths on those categories while retaining most semantic gains.

This is the expected reason to use hybrid retrieval: exact identifiers, numbers, terminology, and technical phrases remain valuable lexical signals, while embeddings recover semantically related passages that lexical overlap misses.

## No-evidence observations

The five unsupported questions produced top dense cosine similarities ranging roughly from 0.60 to 0.78.

That overlap is high enough to reinforce an important rule:

**dense cosine similarity is a ranking signal, not calibrated answer confidence.**

This experiment therefore does not introduce a cosine threshold for refusal and does not replace the existing evidence-sufficiency/grounding gates.

## Decision

**Experiment result: PASS.**

Promote the architecture direction, not this PR directly into production behavior:

1. keep the existing lexical/heuristic retriever;
2. add dense BGE retrieval as a second first-stage signal;
3. fuse heuristic and dense rankings with reciprocal-rank fusion;
4. keep grounding and evidence sufficiency as separate trust controls;
5. benchmark the production integration against this same frozen corpus before enabling it as the default;
6. do not add a vector database until index lifecycle, persistence, and corpus size require one.

The next implementation PR should make the hybrid retriever available behind a retrieval abstraction/feature boundary, then run the same regression benchmark before production promotion.

## Metrics

For answerable questions:

- Recall@1
- Recall@5
- Recall@10
- MRR
- nDCG@10
- category breakdown

For no-evidence questions, dense nearest-neighbor cosine scores are recorded only as observations.

**Cosine similarity is not treated as confidence.** No abstention threshold is selected in this experiment.

## Promotion rule

Do not replace production retrieval merely because the dense output looks semantically better.

Promotion requires measurable improvement on the frozen benchmark, especially Recall@5/10 and known semantic misses, without weakening the existing trust boundary. This experiment meets that bar for **hybrid RRF**, not for dense-only replacement.

A vector database remains out of scope. With only a small benchmark corpus, an in-memory vector list is sufficient to measure model quality. Persistent vector infrastructure should be introduced only when production indexing and corpus scale justify it.

## What comes after this experiment

Next:

- integrate hybrid heuristic + BGE retrieval behind a clean retrieval boundary;
- preserve the current production retriever as fallback during rollout;
- rerun the frozen 49-case benchmark as a blocking regression check;
- separately improve no-evidence/evidence-sufficiency behavior;
- only then evaluate a learned cross-encoder reranker if ranking quality still needs improvement.
