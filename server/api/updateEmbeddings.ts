/**
 * API endpoint to update embeddings for nodes in the database
 */

import { Request, Response } from "express";
import { log } from "../vite";
import { getAllNodes } from "../db/graphService";
import { generateEmbedding } from "../services/embeddingService";
import { storeNodeEmbedding } from "../services/mageVectorService";

/**
 * Handler for updating embeddings on existing nodes
 * This is useful for retroactively adding embeddings to nodes created before
 * the embedding functionality was implemented or fixed
 */
export async function updateEmbeddingsHandler(req: Request, res: Response) {
  try {
    const { nodeType = 'all', limit = 50 } = req.body;
    log(`Updating embeddings for nodes of type: ${nodeType}, limit: ${limit}`, 'update-embeddings');
    
    // Fetch nodes without embeddings
    let allNodes: any[] = [];
    let page = 0;
    let hasMore = true;
    
    // Get nodes in batches to avoid memory issues with large datasets
    while (hasMore && allNodes.length < limit) {
      const { nodes, total } = await getAllNodes(page, 50, nodeType);
      allNodes = [...allNodes, ...nodes.filter(node => !node.embedding_vector)];
      
      page++;
      hasMore = allNodes.length < total && allNodes.length < limit;
    }
    
    // Limit the number of nodes to process
    allNodes = allNodes.slice(0, limit);
    
    log(`Found ${allNodes.length} nodes without embeddings to update`, 'update-embeddings');
    
    // Process each node in sequence
    const results = {
      total: allNodes.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Process each node
    for (const node of allNodes) {
      try {
        results.processed++;
        
        // Generate embedding for the node's content
        const content = node.content || '';
        if (!content || content.trim().length === 0) {
          results.failed++;
          results.errors.push(`Node ${node.id} has no content to embed`);
          continue;
        }
        
        log(`Generating embedding for node ${node.id}`, 'update-embeddings');
        const embedding = await generateEmbedding(content);
        
        // Store the embedding in the database
        const success = await storeNodeEmbedding(node.id, embedding);
        
        if (success) {
          results.succeeded++;
        } else {
          results.failed++;
          results.errors.push(`Failed to store embedding for node ${node.id}`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error processing node ${node.id}: ${errorMessage}`);
      }
    }
    
    // Return results
    return res.status(200).json({
      message: `Updated embeddings for ${results.succeeded} of ${results.total} nodes`,
      results
    });
  } catch (error) {
    log(`Error updating embeddings: ${error}`, 'update-embeddings-error');
    return res.status(500).json({
      error: 'Failed to update embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}