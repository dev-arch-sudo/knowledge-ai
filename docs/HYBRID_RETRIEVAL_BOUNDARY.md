# Hybrid Retrieval Boundary

## Status

Implemented behind a retrieval abstraction and guarded by the frozen retrieval benchmark.

This change deliberately does **not** promote hybrid retrieval to the default production answering path yet.

## Why this exists

The local BGE experiment showed that dense retrieval adds real semantic recall, while the existing heuristic retriever remains strong for exact terminology, identifiers, numbers, and technical wording.

Measured on `project-sample-documents-retrieval-v1`:

| Retriever | Recall@1 | Recall@5 | Recall@10 | MRR | nDCG@10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Heuristic baseline | 75.00% | 87.88% | 90.91% | 82.58% | 84.28% |
| BGE dense | 74.24% | 92.05% | 97.73% | 82.94% | 85.06% |
| Heuristic + BGE RRF hybrid | 74.24% | 97.73% | 100.00% | 83.67% | 86.95% |

The correct architecture direction is therefore hybrid retrieval, not dense-only replacement.

## New boundary

`server/retrieval/productionRetriever.ts` now owns first-stage retrieval selection.

```text
Question + documents
        ↓
ProductionRetriever
        ↓
   configured mode
   ┌───────────────┐
   │               │
heuristic        hybrid
   │               │
existing      heuristic ranking
retriever          +
               BGE dense ranking
                    ↓
                  RRF
                    ↓
             ranked candidates
```

Default mode remains:

```text
heuristic
```

Hybrid mode can be requested explicitly by code or through:

```text
KNOWLEDGE_AI_RETRIEVAL_MODE=hybrid
```

The environment switch is intentionally not enabled by default.

## Dense index lifecycle

The boundary caches the dense retriever per tenant + knowledge base.

The cache signature is derived from the indexed chunks' IDs and content hashes.

```text
same KB + same chunk content
        ↓
reuse document embeddings

changed KB/chunk content
        ↓
rebuild document embeddings
```

This avoids recomputing document vectors on every query while keeping cache invalidation tied to document content.

A vector database is still out of scope. The current corpus size does not justify adding persistent vector infrastructure yet.

## Safe fallback

Hybrid retrieval is not allowed to become a single point of failure.

If model loading, document embedding, query embedding, or dense search fails:

```text
hybrid requested
      ↓
dense path fails
      ↓
heuristic-fallback
      ↓
existing candidate retrieval continues
```

The boundary returns the fallback reason for diagnostics.

## Important trust rule

RRF and cosine similarity are ranking signals.

They are **not** answer confidence.

For this reason the boundary does not convert the RRF score into the existing `combinedScore` confidence-like signal used later by heuristic reranking/evidence sufficiency.

Existing heuristic scores are preserved where they exist. Dense-only rescue candidates deliberately carry zero heuristic confidence until the downstream semantic reranking/evidence-sufficiency behavior is benchmarked separately.

This prevents a high dense similarity or fused rank from silently bypassing the existing abstention controls.

## Blocking benchmark

Run:

```bash
npm run check:retrieval:hybrid-boundary
```

The check verifies:

1. default retrieval remains heuristic;
2. hybrid mode runs through the new boundary;
3. frozen answerable retrieval quality remains above the measured promotion floor;
4. hybrid failure falls back to heuristic candidates instead of breaking retrieval.

Blocking floors:

```text
Recall@5  >= 95%
Recall@10 >= 99%
MRR       >= 82%
```

These thresholds protect the demonstrated retrieval improvement without pretending the benchmark is large enough to justify overly precise production guarantees.

## What is intentionally unchanged

This phase does not change:

- evidence sufficiency thresholds;
- post-generation grounding gate;
- claim verification;
- citation behavior;
- heuristic second-stage reranking;
- default production retrieval mode;
- persistence/vector database architecture.

## Next step

The next change should benchmark the **full answering pipeline** with hybrid candidates flowing through reranking and evidence sufficiency.

That benchmark must answer two questions separately:

1. Do semantically rescued passages survive second-stage reranking and improve answerable-question recall?
2. Does the system preserve or improve refusal behavior for no-evidence questions?

Only after both are measured should `hybrid` become the production default.

If the heuristic reranker suppresses dense-only rescues, introduce a retrieval/reranking contract that treats RRF rank as a ranking feature without treating it as calibrated confidence.

After hybrid production promotion, the next model experiment can evaluate a learned cross-encoder reranker.
