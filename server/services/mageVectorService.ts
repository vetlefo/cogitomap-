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
    
    // Try executing using Memgraph first, with fallback to in-memory if needed
    try {
      // Try different vector search queries, starting with the most optimized for Memgraph 3.0+
      
      // First attempt: using vector_search.search procedure (recommended for Memgraph 3.0+)
      try {
        // Build and execute the query using the dedicated procedure
        let query = '';
        let results = [];
        
        if (nodeTypes.length > 0) {
          // If we have node types, we need to use the specific index for that type
          const nodeType = nodeTypes[0]; // Use first type for now
          let indexName = '';
          
          // Select appropriate index based on node type
          if (nodeType === 'ai_message' || nodeType === 'user_message') {
            indexName = 'vector_idx_msg';
          } else if (nodeType === 'topic') {
            indexName = 'vector_idx_topic';
          } else if (nodeType === 'entity') {
            indexName = 'vector_idx_entity';
          } else {
            indexName = 'vector_idx_all';
          }
          
          query = `
            CALL vector_search.search('${indexName}', ${limit}, $embedding)
            YIELD node, similarity
            WHERE similarity >= ${minSimilarity} AND node.type IN $nodeTypes
            RETURN node, similarity
            ORDER BY similarity DESC
            LIMIT ${limit}
          `;
        } else {
          // If no node types specified, use the general index
          query = `
            CALL vector_search.search('vector_idx_all', ${limit}, $embedding)
            YIELD node, similarity
            WHERE similarity >= ${minSimilarity}
            RETURN node, similarity
            ORDER BY similarity DESC
            LIMIT ${limit}
          `;
        }
        
        log(`Executing MAGE vector query: ${query}`, 'mage-vector-service-debug');
        
        results = await executeCustomQuery(query, {
          embedding: queryVector,
          nodeTypes
        });
        
        // Process and transform the results
        const processedResults = results.map((result: any) => {
          // Handle different result formats based on database implementation
          if (result.node && typeof result.node === 'object') {
            // Extract properties if we get a node object
            const node = result.node.properties || result.node;
            return {
              ...node,
              similarity: result.similarity
            };
          } else {
            // Direct property access if we already have a flattened structure
            return {
              ...result,
              similarity: result.similarity
            };
          }
        });
        
        log(`Vector search returned ${processedResults.length} results`, 'mage-vector-service');
        return processedResults;
        
      } catch (vectorSearchError) {
        // If first approach fails, try alternative
        log(`Primary vector search approach failed: ${vectorSearchError}`, 'mage-vector-service-debug');
        throw vectorSearchError; // Re-throw to trigger fallback
      }
    } catch (memgraphError) {
      // If Memgraph approaches fail, use fallback storage for vector search
      log(`All Memgraph vector search methods failed, using fallback: ${memgraphError}`, 'mage-vector-service-warning');
      
      // Use executeCustomQuery which will route to fallback storage's vector search
      const results = await executeCustomQuery(
        'CALL db.index.vector.queryNodes($indexName, $embedding, $limit, $cutoff) YIELD node, similarity',
        {
          indexName: 'vector_idx_all',
          embedding: queryVector,
          limit,
          cutoff: minSimilarity,
          nodeTypes
        }
      );
      
      return results;
    }
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
    // First check if we can execute custom queries (confirms we're not in fallback mode)
    try {
      // Simple test query to check if we're in fallback mode
      const testQuery = "RETURN 1 as test";
      await executeCustomQuery(testQuery);
    } catch (fallbackError) {
      if (String(fallbackError).includes("fallback mode")) {
        log("Running in fallback mode, skipping vector index creation", 'mage-vector-service-warning');
        // We're in fallback mode, so return early - no indices needed
        return;
      }
    }
  
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
            log('Continuing with limited vector capability...', 'mage-vector-service-warning');
            return; // Exit early if we can't load MAGE modules
          }
        }
      }
    } catch (error) {
      log(`Error checking MAGE: ${error instanceof Error ? error.message : String(error)}`, 'mage-vector-service-error');
      log('Continuing with limited vector capability...', 'mage-vector-service-warning');
      return; // Exit early if we can't check MAGE modules
    }
    
    // Get existing vector indices - using a simpler command compatible with Memgraph 3.0+
    let indices = [];
    try {
      // Try a different way to list indices in Memgraph 3.0+
      try {
        // Try using the vector_search.show_index_info procedure from Memgraph 3.0+
        indices = await executeCustomQuery(`CALL vector_search.show_index_info() YIELD *`);
        
        // This will already be filtered to vector indices only
        if (indices && indices.length > 0) {
          log(`Vector indices from vector_search.show_index_info: ${JSON.stringify(indices)}`, 'mage-vector-service-debug');
        }
      } catch (vectorSearchError) {
        log(`Error using vector_search.show_index_info: ${vectorSearchError}`, 'mage-vector-service-debug');
        
        try {
          // Try a different procedure
          indices = await executeCustomQuery(`CALL mg.indexinfo() YIELD *`);
          
          // Filter for vector indices in application code
          if (indices && indices.length > 0) {
            indices = indices.filter((idx: any) => 
              idx.type && idx.type.toLowerCase().includes('vector'));
          }
        } catch (mgIndexError) {
          log(`Error using mg.indexinfo: ${mgIndexError}`, 'mage-vector-service-debug');
          
          // Last attempt
          try {
            indices = await executeCustomQuery(`SHOW INDEX INFO`);
            
            // Filter for vector indices in application code 
            if (indices && indices.length > 0) {
              indices = indices.filter((idx: any) => 
                idx.index_type && idx.index_type.toLowerCase().includes('vector'));
            }
          } catch (showError) {
            log(`Error getting indices with SHOW command: ${showError}`, 'mage-vector-service-debug');
            indices = [];
          }
        }
      }
      
      log(`Found ${indices.length} existing vector indices`, 'mage-vector-service');
    } catch (indexError) {
      log(`Error checking vector indices: ${indexError}`, 'mage-vector-service-error');
      // Continue with assumption that indices don't exist
      indices = [];
    }
    
    // Initialize indices if they don't exist
    const existingIndices = new Set(indices.map((idx: any) => idx.name));
    
    try {
      // Attempt to create vector indices using specific Memgraph procedures
      try {
        if (!existingIndices.has('vector_idx_all')) {
          try {
            // Try using CREATE VECTOR INDEX first (Memgraph 3.0 syntax)
            await executeCustomQuery(`
              CREATE VECTOR INDEX vector_idx_all ON :Node(embedding)
              WITH CONFIG {
                "dimension": 768,
                "capacity": 10000,
                "metric": "cos"
              }
            `);
            log('Created vector index: vector_idx_all for label: Node', 'mage-vector-service');
          } catch (createError) {
            log(`Vector index creation error: ${createError}`, 'mage-vector-service-error');
            
            // Try alternative syntax
            try {
              await executeCustomQuery(`
                CALL vector_search.create_index(
                  "vector_idx_all", 
                  "Node", 
                  "embedding", 
                  768, 
                  10000, 
                  "cosine"
                );
              `);
              log('Created vector index using procedure: vector_idx_all', 'mage-vector-service');
            } catch (altError) {
              log(`Procedure vector index creation also failed: ${altError}`, 'mage-vector-service-error');
            }
          }
        }
        
        // Create index for message nodes
        if (!existingIndices.has('vector_idx_msg')) {
          try {
            await executeCustomQuery(`
              CALL vector_search.create_index(
                "vector_idx_msg", 
                "ai_message", 
                "embedding", 
                768, 
                10000, 
                "cosine"
              );
            `);
            log('Created vector index: vector_idx_msg for label: ai_message', 'mage-vector-service');
          } catch (createError) {
            log(`Error creating message vector index: ${createError}`, 'mage-vector-service-error');
          }
        }
        
        // Create index for topic nodes
        if (!existingIndices.has('vector_idx_topic')) {
          try {
            await executeCustomQuery(`
              CALL vector_search.create_index(
                "vector_idx_topic", 
                "topic", 
                "embedding", 
                768, 
                10000, 
                "cosine"
              );
            `);
            log('Created vector index: vector_idx_topic for label: topic', 'mage-vector-service');
          } catch (createError) {
            log(`Error creating topic vector index: ${createError}`, 'mage-vector-service-error');
          }
        }
        
        // Create index for entity nodes
        if (!existingIndices.has('vector_idx_entity')) {
          try {
            await executeCustomQuery(`
              CALL vector_search.create_index(
                "vector_idx_entity", 
                "entity", 
                "embedding", 
                768, 
                10000, 
                "cosine"
              );
            `);
            log('Created vector index: vector_idx_entity for label: entity', 'mage-vector-service');
          } catch (createError) {
            log(`Error creating entity vector index: ${createError}`, 'mage-vector-service-error');
          }
        }
      } catch (error) {
        log(`Error in vector index creation: ${error}`, 'mage-vector-service-error');
      }
    } catch (createError) {
      log(`Error creating vector indices: ${createError}`, 'mage-vector-service-error');
      log('Vector search capability may be limited', 'mage-vector-service-warning');
      // Continue - we did our best to create the indices
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
  try {
    await createVectorIndices();
  } catch (error) {
    // Log the error but don't throw it - allow application to continue with fallback
    log(`MAGE vector service initialization error: ${error instanceof Error ? error.message : String(error)}`, 'mage-vector-service-error');
    log('Application will continue with limited vector search capabilities', 'mage-vector-service-warning');
  }
}