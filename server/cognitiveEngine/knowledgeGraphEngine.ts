/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Corpus-agnostic in-memory knowledge graph.
 * Entities and relationships are extracted only from uploaded document text.
 */

export type EntityType =
  | 'SYSTEM'
  | 'FACILITY'
  | 'ROBOT_MODEL'
  | 'METRIC'
  | 'NUMERIC_QUANTITY'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'TEMPORAL_ANCHOR'
  | 'POLICY_OR_STANDARD'
  | 'COMPONENT';

export interface GraphNode {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  properties: Record<string, any>;
  documentSources: Array<{
    documentId: string;
    documentName: string;
    pageNumber: number;
    snippet: string;
  }>;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  predicate: string;
  weight: number;
  confidence: number;
  pageNumber: number;
  documentName: string;
  snippet: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function titleCaseCandidates(text: string): string[] {
  const matches = text.match(/\b(?:[A-Z][A-Za-z0-9&'\-]*)(?:\s+[A-Z][A-Za-z0-9&'\-]*){0,4}\b/g) || [];
  return Array.from(new Set(matches.map((item) => item.trim()).filter((item) => item.length >= 3))).slice(0, 40);
}

function inferType(name: string): EntityType {
  const lower = name.toLowerCase();
  if (/\b(policy|standard|procedure|rule|guideline)\b/.test(lower)) return 'POLICY_OR_STANDARD';
  if (/\b(office|hub|center|centre|facility|branch|site|depot|warehouse|campus)\b/.test(lower)) return 'FACILITY';
  if (/\b(company|corporation|corp|inc|ltd|limited|group|organization|organisation)\b/.test(lower)) return 'ORGANIZATION';
  if (/\b(system|service|platform|application|app)\b/.test(lower)) return 'SYSTEM';
  return 'COMPONENT';
}

export class KnowledgeGraphEngine {
  private graphs: Map<string, KnowledgeGraphData> = new Map();

  public getOrCreateGraph(tenantId: string, kbId: string): KnowledgeGraphData {
    const key = `${tenantId}:${kbId}`;
    let graph = this.graphs.get(key);
    if (!graph) {
      graph = { nodes: [], edges: [] };
      this.graphs.set(key, graph);
    }
    return graph;
  }

  public addNode(
    tenantId: string,
    kbId: string,
    node: Omit<GraphNode, 'id'> & { id?: string }
  ): GraphNode {
    const graph = this.getOrCreateGraph(tenantId, kbId);
    const existing = graph.nodes.find(
      (candidate) =>
        candidate.name.toLowerCase() === node.name.toLowerCase() ||
        candidate.aliases.some((alias) => alias.toLowerCase() === node.name.toLowerCase())
    );

    if (existing) {
      existing.properties = { ...existing.properties, ...node.properties };
      for (const alias of node.aliases || []) {
        if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
      }
      for (const source of node.documentSources || []) {
        if (!existing.documentSources.some((item) => item.pageNumber === source.pageNumber && item.snippet === source.snippet)) {
          existing.documentSources.push(source);
        }
      }
      return existing;
    }

    const created: GraphNode = {
      id: node.id || `node_${node.type.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`,
      name: node.name,
      type: node.type,
      aliases: node.aliases || [],
      properties: node.properties || {},
      documentSources: node.documentSources || [],
    };
    graph.nodes.push(created);
    return created;
  }

  public addEdge(
    tenantId: string,
    kbId: string,
    edge: {
      sourceName: string;
      sourceType: EntityType;
      targetName: string;
      targetType: EntityType;
      predicate: string;
      documentName: string;
      pageNumber: number;
      snippet: string;
      confidence?: number;
    }
  ): GraphEdge {
    const graph = this.getOrCreateGraph(tenantId, kbId);
    const source = this.addNode(tenantId, kbId, {
      name: edge.sourceName,
      type: edge.sourceType,
      aliases: [],
      properties: {},
      documentSources: [{ documentId: 'doc', documentName: edge.documentName, pageNumber: edge.pageNumber, snippet: edge.snippet }],
    });
    const target = this.addNode(tenantId, kbId, {
      name: edge.targetName,
      type: edge.targetType,
      aliases: [],
      properties: {},
      documentSources: [{ documentId: 'doc', documentName: edge.documentName, pageNumber: edge.pageNumber, snippet: edge.snippet }],
    });

    const existing = graph.edges.find(
      (candidate) =>
        candidate.sourceId === source.id &&
        candidate.targetId === target.id &&
        candidate.predicate.toLowerCase() === edge.predicate.toLowerCase()
    );
    if (existing) {
      existing.weight += 1;
      return existing;
    }

    const created: GraphEdge = {
      id: `edge_${Math.random().toString(36).slice(2, 8)}`,
      sourceId: source.id,
      targetId: target.id,
      predicate: edge.predicate.toUpperCase(),
      weight: 1,
      confidence: edge.confidence ?? 0.8,
      pageNumber: edge.pageNumber,
      documentName: edge.documentName,
      snippet: edge.snippet,
    };
    graph.edges.push(created);
    return created;
  }

  public extractAndIndexDocument(
    tenantId: string,
    kbId: string,
    docName: string,
    pages: Array<{ pageNumber: number; text: string }>
  ): void {
    for (const page of pages) {
      const text = page.text || '';
      const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

      for (const candidate of titleCaseCandidates(text)) {
        this.addNode(tenantId, kbId, {
          name: candidate,
          type: inferType(candidate),
          aliases: [],
          properties: {},
          documentSources: [{
            documentId: 'doc',
            documentName: docName,
            pageNumber: page.pageNumber,
            snippet: candidate,
          }],
        });
      }

      for (const line of lines) {
        const patterns: Array<{ regex: RegExp; predicate: string }> = [
          { regex: /^(.{2,70}?)\s+(?:is|are)\s+(?:located|based)\s+in\s+(.{2,70}?)(?:\.|$)/i, predicate: 'LOCATED_IN' },
          { regex: /^(.{2,70}?)\s+(requires|uses|includes|contains|provides|supports|operates|maintains|owns|manages)\s+(.{2,90}?)(?:\.|$)/i, predicate: 'RELATES_TO' },
          { regex: /^(.{2,70}?):\s*(.{2,100})$/, predicate: 'HAS_ATTRIBUTE' },
        ];

        for (const pattern of patterns) {
          const match = line.match(pattern.regex);
          if (!match) continue;
          const subject = match[1].trim();
          const object = (match[3] || match[2] || '').trim();
          if (!subject || !object || subject.length > 80 || object.length > 110) continue;

          const predicate = pattern.predicate === 'RELATES_TO' && match[2]
            ? String(match[2]).trim().toUpperCase().replace(/\s+/g, '_')
            : pattern.predicate;

          this.addEdge(tenantId, kbId, {
            sourceName: subject,
            sourceType: inferType(subject),
            targetName: object,
            targetType: /\d/.test(object) ? 'METRIC' : inferType(object),
            predicate,
            documentName: docName,
            pageNumber: page.pageNumber,
            snippet: line,
            confidence: pattern.predicate === 'HAS_ATTRIBUTE' ? 0.75 : 0.85,
          });
          break;
        }
      }
    }
  }

  public queryGraph(
    tenantId: string,
    kbId: string,
    queryTerms: string[],
    maxDepth: number = 2
  ): {
    matchedNodes: GraphNode[];
    connectedEdges: GraphEdge[];
    graphSummary: string;
    pathExplanations: string[];
  } {
    const graph = this.getOrCreateGraph(tenantId, kbId);
    if (graph.nodes.length === 0) {
      return { matchedNodes: [], connectedEdges: [], graphSummary: '', pathExplanations: [] };
    }

    const matchedNodes = new Set<GraphNode>();
    const connectedEdges = new Set<GraphEdge>();
    const paths: string[] = [];

    for (const node of graph.nodes) {
      const haystack = [node.name, ...node.aliases, ...Object.values(node.properties).map(String)].join(' ').toLowerCase();
      if (queryTerms.some((term) => term.length > 2 && haystack.includes(term.toLowerCase()))) {
        matchedNodes.add(node);
      }
    }

    let frontier = Array.from(matchedNodes);
    const visited = new Set(frontier.map((node) => node.id));
    for (let depth = 0; depth < Math.max(1, maxDepth) && frontier.length > 0; depth++) {
      const next: GraphNode[] = [];
      for (const node of frontier) {
        for (const edge of graph.edges) {
          let neighbour: GraphNode | undefined;
          if (edge.sourceId === node.id) neighbour = graph.nodes.find((item) => item.id === edge.targetId);
          else if (edge.targetId === node.id) neighbour = graph.nodes.find((item) => item.id === edge.sourceId);
          if (!neighbour) continue;

          connectedEdges.add(edge);
          matchedNodes.add(neighbour);
          const source = graph.nodes.find((item) => item.id === edge.sourceId);
          const target = graph.nodes.find((item) => item.id === edge.targetId);
          if (source && target) {
            paths.push(`[${source.name}] --(${edge.predicate})--> [${target.name}] (Source: ${edge.documentName} p.${edge.pageNumber})`);
          }
          if (!visited.has(neighbour.id)) {
            visited.add(neighbour.id);
            next.push(neighbour);
          }
        }
      }
      frontier = next;
    }

    const nodes = Array.from(matchedNodes);
    const edges = Array.from(connectedEdges);
    const graphSummary = nodes.slice(0, 15).map((node) => {
      const properties = Object.entries(node.properties).map(([key, value]) => `${key}: ${value}`).join(', ');
      return `Entity [${node.name}] (${node.type})${properties ? ` {${properties}}` : ''}`;
    }).join('\n');

    return {
      matchedNodes: nodes,
      connectedEdges: edges,
      graphSummary,
      pathExplanations: paths.slice(0, 30),
    };
  }
}

export const knowledgeGraphEngine = new KnowledgeGraphEngine();
