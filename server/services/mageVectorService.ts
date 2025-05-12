/**
 * MAGE Vector Service for Memgraph
 * Handles vector similarity search and operations using the Memgraph MAGE extension
 */

import { log } from "../vite";
import { executeCustomQuery } from "../db/graphService";
import { BubbleNode } from "../../client/src/types";

/**
 * Initialize MAGE vector service and create necessary vector indices
 */
export async function initializeMageVectorService() {
  try {
    // First check if MAGE is loaded properly
    await loadMageIfNeeded();
    
    // Get existing vector indices
    const indices = await getVectorIndices();
    log(`Found ${indices.length} existing vector indices`, "mage-vector-service");
    
    // Create common vector indices if they don't exist already
    
    // General index for all node types
    if (!indices.some(idx => idx.name === 'vector_idx_all')) {
      await createVectorIndex('vector_idx_all', 'Node', 'embedding');
    }
    
    // Index for message nodes
    if (!indices.some(idx => idx.name === 'vector_idx_msg')) {
      await createVectorIndex('vector_idx_msg', 'ai_message|user_message', 'embedding');
    }
    
    // Index for topic nodes
    if (!indices.some(idx => idx.name === 'vector_idx_topic')) {
      await createVectorIndex('vector_idx_topic', 'topic', 'embedding');
    }
    
    // Index for entity nodes
    if (!indices.some(idx => idx.name === 'vector_idx_entity')) {
      await createVectorIndex('vector_idx_entity', 'entity', 'embedding');
    }
    
    log("MAGE vector service initialized successfully", "mage-vector-service");
    return true;
  } catch (error) {
    log(`Error initializing MAGE vector service: ${error}`, "mage-vector-service-error");
    return false;
  }
}

/**
 * Load MAGE module if it's not already loaded
 */
async function loadMageIfNeeded() {
  try {
    // First check if MAGE is loaded
    const checkMageQuery = `CALL mg.load() YIELD *`;
    
    try {
      await executeCustomQuery(checkMageQuery);
      log("MAGE is already loaded", "mage-vector-service");
    } catch (error) {
      // If not loaded, attempt to load it
      log("MAGE not loaded, attempting to load it now", "mage-vector-service");
      
      const loadMageQuery = `CALL mg.load()`;
      await executeCustomQuery(loadMageQuery);
      
      log("MAGE loaded successfully", "mage-vector-service");
    }
    
    return true;
  } catch (error) {
    log(`Error loading MAGE: ${error}`, "mage-vector-service-error");
    throw new Error(`Failed to load MAGE module: ${error}`);
  }
}

/**
 * Get existing vector indices from the database
 */
async function getVectorIndices() {
  try {
    const query = `
      CALL db.index.vector() 
      YIELD index_name, index_label, property_name 
      RETURN index_name AS name, index_label AS label, property_name AS property
    `;
    
    const results = await executeCustomQuery(query);
    return results;
  } catch (error) {
    log(`Error getting vector indices: ${error}`, "mage-vector-service-error");
    return [];
  }
}

/**
 * Create a vector index for a specific node label and property
 */
async function createVectorIndex(indexName: string, label: string, property: string) {
  try {
    const query = `
      CREATE VECTOR INDEX ${indexName} ON :${label}(${property})
      WITH CONFIG {
        "dimension": 768,
        "capacity": 1024,
        "metric": "cos",
        "resize_coefficient": 2
      }
    `;
    
    await executeCustomQuery(query);
    log(`Created vector index: ${indexName} for label: ${label}`, "mage-vector-service");
    return true;
  } catch (error) {
    log(`Error creating vector index ${indexName}: ${error}`, "mage-vector-service-error");
    return false;
  }
}

/**
 * Perform a vector similarity search using MAGE vector index
 * 
 * @param embedding The vector embedding to search with
 * @param indexName Optional specific index to use (defaults to all nodes)
 * @param limit Maximum number of results to return
 * @param minSimilarity Minimum similarity threshold (0-1)
 * @returns Array of matching nodes with similarity scores
 */
export async function performVectorSearch(
  embedding: number[],
  indexName: string = 'vector_idx_all',
  limit: number = 10,
  minSimilarity: number = 0.5
): Promise<BubbleNode[]> {
  try {
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Invalid embedding vector provided");
    }
    
    // Vector search using MAGE
    const query = `
      CALL db.index.vector.queryNodes($indexName, $embedding, $limit)
      YIELD node, similarity
      WHERE similarity >= $minSimilarity
      RETURN node, similarity
      ORDER BY similarity DESC
    `;
    
    const results = await executeCustomQuery(query, {
      indexName,
      embedding,
      limit,
      minSimilarity
    });
    
    // Convert results to BubbleNode objects with similarity scores
    return results.map((result: any) => {
      const node = result.node.properties;
      return {
        ...node,
        similarity: result.similarity
      } as BubbleNode & { similarity: number };
    });
  } catch (error) {
    log(`Error in vector search: ${error}`, "mage-vector-service-error");
    return [];
  }
}

/**
 * Perform an advanced semantic search that includes graph traversal
 * This allows finding not just similar nodes, but related content through connections
 * 
 * @param embedding The vector embedding to search with
 * @param options Search options including node types, limits, etc.
 * @returns Array of nodes with similarity scores and direct/indirect flags
 */
export async function performSemanticGraphSearch(
  embedding: number[],
  options: {
    nodeTypes?: string[];
    limit?: number;
    minSimilarity?: number;
    maxHops?: number;
    includeRelated?: boolean;
  } = {}
): Promise<BubbleNode[]> {
  const {
    nodeTypes,
    limit = 10,
    minSimilarity = 0.5,
    maxHops = 1,
    includeRelated = true
  } = options;
  
  try {
    // First, find direct vector matches
    let query = `
      CALL db.index.vector.queryNodes('vector_idx_all', $embedding, $limit)
      YIELD node, similarity
      WHERE similarity >= $minSimilarity
    `;
    
    // Add node type filter if specified
    if (nodeTypes && nodeTypes.length > 0) {
      const typeLabelsList = nodeTypes.map(t => `node:${t}`).join(' OR ');
      query += `\nAND (${typeLabelsList})`;
    }
    
    // Complete the query for direct matches
    query += `
      WITH node, similarity
      RETURN node, similarity, true AS isDirectMatch
      ORDER BY similarity DESC
      LIMIT $limit
    `;
    
    // Execute the query for direct matches
    const results = await executeCustomQuery(query, {
      embedding,
      limit,
      minSimilarity
    });
    
    // Convert results to nodes with similarity and match type
    const directMatches = results.map((result: any) => {
      const node = result.node.properties;
      return {
        ...node,
        similarity: result.similarity,
        isDirectMatch: true
      };
    });
    
    let allResults = [...directMatches];
    
    // If we want related nodes and have direct matches, find connected nodes
    if (includeRelated && directMatches.length > 0 && maxHops > 0) {
      // Get IDs of direct matches to use as starting points
      const directMatchIds = directMatches.map((node: any) => node.id);
      
      // Query for related nodes through the graph
      const relatedQuery = `
        MATCH (startNode)
        WHERE startNode.id IN $directMatchIds
        MATCH path = (startNode)-[*1..${maxHops}]-(relatedNode)
        WHERE NOT relatedNode.id IN $directMatchIds
      `;
      
      // Add node type filter if specified
      if (nodeTypes && nodeTypes.length > 0) {
        const typeLabelsList = nodeTypes.map(t => `relatedNode:${t}`).join(' OR ');
        query += `\nAND (${typeLabelsList})`;
      }
      
      // Complete the query
      const relatedQueryComplete = relatedQuery + `
        WITH DISTINCT relatedNode
        RETURN relatedNode AS node, 0.0 AS similarity, false AS isDirectMatch
        LIMIT $relatedLimit
      `;
      
      const relatedResults = await executeCustomQuery(relatedQueryComplete, {
        directMatchIds,
        relatedLimit: limit
      });
      
      // Convert related results
      const relatedMatches = relatedResults.map((result: any) => {
        const node = result.node.properties;
        return {
          ...node,
          similarity: 0,  // No direct similarity score
          isDirectMatch: false
        };
      });
      
      // Combine direct and related matches, prioritizing direct matches
      allResults = [...directMatches, ...relatedMatches].slice(0, limit);
    }
    
    return allResults;
  } catch (error) {
    log(`Error in semantic graph search: ${error}`, "mage-vector-service-error");
    return [];
  }
}