# Retrieval Benchmark

This benchmark measures retrieval quality independently from answer generation.

It uses the project's built-in sample documents:

- `Apex-1000 Compressor Operations Manual.pdf`
- `Facility Safety & Compliance Protocol.pdf`

The benchmark intentionally uses the same production parsing and chunking path before retrieval. Each question has manually verified source judgments expressed as document + page + required passage terms, rather than unstable generated chunk IDs.

## Why this exists

Before introducing dense embeddings, Hugging Face models, hybrid retrieval, or a learned reranker, Knowledge AI needs a reproducible baseline for the retrieval system it already has.

The current production retriever is heuristic. Its so-called `semanticScore` is phrase/bigram overlap rather than dense-vector similarity. This benchmark makes that baseline measurable so later model changes can be compared honestly.

## Dataset

The first version contains direct factual questions, paraphrases, terminology mismatch questions, multi-passage questions, an ambiguous pressure question, and no-evidence questions.

The file `retrieval-cases.json` is deliberately data-only so the benchmark can grow beyond 100 questions without changing evaluation code.

A source judgment looks like:

```json
{
  "question": "What pressure does the Apex-1000 operate at under nominal production load?",
  "expectedSources": [
    {
      "document": "Apex-1000 Compressor Operations Manual.pdf",
      "page": 2,
      "contains": ["50 PSI", "nominal production load"]
    }
  ]
}
```

For multi-passage questions, more than one expected source is listed. A benchmark case receives partial Recall@K credit if only some required passages are retrieved.

## Metrics

The harness reports the current first-stage retriever and heuristic reranker separately:

- Recall@1
- Recall@5
- Recall@10
- MRR
- nDCG@10
- no-evidence abstention rate

### Recall@K

For a question with one relevant passage, Recall@5 asks whether that passage appears in the top five results.

For questions with multiple required passages, Recall@K is the fraction of expected passages recovered in the top K.

### MRR

Mean Reciprocal Rank rewards putting the first relevant passage near the top. A relevant result at rank 1 scores 1.0, rank 2 scores 0.5, rank 4 scores 0.25, and so on.

### nDCG@10

nDCG measures ranking quality across multiple relevant passages and penalizes placing them lower in the result list.

## Running

```bash
npm run benchmark:retrieval
```

The script first verifies that every expected source judgment actually resolves to a production chunk. If a document/parser/chunker change makes a judgment invalid, the benchmark fails rather than silently measuring the wrong thing.

## Evaluation discipline

The first CI run establishes the pre-embedding baseline. Once measured, regression thresholds should be pinned slightly below that observed baseline. Future retrieval changes should then be compared on the exact same questions before any claim that a new embedding or reranking model is better.

When Hugging Face embeddings are introduced, compare at least:

1. current heuristic retriever
2. dense bi-encoder retrieval
3. hybrid lexical + dense retrieval

Use the same source judgments and metrics for all three.
