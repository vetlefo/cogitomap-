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
  
  /**
   * Perform a vector similarity search against nodes in the fallback storage
   * Uses cosine similarity for vector comparison
   */
  vectorSearch(
    queryVector: number[],
    nodeTypes: string[] = [],
    limit: number = 10,
    minSimilarity: number = 0.5
  ): Array<BubbleNode & { similarity: number }> {
    if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
      log("Invalid query vector provided for fallback vector search", "fallback-storage");
      return [];
    }
    
    log(`Performing fallback vector search with ${nodeTypes.length > 0 ? nodeTypes.join(',') : 'all'} node types`, "fallback-storage");
    
    // Get all nodes or filtered by type
    let candidates = Array.from(this.nodes.values());
    if (nodeTypes.length > 0) {
      candidates = candidates.filter(node => nodeTypes.includes(node.type));
    }
    
    // Only consider nodes that have embeddings
    candidates = candidates.filter(node => 
      node.embedding_vector && 
      Array.isArray(node.embedding_vector) && 
      node.embedding_vector.length > 0
    );
    
    if (candidates.length === 0) {
      log("No candidate nodes with embeddings found for vector search", "fallback-storage");
      return [];
    }
    
    // Calculate cosine similarity for each node
    const results = candidates.map(node => {
      // Calculate cosine similarity between query vector and node embedding
      const similarity = this.cosineSimilarity(queryVector, node.embedding_vector!);
      return {
        ...node,
        similarity
      };
    });
    
    // Filter by minimum similarity and sort by descending similarity
    return results
      .filter(result => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * Returns a value between -1 and 1, where 1 is most similar
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      // If dimensions don't match, truncate the longer one
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
      return 0; // Avoid division by zero
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  getAllNodes(
    page: number = 0, 
    pageSize: number = 50, 
    nodeType: string | null = 'all'
  ): { nodes: BubbleNode[], total: number } {
    log(`getAllNodes called with page=${page}, pageSize=${pageSize}, nodeType=${nodeType}`, "fallback-storage-debug");
    log(`Current nodes in Map: ${this.nodes.size}`, "fallback-storage-debug");
    
    // Debug dump nodes
    this.debug_dumpNodes();
    
    const nodeArray: BubbleNode[] = [];
    this.nodes.forEach(node => nodeArray.push({...node}));
    
    log(`Converted ${nodeArray.length} nodes to array`, "fallback-storage-debug");
    
    // Filter by node type if specified - force to 'all' if null
    const effectiveNodeType = nodeType === null ? 'all' : nodeType;
    log(`Using effective nodeType: ${effectiveNodeType}`, "fallback-storage-debug");
    
    let filteredNodes = nodeArray;
    if (effectiveNodeType !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.type === effectiveNodeType);
      log(`Filtered to ${filteredNodes.length} nodes of type ${effectiveNodeType}`, "fallback-storage-debug");
    }
    
    // Apply pagination
    const total = filteredNodes.length;
    const start = page * pageSize;
    const end = start + pageSize;
    
    const nodes = filteredNodes.slice(start, end);
    
    log(`Returning ${nodes.length} nodes after pagination (total: ${total})`, "fallback-storage-debug");
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
    log(`Current edges in Map: ${this.edges.size}`, "fallback-storage-debug");
    
    const edgeArray: Edge[] = [];
    this.edges.forEach(edge => edgeArray.push({...edge}));
    
    log(`Converted ${edgeArray.length} edges to array`, "fallback-storage-debug");
    
    // Filter by relationship type if specified - force to 'all' if null
    const effectiveRelType = relationshipType === null ? 'all' : relationshipType;
    log(`Using effective relationshipType: ${effectiveRelType}`, "fallback-storage-debug");
    
    let filteredEdges = edgeArray;
    if (effectiveRelType !== 'all') {
      filteredEdges = filteredEdges.filter(edge => edge.relationship === effectiveRelType);
      log(`Filtered to ${filteredEdges.length} edges of type ${effectiveRelType}`, "fallback-storage-debug");
    }
    
    // Apply pagination
    const total = filteredEdges.length;
    const start = page * pageSize;
    const end = start + pageSize;
    
    const edges = filteredEdges.slice(start, end);
    
    log(`Returning ${edges.length} edges after pagination (total: ${total})`, "fallback-storage-debug");
    return { edges, total };
  }
  
  // For compatibility with graphService.ts 
  getEdgesByRelationship(
    page: number = 0, 
    pageSize: number = 50, 
    relationshipType: string | null = 'all'
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
  
  /**
   * Find related nodes by following edges up to maxHops away
   */
  async findRelatedNodes(
    nodeIds: string[],
    maxHops: number = 2,
    limit: number = 20,
    nodeTypes: string[] = []
  ): Promise<BubbleNode[]> {
    log(`[fallback-storage] Finding related nodes for ${nodeIds.length} nodes with max hops: ${maxHops}`, "fallback-storage");
    
    // Track visited nodes to avoid duplicates
    const visited = new Set<string>(nodeIds);
    
    // Map to track related nodes and their connection strength
    const relatedNodesMap = new Map<string, { node: BubbleNode, strength: number }>();
    
    // Queue for BFS, with [nodeId, currentHop]
    const queue: Array<[string, number]> = nodeIds.map(id => [id, 0]);
    
    while (queue.length > 0) {
      const [currentNodeId, currentHop] = queue.shift()!;
      
      // Don't explore beyond maxHops
      if (currentHop >= maxHops) continue;
      
      // Get all edges connected to this node
      for (const edge of this.edges.values()) {
        let connectedNodeId: string | null = null;
        
        // Check which end of the edge contains our node
        if (edge.source === currentNodeId) {
          connectedNodeId = edge.target;
        } else if (edge.target === currentNodeId) {
          connectedNodeId = edge.source;
        }
        
        // If we found a connected node and haven't visited it yet
        if (connectedNodeId && !visited.has(connectedNodeId)) {
          visited.add(connectedNodeId);
          
          // Get the node object
          const connectedNode = this.nodes.get(connectedNodeId);
          
          if (connectedNode && (nodeTypes.length === 0 || nodeTypes.includes(connectedNode.type))) {
            // Calculate connection strength - edges closer to source nodes get higher strength
            const connectionStrength = edge.strength * (1 - (currentHop / maxHops));
            
            // If we already have this node, update its strength if the new path is stronger
            if (relatedNodesMap.has(connectedNodeId)) {
              const existing = relatedNodesMap.get(connectedNodeId)!;
              if (connectionStrength > existing.strength) {
                relatedNodesMap.set(connectedNodeId, { 
                  node: connectedNode, 
                  strength: connectionStrength 
                });
              }
            } else {
              // Add to our results
              relatedNodesMap.set(connectedNodeId, { 
                node: connectedNode, 
                strength: connectionStrength 
              });
            }
            
            // Add to queue for next hop exploration
            queue.push([connectedNodeId, currentHop + 1]);
          }
        }
      }
    }
    
    // Convert map to array and sort by connection strength
    const results = Array.from(relatedNodesMap.values())
      .map(item => ({
        ...item.node,
        similarity: item.strength, // Use strength as the similarity score
        isDirectMatch: false
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    log(`[fallback-storage] Found ${results.length} related nodes`, "fallback-storage");
    return results;
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