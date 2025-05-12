/**
 * In-memory fallback storage for graph operations when Memgraph is unavailable
 * This is a simple implementation for development and testing
 */

import { log } from "../vite";
import type { BubbleNode, Edge } from "../../client/src/types";

class FallbackStorage {
  private nodes: Map<string, BubbleNode>;
  private edges: Map<string, Edge>;
  
  constructor() {
    this.nodes = new Map<string, BubbleNode>();
    this.edges = new Map<string, Edge>();
    log("Initializing fallback in-memory graph storage", "fallback-storage");
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
      relationship,
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
  
  getAllNodes(
    page: number = 0, 
    pageSize: number = 50, 
    nodeType: string = 'all'
  ): { nodes: BubbleNode[], total: number } {
    const nodeArray: BubbleNode[] = [];
    this.nodes.forEach(node => nodeArray.push({...node}));
    
    // Filter by node type if specified
    let filteredNodes = nodeArray;
    if (nodeType !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.type === nodeType);
    }
    
    // Apply pagination
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
    nodeType: string = 'all'
  ): { nodes: BubbleNode[], total: number } {
    return this.getAllNodes(page, pageSize, nodeType);
  }
  
  getAllEdges(
    page: number = 0, 
    pageSize: number = 50, 
    relationshipType: string = 'all'
  ): { edges: Edge[], total: number } {
    const edgeArray: Edge[] = [];
    this.edges.forEach(edge => edgeArray.push({...edge}));
    
    // Filter by relationship type if specified
    let filteredEdges = edgeArray;
    if (relationshipType !== 'all') {
      filteredEdges = filteredEdges.filter(edge => edge.relationship === relationshipType);
    }
    
    // Apply pagination
    const total = filteredEdges.length;
    const start = page * pageSize;
    const end = start + pageSize;
    
    const edges = filteredEdges.slice(start, end);
    
    return { edges, total };
  }
  
  // For compatibility with graphService.ts 
  getEdgesByRelationship(
    page: number = 0, 
    pageSize: number = 50, 
    relationshipType: string = 'all'
  ): { edges: Edge[], total: number } {
    return this.getAllEdges(page, pageSize, relationshipType);
  }
  
  getNodeNeighbors(nodeId: string): { node: BubbleNode, relationship: string }[] {
    const neighbors: { node: BubbleNode, relationship: string }[] = [];
    
    // Find all edges connected to the node
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
  
  // For compatibility with graphService.ts
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
  
  // Clear all data (for testing)
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    log("Cleared all data in fallback storage", "fallback-storage");
  }
}

// Export a singleton instance
export const fallbackStorage = new FallbackStorage();