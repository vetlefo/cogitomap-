/**
 * API endpoint for semantic search functionality
 * Supports both vector similarity search and text-based search
 */

import { Request, Response } from "express";
import { log } from "../vite";
import { generateEmbedding } from "../services/embeddingService";
import { performVectorSearch, performSemanticGraphSearch } from "../services/mageVectorService";
import { executeCustomQuery } from "../db/graphService";

/**
 * Semantic search handler
 * Supports:
 * - Vector similarity search (using embeddings)
 * - Text-based search (full text or keywords)
 * - Optional graph expansion for related content
 */
export async function semanticSearchHandler(req: Request, res: Response) {
  try {
    const {
      query,                  // Text query to search for
      vectorSearch = true,    // Whether to use vector similarity search
      textSearch = false,     // Whether to use text-based search
      nodeTypes = [],         // Types of nodes to search (empty array = all)
      limit = 10,             // Max number of results to return
      minSimilarity = 0.6,    // Minimum similarity threshold for vector search
      expandGraphSearch = false // Whether to expand search to related nodes
    } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }
    
    log(`Performing semantic search for "${query}"`, 'semantic-search');
    log(`Search options: nodeTypes=${JSON.stringify(nodeTypes)}, limit=${limit}, minSimilarity=${minSimilarity}, expandGraphSearch=${expandGraphSearch}`, 'semantic-search');
    
    // Default to vector search if not specified
    let results: any[] = [];
    
    // For vector search, generate an embedding and find similar content
    if (vectorSearch) {
      try {
        // Generate embedding for the query
        log(`Generating embedding for query: "${query}"`, 'semantic-search');
        const embedding = await generateEmbedding(query);
        log(`Generated embedding with ${embedding.length} dimensions`, 'semantic-search');
        
        let indexName: string;
        // Select the appropriate vector index based on node types
        if (nodeTypes.length === 0) {
          indexName = 'vector_idx_all'; // Use general index for all node types
        } else if (nodeTypes.includes('user_message') || nodeTypes.includes('ai_message')) {
          indexName = 'vector_idx_msg'; // Use message-specific index
        } else if (nodeTypes.includes('topic')) {
          indexName = 'vector_idx_topic'; // Use topic-specific index
        } else if (nodeTypes.includes('entity')) {
          indexName = 'vector_idx_entity'; // Use entity-specific index
        } else {
          indexName = 'vector_idx_all'; // Default to all
        }
        
        log(`Using vector index: ${indexName}`, 'semantic-search');
        
        if (expandGraphSearch) {
          // Advanced semantic search with graph expansion
          log(`Performing graph-expanded semantic search with maxHops=2`, 'semantic-search');
          results = await performSemanticGraphSearch(embedding, {
            nodeTypes: nodeTypes.length > 0 ? nodeTypes : undefined,
            limit,
            minSimilarity,
            maxHops: 2,
            includeRelated: true
          });
        } else {
          // Simple vector search
          log(`Performing direct vector search with ${indexName}`, 'semantic-search');
          results = await performVectorSearch(
            embedding,
            indexName,
            limit,
            minSimilarity
          );
        }
        
        log(`Vector search returned ${results.length} results`, 'semantic-search');
        
        // Add additional debug info if we have results
        if (results.length > 0) {
          const topResult = results[0];
          log(`Top result: ${topResult.type} "${topResult.content?.substring(0, 50)}..." with similarity ${topResult.similarity}`, 'semantic-search');
        }
      } catch (error) {
        log(`Error in vector search: ${error}`, 'semantic-search-error');
        
        // Fall back to text search if vector search fails and text search is enabled
        if (textSearch) {
          log('Falling back to text search', 'semantic-search');
          
          // Simple text search implementation using Cypher directly
          try {
            const cypher = `
              MATCH (n)
              WHERE (n.content CONTAINS $queryText OR n.keywords CONTAINS $queryText)
              ${nodeTypes.length > 0 ? `AND n.type IN $nodeTypes` : ''}
              RETURN n
              LIMIT $limit
            `;
            
            const searchResults = await executeCustomQuery(cypher, {
              queryText: query,
              nodeTypes: nodeTypes.length > 0 ? nodeTypes : undefined,
              limit
            });
            
            // Convert to expected result format
            results = searchResults.map((item: any) => {
              const node = item.n.properties;
              return {
                ...node,
                similarity: 0.5, // Arbitrary score for text matches
                isDirectMatch: true
              };
            });
            
            log(`Text search returned ${results.length} results`, 'semantic-search');
          } catch (textError) {
            log(`Text search also failed: ${textError}`, 'semantic-search-error');
            return res.status(500).json({
              error: 'Both vector and text search failed',
              details: `Vector search: ${error instanceof Error ? error.message : 'Unknown error'}. Text search: ${textError instanceof Error ? textError.message : 'Unknown error'}`
            });
          }
        } else {
          return res.status(500).json({
            error: 'Vector search failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } else if (textSearch) {
      // Basic text search implementation
      log('Performing text-only search', 'semantic-search');
      
      try {
        const cypher = `
          MATCH (n)
          WHERE (n.content CONTAINS $queryText OR n.keywords CONTAINS $queryText)
          ${nodeTypes.length > 0 ? `AND n.type IN $nodeTypes` : ''}
          RETURN n
          LIMIT $limit
        `;
        
        const searchResults = await executeCustomQuery(cypher, {
          queryText: query,
          nodeTypes: nodeTypes.length > 0 ? nodeTypes : undefined,
          limit
        });
        
        // Convert to expected result format
        results = searchResults.map((item: any) => {
          const node = item.n.properties;
          return {
            ...node,
            similarity: 0.5, // Arbitrary score for text matches
            isDirectMatch: true
          };
        });
        
        log(`Text search returned ${results.length} results`, 'semantic-search');
      } catch (error) {
        log(`Error in text search: ${error}`, 'semantic-search-error');
        return res.status(500).json({
          error: 'Text search failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Return the results in a consistent format
    return res.status(200).json({
      query,
      results,
      count: results.length,
      searchType: vectorSearch && results.some(r => r.similarity > 0.5) ? 'vector' : 'text',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log(`Error in semantic search: ${error}`, 'semantic-search-error');
    
    return res.status(500).json({
      error: 'Semantic search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}