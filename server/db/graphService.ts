/**
 * GraphService - provides a unified interface for graph operations.
 * Tries to use Memgraph first, but falls back to local storage when unavailable.
 */

import { runMemgraphQuery } from "./memgraphClient";
import { fallbackStorage } from "./fallbackStorage";
import { log } from "../vite";
import type { BubbleNode, Edge } from "../../client/src/types";

// Track if we're in fallback mode
let usingFallback = false;
let connectionTested = false;

/**
 * Test if Memgraph connection is available
 */
export async function testMemgraphConnection(): Promise<boolean> {
  if (connectionTested) {
    return !usingFallback;
  }
  
  try {
    // Simple query to test connection
    await runMemgraphQuery("RETURN 1 as test");
    usingFallback = false;
    connectionTested = true;
    log("Memgraph connection test successful, using database storage", "graph-service");
    return true;
  } catch (error) {
    usingFallback = true;
    connectionTested = true;
    log(`Memgraph connection test failed, using fallback storage: ${error}`, "graph-service");
    return false;
  }
}

/**
 * Create a node in the graph
 */
export async function createNode(node: BubbleNode): Promise<BubbleNode> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  if (!usingFallback) {
    try {
      const nodeLabel = node.type;
      const query = `CREATE (n:${nodeLabel} $props) RETURN n`;
      const params = { props: node };
      
      const result = await runMemgraphQuery(query, params);
      
      if (result.records.length > 0 && result.records[0].get('n')) {
        const createdNodeProperties = result.records[0].get('n').properties;
        log(`Node created in Memgraph: ${createdNodeProperties.id}`, "graph-service");
        return createdNodeProperties as BubbleNode;
      } else {
        throw new Error("Node creation failed in Memgraph, no record returned");
      }
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error creating node in Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  return fallbackStorage.addNode(node);
}

/**
 * Create an edge between nodes
 */
export async function createEdge(
  sourceId: string, 
  targetId: string, 
  relationship: string, 
  properties: Record<string, any> = {}
): Promise<Edge> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  if (!usingFallback) {
    try {
      const query = `
        MATCH (sourceNode {id: $sourceId}), (targetNode {id: $targetId})
        CREATE (sourceNode)-[r:${relationship} $props]->(targetNode)
        RETURN type(r) AS relationship, r AS edge, startNode(r).id AS source, endNode(r).id AS target
      `;
      const params = {
        sourceId,
        targetId,
        props: properties
      };
      
      const result = await runMemgraphQuery(query, params);
      
      if (result.records.length > 0) {
        const record = result.records[0];
        const edgeProps = record.get('edge').properties;
        
        const edge: Edge = {
          id: `${sourceId}-${relationship}-${targetId}`,
          source: record.get('source'),
          target: record.get('target'),
          relationship: record.get('relationship') as any,
          strength: edgeProps.strength || 0.5,
          ...edgeProps
        };
        
        log(`Edge created in Memgraph: ${sourceId} -> ${targetId}`, "graph-service");
        return edge;
      } else {
        throw new Error("Edge creation failed in Memgraph, no record returned");
      }
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error creating edge in Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  return fallbackStorage.addEdge(sourceId, targetId, relationship, properties);
}

/**
 * Get a node by ID
 */
export async function getNode(id: string): Promise<BubbleNode | null> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  if (!usingFallback) {
    try {
      const query = `MATCH (n {id: $id}) RETURN n`;
      const params = { id };
      
      const result = await runMemgraphQuery(query, params);
      
      if (result.records.length > 0) {
        return result.records[0].get('n').properties as BubbleNode;
      } else {
        return null;
      }
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting node from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  const node = fallbackStorage.getNode(id);
  return node || null;
}

/**
 * Get a node's neighbors
 */
export async function getNodeNeighbors(nodeId: string): Promise<{ node: BubbleNode, relationship: string }[]> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  if (!usingFallback) {
    try {
      const query = `
        MATCH (source {id: $nodeId})-[r]->(target)
        RETURN target AS node, type(r) AS relationship
        UNION
        MATCH (source)-[r]->(target {id: $nodeId})
        RETURN source AS node, 'from_' + type(r) AS relationship
      `;
      const params = { nodeId };
      
      const result = await runMemgraphQuery(query, params);
      
      return result.records.map(record => ({
        node: record.get('node').properties as BubbleNode,
        relationship: record.get('relationship')
      }));
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting node neighbors from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  return fallbackStorage.getNodeNeighbors(nodeId);
}

/**
 * Get graph statistics
 */
export async function getGraphStats(): Promise<{ nodeCount: number, edgeCount: number, usingFallback: boolean }> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  if (!usingFallback) {
    try {
      const nodeCountQuery = `MATCH (n) RETURN count(n) AS nodeCount`;
      const edgeCountQuery = `MATCH ()-[r]->() RETURN count(r) AS edgeCount`;
      
      const nodeResult = await runMemgraphQuery(nodeCountQuery);
      const edgeResult = await runMemgraphQuery(edgeCountQuery);
      
      // Get raw values - neo4j integers might be returned as either Numbers or special Integer objects
      const nodeCountRaw = nodeResult.records[0].get('nodeCount');
      const edgeCountRaw = edgeResult.records[0].get('edgeCount');
      
      // Convert to regular numbers safely
      const nodeCount = typeof nodeCountRaw.toNumber === 'function' ? 
        nodeCountRaw.toNumber() : Number(nodeCountRaw);
      const edgeCount = typeof edgeCountRaw.toNumber === 'function' ? 
        edgeCountRaw.toNumber() : Number(edgeCountRaw);
      
      return {
        nodeCount,
        edgeCount,
        usingFallback: false
      };
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting graph stats from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  const stats = fallbackStorage.getStats();
  return {
    ...stats,
    usingFallback: true
  };
}