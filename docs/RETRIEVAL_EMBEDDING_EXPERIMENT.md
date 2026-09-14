# Dense Retrieval Experiment — BGE Small

## Status

Experimental. This does **not** replace the production retriever.

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

Promotion requires measurable improvement on the frozen benchmark, especially Recall@5/10 and known semantic misses, without weakening the existing trust boundary. If dense alone does not win but hybrid RRF does, prefer the smallest hybrid change that preserves exact-term retrieval.

A vector database is out of scope for this experiment. With only a small benchmark corpus, an in-memory vector list is sufficient to measure model quality. Persistent vector infrastructure should be introduced only after dense retrieval has demonstrated value.

## What comes after this experiment

Depending on measured results:

- If BGE wins clearly: promote dense/hybrid behind a retrieval abstraction and add persistent embedding metadata/index lifecycle.
- If gains are weak: benchmark a second model before changing production.
- If retrieval improves but no-evidence behavior remains weak: work on evidence sufficiency/calibration separately; do not invent a cosine-confidence threshold.
- Learned cross-encoder reranking comes only after first-stage retrieval is stable and measured.
