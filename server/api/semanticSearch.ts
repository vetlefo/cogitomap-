/**
 * Semantic search API endpoint
 */
import { Router } from 'express';
import { z } from 'zod';
import { generateEmbedding } from '../services/embeddingService';
import { vectorSearch as mageVectorSearch } from '../services/mageVectorService'; // Renamed import
import { log } from '../vite';
// FallbackStorage is no longer directly used for vector search or related nodes here.
// import { fallbackStorage } from '../db/fallbackStorage';
import { executeCustomQuery, findRelatedNodes as findRelatedNodesFromGraphService } from '../db/graphService';

export const semanticSearchRouter = Router();

// Schema for semantic search request
const SemanticSearchRequestSchema = z.object({
  query: z.string().min(1),
  nodeTypes: z.array(z.string()).optional(),
  limit: z.number().int().positive().default(10),
  minSimilarity: z.number().min(0).max(1).default(0.65),
  maxHops: z.number().int().min(0).max(5).default(2), // For related nodes
  includeRelated: z.boolean().default(true),
  vectorSearch: z.boolean().default(true), // Whether to perform vector search
  textSearch: z.boolean().default(true),   // Whether to perform text-based keyword search
  // expandGraphSearch: z.boolean().default(false) // This seems redundant if includeRelated is used
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
      nodeTypes = [], // Default to empty array if not provided
      limit,
      minSimilarity,
      maxHops,
      includeRelated,
      vectorSearch: performVectorSearch, // Renamed for clarity
      textSearch: performTextSearch,
    } = validationResult.data;

    log(`Performing semantic search for "${query}"`, 'semantic-search');
    log(`Search options: nodeTypes=${JSON.stringify(nodeTypes)}, limit=${limit}, minSimilarity=${minSimilarity}, includeRelated=${includeRelated}, maxHops=${maxHops}`, 'semantic-search');

    const allResults: any[] = []; // Using any for now, should be typed BubbleNode & { similarity?: number, isDirectMatch?: boolean, matchType?: string }
    
    // Perform vector search if enabled
    if (performVectorSearch) {
      log(`Generating embedding for query: "${query}"`, 'semantic-search');
      const embedding = await generateEmbedding(query);
      log(`Generated embedding with ${embedding.length} dimensions`, 'semantic-search');

      log(`Performing direct vector search via MAGE service.`, 'semantic-search');
      // Use mageVectorSearch from mageVectorService
      const vectorResults = await mageVectorSearch(
        embedding,
        minSimilarity,
        limit,
        nodeTypes
      );

      log(`MAGE Vector search returned ${vectorResults.length} results`, 'semantic-search');
      
      vectorResults.forEach(result => {
        allResults.push({ ...result, isDirectMatch: true, matchType: 'vector' });
      });

      if (vectorResults.length > 0) {
        const topResult = vectorResults[0];
        log(`Top vector result: ${topResult.type} "${topResult.content?.substring(0, 25)}..." with similarity ${topResult.similarity}`, 'semantic-search');
      }
    }

    // Perform text search if enabled
    if (performTextSearch) {
      try {
        // Text search query using CONTAINS (adjust if Memgraph has different full-text search syntax)
        // This is a basic keyword CONTAINS search. For more advanced full-text, Memgraph might need specific indexing (e.g., via MAGE modules).
        const textSearchQueryParts: string[] = [];
        if (nodeTypes.length > 0) {
          textSearchQueryParts.push(`n.type IN $nodeTypes`);
        }
        // Create OR conditions for query against content, title, keywords
        const contentMatch = `(n.content CONTAINS $query OR n.title CONTAINS $query OR (exists(n.keywords) AND ANY(k IN n.keywords WHERE k CONTAINS $query)))`;
        textSearchQueryParts.push(contentMatch);

        const textSearchQuery = `
          MATCH (n)
          WHERE ${textSearchQueryParts.join(' AND ')}
          RETURN n
          LIMIT $textSearchLimit
        `; // Using a different limit for text search initially

        const textResultsRaw = await executeCustomQuery(textSearchQuery, {
          query, // The search query string
          nodeTypes,
          textSearchLimit: limit * 2, // Fetch a bit more for text search initially
        });
        
        if (textResultsRaw && textResultsRaw.length > 0) {
          log(`Text search returned ${textResultsRaw.length} results`, 'semantic-search');
          textResultsRaw.forEach(result => {
            const node = result.n.properties || result.n; // Adapt to Memgraph driver's result structure
            if (!allResults.some(r => r.id === node.id)) { // Avoid duplicates
              allResults.push({
                ...node,
                id: node.id, // Ensure id is at top level
                isDirectMatch: true, // Text matches are also direct
                matchType: 'text',
                // Text search doesn't inherently provide similarity; could be added by other means
              });
            }
          });
        }
      } catch (error) {
        log(`Text search error: ${error instanceof Error ? error.message : String(error)}`, 'semantic-search-error');
      }
    }

    // Find related nodes if requested and direct matches were found
    const directMatchIds = allResults.filter(r => r.isDirectMatch).map(node => node.id);

    if (includeRelated && directMatchIds.length > 0 && maxHops > 0) {
      try {
        log(`Expanding graph search for ${directMatchIds.length} direct matches, up to ${maxHops} hops.`, 'semantic-search');
        
        // Use the graphService's findRelatedNodes which should query Memgraph
        const relatedNodes = await findRelatedNodesFromGraphService(
          directMatchIds,
          maxHops,
          limit * 2, // Fetch more initially for ranking
          nodeTypes
        );
        
        log(`Found ${relatedNodes.length} related nodes through graph expansion.`, 'semantic-search');
        
        if (relatedNodes && relatedNodes.length > 0) {
          for (const relatedNode of relatedNodes) {
            if (!allResults.some(node => node.id === relatedNode.id)) {
              allResults.push({ ...relatedNode, isDirectMatch: false, matchType: 'related' });
            }
          }
        }
      } catch (error) {
        log(`Related nodes query error: ${error instanceof Error ? error.message : String(error)}`, 'semantic-search-error');
      }
    }

    // Sort results: direct matches first (vector by similarity, then text), then related nodes
    allResults.sort((a, b) => {
      if (a.isDirectMatch && !b.isDirectMatch) return -1;
      if (!a.isDirectMatch && b.isDirectMatch) return 1;
      
      if (a.isDirectMatch && b.isDirectMatch) {
        // Vector matches with similarity take precedence
        if (a.matchType === 'vector' && b.matchType !== 'vector') return -1;
        if (a.matchType !== 'vector' && b.matchType === 'vector') return 1;
        if (a.matchType === 'vector' && b.matchType === 'vector') {
          return (b.similarity || 0) - (a.similarity || 0);
        }
        // For text matches, or if one is vector without similarity and other is text
        // Could add importance or other ranking here. For now, stable sort.
        return 0;
      }
      
      // For related nodes, sort by similarity (if available, e.g., from path weighting) or just add them
      return (b.similarity || 0) - (a.similarity || 0); // Assuming related nodes might have a 'similarity' or 'strength'
    });

    // Limit final results
    const finalResults = allResults.slice(0, limit);

    log(`Returning ${finalResults.length} search results for query "${query}"`, 'semantic-search');
    
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

// ... (keep /node-count endpoint as is)