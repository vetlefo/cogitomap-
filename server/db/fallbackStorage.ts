/**
 * Fallback in-memory graph storage for when Memgraph connection is unavailable
 * This provides temporary storage during the session to simulate graph operations
 */

import { log } from "../vite";
import type { BubbleNode, Edge } from "../../client/src/types";

// In-memory storage for graph data
class FallbackGraphStorage {
  private nodes: Map<string, BubbleNode> = new Map();
  private edges: Map<string, Edge> = new Map();
  private edgeCounter: number = 0;

  constructor() {
    log("Initializing fallback in-memory graph storage", "fallback-storage");
  }

  // Node operations
  public addNode(node: BubbleNode): BubbleNode {
    log(`Adding node to fallback storage: ${node.id}`, "fallback-storage");
    this.nodes.set(node.id, { ...node });
    return node;
  }

  public getNode(id: string): BubbleNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): BubbleNode[] {
    return Array.from(this.nodes.values());
  }

  public getNodesByType(type: string): BubbleNode[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  // Edge operations
  public addEdge(source: string, target: string, relationship: string, properties: Record<string, any> = {}): Edge {
    // Generate an edge ID if not provided
    const edgeId = `edge-${Date.now()}-${this.edgeCounter++}`;
    
    const edge: Edge = {
      id: edgeId,
      source,
      target,
      relationship: relationship as any, // Cast to the proper type
      strength: properties.strength || 0.5,
      ...properties
    };
    
    log(`Adding edge to fallback storage: ${source} -> ${target} (${relationship})`, "fallback-storage");
    this.edges.set(edgeId, edge);
    return edge;
  }

  public getEdge(id: string): Edge | undefined {
    return this.edges.get(id);
  }

  public getAllEdges(): Edge[] {
    return Array.from(this.edges.values());
  }

  public getEdgesByRelationship(relationship: string): Edge[] {
    return Array.from(this.edges.values()).filter(edge => edge.relationship === relationship);
  }

  public getNodeNeighbors(nodeId: string): { node: BubbleNode, relationship: string }[] {
    const neighbors: { node: BubbleNode, relationship: string }[] = [];
    
    // Find all edges where this node is the source
    const outgoingEdges = Array.from(this.edges.values()).filter(edge => edge.source === nodeId);
    
    // For each outgoing edge, find the target node
    for (const edge of outgoingEdges) {
      const targetNode = this.nodes.get(edge.target);
      if (targetNode) {
        neighbors.push({
          node: targetNode,
          relationship: edge.relationship
        });
      }
    }
    
    // Find all edges where this node is the target
    const incomingEdges = Array.from(this.edges.values()).filter(edge => edge.target === nodeId);
    
    // For each incoming edge, find the source node
    for (const edge of incomingEdges) {
      const sourceNode = this.nodes.get(edge.source);
      if (sourceNode) {
        // Use the inverse relationship name or prepend "from_" to indicate direction
        neighbors.push({
          node: sourceNode,
          relationship: `from_${edge.relationship}`
        });
      }
    }
    
    return neighbors;
  }

  // Clear storage (useful for testing)
  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.edgeCounter = 0;
    log("Cleared fallback storage", "fallback-storage");
  }

  // Get storage stats
  public getStats(): { nodeCount: number, edgeCount: number } {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size
    };
  }
}

// Create and export a singleton instance
export const fallbackStorage = new FallbackGraphStorage();