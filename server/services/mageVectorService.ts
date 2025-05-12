/**
 * MAGE Vector Service
 * Specialized service for working with MAGE vector operations in Memgraph
 * Provides functions for creating indices, searching, and optimizing vector operations
 */

import { log } from "../vite";
import { MemgraphClient, configureMemgraphClient } from "./memgraphClient";
import { normalizeVector } from "./embeddingService";

// Default configuration for vector indices
const DEFAULT_VECTOR_CONFIG = {
  dimension: 768,    // Default for text-embedding-3-small with some dimension reduction
  capacity: 1024,    // Start with 1024 vectors (2^10)
  metric: "cos",     // Cosine similarity for text embeddings
  resize_coefficient: 2.0  // Double capacity when needed
};

// Vector index names for different node types
const VECTOR_INDICES = {
  all: "vector_idx_all",       // General index for all nodes
  messages: "vector_idx_msg",  // Message-specific index
  topics: "vector_idx_topic",  // Topic-specific index
  entities: "vector_idx_entity" // Entity-specific index  
};

// Client instance
let memgraphClient: MemgraphClient;

/**
 * Initialize the MAGE vector service
 * This sets up the client and ensures vector indices exist
 */
export async function initializeMageVectorService() {
  try {
    log("Initializing MAGE vector service...", "mage-vector-service");
    memgraphClient = await configureMemgraphClient();
    
    // Check if Memgraph is available and has MAGE loaded
    await ensureMageAvailable();
    
    // Create necessary vector indices
    await ensureVectorIndices();
    
    log("MAGE vector service initialized successfully", "mage-vector-service");
    return true;
  } catch (error) {
    log(`Failed to initialize MAGE vector service: ${error}`, "mage-vector-service-error");
    return false;
  }
}

/**
 * Verify MAGE module availability with vector search capabilities
 */
async function ensureMageAvailable(): Promise<boolean> {
  try {
    // Check if vector_search module is loaded
    const result = await memgraphClient.executeQuery(
      "MATCH (n) RETURN EXISTS(n.id) AS test, count(n) as test_count LIMIT 1"
    );
    
    log("MAGE availability check completed", "mage-vector-service");
    return true;
  } catch (error) {
    log(`Error checking MAGE availability: ${error}`, "mage-vector-service-error");
    throw new Error("MAGE vector module not available");
  }
}

/**
 * Create vector indices if they don't exist already
 */
async function ensureVectorIndices(): Promise<void> {
  try {
    // Get existing indices
    const indices = await listVectorIndices();
    const existingNames = indices.map(idx => idx.name);
    
    // Create missing indices
    for (const [key, indexName] of Object.entries(VECTOR_INDICES)) {
      if (!existingNames.includes(indexName)) {
        let nodeLabel = "Node"; // Default label
        
        // Set appropriate node label based on index type
        switch (key) {
          case "messages":
            nodeLabel = "ai_message|user_message";
            break;
          case "topics":
            nodeLabel = "topic";
            break;
          case "entities":
            nodeLabel = "entity";
            break;
          default:
            nodeLabel = "Node";
        }
        
        // Create vector index
        await createVectorIndex(indexName, nodeLabel, "embedding", DEFAULT_VECTOR_CONFIG);
        log(`Created vector index: ${indexName} for label: ${nodeLabel}`, "mage-vector-service");
      } else {
        log(`Vector index already exists: ${indexName}`, "mage-vector-service");
      }
    }
  } catch (error) {
    log(`Error ensuring vector indices: ${error}`, "mage-vector-service-error");
    throw new Error("Failed to create vector indices");
  }
}

/**
 * List existing vector indices in the database
 */
async function listVectorIndices(): Promise<Array<{name: string, label: string, property: string}>> {
  try {
    // Query to list vector indices
    const query = `
      CALL db.index.vector() 
      YIELD index_name, index_label, property_name 
      RETURN index_name AS name, index_label AS label, property_name AS property
    `;
    
    const result = await memgraphClient.executeQuery(query);
    return result.map(row => ({
      name: row.name,
      label: row.label,
      property: row.property
    }));
  } catch (error) {
    log(`Error listing vector indices: ${error}`, "mage-vector-service-error");
    return [];
  }
}

/**
 * Create a vector index on a node property
 * 
 * @param indexName Name for the vector index
 * @param nodeLabel Label(s) of nodes to index (can use | for multiple labels)
 * @param propertyName Property name containing the vector
 * @param config Configuration parameters for the index
 */
export async function createVectorIndex(
  indexName: string,
  nodeLabel: string,
  propertyName: string,
  config: {
    dimension: number,
    capacity: number,
    metric: string,
    resize_coefficient: number
  }
): Promise<boolean> {
  try {
    const query = `
      CREATE VECTOR INDEX ${indexName} ON :${nodeLabel}(${propertyName})
      WITH CONFIG {
        "dimension": ${config.dimension},
        "capacity": ${config.capacity},
        "metric": "${config.metric}",
        "resize_coefficient": ${config.resize_coefficient}
      }
    `;
    
    await memgraphClient.executeQuery(query);
    return true;
  } catch (error) {
    log(`Error creating vector index ${indexName}: ${error}`, "mage-vector-service-error");
    return false;
  }
}

/**
 * Perform a vector similarity search using MAGE
 * 
 * @param queryVector Query embedding vector
 * @param indexName Name of the vector index to search
 * @param limit Maximum number of results to return
 * @param minSimilarity Minimum similarity threshold (0-1)
 * @returns Array of {node, similarity} objects
 */
export async function performVectorSearch(
  queryVector: number[],
  indexName: string = VECTOR_INDICES.all,
  limit: number = 5,
  minSimilarity: number = 0.6
): Promise<Array<{id: string, type: string, content: string, similarity: number}>> {
  try {
    // Normalize the vector for consistent results
    const normalizedVector = normalizeVector(queryVector);
    
    // Build and execute the vector search query
    const query = `
      CALL vector_search.search("${indexName}", ${limit}, $embedding)
      YIELD node, similarity
      WHERE similarity >= ${minSimilarity}
      RETURN node.id AS id, node.type AS type, node.content AS content, similarity
      ORDER BY similarity DESC
    `;
    
    const result = await memgraphClient.executeQuery(query, { embedding: normalizedVector });
    
    return result.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      similarity: row.similarity
    }));
  } catch (error) {
    log(`Error performing vector search: ${error}`, "mage-vector-service-error");
    return [];
  }
}

/**
 * Advanced semantic search with expansion via graph traversal
 * 
 * @param queryVector Query embedding vector
 * @param options Advanced search options
 * @returns Expanded result set with related nodes
 */
export async function performSemanticGraphSearch(
  queryVector: number[],
  options: {
    indexName?: string,
    limit?: number,
    minSimilarity?: number,
    maxHops?: number,
    includeRelated?: boolean,
    nodeTypes?: string[],
    requireKeywords?: string[]
  } = {}
): Promise<Array<{id: string, type: string, content: string, similarity: number, isDirectMatch: boolean}>> {
  try {
    // Apply defaults
    const {
      indexName = VECTOR_INDICES.all,
      limit = 10,
      minSimilarity = 0.6,
      maxHops = 2,
      includeRelated = true,
      nodeTypes = [],
      requireKeywords = []
    } = options;
    
    // Normalize the vector
    const normalizedVector = normalizeVector(queryVector);
    
    // Build nodeType filter
    let nodeTypeFilter = '';
    if (nodeTypes && nodeTypes.length > 0) {
      const typeList = nodeTypes.map(t => `node.type = '${t}'`).join(' OR ');
      nodeTypeFilter = ` AND (${typeList})`;
    }
    
    // Build keyword filter
    let keywordFilter = '';
    if (requireKeywords && requireKeywords.length > 0) {
      const keywordFilters = requireKeywords.map(keyword => 
        `(node.content CONTAINS '${keyword}' OR 
          EXISTS(node.keywords) AND ANY(kw IN node.keywords WHERE kw CONTAINS '${keyword}'))`
      ).join(' OR ');
      keywordFilter = ` AND (${keywordFilters})`;
    }
    
    // Build relationship expansion query if needed
    const expansionQuery = includeRelated ? `
      WITH COLLECT(seed_node) AS initialNodes
      
      // Expand to related nodes within n hops
      UNWIND initialNodes AS seedNode
      OPTIONAL MATCH path = (seedNode)-[*1..${maxHops}]-(related)
      WITH initialNodes, COLLECT(DISTINCT related) AS relatedNodes
      
      // Combine initial and related nodes
      WITH initialNodes, relatedNodes
      UNWIND initialNodes + relatedNodes AS node
      WHERE node IS NOT NULL
    ` : '';
    
    // Final sorting and limiting
    const finalSort = includeRelated ? `
      // Track which are direct matches vs related
      WITH node, node IN initialNodes AS isDirectMatch
      CALL vector_search.dot_product(node.embedding, $embedding) AS expandedSimilarity
      WHERE expandedSimilarity >= ${minSimilarity}
      
      // Sort by whether it's a direct match first, then by similarity
      RETURN node.id AS id, node.type AS type, node.content AS content, 
             expandedSimilarity AS similarity, isDirectMatch
      ORDER BY isDirectMatch DESC, similarity DESC
      LIMIT ${limit}
    ` : `
      RETURN node.id AS id, node.type AS type, node.content AS content, 
             similarity, true AS isDirectMatch
      LIMIT ${limit}
    `;
    
    // Complete query
    const query = `
      // Step 1: Find initial nodes via vector search
      CALL vector_search.search("${indexName}", ${Math.min(limit * 2, 20)}, $embedding)
      YIELD node AS seed_node, similarity
      WHERE similarity >= ${minSimilarity}${nodeTypeFilter}${keywordFilter}
      
      ${expansionQuery}
      
      ${finalSort}
    `;
    
    const result = await memgraphClient.executeQuery(query, { embedding: normalizedVector });
    
    return result.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      similarity: row.similarity,
      isDirectMatch: row.isDirectMatch
    }));
  } catch (error) {
    log(`Error performing semantic graph search: ${error}`, "mage-vector-service-error");
    return [];
  }
}

/**
 * Store an embedding vector on a node
 * 
 * @param nodeId ID of the node
 * @param embedding Vector to store
 * @returns Success status
 */
export async function storeNodeEmbedding(
  nodeId: string,
  embedding: number[]
): Promise<boolean> {
  try {
    // Normalize the vector
    const normalizedEmbedding = normalizeVector(embedding);
    
    // Update the node with the embedding
    const query = `
      MATCH (n {id: $nodeId})
      SET n.embedding = $embedding
      RETURN n.id
    `;
    
    await memgraphClient.executeQuery(query, { 
      nodeId,
      embedding: normalizedEmbedding
    });
    
    return true;
  } catch (error) {
    log(`Error storing embedding for node ${nodeId}: ${error}`, "mage-vector-service-error");
    return false;
  }
}