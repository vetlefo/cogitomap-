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

// Constants for pagination defaults
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

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
 * Get all nodes with optional pagination and type filtering
 */
export async function getAllNodes(
  page: number = 0,
  pageSize: number = DEFAULT_PAGE_SIZE,
  nodeType: string | null = null
): Promise<{ nodes: BubbleNode[], total: number, page: number, pageSize: number }> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }

  // Sanitize pagination parameters
  pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  page = Math.max(0, page);
  const skip = page * pageSize;
  
  if (!usingFallback) {
    try {
      // Build the query based on whether we're filtering by type
      let countQuery, nodesQuery;
      const params: Record<string, any> = { 
        skip: Number(skip), 
        limit: Number(pageSize) 
      };
      
      // Ensure params are numbers (Memgraph is strict about this)
      log(`Query params: skip=${params.skip}, limit=${params.limit}`, "graph-service-debug");
      
      if (nodeType) {
        countQuery = `MATCH (n:${nodeType}) RETURN count(n) AS total`;
        nodesQuery = `MATCH (n:${nodeType}) RETURN n ORDER BY n.id SKIP toInteger($skip) LIMIT toInteger($limit)`;
      } else {
        countQuery = `MATCH (n) RETURN count(n) AS total`;
        nodesQuery = `MATCH (n) RETURN n ORDER BY n.id SKIP toInteger($skip) LIMIT toInteger($limit)`;
      }
      
      // Get the total count
      const countResult = await runMemgraphQuery(countQuery);
      const totalRaw = countResult.records[0].get('total');
      const total = typeof totalRaw.toNumber === 'function' ? 
        totalRaw.toNumber() : Number(totalRaw);
      
      // Get the nodes for the current page
      const nodesResult = await runMemgraphQuery(nodesQuery, params);
      
      const nodes = nodesResult.records.map(record => record.get('n').properties as BubbleNode);
      
      return {
        nodes,
        total,
        page,
        pageSize
      };
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting all nodes from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  const allNodes = fallbackStorage.getAllNodes();
  
  // Apply type filtering if specified
  const filteredNodes = nodeType 
    ? allNodes.filter(node => node.type === nodeType)
    : allNodes;
  
  const total = filteredNodes.length;
  const paginatedNodes = filteredNodes.slice(skip, skip + pageSize);
  
  return {
    nodes: paginatedNodes,
    total,
    page,
    pageSize
  };
}

/**
 * Get all edges with optional pagination and relationship type filtering
 */
export async function getAllEdges(
  page: number = 0,
  pageSize: number = DEFAULT_PAGE_SIZE,
  relationshipType: string | null = null
): Promise<{ edges: Edge[], total: number, page: number, pageSize: number }> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }

  // Sanitize pagination parameters
  pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  page = Math.max(0, page);
  const skip = page * pageSize;
  
  if (!usingFallback) {
    try {
      // Build the query based on whether we're filtering by relationship type
      let countQuery, edgesQuery;
      const params: Record<string, any> = { 
        skip: Number(skip), 
        limit: Number(pageSize) 
      };
      
      // Ensure params are numbers (Memgraph is strict about this)
      log(`Query params: skip=${params.skip}, limit=${params.limit}`, "graph-service-debug");
      
      if (relationshipType) {
        countQuery = `MATCH ()-[r:${relationshipType}]->() RETURN count(r) AS total`;
        edgesQuery = `
          MATCH (source)-[r:${relationshipType}]->(target)
          RETURN type(r) AS relationship, 
                 source.id AS sourceId, 
                 target.id AS targetId, 
                 properties(r) AS properties
          ORDER BY source.id, target.id
          SKIP toInteger($skip) LIMIT toInteger($limit)
        `;
      } else {
        countQuery = `MATCH ()-[r]->() RETURN count(r) AS total`;
        edgesQuery = `
          MATCH (source)-[r]->(target)
          RETURN type(r) AS relationship, 
                 source.id AS sourceId, 
                 target.id AS targetId, 
                 properties(r) AS properties
          ORDER BY source.id, target.id
          SKIP toInteger($skip) LIMIT toInteger($limit)
        `;
      }
      
      // Get the total count
      const countResult = await runMemgraphQuery(countQuery);
      const totalRaw = countResult.records[0].get('total');
      const total = typeof totalRaw.toNumber === 'function' ? 
        totalRaw.toNumber() : Number(totalRaw);
      
      // Get the edges for the current page
      const edgesResult = await runMemgraphQuery(edgesQuery, params);
      
      const edges = edgesResult.records.map(record => {
        const sourceId = record.get('sourceId');
        const targetId = record.get('targetId');
        const relationship = record.get('relationship');
        const properties = record.get('properties');
        
        return {
          id: `${sourceId}-${relationship}-${targetId}`,
          source: sourceId,
          target: targetId,
          relationship,
          strength: properties.strength || 0.5,
          ...properties
        } as Edge;
      });
      
      return {
        edges,
        total,
        page,
        pageSize
      };
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting all edges from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  const allEdges = fallbackStorage.getAllEdges();
  
  // Apply relationship type filtering if specified
  const filteredEdges = relationshipType 
    ? allEdges.filter(edge => edge.relationship === relationshipType)
    : allEdges;
  
  const total = filteredEdges.length;
  const paginatedEdges = filteredEdges.slice(skip, skip + pageSize);
  
  return {
    edges: paginatedEdges,
    total,
    page,
    pageSize
  };
}

/**
 * Get a subgraph centered around a specific node
 */
export async function getSubgraph(
  nodeId: string,
  depth: number = 1
): Promise<{ nodes: BubbleNode[], edges: Edge[] }> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  // Limit maximum depth for performance reasons
  depth = Math.min(depth, 3);
  
  if (!usingFallback) {
    try {
      // Use variable path length to get neighbors up to specified depth
      const query = `
        MATCH path = (center {id: $nodeId})-[*0..${depth}]-(neighbor)
        WITH collect(path) AS paths
        UNWIND paths AS p
        UNWIND nodes(p) AS node
        WITH DISTINCT node
        RETURN collect(node) AS nodes
      `;
      
      const edgesQuery = `
        MATCH path = (center {id: $nodeId})-[*0..${depth}]-(neighbor)
        WITH collect(path) AS paths
        UNWIND paths AS p
        UNWIND relationships(p) AS r
        WITH DISTINCT r, startNode(r) AS source, endNode(r) AS target
        RETURN collect({
          relationship: type(r), 
          sourceId: source.id, 
          targetId: target.id, 
          properties: properties(r)
        }) AS edges
      `;
      
      const params = { nodeId };
      
      // Get nodes in the subgraph
      const nodesResult = await runMemgraphQuery(query, params);
      const edgesResult = await runMemgraphQuery(edgesQuery, params);
      
      // Process nodes
      const nodes: BubbleNode[] = [];
      if (nodesResult.records.length > 0 && nodesResult.records[0].get('nodes')) {
        const nodeResults = nodesResult.records[0].get('nodes');
        for (const nodeResult of nodeResults) {
          nodes.push(nodeResult.properties as BubbleNode);
        }
      }
      
      // Process edges
      const edges: Edge[] = [];
      if (edgesResult.records.length > 0 && edgesResult.records[0].get('edges')) {
        const edgeResults = edgesResult.records[0].get('edges');
        for (const edgeResult of edgeResults) {
          const sourceId = edgeResult.sourceId;
          const targetId = edgeResult.targetId;
          const relationship = edgeResult.relationship;
          const properties = edgeResult.properties || {};
          
          edges.push({
            id: `${sourceId}-${relationship}-${targetId}`,
            source: sourceId,
            target: targetId,
            relationship,
            strength: properties.strength || 0.5,
            ...properties
          } as Edge);
        }
      }
      
      return { nodes, edges };
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting subgraph from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  // This is a simplified version; in a real implementation we'd need to do a proper breadth-first traversal
  
  // Start with the center node
  const centerNode = fallbackStorage.getNode(nodeId);
  if (!centerNode) {
    return { nodes: [], edges: [] };
  }
  
  const nodes: BubbleNode[] = [centerNode];
  const edges: Edge[] = [];
  const visitedNodeIds = new Set<string>([nodeId]);
  let currentDepth = 0;
  let currentLayer = [nodeId];
  
  // Breadth-first traversal to collect nodes and edges
  while (currentDepth < depth && currentLayer.length > 0) {
    const nextLayer: string[] = [];
    
    for (const currentNodeId of currentLayer) {
      // Get all neighbors
      const neighbors = fallbackStorage.getNodeNeighbors(currentNodeId);
      
      for (const { node: neighborNode, relationship } of neighbors) {
        // Add the edge
        const edge = fallbackStorage.getEdge(`${currentNodeId}-${relationship}-${neighborNode.id}`) ||
                    fallbackStorage.getEdge(`${neighborNode.id}-${relationship}-${currentNodeId}`);
        
        if (edge && !edges.some(e => e.id === edge.id)) {
          edges.push(edge);
        }
        
        // Add the node if not already visited
        if (!visitedNodeIds.has(neighborNode.id)) {
          visitedNodeIds.add(neighborNode.id);
          nodes.push(neighborNode);
          nextLayer.push(neighborNode.id);
        }
      }
    }
    
    // Move to the next layer
    currentLayer = nextLayer;
    currentDepth++;
  }
  
  return { nodes, edges };
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