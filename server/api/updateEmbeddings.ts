/**
 * API endpoint to update embeddings for nodes in the database
 */

import { Request, Response } from "express";
import { log } from "../vite";
import { executeCustomQuery, getAllNodes } from "../db/graphService";
import { generateEmbedding } from "../services/embeddingService";
import { BubbleNode } from "../../client/src/types";

/**
 * Handler for updating embeddings on existing nodes
 * This is useful for retroactively adding embeddings to nodes created before
 * the embedding functionality was implemented or fixed
 */
export async function updateEmbeddingsHandler(req: Request, res: Response) {
  try {
    const { 
      nodeType = 'all',  // Type of nodes to update, or 'all' for all types
      limit = 50         // Maximum number of nodes to process in one request
    } = req.body;

    log(`Starting embedding update for node type: ${nodeType}, limit: ${limit}`, "update-embeddings");
    
    // 1. Get nodes without embeddings
    let nodes: BubbleNode[] = [];
    
    try {
      // Get nodes that don't have embeddings yet
      let result;
      if (nodeType === 'all') {
        result = await getAllNodes(0, limit, undefined);
      } else {
        result = await getAllNodes(0, limit, nodeType as string);
      }
      
      nodes = result.nodes;
      
      log(`Found ${nodes.length} nodes that need embeddings updated`, "update-embeddings");
    } catch (error) {
      log(`Error fetching nodes: ${error}`, "update-embeddings-error");
      return res.status(500).json({
        error: 'Failed to fetch nodes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // 2. Process each node and generate embeddings
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      total: nodes.length,
      failures: [] as string[]
    };
    
    // Process nodes in sequence to avoid overwhelming the embedding service
    for (const node of nodes) {
      try {
        results.processed++;
        
        // Skip nodes that already have valid embeddings (non-empty arrays)
        if (node.embedding_vector && node.embedding_vector.length > 0) {
          results.succeeded++;
          continue;
        }
        
        // Generate the embedding from the node content
        const textToEmbed = node.content;
        if (!textToEmbed || textToEmbed.trim().length === 0) {
          log(`Node ${node.id} has no content to embed, skipping`, "update-embeddings-warn");
          results.failed++;
          results.failures.push(`${node.id}: No content to embed`);
          continue;
        }
        
        // Generate the embedding
        const embedding = await generateEmbedding(textToEmbed);
        
        // Update the node in the database with the new embedding
        const updateQuery = `
          MATCH (n {id: $id})
          SET n.embedding = $embedding
          RETURN n
        `;
        
        await executeCustomQuery(updateQuery, { 
          id: node.id, 
          embedding: embedding 
        });
        
        log(`Updated embedding for node ${node.id}`, "update-embeddings");
        results.succeeded++;
      } catch (error) {
        log(`Error updating embedding for node ${node.id}: ${error}`, "update-embeddings-error");
        results.failed++;
        results.failures.push(`${node.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 3. Return the results
    return res.status(200).json({
      message: `Processed ${results.processed} nodes, updated ${results.succeeded} embeddings, failed ${results.failed}`,
      results: {
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        total: results.total,
        failures: results.failures.length > 0 ? results.failures : undefined
      }
    });
  } catch (error) {
    log(`Error in update embeddings handler: ${error}`, "update-embeddings-error");
    
    return res.status(500).json({
      error: 'Failed to update embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}