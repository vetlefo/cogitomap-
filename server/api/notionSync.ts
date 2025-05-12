/**
 * API endpoints for Notion synchronization
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { log } from '../vite';
import { notion, getNodesFromNotion, getEdgesFromNotion, findDatabaseByTitle } from '../notion';
import { fallbackStorage } from '../db/fallbackStorage';

export const notionSyncRouter = Router();

// Schema for sync request
const SyncRequestSchema = z.object({
  direction: z.enum(['pull', 'push']),
  nodeTypes: z.array(z.string()).optional(),
  syncEdges: z.boolean().optional().default(true),
});

type SyncRequest = z.infer<typeof SyncRequestSchema>;

/**
 * POST /api/notion/sync
 * Synchronizes data between the local graph and Notion
 */
notionSyncRouter.post('/sync', async (req: Request, res: Response) => {
  try {
    const validationResult = SyncRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validationResult.error.format()
      });
    }

    const { direction, nodeTypes, syncEdges } = validationResult.data;
    
    log(`Starting Notion sync - direction: ${direction}`, 'notion-sync');
    
    if (direction === 'pull') {
      // Pull data from Notion to local graph
      const result = await pullFromNotion(nodeTypes, syncEdges);
      return res.status(200).json(result);
    } else {
      // Push data from local graph to Notion
      const result = await pushToNotion(nodeTypes, syncEdges);
      return res.status(200).json(result);
    }
  } catch (error) {
    log(`Notion sync error: ${error instanceof Error ? error.message : String(error)}`, 'notion-sync-error');
    return res.status(500).json({
      error: 'Failed to synchronize with Notion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/notion/status
 * Checks Notion connection and databases status
 */
notionSyncRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    // Check if we can connect to Notion API
    let connected = false;
    let hasNodesDB = false;
    let hasEdgesDB = false;
    
    try {
      // Try to access the user endpoint as a basic connectivity test
      await notion.users.list({});
      connected = true;
      
      // Check if required databases exist
      const nodesDb = await findDatabaseByTitle('Knowledge Graph Nodes');
      const edgesDb = await findDatabaseByTitle('Knowledge Graph Edges');
      
      hasNodesDB = nodesDb !== null;
      hasEdgesDB = edgesDb !== null;
    } catch (error) {
      connected = false;
      log(`Notion connectivity test failed: ${error instanceof Error ? error.message : String(error)}`, 'notion-sync');
    }
    
    return res.status(200).json({
      connected,
      databases: {
        nodes: hasNodesDB,
        edges: hasEdgesDB
      }
    });
  } catch (error) {
    log(`Notion status check error: ${error instanceof Error ? error.message : String(error)}`, 'notion-sync-error');
    return res.status(500).json({
      error: 'Failed to check Notion status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Pull data from Notion into the local graph
 */
async function pullFromNotion(nodeTypes: string[] = [], syncEdges: boolean = true) {
  try {
    // Find the databases
    const nodesDb = await findDatabaseByTitle('Knowledge Graph Nodes');
    const edgesDb = await findDatabaseByTitle('Knowledge Graph Edges');
    
    if (!nodesDb) {
      throw new Error('Nodes database not found in Notion');
    }
    
    if (syncEdges && !edgesDb) {
      throw new Error('Edges database not found in Notion');
    }
    
    // Get nodes from Notion
    let nodes = await getNodesFromNotion(nodesDb.id);
    
    // Filter by node types if specified
    if (nodeTypes && nodeTypes.length > 0) {
      nodes = nodes.filter(node => nodeTypes.includes(node.type));
    }
    
    // Import nodes into local graph
    let importedNodeCount = 0;
    for (const node of nodes) {
      if (node.id) {
        // Add to local graph - use node.position for x,y,z coordinates
        fallbackStorage.createNode({
          id: node.id,
          content: node.content,
          type: node.type as any,
          position: node.position,
          importance: node.importance,
          keywords: node.keywords
        });
        importedNodeCount++;
      }
    }
    
    // Get and import edges if requested
    let importedEdgeCount = 0;
    if (syncEdges && edgesDb) {
      const edges = await getEdgesFromNotion(edgesDb.id);
      
      for (const edge of edges) {
        if (edge.id && edge.source && edge.target) {
          fallbackStorage.createEdge(
            edge.source,
            edge.target,
            edge.relationship,
            { strength: edge.strength }
          );
          importedEdgeCount++;
        }
      }
    }
    
    return {
      success: true,
      imported: {
        nodes: importedNodeCount,
        edges: importedEdgeCount
      }
    };
  } catch (error) {
    log(`Error pulling from Notion: ${error instanceof Error ? error.message : String(error)}`, 'notion-sync-error');
    throw error;
  }
}

/**
 * Push data from the local graph to Notion
 */
async function pushToNotion(nodeTypes: string[] = [], syncEdges: boolean = true) {
  try {
    // Find the databases
    const nodesDb = await findDatabaseByTitle('Knowledge Graph Nodes');
    const edgesDb = await findDatabaseByTitle('Knowledge Graph Edges');
    
    if (!nodesDb) {
      throw new Error('Nodes database not found in Notion');
    }
    
    if (syncEdges && !edgesDb) {
      throw new Error('Edges database not found in Notion');
    }
    
    // Get nodes from local graph
    const { nodes } = fallbackStorage.getAllNodes(0, 1000, nodeTypes.length > 0 ? nodeTypes[0] : null);
    
    // Filter by node types if multiple specified
    const filteredNodes = nodeTypes.length > 1 
      ? nodes.filter(node => nodeTypes.includes(node.type))
      : nodes;
    
    // Export nodes to Notion
    let exportedNodeCount = 0;
    for (const node of filteredNodes) {
      // Create node in Notion
      await notion.pages.create({
        parent: {
          database_id: nodesDb.id
        },
        properties: {
          Id: {
            rich_text: [{ text: { content: node.id } }]
          },
          Content: {
            rich_text: [{ text: { content: node.content?.substring(0, 2000) || "" } }]
          },
          Type: {
            select: { name: node.type }
          },
          Importance: {
            number: node.importance || 0.5
          },
          Keywords: {
            multi_select: (node.keywords || []).map(keyword => ({
              name: keyword.substring(0, 100) // Notion has a limit on select name length
            }))
          },
          PositionX: {
            number: node.position?.x || 0
          },
          PositionY: {
            number: node.position?.y || 0
          },
          PositionZ: {
            number: node.position?.z || 0
          }
        }
      });
      
      exportedNodeCount++;
    }
    
    // Get and export edges if requested
    let exportedEdgeCount = 0;
    if (syncEdges && edgesDb) {
      const { edges } = fallbackStorage.getAllEdges(0, 1000);
      
      for (const edge of edges) {
        // Create edge in Notion
        await notion.pages.create({
          parent: {
            database_id: edgesDb.id
          },
          properties: {
            Id: {
              rich_text: [{ text: { content: edge.id } }]
            },
            Source: {
              rich_text: [{ text: { content: edge.source } }]
            },
            Target: {
              rich_text: [{ text: { content: edge.target } }]
            },
            Relationship: {
              select: { name: edge.relationship }
            },
            Strength: {
              number: edge.strength || 0.5
            }
          }
        });
        
        exportedEdgeCount++;
      }
    }
    
    return {
      success: true,
      exported: {
        nodes: exportedNodeCount,
        edges: exportedEdgeCount
      }
    };
  } catch (error) {
    log(`Error pushing to Notion: ${error instanceof Error ? error.message : String(error)}`, 'notion-sync-error');
    throw error;
  }
}