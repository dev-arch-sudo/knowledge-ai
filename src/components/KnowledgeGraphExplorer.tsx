/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Knowledge Graph Explorer (Open-Source GraphRAG Inspired)
 * Interactive visual explorer for extracted entity nodes, properties,
 * and directed multi-hop relationships.
 */

import React, { useState, useEffect } from 'react';
import {
  Share2,
  Search,
  RotateCw,
  Layers,
  ArrowRight,
  Database,
  Tag,
  CheckCircle2,
  Filter,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  properties: Record<string, any>;
  documentSources: Array<{
    documentId: string;
    documentName: string;
    pageNumber: number;
    snippet: string;
  }>;
}

interface GraphEdge {
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

interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const KnowledgeGraphExplorer: React.FC = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [traversalStart, setTraversalStart] = useState<string>('');
  const [traversalEnd, setTraversalEnd] = useState<string>('');
  const [traversalPath, setTraversalPath] = useState<string[] | null>(null);

  const fetchGraph = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/cognitive/graph');
      const data = await res.json();
      if (res.ok && data.success) {
        setGraphData(data.graph);
        if (data.graph.nodes.length > 0 && !selectedNode) {
          setSelectedNode(data.graph.nodes[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load knowledge graph:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Get distinct node types
  const distinctTypes = Array.from(new Set(nodes.map((n) => n.type)));

  // Filter nodes
  const filteredNodes = nodes.filter((n) => {
    const matchesSearch =
      searchTerm === '' ||
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.aliases.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'ALL' || n.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Calculate connected edges for selected node
  const connectedOutgoing = selectedNode
    ? edges.filter((e) => e.sourceId === selectedNode.id)
    : [];
  const connectedIncoming = selectedNode
    ? edges.filter((e) => e.targetId === selectedNode.id)
    : [];

  // Execute path finding traversal
  const handleFindPath = () => {
    if (!traversalStart.trim() || !traversalEnd.trim() || !graphData) return;
    const sLower = traversalStart.toLowerCase();
    const eLower = traversalEnd.toLowerCase();

    const startNode = nodes.find(
      (n) => n.name.toLowerCase().includes(sLower) || n.aliases.some((a) => a.toLowerCase().includes(sLower))
    );
    const endNode = nodes.find(
      (n) => n.name.toLowerCase().includes(eLower) || n.aliases.some((a) => a.toLowerCase().includes(eLower))
    );

    if (!startNode || !endNode) {
      setTraversalPath([`Could not locate both entities in graph: "${traversalStart}" and "${traversalEnd}"`]);
      return;
    }

    if (startNode.id === endNode.id) {
      setTraversalPath([`Start and destination entities are identical: [${startNode.name}]`]);
      return;
    }

    // Direct edge?
    const directEdge = edges.find((e) => e.sourceId === startNode.id && e.targetId === endNode.id);
    if (directEdge) {
      setTraversalPath([
        `Direct 1-Hop Relation: [${startNode.name}] --(${directEdge.predicate})--> [${endNode.name}] (Page ${directEdge.pageNumber})`,
      ]);
      return;
    }

    // 2-Hop search
    for (const e1 of edges.filter((e) => e.sourceId === startNode.id)) {
      const midNode = nodes.find((n) => n.id === e1.targetId);
      if (midNode) {
        const e2 = edges.find((e) => e.sourceId === midNode.id && e.targetId === endNode.id);
        if (e2) {
          setTraversalPath([
            `Step 1: [${startNode.name}] --(${e1.predicate})--> [${midNode.name}] (Page ${e1.pageNumber})`,
            `Step 2: [${midNode.name}] --(${e2.predicate})--> [${endNode.name}] (Page ${e2.pageNumber})`,
            `Resolved Multi-Hop Link via [${midNode.name}]`,
          ]);
          return;
        }
      }
    }

    setTraversalPath([
      `No direct 2-hop relational path detected between [${startNode.name}] and [${endNode.name}]. They exist in separate subgraphs.`,
    ]);
  };

  return (
    <div id="knowledge-graph-explorer" className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Knowledge Graph & Entity Relation Engine (GraphRAG)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Extracts fine-grained entity nodes, metadata properties, and directed relational triplets across all ingested PDF documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">Entities</span>
              <span className="font-bold text-indigo-700 font-mono text-sm">{nodes.length}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">Relations</span>
              <span className="font-bold text-purple-700 font-mono text-sm">{edges.length}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="text-center">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">Types</span>
              <span className="font-bold text-emerald-700 font-mono text-sm">{distinctTypes.length}</span>
            </div>
          </div>

          <button
            onClick={fetchGraph}
            disabled={isLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Graph"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Multi-Hop Path Traversal Sandbox */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-slate-50 rounded-xl border border-indigo-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Multi-Hop Relational Traversal Sandbox
          </h4>
        </div>
        <p className="text-[11px] text-slate-600 mb-3">
          Discover cross-document paths between two entities (e.g. "AR-40" and "120 robots" or "Singapore Central" and "Singapore").
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            placeholder="Start Entity (e.g. AR-40)"
            value={traversalStart}
            onChange={(e) => setTraversalStart(e.target.value)}
            className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <input
            type="text"
            placeholder="Target Entity (e.g. 12.0 kWh)"
            value={traversalEnd}
            onChange={(e) => setTraversalEnd(e.target.value)}
            className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleFindPath}
            className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Find Path
          </button>
        </div>

        {traversalPath && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-indigo-200 text-xs space-y-1">
            <span className="font-semibold text-slate-700 block mb-1">Traversal Results:</span>
            {traversalPath.map((step, idx) => (
              <div key={idx} className="font-mono text-[11px] text-indigo-900 bg-indigo-50/50 p-1 rounded">
                {step}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Entity Catalog + Selected Node Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Entity Node List */}
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col h-[520px]">
          {/* Filter & Search */}
          <div className="space-y-2 mb-3 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search entities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Type selector */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedType('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                  selectedType === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({nodes.length})
              </button>
              {distinctTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                    selectedType === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Node Items List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredNodes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No entities found matching filters.
              </div>
            ) : (
              filteredNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                    selectedNode?.id === node.id
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900'
                      : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px] truncate">{node.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-white border border-slate-200 text-slate-500">
                      {node.type}
                    </span>
                  </div>
                  {node.aliases.length > 0 && (
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      Alias: {node.aliases.join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Selected Node Details & Connected Relations */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-[520px] overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="border-b border-slate-100 pb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{selectedNode.name}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                      {selectedNode.type}
                    </span>
                  </div>
                  {selectedNode.aliases.length > 0 && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Known Aliases: {selectedNode.aliases.join(' • ')}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-400">ID: {selectedNode.id}</span>
              </div>

              {/* Node Properties */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  Extracted Properties & Attributes
                </h5>
                {Object.keys(selectedNode.properties).length === 0 ? (
                  <div className="text-xs text-slate-400 italic">No structured properties recorded.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedNode.properties).map(([k, v]) => (
                      <div key={k} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <span className="text-slate-400 font-mono text-[10px] block">{k}:</span>
                        <span className="font-semibold text-slate-800">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Connected Outgoing Relationships */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                  Outgoing Directed Relationships ({connectedOutgoing.length})
                </h5>
                {connectedOutgoing.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">No outgoing edges.</div>
                ) : (
                  <div className="space-y-1.5">
                    {connectedOutgoing.map((edge) => {
                      const target = nodes.find((n) => n.id === edge.targetId);
                      return (
                        <div key={edge.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              --({edge.predicate})--&gt;
                            </span>
                            <span className="font-semibold text-slate-800">
                              {target ? target.name : edge.targetId}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Page {edge.pageNumber} ({edge.documentName})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Connected Incoming Relationships */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
                  Incoming Directed Relationships ({connectedIncoming.length})
                </h5>
                {connectedIncoming.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">No incoming edges.</div>
                ) : (
                  <div className="space-y-1.5">
                    {connectedIncoming.map((edge) => {
                      const source = nodes.find((n) => n.id === edge.sourceId);
                      return (
                        <div key={edge.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {source ? source.name : edge.sourceId}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              --({edge.predicate})--&gt;
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Page {edge.pageNumber}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Document Grounding Citations */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                  Document Grounding Sources
                </h5>
                <div className="space-y-1.5">
                  {selectedNode.documentSources.map((src, idx) => (
                    <div key={idx} className="p-2 bg-indigo-50/40 rounded-lg border border-indigo-100 text-xs text-slate-700">
                      <div className="font-semibold text-indigo-900 text-[11px] mb-0.5">
                        {src.documentName} (Page {src.pageNumber})
                      </div>
                      <p className="text-[11px] text-slate-600 italic">"{src.snippet}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Select an entity node from the left to inspect properties and graph connections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
