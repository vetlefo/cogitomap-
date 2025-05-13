/**

GraphService - provides a unified interface for graph operations.
Uses Memgraph if active, otherwise falls back to local storage.
The active strategy is determined at server startup.
*/
import { executeQuery as executeMemgraphQuery } from "./memgraphClient"; // Renamed for clarity
import { fallbackStorage } from "./fallbackStorage";
import { log } from "../vite";
import type { BubbleNode, Edge } from "../../client/src/types";

// Strategy variable: true if Memgraph is connected and should be used.
let _isMemgraphActive = false; // Default to fallback

// Constants for pagination defaults
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**

Sets the database strategy for the graph service.
This should be called once at server startup.
@param useMemgraph - True if Memgraph is connected and should be used.
*/
export function setDatabaseStrategy(useMemgraph: boolean): void {
_isMemgraphActive = useMemgraph;
log(`GraphService strategy set. Using Memgraph: ${_isMemgraphActive}`, "graph-service-init");
}
/**

Create a node in the graph.
*/
export async function createNode(node: BubbleNode): Promise<BubbleNode> {
if (_isMemgraphActive) {
try {
log(`Attempting to create/update node in Memgraph: ${node.id} of type ${node.type}`, "graph-service-memgraph");
// MERGE is generally safer for create/update semantics with unique IDs.
// Ensure properties are correctly passed for Memgraph.
// Memgraph does not support setting a node directly with n = $props if $props contains complex objects
// not directly mappable to Cypher types (like nested position object).
// It's safer to set properties individually or use Cypher's map projection carefully.
const propertiesToSet = { ...node };
// delete propertiesToSet.position; // Handle position separately if it causes issues
const query = `MERGE (n {id: $id}) ON CREATE SET n = $props, n += {type: $type, createdAt: timestamp()} ON MATCH SET n += $props RETURN n`;
// Ensure all node properties are serializable and compatible with Memgraph.
// The 'props' should be a flat map of primitive types or lists of primitive types.
// Nested objects like 'position' might need to be deconstructed if they cause issues.
// For now, assuming 'node' object is structured compatibly.
const results = await executeMemgraphQuery(query, { id: node.id, props: propertiesToSet, type: node.type });
if (results && results.length > 0 && results[0].n) {
log(`Node ${node.id} created/updated in Memgraph.`, "graph-service-memgraph");
return results[0].n as BubbleNode; // Memgraph driver already converts records to objects
}
log(`Node ${node.id} operation in Memgraph did not return expected result.`, "graph-service-warning");
throw new Error(`Failed to create/update node ${node.id} in Memgraph, no result returned.`);
} catch (error) {
log(`Memgraph error creating/updating node ${node.id}: ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
throw error; // Propagate error
}
} else {
log(`Creating node with fallback: ${node.id}`, "graph-service-fallback");
return fallbackStorage.createNode(node);
}
}
/**

Create an edge between nodes.
*/
export async function createEdge(
sourceId: string,
targetId: string,
relationship: string,
properties: Record<string, any> = {}
): Promise<Edge | null> {
const edgeId = `${sourceId}-${relationship}-${targetId}`;
const allProps = {
id: edgeId, // Storing ID as a property can be useful.
...properties,
strength: properties.strength || 0.7, // Default strength
createdAt: properties.createdAt || Date.now(),
};
if (_isMemgraphActive) {
try {
log(`Attempting to create edge in Memgraph: ${sourceId} -[${relationship}]-> ${targetId}`, "graph-service-memgraph");
const query = `MATCH (source {id: $sourceId}), (target {id: $targetId}) MERGE (source)-[r:${relationship} {id: $edgeId}]->(target) ON CREATE SET r = $props ON MATCH SET r += $props RETURN r, type(r) as relationshipType, startNode(r).id as source, endNode(r).id as target`;
// Note: MERGE on relationship with properties might create duplicates if not careful with keys.
// Using an 'id' property on the relationship for MERGE uniqueness.
const results = await executeMemgraphQuery(query, {
sourceId,
targetId,
edgeId,
props: allProps,
});

if (results && results.length > 0 && results[0].r) {
    log(`Edge ${edgeId} created/updated in Memgraph.`, "graph-service-memgraph");
    const dbEdge = results[0].r;
    return {
      id: dbEdge.id || edgeId,
      source: results[0].source,
      target: results[0].target,
      relationship: results[0].relationshipType,
      strength: dbEdge.strength,
      properties: dbEdge,
    } as Edge;
  }
  log(`Edge ${edgeId} operation in Memgraph did not return expected result. Source/Target might not exist.`, "graph-service-warning");
  throw new Error(`Failed to create/update edge ${edgeId}. Source/Target nodes might not exist.`);
} catch (error) {
  log(`Memgraph error creating/updating edge ${edgeId}: ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
  throw error; // Propagate error
}
} else {
log(`Creating edge with fallback: ${edgeId}`, "graph-service-fallback");
return fallbackStorage.createEdge(sourceId, targetId, relationship, allProps);
}
}

/**

Get a node by ID.
*/
export async function getNode(id: string): Promise<BubbleNode | null> {
if (_isMemgraphActive) {
try {
const query = `MATCH (n {id: $id}) RETURN n`;
const results = await executeMemgraphQuery(query, { id });
return results && results.length > 0 ? (results[0].n as BubbleNode) : null;
} catch (error) {
log(`Memgraph error getting node ${id}: ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
throw error;
}
} else {
return fallbackStorage.getNode(id);
}
}
/**

Get a node's neighbors.
*/
export async function getNodeNeighbors(nodeId: string): Promise<{ node: BubbleNode, relationship: string }[]> {
if (_isMemgraphActive) {
try {
const query = `MATCH (n {id: $nodeId})-[r]-(neighbor) RETURN neighbor, type(r) AS relationship`;
const results = await executeMemgraphQuery(query, { nodeId });
return results.map(result => ({
node: result.neighbor as BubbleNode,
relationship: result.relationship as string,
}));
} catch (error) {
log(`Memgraph error getting neighbors for node ${nodeId}: ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
throw error;
}
} else {
return fallbackStorage.getNodeNeighbors(nodeId);
}
}
/**

Get all nodes with optional pagination and type filtering.
*/
export async function getAllNodes(
page: number = 0,
pageSize: number = DEFAULT_PAGE_SIZE,
nodeType: string | null = null // Changed 'all' to null for clarity
): Promise<{ nodes: BubbleNode[], total: number }> {
pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
const skip = page * pageSize;
if (_isMemgraphActive) {
try {
const typeMatchClause = nodeType ? `:${nodeType}` : '';

const countQuery = `MATCH (n${typeMatchClause}) RETURN count(n) AS total`;
  const countResult = await executeMemgraphQuery(countQuery);
  const total = countResult && countResult.length > 0 ? Number(countResult[0].total) : 0;

  if (total === 0) return { nodes: [], total: 0 };

  const query = `
    MATCH (n${typeMatchClause})
    RETURN n
    ORDER BY n.id DESC
    SKIP $skip LIMIT $limit
  `;
  // Memgraph client's executeQuery already handles toInteger for skip/limit if needed
  const results = await executeMemgraphQuery(query, { skip, limit: pageSize });
  const nodes = results.map(result => result.n as BubbleNode);
  return { nodes, total };
} catch (error) {
  log(`Memgraph error getting all nodes (type: ${nodeType}): ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
  throw error;
}
} else {
return fallbackStorage.getAllNodes(page, pageSize, nodeType);
}
}

/**

Get all edges with optional pagination and relationship type filtering.
*/
export async function getAllEdges(
page: number = 0,
pageSize: number = DEFAULT_PAGE_SIZE,
relationshipType: string | null = null // Changed 'all' to null
): Promise<{ edges: Edge[], total: number }> {
pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
const skip = page * pageSize;
if (_isMemgraphActive) {
try {
const relTypeMatchClause = relationshipType ? `:${relationshipType}` : '';

const countQuery = `MATCH ()-[r${relTypeMatchClause}]->() RETURN count(r) AS total`;
  const countResult = await executeMemgraphQuery(countQuery);
  const total = countResult && countResult.length > 0 ? Number(countResult[0].total) : 0;

  if (total === 0) return { edges: [], total: 0 };

  const query = `
    MATCH (source)-[r${relTypeMatchClause}]->(target)
    RETURN r, type(r) AS relationshipType, startNode(r).id AS sourceId, endNode(r).id AS targetId
    ORDER BY r.createdAt DESC
    SKIP $skip LIMIT $limit
  `;
  const results = await executeMemgraphQuery(query, { skip, limit: pageSize });
  const edges = results.map(result => {
    const dbEdge = result.r;
    return {
      id: dbEdge.id || `${result.sourceId}-${result.relationshipType}-${result.targetId}`,
      source: result.sourceId,
      target: result.targetId,
      relationship: result.relationshipType,
      strength: dbEdge.strength || 0.5,
      properties: dbEdge,
    } as Edge;
  });
  return { edges, total };
} catch (error) {
  log(`Memgraph error getting all edges (type: ${relationshipType}): ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
  throw error;
}
} else {
return fallbackStorage.getAllEdges(page, pageSize, relationshipType);
}
}

/**

Get a subgraph centered around a specific node.
*/
export async function getSubgraph(
nodeId: string,
depth: number = 1 // Reduced default depth for performance
): Promise<{ nodes: BubbleNode[], edges: Edge[] }> {
if (_isMemgraphActive) {
try {
// Query to get nodes and relationships in the subgraph
// This query fetches distinct nodes and then relationships between them.
const query = `MATCH p = (centerNode {id: $nodeId})-[*0..${depth}]-(relatedNode) WITH COLLECT(DISTINCT centerNode) + COLLECT(DISTINCT relatedNode) AS allNodesInPath UNWIND allNodesInPath AS n WITH COLLECT(DISTINCT n) AS nodes UNWIND nodes as node1 UNWIND nodes as node2 MATCH (node1)-[r]-(node2) WHERE id(node1) < id(node2) // Avoid duplicate relationships and self-loops in this part RETURN COLLECT(DISTINCT properties(node1)) + COLLECT(DISTINCT properties(node2)) AS nodeProps, COLLECT(DISTINCT {id: r.id, source: startNode(r).id, target: endNode(r).id, relationship: type(r), strength: r.strength, properties: properties(r)}) AS rels;`
// This is a simplified approach; a more complex query or multiple queries might be needed for full subgraph data.
// The above query may not be optimal. A common pattern is to return paths and process them.
// For instance:
const pathQuery = `MATCH path = (centerNode {id: $nodeId})-[*0..${depth}]-(relatedNode) RETURN path`;
const results = await executeMemgraphQuery(pathQuery, { nodeId });
const nodesMap = new Map<string, BubbleNode>();
const edgesMap = new Map<string, Edge>();
results.forEach(record => {
const path = record.path;
path.segments.forEach((segment: any) => {
const startNode = segment.start.properties as BubbleNode;
const endNode = segment.end.properties as BubbleNode;
const rel = segment.relationship.properties;
const relType = segment.relationship.type;
if (startNode && startNode.id && !nodesMap.has(startNode.id)) nodesMap.set(startNode.id, startNode);
   if (endNode && endNode.id && !nodesMap.has(endNode.id)) nodesMap.set(endNode.id, endNode);

   const edgeId = rel.id || `${startNode.id}-${relType}-${endNode.id}`;
   if (!edgesMap.has(edgeId)) {
     edgesMap.set(edgeId, {
       id: edgeId,
       source: startNode.id,
       target: endNode.id,
       relationship: relType,
       strength: rel.strength || 0.5,
       properties: rel
     } as Edge);
   }
 });
 // Ensure center node is added if path is of length 0
 if(path.start && path.start.properties && !nodesMap.has(path.start.properties.id)) {
     nodesMap.set(path.start.properties.id, path.start.properties as BubbleNode);
 }
});
return { nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) };
} catch (error) {
log(`Memgraph error getting subgraph for node ${nodeId}: ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
throw error;
}
} else {
// Fallback implementation for getSubgraph (can be complex)
const centerNode = fallbackStorage.getNode(nodeId);
if (!centerNode) return { nodes: [], edges: [] };
const nodes = new Map<string, BubbleNode>();
const edges = new Map<string, Edge>();
const queue: { id: string, d: number }[] = [{ id: nodeId, d: 0 }];
const visited = new Set<string>();
nodes.set(nodeId, centerNode);
visited.add(nodeId);
while (queue.length > 0) {
const current = queue.shift()!;
if (current.d >= depth) continue;
const neighbors = fallbackStorage.getNodeNeighbors(current.id);
for (const neighborInfo of neighbors) {
const neighborNode = neighborInfo.node;
if (!nodes.has(neighborNode.id)) {
nodes.set(neighborNode.id, neighborNode);
}
// Find edge connecting current and neighbor
 const edgeId1 = `${current.id}-${neighborInfo.relationship}-${neighborNode.id}`;
 const edgeId2 = `${neighborNode.id}-${neighborInfo.relationship}-${current.id}`; // For undirected or differently stored
 
 let edge = fallbackStorage.getEdge(edgeId1) || fallbackStorage.getEdge(edgeId2);
 if(edge && !edges.has(edge.id)){
     edges.set(edge.id, edge);
 }


 if (!visited.has(neighborNode.id)) {
   visited.add(neighborNode.id);
   queue.push({ id: neighborNode.id, d: current.d + 1 });
 }
}
}
return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
}
}

/**
 * Find related nodes in Memgraph by traversing relationships.
 * @param nodeIds - Array of starting node IDs.
 * @param maxHops - Maximum number of hops to traverse.
 * @param limit - Maximum number of related nodes to return.
 * @param nodeTypes - Optional array of node types to filter related nodes by.
 * @returns A promise resolving to an array of related nodes.
 */
export async function findRelatedNodes(
  nodeIds: string[],
  maxHops: number = 2,
  limit: number = 20,
  nodeTypes: string[] = [] // Empty array means no type filtering for related nodes
): Promise<BubbleNode[]> {
  if (!_isMemgraphActive) {
    log("findRelatedNodes called in fallback mode. This functionality requires Memgraph.", "graph-service-warning");
    // In a true "Memgraph as SoT" for this feature, we might throw an error or return empty.
    // For now, returning empty to align with CG-21 removing Qdrant/fallback for this.
    return [];
  }
  if (nodeIds.length === 0) {
    return [];
  }

  try {
    // This Cypher query finds nodes related to the initial set (`nodeIds`)
    // by traversing paths up to `maxHops`. It prioritizes nodes with shorter path lengths.
    // It also filters related nodes by `nodeTypes` if provided.
    const query = `
      MATCH (startNode) WHERE startNode.id IN $nodeIds
      CALL {
          WITH startNode
          MATCH path = (startNode)-[*1..${maxHops}]-(relatedNode) // Ensure maxHops is an integer
          WHERE NOT relatedNode.id IN $nodeIds // Exclude the start nodes themselves from related results
          AND (CASE WHEN size($nodeTypes) > 0 THEN relatedNode.type IN $nodeTypes ELSE true END)
          RETURN relatedNode, min(length(path)) AS hopCount
          ORDER BY hopCount ASC // Prioritize closer nodes
      }
      WITH relatedNode, hopCount // Aggregate results before distinct and limit
      RETURN DISTINCT relatedNode AS node, hopCount
      ORDER BY hopCount ASC
      LIMIT $limit
    `;

    const params = {
      nodeIds,
      // maxHops: maxHops, // maxHops is directly in the query string, ensure it's integer
      nodeTypes,
      limit,
    };

    log(`Executing findRelatedNodes Memgraph query with params: ${JSON.stringify(params)}`, "graph-service-memgraph");
    const results = await executeMemgraphQuery(query, params);
    
    // Results will be like [{ node: { properties: {...} }, hopCount: X }, ...]
    // We need to extract the node properties.
    return results.map(record => {
        const nodeProps = record.node.properties || record.node;
        return {
            ...nodeProps,
            id: nodeProps.id, // Ensure id is at the top level
            // hopDistance: record.hopCount // Optionally include hop distance
        } as BubbleNode;
    });

  } catch (error) {
    log(`Memgraph error finding related nodes: ${error instanceof Error ? error.message : String(error)}.`, "graph-service-error");
    throw error; // Propagate error
  }
}


/**

Get graph statistics.
*/
export async function getGraphStats(): Promise<{ nodeCount: number, edgeCount: number, usingFallback: boolean }> {
if (_isMemgraphActive) {
try {
const nodeCountQuery = `MATCH (n) RETURN count(n) AS count`;
const edgeCountQuery = `MATCH ()-[r]->() RETURN count(r) AS count`;
const [nodeResult, edgeResult] = await Promise.all([
executeMemgraphQuery(nodeCountQuery),
executeMemgraphQuery(edgeCountQuery)
]);
const nodeCount = nodeResult && nodeResult.length > 0 ? Number(nodeResult[0].count) : 0;
const edgeCount = edgeResult && edgeResult.length > 0 ? Number(edgeResult[0].count) : 0;
return { nodeCount, edgeCount, usingFallback: false };
} catch (error) {
log(`Memgraph error getting graph stats: ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
// If stats fail, it might indicate a problem, but we don't fallback here.
// We return an error state for stats.
throw new Error(`Failed to retrieve Memgraph stats: ${error instanceof Error ? error.message : String(error)}`);
}
} else {
const stats = fallbackStorage.getStats();
return { ...stats, usingFallback: true };
}
}
/**

Execute a custom Cypher query.
If Memgraph is not active, this will attempt to handle specific known query types
(like vector search) via fallbackStorage, or return empty for arbitrary queries.
*/
export async function executeCustomQuery(query: string, params: Record<string, any> = {}): Promise<any[]> {
if (_isMemgraphActive) {
try {
log(`Executing custom Memgraph query: ${query.substring(0, 200)}...`, "graph-service-custom-query");
return await executeMemgraphQuery(query, params);
} catch (error) {
log(`Memgraph error executing custom query: ${error instanceof Error ? error.message : String(error)}. This operation will NOT use fallback.`, "graph-service-error");
throw error;
}
} else {
// Fallback mode: Try to handle known query patterns if possible
log(`Executing custom query in FALLBACK mode: ${query.substring(0, 200)}...`, "graph-service-fallback-query");
if ((query.includes('vector_search.search') || query.includes('db.index.vector.queryNodes')) && params.embedding) {
log(`Handling vector search query via fallbackStorage.`, "graph-service-fallback-query");
const { embedding, limit = 10, nodeTypes = [], minSimilarity = 0.5 } = params;
// The fallback vector search returns nodes with a 'similarity' property.
// The Memgraph query YIELDS node, similarity. So we need to make fallback result compatible.
const fallbackResults = fallbackStorage.vectorSearch(embedding, nodeTypes, limit, minSimilarity);
return fallbackResults.map(node => ({ node: node, similarity: node.similarity }));
}
// Add more handlers for other specific Cypher queries if needed for fallback.
log(`Cannot execute arbitrary custom query in fallback mode. Query: ${query.substring(0,200)}... Returning empty result.`, "graph-service-warning");
return [];
}
}