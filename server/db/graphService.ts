/**
 * GraphService - provides a unified interface for graph operations.
 * Tries to use Memgraph first, but falls back to local storage when unavailable.
 */

import { executeQuery } from "./memgraphClient";
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
    log(`Using fallback storage for graph operations: ${usingFallback}`, "graph-service-debug");
    return !usingFallback;
  }
  
  try {
    // Check if environment variables are configured
    const missingEnvVars = [];
    if (!process.env.MEMGRAPH_URI) missingEnvVars.push('MEMGRAPH_URI');
    if (!process.env.MEMGRAPH_USERNAME) missingEnvVars.push('MEMGRAPH_USERNAME');
    if (!process.env.MEMGRAPH_PASSWORD) missingEnvVars.push('MEMGRAPH_PASSWORD');
    
    if (missingEnvVars.length > 0) {
      log(`Missing Memgraph environment variables: ${missingEnvVars.join(', ')}`, "graph-service-warning");
      log("Will use fallback storage due to missing configuration", "graph-service");
      usingFallback = true;
      connectionTested = true;
      return false;
    }
    
    // Check URI format and adjust if needed
    const uri = process.env.MEMGRAPH_URI!;
    if (uri.startsWith('bolt+ssc://')) {
      log(`Using Memgraph URI with SSL: ${uri}`, "graph-service-debug");
    }
    
    // Simple query to test connection - with improved debug output
    log("Executing Memgraph test query...", "graph-service-debug");
    try {
      const results = await executeQuery("RETURN 1 as test");
      
      if (results && results.length > 0) {
        log(`Test query results: ${JSON.stringify(results)}`, "graph-service-debug");
        
        // Try a second more complex query
        try {
          const nodeCount = await executeQuery("MATCH (n) RETURN count(n) as count");
          const count = nodeCount[0]?.count || 0;
          log(`Database contains ${count} nodes`, "graph-service-debug");
          
          // Force using real database if connection test successful
          usingFallback = false;
          connectionTested = true;
          log("Memgraph connection test successful, using database storage", "graph-service");
        } catch (countError) {
          log(`Node count query failed: ${countError}`, "graph-service-debug");
          // This is not a critical error, as long as basic query works
          usingFallback = false;
          connectionTested = true;
          log("Memgraph connection partially successful, still using database storage", "graph-service");
        }
        return true;
      } else {
        log("Test query returned empty results", "graph-service-debug");
        usingFallback = true;
        connectionTested = true;
        log("Memgraph connection test returned no results, using fallback storage", "graph-service");
        return false;
      }
    } catch (queryError) {
      log(`Test query execution failed: ${queryError}`, "graph-service-debug");
      usingFallback = true;
      connectionTested = true;
      log("Memgraph test query failed, using fallback storage", "graph-service");
      return false;
    }
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
  
  // Use Memgraph if available
  if (!usingFallback) {
    try {
      log(`Creating node with Memgraph: ${node.id} of type ${node.type}`, "graph-service-debug");
      log(`Node position data: ${JSON.stringify(node.position)}`, "graph-service-debug");
      
      // Generate Cypher query for node creation - updated for Memgraph 3.0
      // Use MATCH to first check if node exists, prevent duplicates
      let query = '';
      
      // First check if node exists
      const checkQuery = `
        MATCH (n)
        WHERE n.id = $id
        RETURN count(n) AS count
      `;
      
      const checkResult = await executeQuery(checkQuery, { id: node.id });
      const exists = checkResult && checkResult.length > 0 && checkResult[0].count > 0;
      
      if (exists) {
        // Node exists, update it
        query = `
          MATCH (n {id: $id})
          SET n = $props
          RETURN n
        `;
      } else {
        // Node doesn't exist, create it
        query = `
          CREATE (n:${node.type} {id: $id})
          SET n = $props
          RETURN n
        `;
      }
      
      log(`Executing node creation query: ${query}`, "graph-service-debug");
      const results = await executeQuery(query, { id: node.id, props: node });
      
      log(`Node ${exists ? 'updated' : 'created'} in Memgraph: ${node.id}`, "graph-service");
      
      // Return the created node - handling the Memgraph result format
      if (results && results.length > 0) {
        let createdNode: any;
        
        // Handle different result formats
        if (results[0].n && typeof results[0].n === 'object') {
          // Neo4j-style result with .n property
          createdNode = results[0].n;
        } else if (results[0] && typeof results[0] === 'object') {
          // Memgraph might return the node directly
          createdNode = results[0];
        } else {
          // Unable to parse result
          log(`Unusual result format: ${JSON.stringify(results)}`, "graph-service-warning");
          createdNode = node; // Fall back to original node
        }
        
        // Make sure position data is included
        if (!createdNode.position && node.position) {
          createdNode.position = node.position;
        }
        
        if (createdNode.position) {
          log(`Returning node with position: ${JSON.stringify(createdNode.position)}`, "graph-service-debug");
        }
        
        return createdNode as BubbleNode;
      }
      
      // Fallback to the original node if result format doesn't match
      return node;
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error creating node in Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  log(`Creating node with fallback: ${node.id}`, "graph-service");
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
): Promise<Edge | null> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  // Construct edge ID
  const edgeId = `${sourceId}-${relationship}-${targetId}`;
  
  // Set strength property (for visualization) if not provided
  if (!('strength' in properties)) {
    properties.strength = 0.7; // Default strength
  }
  
  // Add timestamp if not provided
  if (!('created_at' in properties)) {
    properties.created_at = Date.now();
  }
  
  // Use Memgraph if available
  if (!usingFallback) {
    try {
      // Generate Cypher query for edge creation - updated for Memgraph 3.0
      const query = `
        MATCH (source {id: $sourceId}), (target {id: $targetId})
        CREATE (source)-[r:${relationship} $props]->(target)
        RETURN r, source, target, type(r) AS relationship
      `;
      
      const results = await executeQuery(query, {
        sourceId,
        targetId,
        props: properties
      });
      
      // Check if the edge was created
      if (!results || results.length === 0) {
        log(`Failed to create edge, nodes not found: ${sourceId} -> ${targetId}`, "graph-service");
        return null;
      }
      
      log(`Edge created in Memgraph: ${edgeId}`, "graph-service");
      
      // Construct the edge object
      const edge: Edge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        strength: properties.strength || 0.7,
        relationship: relationship as any, // Cast to allow any relationship type
        ...properties
      };
      
      return edge;
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error creating edge in Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  log(`Creating edge with fallback: ${edgeId}`, "graph-service");
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
      const results = await executeQuery(query, { id });
      
      // Check if the node was found
      if (!results || results.length === 0) {
        return null;
      }
      
      // Extract node properties
      if (results[0] && results[0].n) {
        return results[0].n as BubbleNode;
      }
      return null;
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
      // Query for incoming and outgoing connections
      const query = `
        MATCH (n {id: $nodeId})-[r]-(neighbor)
        RETURN neighbor, type(r) AS relationship
      `;
      
      const results = await executeQuery(query, { nodeId });
      
      // Process results
      const neighbors: { node: BubbleNode, relationship: string }[] = [];
      
      if (results && results.length > 0) {
        for (const result of results) {
          if (result.neighbor && result.relationship) {
            neighbors.push({
              node: result.neighbor as BubbleNode,
              relationship: result.relationship
            });
          }
        }
      }
      
      return neighbors;
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
  nodeType: string | null = 'all'
): Promise<{ nodes: BubbleNode[], total: number }> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  // Apply limits to page size
  pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  const skip = page * pageSize;
  
  log(`Query params: skip=${skip}, limit=${pageSize}`, "graph-service-debug");
  
  if (!usingFallback) {
    try {
      // Get total count of nodes
      const countQuery = nodeType !== 'all'
        ? `MATCH (n:${nodeType}) RETURN count(n) AS total`
        : `MATCH (n) RETURN count(n) AS total`;
        
      const countResult = await executeQuery(countQuery);
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
      
      // Get paginated nodes - updated for Memgraph 3.0 (removed toInteger)
      const query = nodeType !== 'all'
        ? `MATCH (n:${nodeType}) RETURN n ORDER BY n.id SKIP $skip LIMIT $limit`
        : `MATCH (n) RETURN n ORDER BY n.id SKIP $skip LIMIT $limit`;
      
      const results = await executeQuery(query, {
        skip,
        limit: pageSize
      });
      
      // Process results
      const nodes: BubbleNode[] = [];
      
      if (results && results.length > 0) {
        for (const result of results) {
          if (result.n) {
            nodes.push(result.n as BubbleNode);
          }
        }
      }
      
      return { nodes, total: Number(total) };
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting all nodes from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  return fallbackStorage.getAllNodes(page, pageSize, nodeType);
}

/**
 * Get all edges with optional pagination and relationship type filtering
 */
export async function getAllEdges(
  page: number = 0,
  pageSize: number = DEFAULT_PAGE_SIZE,
  relationshipType: string | null = 'all'
): Promise<{ edges: Edge[], total: number }> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  // Apply limits to page size
  pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  const skip = page * pageSize;
  
  log(`Query params: skip=${skip}, limit=${pageSize}`, "graph-service-debug");
  
  if (!usingFallback) {
    try {
      // Get total count of relationships
      const countQuery = relationshipType !== 'all'
        ? `MATCH ()-[r:${relationshipType}]->() RETURN count(r) AS total`
        : `MATCH ()-[r]->() RETURN count(r) AS total`;
        
      const countResult = await executeQuery(countQuery);
      const total = countResult && countResult.length > 0 ? countResult[0].total : 0;
      
      // Get paginated relationships with source and target nodes - updated for Memgraph 3.0
      const query = relationshipType !== 'all'
        ? `
          MATCH (source)-[r:${relationshipType}]->(target)
          RETURN type(r) AS relationship, 
                 source.id AS sourceId, 
                 target.id AS targetId, 
                 properties(r) AS properties
          SKIP $skip LIMIT $limit
        `
        : `
          MATCH (source)-[r]->(target)
          RETURN type(r) AS relationship, 
                 source.id AS sourceId, 
                 target.id AS targetId, 
                 properties(r) AS properties
          SKIP $skip LIMIT $limit
        `;
      
      const results = await executeQuery(query, {
        skip,
        limit: pageSize
      });
      
      // Process results
      const edges: Edge[] = [];
      
      if (results && results.length > 0) {
        for (const result of results) {
          if (result.relationship && result.sourceId && result.targetId) {
            const relationship = result.relationship;
            const sourceId = result.sourceId;
            const targetId = result.targetId;
            const properties = result.properties || {};
            
            edges.push({
              id: `${sourceId}-${relationship}-${targetId}`,
              source: sourceId,
              target: targetId,
              relationship,
              strength: properties.strength || 0.5,
              ...properties
            });
          }
        }
      }
      
      return { edges, total: Number(total) };
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error getting all edges from Memgraph, switching to fallback: ${error}`, "graph-service");
      // Continue with fallback implementation
    }
  }
  
  // Fallback implementation
  return fallbackStorage.getAllEdges(page, pageSize, relationshipType);
}

/**
 * Get a subgraph centered around a specific node
 */
export async function getSubgraph(
  nodeId: string,
  depth: number = 2
): Promise<{ nodes: BubbleNode[], edges: Edge[] }> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  if (!usingFallback) {
    try {
      // Fetch nodes up to specified depth around the center node
      const query = `
        MATCH p = (center {id: $nodeId})-[*0..${depth}]-(n)
        WITH COLLECT(DISTINCT n) + COLLECT(DISTINCT center) AS nodes
        UNWIND nodes AS node
        RETURN COLLECT(DISTINCT node) AS nodes
      `;
      
      // Fetch all relationships between the nodes
      const edgesQuery = `
        MATCH p = (center {id: $nodeId})-[*0..${depth}]-(n)
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
      const nodesResults = await executeQuery(query, params);
      const edgesResults = await executeQuery(edgesQuery, params);
      
      // Process nodes
      const nodes: BubbleNode[] = [];
      if (nodesResults && nodesResults.length > 0 && nodesResults[0].nodes) {
        const nodeResults = nodesResults[0].nodes;
        if (Array.isArray(nodeResults)) {
          for (const nodeResult of nodeResults) {
            nodes.push(nodeResult as BubbleNode);
          }
        }
      }
      
      // Process edges
      const edges: Edge[] = [];
      if (edgesResults && edgesResults.length > 0 && edgesResults[0].edges) {
        const edgeResults = edgesResults[0].edges;
        if (Array.isArray(edgeResults)) {
          for (const edgeResult of edgeResults) {
            if (edgeResult.sourceId && edgeResult.targetId && edgeResult.relationship) {
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
      
      const nodeResult = await executeQuery(nodeCountQuery);
      const edgeResult = await executeQuery(edgeCountQuery);
      
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

/**
 * Execute a custom Cypher query against the graph database
 * This is used by the memgraphClient to execute queries
 * 
 * @param query The Cypher query to execute
 * @param params Optional parameters for the query
 * @returns The query result
 */
/**
 * Handle vector search queries in fallback mode by using the fallbackStorage's vector search
 */
async function handleFallbackVectorSearch(params: Record<string, any>): Promise<any[]> {
  try {
    const { 
      embedding,
      nodeTypes = [],
      limit = 10, 
      minSimilarity = 0.5 
    } = params;
    
    if (!embedding || !Array.isArray(embedding)) {
      log("Missing or invalid embedding for fallback vector search", "graph-service-error");
      return [];
    }
    
    log(`Performing fallback vector search with ${embedding.length} dimension vector`, "graph-service");
    
    // Use the fallbackStorage's vector search method
    const results = fallbackStorage.vectorSearch(embedding, nodeTypes, limit, minSimilarity);
    
    // Transform results to match the expected format from Memgraph queries
    return results.map(result => ({
      node: {
        properties: { ...result }
      },
      similarity: result.similarity
    }));
    
  } catch (error) {
    log(`Error in fallback vector search: ${error}`, "graph-service-error");
    return [];
  }
}

export async function executeCustomQuery(query: string, params: Record<string, any> = {}): Promise<any[]> {
  // Ensure we've tested the connection
  if (!connectionTested) {
    await testMemgraphConnection();
  }
  
  // Use Memgraph if available
  if (!usingFallback) {
    try {
      log(`Executing custom query: ${query.substring(0, 200)}...`, "graph-service-query");
      
      const results = await executeQuery(query, params);
      
      // For Memgraph 3.0+, the results from executeQuery are already transformed into objects
      if (Array.isArray(results)) {
        return results;
      }
      
      // Fallback for any Neo4j-style result objects that might still have records format
      if (results && results.records && Array.isArray(results.records)) {
        // Extract records from the result in Neo4j format
        return results.records.map(record => {
          const obj: Record<string, any> = {};
          
          // Extract all properties from the record
          for (const key of record.keys) {
            const value = record.get(key);
            
            // Handle Neo4j node objects - use a simple approach without type checks that cause issues
            if (value && typeof value === 'object' && value.properties) {
              // For Neo4j nodes, extract properties safely
              const nodeProps = { ...value.properties };
              const nodeId = nodeProps.id || (value.identity ? value.identity.toString() : 'unknown');
              
              obj[key] = {
                ...nodeProps,
                id: nodeId
              };
            } else {
              obj[key] = value;
            }
          }
          
          return obj;
        });
      }
      
      // Last resort, return empty array if we can't process the results
      return [];
    } catch (error) {
      // Switch to fallback mode if there's an error
      usingFallback = true;
      log(`Error executing custom query in Memgraph, switching to fallback: ${error}`, "graph-service");
      // For custom queries, we'll just return an empty array in fallback mode
      // since we can't easily support arbitrary queries
      return [];
    }
  }
  
  // Fallback mode - check if it's a vector search query we can handle
  if (query.includes('db.index.vector.queryNodes') && params.embedding) {
    log(`Detected vector search query in fallback mode, attempting fallback vector search`, "graph-service");
    return handleFallbackVectorSearch(params);
  } else {
    // Can't handle other custom queries in fallback mode
    log(`Cannot execute custom query in fallback mode: ${query}`, "graph-service");
    return [];
  }
}