/**
 * Semantic Service
 * Provides advanced semantic operations for the knowledge graph
 * Based on embeddings for calculating similarity and relationships
 */

import { log } from "../vite";
import { BubbleNode, Edge } from "../../client/src/types";
import { calculateSimilarity } from "./embeddingService";
import { getAllNodes, createEdge } from "../db/graphService";

interface SemanticRelation {
  source: BubbleNode;
  target: BubbleNode;
  similarity: number;
  type: string;
}

/**
 * Analyze semantic relationships between nodes
 * Identifies semantically similar nodes and creates relationships between them
 */
export async function analyzeSemanticRelationships(options: {
  minSimilarity?: number;
  maxRelationsPerNode?: number;
  nodeTypes?: string[];
} = {}): Promise<SemanticRelation[]> {
  try {
    // Default values
    const minSimilarity = options.minSimilarity || 0.7;
    const maxRelationsPerNode = options.maxRelationsPerNode || 5;
    const nodeTypes = options.nodeTypes || ['topic', 'entity', 'summary'];

    // Get all nodes from the database
    const result = await getAllNodes(0, 1000); // Fetch up to 1000 nodes
    const nodes = result.nodes.filter(node => 
      nodeTypes.includes(node.type) && 
      node.embedding_vector && 
      node.embedding_vector.length > 0
    );

    if (nodes.length === 0) {
      log('No nodes with embeddings found for semantic analysis', 'semantic-service');
      return [];
    }

    log(`Analyzing semantic relationships for ${nodes.length} nodes`, 'semantic-service');

    // Calculate similarities between all node pairs
    const relations: SemanticRelation[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const source = nodes[i];
      
      // Store similarities for this source node
      const similarities: {target: BubbleNode, similarity: number}[] = [];
      
      for (let j = 0; j < nodes.length; j++) {
        // Skip self-comparison
        if (i === j) continue;
        
        const target = nodes[j];
        
        // Calculate similarity only if both nodes have embedding vectors
        if (source.embedding_vector && target.embedding_vector) {
          const similarity = calculateSimilarity(
            source.embedding_vector,
            target.embedding_vector
          );
          
          // Only consider if similarity is above threshold
          if (similarity >= minSimilarity) {
            similarities.push({
              target,
              similarity
            });
          }
        }
      }
      
      // Sort by similarity (highest first) and take top N
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topSimilarities = similarities.slice(0, maxRelationsPerNode);
      
      // Create relations for top similarities
      for (const item of topSimilarities) {
        // Determine relation type based on node types and similarity
        let relationType = 'semantically_similar';
        
        // If they're the same type, they're related
        if (source.type === item.target.type) {
          relationType = 'related';
        }
        // Topics can elaborate on entities
        else if (source.type === 'topic' && item.target.type === 'entity') {
          relationType = 'elaborates';
        }
        // Summaries can support entities or topics
        else if (source.type === 'summary' && 
                (item.target.type === 'entity' || item.target.type === 'topic')) {
          relationType = 'supports';
        }
        
        relations.push({
          source,
          target: item.target,
          similarity: item.similarity,
          type: relationType
        });
      }
    }
    
    log(`Found ${relations.length} semantic relationships`, 'semantic-service');
    return relations;
  } catch (error) {
    log(`Error analyzing semantic relationships: ${error}`, 'semantic-service');
    return [];
  }
}

/**
 * Create edges in the graph database based on semantic relationships
 */
export async function createSemanticEdges(relations: SemanticRelation[]): Promise<Edge[]> {
  const createdEdges: Edge[] = [];
  
  try {
    for (const relation of relations) {
      try {
        const edge = await createEdge(
          relation.source.id,
          relation.target.id,
          relation.type as any,
          { 
            strength: relation.similarity,
            semanticSimilarity: relation.similarity 
          }
        );
        
        createdEdges.push(edge);
      } catch (error) {
        log(`Error creating semantic edge between ${relation.source.id} and ${relation.target.id}: ${error}`, 'semantic-service');
        // Continue with other relations
      }
    }
    
    log(`Created ${createdEdges.length} semantic edges`, 'semantic-service');
    return createdEdges;
  } catch (error) {
    log(`Error in createSemanticEdges: ${error}`, 'semantic-service');
    return createdEdges;
  }
}

/**
 * Identify clusters of semantically related nodes
 * This is a simplified community detection algorithm based on semantic similarity
 */
export function identifySemanticClusters(nodes: BubbleNode[], options: {
  minSimilarity?: number;
  maxClusters?: number;
} = {}): { clusterId: number; nodes: BubbleNode[] }[] {
  try {
    const minSimilarity = options.minSimilarity || 0.6;
    const maxClusters = options.maxClusters || 10;
    
    // Filter nodes with embeddings
    const nodesWithEmbeddings = nodes.filter(
      node => node.embedding_vector && node.embedding_vector.length > 0
    );
    
    if (nodesWithEmbeddings.length === 0) {
      return [];
    }
    
    // Simple clustering algorithm:
    // 1. Start with each node in its own cluster
    // 2. Merge clusters if similarity between any nodes exceeds threshold
    // 3. Continue until no more merges are possible or max iterations reached
    
    // Initialize clusters - each node starts in its own cluster
    const clusters: Set<BubbleNode>[] = nodesWithEmbeddings.map(node => new Set([node]));
    let mergeOccurred = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;
    
    while (mergeOccurred && iterations < MAX_ITERATIONS && clusters.length > 1) {
      mergeOccurred = false;
      iterations++;
      
      // Check each pair of clusters
      for (let i = 0; i < clusters.length && clusters.length > 1; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          // Check if any node in cluster i is similar to any node in cluster j
          const clusterI = Array.from(clusters[i]);
          const clusterJ = Array.from(clusters[j]);
          
          let shouldMerge = false;
          
          // Check similarity between nodes in different clusters
          for (const nodeI of clusterI) {
            if (shouldMerge) break;
            
            for (const nodeJ of clusterJ) {
              if (nodeI.embedding_vector && nodeJ.embedding_vector) {
                const similarity = calculateSimilarity(
                  nodeI.embedding_vector,
                  nodeJ.embedding_vector
                );
                
                if (similarity >= minSimilarity) {
                  shouldMerge = true;
                  break;
                }
              }
            }
          }
          
          // Merge clusters if similar
          if (shouldMerge) {
            // Add all nodes from cluster j to cluster i
            clusterJ.forEach(node => clusters[i].add(node));
            
            // Remove cluster j
            clusters.splice(j, 1);
            
            mergeOccurred = true;
            j--; // Adjust index after removing a cluster
          }
        }
      }
    }
    
    // Convert to expected format and limit number of clusters
    return clusters
      .slice(0, maxClusters)
      .map((cluster, index) => ({
        clusterId: index,
        nodes: Array.from(cluster)
      }));
    
  } catch (error) {
    log(`Error identifying semantic clusters: ${error}`, 'semantic-service');
    return [];
  }
}