# Knowledge AI Product Direction

## Positioning

**Knowledge AI is a trustworthy private document assistant for teams.**

The product is not sold as “GraphRAG”, “CRAG”, “multi-agent mediation”, or a collection of AI phases. Those systems are internal mechanisms used to make the answer more reliable.

The user-facing promise is simpler:

> Upload authoritative company documents, ask questions, receive source-backed answers, and get a clear refusal when the evidence is not there.

## Primary users

The first target users should be small and medium teams that already have important knowledge trapped in PDFs and internal documents:

- HR / policy teams
- operations teams using SOPs and manuals
- customer-support teams using product documentation
- software teams using runbooks and technical documentation
- training and onboarding teams
- consultancies creating private knowledge assistants for clients

## Core jobs to be done

### 1. Find an answer quickly

A user should not have to manually open multiple PDFs and search each one.

### 2. Verify the answer

Every material factual answer should make it easy to inspect the supporting source.

### 3. Know when the system does not know

A high-quality refusal is better than a plausible unsupported answer.

### 4. Ask follow-up questions naturally

Conversational context should resolve references such as “it”, “that policy”, “that model”, or “the second location” without treating prior assistant output as authoritative evidence.

## Default product surface

The normal user experience should emphasize:

- **Ask**
- **Documents**
- **Sources / citations**
- **Assistant settings**
- **Quality**

Advanced capabilities should remain available for developers/admins:

- retrieval diagnostics
- cognitive execution traces
- GraphRAG traversal
- CRAG decisions
- provider telemetry
- memory / learning experiments
- orchestration
- API / SaaS tooling

## Trust contract

Knowledge AI should follow these invariants:

1. Workspace documents are the authoritative factual source unless a workspace explicitly enables external knowledge.
2. Retrieval runs on every grounded factual turn.
3. Assistant chat history may help resolve the question, but does not become authoritative evidence.
4. Generated claims must be checked against retrieved evidence.
5. Citations must point to evidence actually used to support the answer.
6. Insufficient evidence should produce an abstention/refusal.
7. Production benchmark scores must not depend on hard-coded benchmark answers.
8. Simulated provider behavior must never be presented as measured live-provider performance.
9. Estimated telemetry must be labeled as estimated.
10. Security and tenant isolation outrank answer convenience.

## Provider strategy

Do not call multiple paid models for every request.

Recommended routing:

```text
Normal grounded question
        ↓
Primary provider
        ↓
claim verification
        ↓
answer
```

For high-risk or difficult requests:

```text
retrieval
   ↓
primary model answer
   +
independent verifier model
   ↓
disagreement / evidence arbitration
   ↓
final answer or abstention
```

For provider outages:

```text
primary provider
   ↓ failure / rate limit
fallback provider
```

A second provider should be added only after baseline metrics are trustworthy enough to prove whether it improves correctness, reliability, or refusal behavior.

## MVP success criteria

The first strong product milestone is not “more features”. It is a reliable document assistant that can demonstrate:

- strong retrieval recall
- strong citation precision
- low unsupported-claim rate
- high refusal accuracy
- low false-refusal rate
- correct conversational follow-up behavior
- acceptable response latency
- clear source inspection UX

## Non-goals for the current milestone

- generic open-domain chatbot
- autonomous company agent
- large marketplace of agents
- dozens of model providers
- self-modifying production knowledge
- claiming enterprise readiness from simulated telemetry

Those can be explored later if the core document-answering product proves useful and trustworthy.
