/**
 * MAGE Vector Service
 * Provides functions for working with the Memgraph MAGE vector similarity module
 */
import { executeCustomQuery } from '../db/graphService';
import { log } from '../vite';

/**
 * Perform vector search using Memgraph MAGE's vector similarity module
 * 
 * @param queryVector - The embedding vector to search with
 * @param minSimilarity - Minimum similarity threshold (0-1)
 * @param limit - Maximum number of results to return
 * @param nodeTypes - Optional array of node types to limit search to
 * @returns Array of nodes with similarity scores
 */
export async function vectorSearch(
  queryVector: number[],
  minSimilarity: number = 0.65,
  limit: number = 10,
  nodeTypes: string[] = []
): Promise<any[]> {
  try {
    log(`Performing vector search with ${queryVector.length} dimension vector, min similarity: ${minSimilarity}`, 'mage-vector-service');
    
    // Construct type filter if needed
    const typeFilter = nodeTypes.length > 0 
      ? `AND node.type IN $nodeTypes` 
      : '';
    
    // Build and execute the query
    const query = `
      CALL db.index.vector.queryNodes('vector_idx_all', $embedding, ${limit})
      YIELD node, similarity
      WHERE similarity >= ${minSimilarity} ${typeFilter}
      RETURN node, similarity
      ORDER BY similarity DESC
    `;
    
    log(`Executing MAGE vector query: ${query}`, 'mage-vector-service');
    
    const results = await executeCustomQuery(query, {
      embedding: queryVector,
      nodeTypes
    });
    
    // Process and transform the results
    const processedResults = results.map((result: any) => {
      const node = result.node?.properties || {};
      return {
        ...node,
        similarity: result.similarity
      };
    });
    
    log(`Vector search returned ${processedResults.length} results`, 'mage-vector-service');
    return processedResults;
  } catch (error) {
    log(`Vector search error: ${error instanceof Error ? error.message : String(error)}`, 'mage-vector-service-error');
    
    // Return empty results in case of failure
    return [];
  }
}

/**
 * Create MAGE vector indices for different node types
 * This ensures we have proper indices for vector similarity search
 */
export async function createVectorIndices(): Promise<void> {
  try {
    // Check if MAGE procedures exist
    try {
      // Try checking if MAGE modules are already loaded by querying for vector procedures
      const mageProcs = await executeCustomQuery('CALL mg.procedures() YIELD * WHERE name CONTAINS "vector" RETURN count(*) as proc_count');
      const procCount = mageProcs.length > 0 ? mageProcs[0].proc_count : 0;
      
      if (procCount > 0) {
        log(`Found ${procCount} vector procedures, MAGE appears to be loaded`, 'mage-vector-service');
      } else {
        // Try loading MAGE if no procedures found
        try {
          await executeCustomQuery('CALL mg.load("mage") YIELD *');
          log('MAGE loaded successfully', 'mage-vector-service');
        } catch (mageError) {
          // Try alternative method
          try {
            await executeCustomQuery('CALL mg.load_all() YIELD *');
            log('MAGE loaded using alternative method', 'mage-vector-service');
          } catch (allError) {
            log(`All MAGE loading attempts failed. Last error: ${allError instanceof Error ? allError.message : String(allError)}`, 'mage-vector-service-error');
            log('Continuing with fallback mode...', 'mage-vector-service');
          }
        }
      }
    } catch (error) {
      log(`Error checking MAGE: ${error instanceof Error ? error.message : String(error)}`, 'mage-vector-service-error');
      log('Continuing with fallback mode...', 'mage-vector-service');
    }
    
    // Get existing vector indices
    const indices = await executeCustomQuery(`
      CALL db.index.vector() 
      YIELD index_name, index_label, property_name 
      RETURN index_name AS name, index_label AS label, property_name AS property
    `);
    
    log(`Found ${indices.length} existing vector indices`, 'mage-vector-service');
    
    // Initialize indices if they don't exist
    const existingIndices = new Set(indices.map((idx: any) => idx.name));
    
    // Create general vector index for all nodes
    if (!existingIndices.has('vector_idx_all')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_all ON :Node(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 1024,
        "metric": "cos",
        "resize_coefficient": 2
      }
      `);
      log('Created vector index: vector_idx_all for label: Node', 'mage-vector-service');
    }
    
    // Create index for message nodes
    if (!existingIndices.has('vector_idx_msg')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_msg ON :ai_message|user_message(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 1024,
        "metric": "cos",
        "resize_coefficient": 2
      }
      `);
      log('Created vector index: vector_idx_msg for label: ai_message|user_message', 'mage-vector-service');
    }
    
    // Create index for topic nodes
    if (!existingIndices.has('vector_idx_topic')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_topic ON :topic(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 1024,
        "metric": "cos",
        "resize_coefficient": 2
      }
      `);
      log('Created vector index: vector_idx_topic for label: topic', 'mage-vector-service');
    }
    
    // Create index for entity nodes
    if (!existingIndices.has('vector_idx_entity')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_entity ON :entity(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 1024,
        "metric": "cos",
        "resize_coefficient": 2
      }
      `);
      log('Created vector index: vector_idx_entity for label: entity', 'mage-vector-service');
    }
    
    log('MAGE vector service initialized successfully', 'mage-vector-service');
  } catch (error) {
    log(`Error initializing MAGE vector indices: ${error instanceof Error ? error.message : String(error)}`, 'mage-vector-service-error');
    throw error;
  }
}

/**
 * Initialize the MAGE vector service
 * This should be called during server startup
 */
export async function initMageVectorService(): Promise<void> {
  await createVectorIndices();
}