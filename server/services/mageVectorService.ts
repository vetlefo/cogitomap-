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
    
    // Build and execute the query - using Memgraph 3.0+ vector_search module
    const query = `
      CALL vector_search.search('vector_idx_all', ${limit}, $embedding)
      YIELD node, similarity
      WITH node, similarity
      WHERE similarity >= ${minSimilarity}
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
      // Try checking if MAGE modules are already loaded
      // Memgraph doesn't support WHERE after YIELD, so we filter results in memory
      let vectorProcCount = 0;
      try {
        const allProcs = await executeCustomQuery('CALL mg.procedures() YIELD name RETURN name');
        // Filter the results in-memory rather than with WHERE clause
        const vectorProcs = allProcs.filter(proc => proc.name && proc.name.includes('vector'));
        vectorProcCount = vectorProcs.length;
        
        log(`Found ${vectorProcs.length} vector procedures: ${vectorProcs.map(p => p.name).join(', ')}`, 'mage-vector-service-debug');
      } catch (procError) {
        log(`Error fetching procedures: ${procError}`, 'mage-vector-service-debug');
        // Continue with initialization even if procedure check fails
      }
      
      if (vectorProcCount > 0) {
        log(`Found ${vectorProcCount} vector procedures, MAGE appears to be loaded`, 'mage-vector-service');
      } else {
        // Try loading MAGE if no procedures found
        try {
          // Load vector_search module specifically for Memgraph 3.0+
          await executeCustomQuery('CALL mg.load("vector_search")');
          log('MAGE vector_search module loaded successfully', 'mage-vector-service');
        } catch (mageError) {
          // Try alternative method
          try {
            // In Memgraph 3.0, load_all doesn't use YIELD
            await executeCustomQuery('CALL mg.load_all()');
            log('MAGE loaded using mg.load_all()', 'mage-vector-service');
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
    
    // Get existing vector indices - using Memgraph 3.0 SHOW INDEX INFO command
    const indices = await executeCustomQuery(`
      SHOW INDEX INFO
      YIELD index_name, index_type, object_type, schema_name, property_name
      WITH index_name, index_type, object_type, schema_name, property_name
      WHERE index_type = 'vector'
      RETURN index_name AS name, schema_name AS label, property_name AS property
    `);
    
    log(`Found ${indices.length} existing vector indices`, 'mage-vector-service');
    
    // Initialize indices if they don't exist
    const existingIndices = new Set(indices.map((idx: any) => idx.name));
    
    // Create general vector index for all nodes - updated for Memgraph 3.0
    if (!existingIndices.has('vector_idx_all')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_all ON :Node(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 10000,
        "metric": "cos"
      }
      `);
      log('Created vector index: vector_idx_all for label: Node', 'mage-vector-service');
    }
    
    // Create index for message nodes - updated for Memgraph 3.0
    if (!existingIndices.has('vector_idx_msg')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_msg ON :ai_message|user_message(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 10000,
        "metric": "cos"
      }
      `);
      log('Created vector index: vector_idx_msg for label: ai_message|user_message', 'mage-vector-service');
    }
    
    // Create index for topic nodes - updated for Memgraph 3.0
    if (!existingIndices.has('vector_idx_topic')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_topic ON :topic(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 10000,
        "metric": "cos"
      }
      `);
      log('Created vector index: vector_idx_topic for label: topic', 'mage-vector-service');
    }
    
    // Create index for entity nodes - updated for Memgraph 3.0
    if (!existingIndices.has('vector_idx_entity')) {
      await executeCustomQuery(`
      CREATE VECTOR INDEX vector_idx_entity ON :entity(embedding)
      WITH CONFIG {
        "dimension": 768,
        "capacity": 10000,
        "metric": "cos"
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