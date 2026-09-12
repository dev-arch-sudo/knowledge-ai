# Unseen-Corpus Effectiveness Benchmark

## Goal

Measure whether Knowledge AI can answer questions from documents that were not used to design the engine or its prior benchmark fixtures.

The benchmark must evaluate product trust, not benchmark-specific memorization.

## Corpus

Use a synthetic but realistic operations handbook for a fictional company unrelated to Aurora Robotics. The benchmark corpus should contain:

- company policy facts
- product/service specifications
- regional office information
- support/SLA rules
- an employee onboarding policy
- at least one structured table
- at least one relationship that requires combining evidence from two sections
- explicit unknown / undocumented information

## Evaluation categories

1. Direct factual retrieval
2. Entity and attribute lookup
3. Multi-hop synthesis
4. Comparison
5. Table lookup / arithmetic
6. Contradiction correction
7. Follow-up conversational resolution
8. Multilingual retrieval
9. Unsupported-question refusal
10. Citation accuracy

## Core metrics

- Answer accuracy
- Retrieval hit rate
- Citation precision
- Grounding score
- Correct refusal rate
- False refusal rate
- Unsupported-claim rate
- Conversation follow-up accuracy
- Multilingual answer accuracy
- Per-query latency

## Rules

- No benchmark answer may be hard-coded into production reasoning code.
- The production cognitive engine must remain corpus-agnostic.
- Benchmark fixtures can contain expected answers, but only inside benchmark files.
- A passing result requires source-backed answers, not keyword-only answer matching.
- Unsupported questions should be refused rather than answered from general model knowledge.

## Initial quality targets

These are goals, not claims of current performance:

- >= 90% answer accuracy
- >= 95% citation precision
- >= 95% correct-refusal rate
- <= 5% false-refusal rate
- <= 3% unsupported-claim rate

The benchmark report must clearly distinguish measured metrics from targets.
