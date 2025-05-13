/**
 * In-memory fallback storage for graph operations when Memgraph is unavailable
 * This is a simple implementation for development and testing
 */

import { log } from "../vite";
import type { BubbleNode, Edge, RelationshipType } from "../../client/src/types";

class FallbackStorage {
  private nodes: Map<string, BubbleNode>;
  private edges: Map<string, Edge>;
  
  constructor() {
    this.nodes = new Map<string, BubbleNode>();
    this.edges = new Map<string, Edge>();
    log("Initializing fallback in-memory graph storage", "fallback-storage");
  }
  
  // Debug methods
  debug_getNodesSize(): number {
    return this.nodes.size;
  }
  
  debug_dumpNodes(): void {
    log(`Current nodes in fallback storage: ${this.nodes.size}`, "fallback-storage-debug");
    this.nodes.forEach((node, id) => {
      log(`Node ${id}: ${node.type} - ${node.content?.substring(0, 30)}...`, "fallback-storage-debug");
    });
  }
  
  // Node operations
  
  createNode(node: BubbleNode): BubbleNode {
    this.nodes.set(node.id, { ...node });
    log(`Created node in fallback storage: ${node.id}`, "fallback-storage");
    return { ...node };
  }
  
  getNode(id: string): BubbleNode | null {
    const node = this.nodes.get(id);
    return node ? { ...node } : null;
  }
  
  updateNode(id: string, updates: Partial<BubbleNode>): BubbleNode | null {
    const node = this.nodes.get(id);
    if (!node) {
      return null;
    }
    
    const updatedNode = { ...node, ...updates };
    this.nodes.set(id, updatedNode);
    return { ...updatedNode };
  }
  
  deleteNode(id: string): boolean {
    // Delete all connected edges
    const edgesToDelete: string[] = [];
    
    this.edges.forEach((edge, edgeId) => {
      if (edge.source === id || edge.target === id) {
        edgesToDelete.push(edgeId);
      }
    });
    
    // Delete the edges
    edgesToDelete.forEach(edgeId => this.edges.delete(edgeId));
    
    return this.nodes.delete(id);
  }
  
  // Edge operations
  
  createEdge(
    sourceId: string, 
    targetId: string, 
    relationship: string, 
    properties: Record<string, any> = {}
  ): Edge | null {
    // Check if source and target nodes exist
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      log(`Failed to create edge, nodes not found: ${sourceId} -> ${targetId}`, "fallback-storage");
      return null;
    }
    
    const edgeId = `${sourceId}-${relationship}-${targetId}`;
    
    // Set default strength if not provided
    if (!('strength' in properties)) {
      properties.strength = 0.7;
    }
    
    const edge: Edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      relationship: relationship as RelationshipType,
      strength: properties.strength,
      ...properties
    };
    
    this.edges.set(edgeId, edge);
    log(`Created edge in fallback storage: ${edgeId}`, "fallback-storage");
    
    return { ...edge };
  }
  
  getEdge(id: string): Edge | null {
    const edge = this.edges.get(id);
    return edge ? { ...edge } : null;
  }
  
  updateEdge(id: string, updates: Partial<Edge>): Edge | null {
    const edge = this.edges.get(id);
    if (!edge) {
      return null;
    }
    
    const updatedEdge = { ...edge, ...updates };
    this.edges.set(id, updatedEdge);
    return { ...updatedEdge };
  }
  
  deleteEdge(id: string): boolean {
    return this.edges.delete(id);
  }
  
  // Query operations
  
  // vectorSearch method REMOVED as per CG-21
  // findRelatedNodes method REMOVED as per CG-21

  /**
   * Calculate cosine similarity between two vectors
   * Returns a value between -1 and 1, where 1 is most similar
   * This can remain as a utility if needed elsewhere, or be moved to a util file.
   * For now, keeping it here as it's not directly tied to Qdrant.
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      const minLength = Math.min(vecA.length, vecB.length);
      vecA = vecA.slice(0, minLength);
      vecB = vecB.slice(0, minLength);
      log(`Vector dimensions don't match, truncating to ${minLength}`, "fallback-storage");
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  getAllNodes(
    page: number = 0, 
    pageSize: number = 50, 
    nodeType: string | null = 'all'
  ): { nodes: BubbleNode[], total: number } {
    log(`getAllNodes called with page=${page}, pageSize=${pageSize}, nodeType=${nodeType}`, "fallback-storage-debug");
    const nodeArray: BubbleNode[] = [];
    this.nodes.forEach(node => nodeArray.push({...node}));
    
    const effectiveNodeType = nodeType === null ? 'all' : nodeType;
    
    let filteredNodes = nodeArray;
    if (effectiveNodeType !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.type === effectiveNodeType);
    }
    
    const total = filteredNodes.length;
    const start = page * pageSize;
    const end = start + pageSize;
    
    const nodes = filteredNodes.slice(start, end);
    
    return { nodes, total };
  }
  
  // For compatibility with graphService.ts
  getNodesByType(
    page: number = 0, 
    pageSize: number = 50, 
    nodeType: string | null = 'all'
  ): { nodes: BubbleNode[], total: number } {
    return this.getAllNodes(page, pageSize, nodeType);
  }
  
  getAllEdges(
    page: number = 0, 
    pageSize: number = 50, 
    relationshipType: string | null = 'all'
  ): { edges: Edge[], total: number } {
    log(`getAllEdges called with page=${page}, pageSize=${pageSize}, relationshipType=${relationshipType}`, "fallback-storage-debug");
    const edgeArray: Edge[] = [];
    this.edges.forEach(edge => edgeArray.push({...edge}));
    
    const effectiveRelType = relationshipType === null ? 'all' : relationshipType;
    
    let filteredEdges = edgeArray;
    if (effectiveRelType !== 'all') {
      filteredEdges = filteredEdges.filter(edge => edge.relationship === effectiveRelType);
    }
    
    const total = filteredEdges.length;
    const start = page * pageSize;
    const end = start + pageSize;
    
    const edges = filteredEdges.slice(start, end);
    
    return { edges, total };
  }
  
  getEdgesByRelationship(
    page: number = 0, 
    pageSize: number = 50, 
    relationshipType: string | null = 'all'
  ): { edges: Edge[], total: number } {
    return this.getAllEdges(page, pageSize, relationshipType);
  }
  
  getNodeNeighbors(nodeId: string): { node: BubbleNode, relationship: string }[] {
    const neighbors: { node: BubbleNode, relationship: string }[] = [];
    
    this.edges.forEach(edge => {
      if (edge.source === nodeId) {
        const targetNode = this.nodes.get(edge.target);
        if (targetNode) {
          neighbors.push({
            node: { ...targetNode },
            relationship: edge.relationship || 'related_to'
          });
        }
      } else if (edge.target === nodeId) {
        const sourceNode = this.nodes.get(edge.source);
        if (sourceNode) {
          neighbors.push({
            node: { ...sourceNode },
            relationship: edge.relationship || 'related_to'
          });
        }
      }
    });
    
    return neighbors;
  }
  
  addNode(node: BubbleNode): BubbleNode {
    return this.createNode(node);
  }
  
  addEdge(
    sourceId: string, 
    targetId: string, 
    relationship: string, 
    properties: Record<string, any> = {}
  ): Edge | null {
    return this.createEdge(sourceId, targetId, relationship, properties);
  }
  
  getStats(): { nodeCount: number, edgeCount: number } {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size
    };
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    log("Cleared all data in fallback storage", "fallback-storage");
  }
}

// Export a singleton instance
export const fallbackStorage = new FallbackStorage();