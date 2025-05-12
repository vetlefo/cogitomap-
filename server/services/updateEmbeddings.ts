/**
 * Utility service to update embeddings for existing nodes in the database
 * This can be run to retroactively add embeddings to nodes that were created without them
 */

import { log } from "../vite";
import { MemgraphClient, configureMemgraphClient } from "./memgraphClient";
import { BubbleNode } from "../../shared/types";
import { generateEmbedding } from "./embeddingService";
import { storeNodeEmbedding } from "./mageVectorService";

/**
 * Update embeddings for nodes in the database that don't have them yet
 * 
 * @returns {Promise<{updated: number, total: number, errors: number}>} - Statistics about the update
 */
export async function updateExistingNodesWithEmbeddings(): Promise<{
  updated: number;
  total: number;
  errors: number;
}> {
  let client: MemgraphClient;
  let updated = 0;
  let errors = 0;
  let total = 0;
  
  try {
    log("Initializing embedding update for existing nodes...", "update-embeddings");
    client = await configureMemgraphClient();
    
    // Get all nodes without embeddings
    const nodesWithoutEmbeddings = await getNodesWithoutEmbeddings(client);
    total = nodesWithoutEmbeddings.length;
    
    log(`Found ${total} nodes without embeddings`, "update-embeddings");
    
    // Update embeddings for each node
    for (const node of nodesWithoutEmbeddings) {
      try {
        await updateNodeEmbedding(node);
        updated++;
        
        if (updated % 10 === 0) {
          log(`Updated ${updated}/${total} nodes with embeddings`, "update-embeddings");
        }
      } catch (error) {
        errors++;
        log(`Error updating embedding for node ${node.id}: ${error}`, "update-embeddings-error");
      }
    }
    
    log(`Embedding update complete. Updated: ${updated}, Errors: ${errors}, Total: ${total}`, 
      "update-embeddings");
    
    return { updated, total, errors };
  } catch (error) {
    log(`Failed to update node embeddings: ${error}`, "update-embeddings-error");
    return { updated, total, errors };
  }
}

/**
 * Get all nodes from the database that don't have embeddings
 */
async function getNodesWithoutEmbeddings(client: MemgraphClient): Promise<BubbleNode[]> {
  try {
    const query = `
      MATCH (n)
      WHERE NOT EXISTS(n.embedding)
      RETURN n.id AS id, n.content AS content, n.type AS type, 
             n.keywords AS keywords, n.position AS position,
             n.importance AS importance
      LIMIT 200
    `;
    
    const result = await client.executeQuery(query);
    
    return result.map((row: any) => ({
      id: row.id,
      content: row.content,
      type: row.type,
      position: row.position,
      importance: row.importance,
      keywords: row.keywords || []
    }));
  } catch (error) {
    log(`Error fetching nodes without embeddings: ${error}`, "update-embeddings-error");
    return [];
  }
}

/**
 * Update embedding for a single node
 */
async function updateNodeEmbedding(node: BubbleNode): Promise<boolean> {
  try {
    // Skip nodes without content
    if (!node.content) {
      log(`Skipping node ${node.id} with no content`, "update-embeddings");
      return false;
    }
    
    // Generate embedding
    const embedding = await generateEmbedding(node.content);
    
    // Store embedding in database
    const success = await storeNodeEmbedding(node.id, embedding);
    
    if (!success) {
      log(`Failed to store embedding for node ${node.id}`, "update-embeddings-error");
      return false;
    }
    
    return true;
  } catch (error) {
    log(`Error in updateNodeEmbedding for node ${node.id}: ${error}`, "update-embeddings-error");
    return false;
  }
}

/**
 * Endpoint helper to run the update process
 */
export async function runEmbeddingUpdate(): Promise<{
  success: boolean;
  updated: number;
  total: number;
  errors: number;
  message: string;
}> {
  try {
    const result = await updateExistingNodesWithEmbeddings();
    
    return {
      success: true,
      ...result,
      message: `Successfully updated ${result.updated} out of ${result.total} nodes`
    };
  } catch (error) {
    return {
      success: false,
      updated: 0,
      total: 0,
      errors: 1,
      message: `Error updating embeddings: ${error}`
    };
  }
}