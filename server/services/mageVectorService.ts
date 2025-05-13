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
    log(`Performing vector search with ${queryVector.length} dimension vector, min similarity: ${minSimilarity}, types: ${nodeTypes.join(',')}`, 'mage-vector-service');
    
    // Try executing using Memgraph first
    try {
      // First attempt: using vector_search.search procedure (recommended for Memgraph 3.0+)
      let query = '';
      const params: any = {
        embedding: queryVector,
        minSimilarity: minSimilarity, // Ensure minSimilarity is passed as a parameter
        limit: limit, // Ensure limit is passed as a parameter
      };

      // Determine the index name and query structure based on nodeTypes
      // If specific node types are provided, we might want to query specific indexes
      // or filter after a general search. For simplicity with vector_search.search,
      // we can use a general index and filter by type, or select a type-specific index.
      
      // Let's assume 'vector_idx_all' is a general index on a common label like :Node or :Concept
      // and we filter by type afterwards. Or, if type-specific indexes exist (e.g., vector_idx_topic for :Topic nodes)
      // a more complex logic to choose the index or UNION results might be needed.
      // For now, using 'vector_idx_all' and filtering.

      const indexName = 'vector_idx_all'; // Assuming a general index for all relevant nodes

      query = `
        CALL vector_search.search('${indexName}', $limit, $embedding)
        YIELD node, similarity
        WITH node, similarity
      `;

      if (nodeTypes.length > 0) {
        query += `
        WHERE node.type IN $nodeTypes AND similarity >= $minSimilarity
        `;
        params.nodeTypes = nodeTypes;
      } else {
        query += `
        WHERE similarity >= $minSimilarity
        `;
      }
      
      query += `
        RETURN node, similarity
        ORDER BY similarity DESC
        LIMIT $limit
      `;
        
      log(`Executing MAGE vector query: ${query}`, 'mage-vector-service-debug');
        
      const results = await executeCustomQuery(query, params);
        
      const processedResults = results.map((result: any) => {
        const nodeProperties = result.node.properties || result.node; // Handle Memgraph node structure
        return {
          ...nodeProperties,
          id: nodeProperties.id, // Ensure id is at the top level
          similarity: result.similarity
        };
      });
        
      log(`Vector search returned ${processedResults.length} results`, 'mage-vector-service');
      return processedResults;
        
    } catch (memgraphError) {
      log(`Memgraph vector search failed: ${memgraphError}. This service does not use fallback storage directly.`, 'mage-vector-service-warning');
      throw memgraphError; // Re-throw to be handled by caller, or implement specific error handling
    }
  } catch (error) {
    log(`Vector search error: ${error instanceof Error ? error.message : String(error)}`, 'mage-vector-service-error');
    return []; // Return empty results in case of failure
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
  
    try {
      let vectorProcCount = 0;
      try {
        const allProcs = await executeCustomQuery('CALL mg.procedures() YIELD name RETURN name');
        // Filter in JS for robustness across Memgraph versions regarding WHERE after YIELD
        const vectorProcs = allProcs.filter(proc => proc.name && (proc.name.includes('vector') || proc.name.includes('similarity')));
        vectorProcCount = vectorProcs.length;
        log(`Found ${vectorProcs.length} vector/similarity procedures: ${vectorProcs.map(p => p.name).join(', ')}`, 'mage-vector-service-debug');
      } catch (procError) {
        log(`Error fetching procedures: ${procError}`, 'mage-vector-service-debug');
      }
      
      if (vectorProcCount === 0) {
        log('No MAGE vector procedures found. Attempting to load MAGE modules.', 'mage-vector-service-warning');
        try {
          await executeCustomQuery('CALL mg.load("vector_search")');
          log('MAGE vector_search module loaded successfully', 'mage-vector-service');
        } catch (mageError) {
          try {
            await executeCustomQuery('CALL mg.load_all()');
            log('MAGE loaded using mg.load_all()', 'mage-vector-service');
          } catch (allError) {
            log(`All MAGE loading attempts failed. Last error: ${allError instanceof Error ? allError.message : String(allError)}`, 'mage-vector-service-error');
            log('Continuing with limited vector capability...', 'mage-vector-service-warning');
            return;
          }
        }
      }
    } catch (error) {
      log(`Error checking/loading MAGE: ${error instanceof Error ? error.message : String(error)}`, 'mage-vector-service-error');
      log('Continuing with limited vector capability...', 'mage-vector-service-warning');
      return;
    }
    
    let indices: any[] = [];
    try {
      // Prefer vector_search.show_index_info() for Memgraph 3.0+
      indices = await executeCustomQuery(`CALL vector_search.show_index_info() YIELD *`);
      log(`Vector indices from vector_search.show_index_info: ${JSON.stringify(indices)}`, 'mage-vector-service-debug');
    } catch (vectorSearchError) {
      log(`Error using vector_search.show_index_info: ${vectorSearchError}. Trying older methods.`, 'mage-vector-service-debug');
      try {
        indices = await executeCustomQuery(`CALL mg.indexinfo() YIELD *`);
        if (indices && indices.length > 0) {
          indices = indices.filter((idx: any) => idx.type && idx.type.toLowerCase().includes('vector'));
        }
      } catch (mgIndexError) {
        log(`Error using mg.indexinfo: ${mgIndexError}. Trying SHOW INDEX INFO.`, 'mage-vector-service-debug');
        try {
          indices = await executeCustomQuery(`SHOW INDEX INFO`);
          if (indices && indices.length > 0) {
            indices = indices.filter((idx: any) => idx.index_type && idx.index_type.toLowerCase().includes('vector'));
          }
        } catch (showError) {
          log(`Error getting indices with SHOW INDEX INFO: ${showError}`, 'mage-vector-service-debug');
          indices = [];
        }
      }
    }
    log(`Found ${indices.length} existing vector indices.`, 'mage-vector-service');
    
    const existingIndices = new Set(indices.map((idx: any) => idx.name || idx.index_name)); // Adapt to potential property name differences

    // Define common properties for vector indexes
    const commonIndexConfig = { dimension: 768, capacity: 10000, metric: "COSINE" }; // Standardized dimension
    
    // Index configurations: [indexName, label, property]
    const indexesToCreate = [
      // A general index on a common label (e.g., :Node, or :Concept if you use one)
      // For this example, let's assume most nodes that need vector search have a :HasEmbedding label or similar.
      // If not, a specific label like :AllNodesWithEmbedding or just :Node could be used.
      // Using :Node for broad applicability, assuming 'embedding_vector' is the property.
      { name: 'vector_idx_all', label: 'Node', property: 'embedding_vector' },
      { name: 'vector_idx_msg', label: 'ai_message', property: 'embedding_vector' }, // Specific for ai_message
      { name: 'vector_idx_user_msg', label: 'user_message', property: 'embedding_vector' }, // Specific for user_message
      { name: 'vector_idx_topic', label: 'topic', property: 'embedding_vector' }, // Specific for topic
      { name: 'vector_idx_entity', label: 'entity', property: 'embedding_vector' }  // Specific for entity
    ];

    for (const indexDef of indexesToCreate) {
      if (!existingIndices.has(indexDef.name)) {
        try {
          // Memgraph 3.0+ syntax: CREATE VECTOR INDEX
          // Ensure the label used exists on your nodes with embeddings.
          // If nodes can have multiple labels, target the most relevant one or a common one.
          await executeCustomQuery(`
            CREATE VECTOR INDEX ${indexDef.name} ON :${indexDef.label}(${indexDef.property})
            WITH ${JSON.stringify(commonIndexConfig)}
          `);
          log(`Created vector index: ${indexDef.name} on :${indexDef.label}(${indexDef.property})`, 'mage-vector-service');
        } catch (createError) {
          log(`Failed to create vector index ${indexDef.name} with CREATE VECTOR INDEX: ${createError}. Trying CALL vector_search.create_index.`, 'mage-vector-service-error');
          try {
            // Fallback to older procedure call if CREATE VECTOR INDEX fails (e.g. older Memgraph MAGE version)
             await executeCustomQuery(`
              CALL vector_search.create_index(
                "${indexDef.name}",
                "${indexDef.label}",
                "${indexDef.property}",
                ${commonIndexConfig.dimension},
                ${commonIndexConfig.capacity},
                "${commonIndexConfig.metric.toLowerCase()}"
              );
            `);
            log(`Created vector index using procedure: ${indexDef.name} on :${indexDef.label}(${indexDef.property})`, 'mage-vector-service');
          } catch (procCreateError) {
             log(`Failed to create vector index ${indexDef.name} with procedure: ${procCreateError}`, 'mage-vector-service-error');
          }
        }
      } else {
        log(`Vector index ${indexDef.name} already exists.`, 'mage-vector-service-debug');
      }
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