/**
 * Semantic search API endpoint
 */
import { Router } from 'express';
import { z } from 'zod';
import { generateEmbedding } from '../services/embeddingService';
import { vectorSearch } from '../services/mageVectorService';
import { log } from '../vite';
import { fallbackStorage } from '../db/fallbackStorage';
import { executeCustomQuery } from '../db/graphService';

export const semanticSearchRouter = Router();

// Schema for semantic search request
const SemanticSearchRequestSchema = z.object({
  query: z.string().min(1),
  nodeTypes: z.array(z.string()).optional(),
  limit: z.number().int().positive().default(10),
  minSimilarity: z.number().min(0).max(1).default(0.65),
  maxHops: z.number().int().min(0).max(5).default(2),
  includeRelated: z.boolean().default(true),
  vectorSearch: z.boolean().default(true),
  textSearch: z.boolean().default(true),
  expandGraphSearch: z.boolean().default(false)
});

/**
 * POST /api/semantic/search
 * Performs a semantic search against the knowledge graph
 */
semanticSearchRouter.post('/search', async (req, res) => {
  try {
    // Validate request body
    const validationResult = SemanticSearchRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.errors
      });
    }

    const {
      query,
      nodeTypes = [],
      limit,
      minSimilarity,
      maxHops,
      includeRelated,
      vectorSearch,
      textSearch,
      expandGraphSearch
    } = validationResult.data;

    log(`Performing semantic search for "${query}"`, 'semantic-search');
    log(`Search options: nodeTypes=${JSON.stringify(nodeTypes)}, limit=${limit}, minSimilarity=${minSimilarity}, expandGraphSearch=${expandGraphSearch}`, 'semantic-search');

    // Collect all results
    const allResults: any[] = [];
    
    // Perform vector search if enabled
    if (vectorSearch) {
      // Generate embedding for the query
      log(`Generating embedding for query: "${query}"`, 'semantic-search');
      const embedding = await generateEmbedding(query);
      log(`Generated embedding with ${embedding.length} dimensions`, 'semantic-search');

      // Choose the appropriate vector index
      const vectorIndex = nodeTypes.length > 0 
        ? `vector_idx_${nodeTypes.join('_')}`
        : 'vector_idx_all';
      
      log(`Using vector index: ${vectorIndex}`, 'semantic-search');
      log(`Performing direct vector search with ${vectorIndex}`, 'semantic-search');

      // Perform vector search
      // Forward to the fallbackStorage if we're in fallback mode
      const vectorResults = await fallbackStorage.vectorSearch(
        embedding,
        minSimilarity,
        limit,
        nodeTypes
      );

      log(`Vector search returned ${vectorResults.length} results`, 'semantic-search');
      
      // Add direct match flag and add to results
      vectorResults.forEach(result => {
        result.isDirectMatch = true;
        allResults.push(result);
      });

      // Log some info about top results
      if (vectorResults.length > 0) {
        const topResult = vectorResults[0];
        log(`Top result: ${topResult.type} "${topResult.content?.substring(0, 25)}..." with similarity ${topResult.similarity}`, 'semantic-search');
      }
    }

    // Perform text search if enabled
    if (textSearch) {
      // Text search query using CONTAINS or FULLTEXT index if available
      try {
        const textSearchQuery = `
          MATCH (n)
          WHERE
            ${nodeTypes.length > 0 ? `n.type IN $nodeTypes AND` : ''}
            (n.content CONTAINS $query OR
             n.title CONTAINS $query OR
             ANY(k IN n.keywords WHERE k CONTAINS $query))
          RETURN n
          LIMIT $limit
        `;

        const textResults = await executeCustomQuery(textSearchQuery, {
          query,
          nodeTypes,
          limit
        });

        // Process text search results
        if (textResults && textResults.length > 0) {
          log(`Text search returned ${textResults.length} results`, 'semantic-search');
          
          // Add text search results to the overall results
          textResults.forEach(result => {
            const node = result.n.properties;
            
            // Skip if this node is already in the results from vector search
            if (!allResults.some(r => r.id === node.id)) {
              allResults.push({
                ...node,
                isDirectMatch: true,
                matchType: 'text'
              });
            }
          });
        }
      } catch (error) {
        log(`Text search error: ${error instanceof Error ? error.message : String(error)}`, 'semantic-search-error');
        // Continue with other search methods
      }
    }

    // Find related nodes if requested
    if (includeRelated && allResults.length > 0 && maxHops > 0) {
      // Get IDs of direct match nodes
      const directNodeIds = allResults.map(node => node.id);
      
      try {
        log(`Expanding graph search for ${directNodeIds.length} direct matches`, 'semantic-search');
        
        // Use the fallbackStorage implementation for graph expansion
        const relatedNodes = await fallbackStorage.findRelatedNodes(
          directNodeIds,
          maxHops,
          limit * 2,
          nodeTypes
        );
        
        log(`Found ${relatedNodes.length} related nodes through graph expansion`, 'semantic-search');
        
        if (relatedNodes && relatedNodes.length > 0) {
          // Add related nodes to results if they aren't already there
          for (const relatedNode of relatedNodes) {
            // Only add if not already in results
            if (!allResults.some(node => node.id === relatedNode.id)) {
              allResults.push(relatedNode);
            }
          }
        }
      } catch (error) {
        log(`Related nodes query error: ${error instanceof Error ? error.message : String(error)}`, 'semantic-search-error');
        // Continue with available results
      }
    }

    // Sort results: direct matches first (by similarity), then related nodes
    allResults.sort((a, b) => {
      // Direct matches come before related nodes
      if (a.isDirectMatch && !b.isDirectMatch) return -1;
      if (!a.isDirectMatch && b.isDirectMatch) return 1;
      
      // For direct matches, sort by similarity
      if (a.isDirectMatch && b.isDirectMatch) {
        // If similarity is available, use it
        if (a.similarity !== undefined && b.similarity !== undefined) {
          return b.similarity - a.similarity;
        }
        // Fall back to importance
        return (b.importance || 0) - (a.importance || 0);
      }
      
      // For related nodes, sort by connection strength
      return (b.connectionStrength || 0) - (a.connectionStrength || 0);
    });

    // Limit final results
    const finalResults = allResults.slice(0, limit);

    log(`Returning ${finalResults.length} search results`, 'semantic-search');
    
    // Return search results
    return res.status(200).json({
      query,
      results: finalResults
    });
  } catch (error) {
    log(`Semantic search error: ${error instanceof Error ? error.message : String(error)}`, 'semantic-search-error');
    return res.status(500).json({
      error: 'Failed to perform semantic search',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/semantic/node-count
 * Gets node counts by type
 */
semanticSearchRouter.get('/node-count', async (req, res) => {
  try {
    const query = `
      MATCH (n)
      RETURN n.type as type, count(n) as count
      ORDER BY count DESC
    `;
    
    const results = await executeCustomQuery(query);
    
    const typeCounts = results.reduce((acc, row) => {
      acc[row.type || 'unknown'] = row.count;
      return acc;
    }, {});
    
    return res.status(200).json(typeCounts);
  } catch (error) {
    log(`Node count error: ${error instanceof Error ? error.message : String(error)}`, 'semantic-search-error');
    return res.status(500).json({
      error: 'Failed to get node counts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});