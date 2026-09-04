import { AgentDefinition } from './types.js';

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();

  constructor() {
    this.seedDefaultAgents();
  }

  private seedDefaultAgents() {
    // 1. Research Agent
    this.registerAgent({
      id: 'agent-researcher-1',
      name: 'Primary Research Agent',
      role: 'Literature and documentation factual extraction',
      provider: 'mock',
      capabilities: ['document_search', 'citation_extraction', 'fact_retrieval'],
      isExternal: true,
      untrusted: true,
    });

    // 2. Technical Analyst Agent
    this.registerAgent({
      id: 'agent-analyst-1',
      name: 'Technical Verification Analyst',
      role: 'Procedural verification and numerical validation',
      provider: 'mock',
      capabilities: ['code_review', 'procedure_validation', 'numerical_check'],
      isExternal: true,
      untrusted: true,
    });

    // 3. Safety & Compliance Agent
    this.registerAgent({
      id: 'agent-compliance-1',
      name: 'Regulatory & Compliance Agent',
      role: 'Cross-document policy audit and safety boundary checking',
      provider: 'mock',
      capabilities: ['compliance_audit', 'regulatory_review', 'refusal_check'],
      isExternal: true,
      untrusted: true,
    });

    // 4. Synthesis Agent
    this.registerAgent({
      id: 'agent-synthesis-1',
      name: 'Consensus Synthesis Agent',
      role: 'Multi-agent output consolidation and disagreement summarization',
      provider: 'mock',
      capabilities: ['synthesis', 'aggregation', 'conflict_resolution'],
      isExternal: true,
      untrusted: true,
    });

    // 5. Independent Verification Agent (Section 34)
    this.registerAgent({
      id: 'agent-verifier-1',
      name: 'Independent Verification Agent',
      role: 'External third-party claim inspection prior to Knowledge AI grounding',
      provider: 'mock',
      capabilities: ['independent_audit', 'contradiction_hunting', 'claim_isolation'],
      isExternal: true,
      untrusted: true,
    });

    // 6. Gemini-powered external agent (when API key available)
    this.registerAgent({
      id: 'agent-gemini-external',
      name: 'Gemini 2.5 Flash External Agent',
      role: 'General external reasoning via Gemini API',
      provider: 'gemini',
      modelIdentifier: 'gemini-2.5-flash',
      capabilities: ['multimodal_reasoning', 'complex_synthesis', 'cross_domain_inference'],
      isExternal: true,
      untrusted: true, // Untrusted external agent
    });
  }

  public registerAgent(agent: AgentDefinition): void {
    // Critical architectural enforcement: External / mediator agents are untrusted
    this.agents.set(agent.id, {
      ...agent,
      isExternal: true,
      untrusted: true,
    });
  }

  public getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  public listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  public findAgentsByCapability(capability: string): AgentDefinition[] {
    return Array.from(this.agents.values()).filter((a) =>
      a.capabilities.includes(capability)
    );
  }

  public reset(): void {
    this.agents.clear();
    this.seedDefaultAgents();
  }
}

export const agentRegistry = new AgentRegistry();
