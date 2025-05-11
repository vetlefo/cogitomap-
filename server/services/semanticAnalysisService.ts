/**
 * Semantic Analysis Service
 * 
 * This service provides methods for asynchronous semantic analysis of conversations
 * using independent one-shot LLM calls to maintain unbiased analysis.
 */

import { Message } from '../../client/src/types';
import { BubbleNode, Edge } from '../../client/src/types';
import { handleLLMRequest } from '../api/llm_router';
import { createNode, createEdge } from '../db/graphService';

/**
 * Extract keywords from a set of messages
 */
export async function extractKeywordsFromConversation(messages: Message[]): Promise<string[]> {
  // Create a specialized one-shot prompt for keyword extraction
  const keywordExtractionPrompt: Message = {
    role: 'system',
    content: `
    Extract the 10-15 most significant keywords or phrases from this conversation.
    Return ONLY a JSON array of strings, with no additional text.
    Focus on substantive concepts rather than common words.
    `
  };

  const conversationContent = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const extractionRequest = {
    messages: [
      keywordExtractionPrompt,
      { role: 'user', content: conversationContent }
    ],
    // Use a model with good pattern recognition
    model: 'openai:gpt-4o',
    structured: false
  };

  try {
    // Create a mock request/response for the handleLLMRequest function
    const mockRequest = {
      body: extractionRequest,
      query: { structured: 'false' }
    } as any;
    
    const mockResponse = {
      json: (data: any) => data,
      status: (_: number) => ({ json: (data: any) => data })
    } as any;

    const result = await handleLLMRequest(mockRequest, mockResponse);
    
    // Parse the response, which should be a JSON array of strings
    let keywords: string[] = [];
    
    if (result && typeof result === 'object' && 'message' in result && 
        result.message && typeof result.message === 'object' && 
        'content' in result.message && typeof result.message.content === 'string') {
      
      try {
        // Try to extract JSON array from the response
        const jsonMatch = result.message.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          keywords = JSON.parse(jsonMatch[0]);
        } else if (Array.isArray(JSON.parse(result.message.content))) {
          keywords = JSON.parse(result.message.content);
        }
      } catch (e) {
        console.error('Error parsing keywords response:', e);
        // Fallback: extract words that might be keywords (in quotation marks or with special formatting)
        const potentialKeywords = result.message.content.match(/"([^"]*)"|'([^']*)'|`([^`]*)`/g);
        if (potentialKeywords) {
          keywords = potentialKeywords.map((k: string) => k.replace(/["'`]/g, ''));
        }
      }
    }
    
    return keywords;
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return [];
  }
}

/**
 * Find semantic relationships between a set of keywords or entities
 * Uses non-chained, one-shot prompting to maintain unbiased analysis
 */
export async function findSemanticRelationships(
  keywords: string[], 
  originalMessages: Message[] = []
): Promise<{ nodes: BubbleNode[], edges: Edge[], summary: string }> {
  // Create a specialized one-shot prompt for relationship analysis
  const relationshipAnalysisPrompt: Message = {
    role: 'system',
    content: `
    Analyze the semantic relationships between these concepts: ${keywords.join(', ')}
    
    Return a JSON object with these properties:
    1. "nodes": Array of objects representing each concept with properties:
       - "id": String identifier (use the concept name)
       - "content": The concept name
       - "type": "topic" or "entity" or "concept"
       - "importance": Number from 1-10 indicating concept importance
    
    2. "edges": Array of relationships between concepts with properties:
       - "source": Source concept id
       - "target": Target concept id
       - "relationship": Type of relationship (e.g. "influences", "part_of", etc.)
       - "strength": Number from 1-10 indicating relationship strength
    
    3. "summary": Brief paragraph explaining key relationships identified
    
    Focus only on the most meaningful connections. Aim for clarity and insight.
    `
  };

  // Include a brief context from original messages if available
  let contextHint = '';
  if (originalMessages.length > 0) {
    const lastMessages = originalMessages.slice(-3);
    contextHint = `\n\nThese concepts appeared in a conversation about: ${
      lastMessages
        .filter(m => m.role !== 'system')
        .map(m => m.content.substring(0, 100))
        .join(' ... ')
    }`;
  }

  const relationshipRequest = {
    messages: [
      relationshipAnalysisPrompt,
      { role: 'user', content: `Analyze these concepts: ${keywords.join(', ')}${contextHint}` }
    ],
    // Use a model with good reasoning capabilities
    model: 'openai:gpt-4o',
    structured: false
  };

  try {
    // Create a mock request/response for the handleLLMRequest function
    const mockRequest = {
      body: relationshipRequest,
      query: { structured: 'false' }
    } as any;
    
    const mockResponse = {
      json: (data: any) => data,
      status: (_: number) => ({ json: (data: any) => data })
    } as any;

    const result = await handleLLMRequest(mockRequest, mockResponse);
    
    // Parse the response, which should contain nodes, edges, and a summary
    let nodes: BubbleNode[] = [];
    let edges: Edge[] = [];
    let summary = '';
    
    if (result && typeof result === 'object' && 'message' in result && 
        result.message && typeof result.message === 'object' && 
        'content' in result.message && typeof result.message.content === 'string') {
      
      try {
        // Extract JSON object from response
        const jsonMatch = result.message.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Map the parsed nodes to BubbleNode objects
          if (parsed.nodes && Array.isArray(parsed.nodes)) {
            nodes = parsed.nodes.map((node: any) => ({
              id: `semantic-${node.id || node.content}`,
              content: node.content,
              type: node.type || 'topic',
              importance: node.importance || 5,
              position: {
                x: Math.random() * 10 - 5,
                y: Math.random() * 10 - 5,
                z: Math.random() * 10 - 5
              }
            }));
          }
          
          // Map the parsed edges to Edge objects
          if (parsed.edges && Array.isArray(parsed.edges)) {
            edges = parsed.edges.map((edge: any, index: number) => ({
              id: `semantic-edge-${index}`,
              source: `semantic-${edge.source}`,
              target: `semantic-${edge.target}`,
              relationship: edge.relationship || 'related_to',
              strength: edge.strength || 5
            }));
          }
          
          // Extract the summary
          if (parsed.summary) {
            summary = parsed.summary;
          }
        }
      } catch (e) {
        console.error('Error parsing relationship analysis response:', e);
      }
    }
    
    return { nodes, edges, summary };
  } catch (error) {
    console.error('Error finding semantic relationships:', error);
    return { nodes: [], edges: [], summary: '' };
  }
}

/**
 * Generate async semantic connections for the graph database
 * This method can be called periodically to enhance the knowledge graph
 * without affecting the main conversation flow
 */
export async function generateSemanticConnections(recentMessages: Message[]): Promise<{
  nodesCreated: number;
  edgesCreated: number;
  summary: string;
}> {
  try {
    // 1. Extract keywords from recent messages
    const keywords = await extractKeywordsFromConversation(recentMessages);
    
    if (keywords.length === 0) {
      return { nodesCreated: 0, edgesCreated: 0, summary: "No significant keywords found" };
    }
    
    // 2. Find semantic relationships between keywords
    const { nodes, edges, summary } = await findSemanticRelationships(keywords, recentMessages);
    
    // 3. Add nodes and edges to the graph database
    let nodesCreated = 0;
    let edgesCreated = 0;
    
    for (const node of nodes) {
      try {
        await createNode({
          ...node,
          metadata: {
            source: 'semantic_analysis',
            timestamp: Date.now()
          }
        });
        nodesCreated++;
      } catch (e) {
        console.error(`Error creating semantic node ${node.id}:`, e);
      }
    }
    
    for (const edge of edges) {
      try {
        await createEdge(
          edge.source,
          edge.target,
          edge.relationship || 'relates_to',
          edge.strength || 5
        );
        edgesCreated++;
      } catch (e) {
        console.error(`Error creating semantic edge from ${edge.source} to ${edge.target}:`, e);
      }
    }
    
    return {
      nodesCreated,
      edgesCreated,
      summary
    };
  } catch (error) {
    console.error('Error generating semantic connections:', error);
    return {
      nodesCreated: 0,
      edgesCreated: 0,
      summary: 'Error generating semantic connections'
    };
  }
}

/**
 * Create a summary node that connects several other nodes
 * This is useful for creating higher-level perspectives on conversations
 */
export async function createSummaryNode(
  nodeIds: string[],
  messageContext: Message[] = []
): Promise<BubbleNode | null> {
  // Create a specialized one-shot prompt for generating a summary
  const summaryPrompt: Message = {
    role: 'system',
    content: `
    Create a concise, insightful summary that connects these concepts.
    Return a JSON object with:
    1. "summary": A 1-2 sentence synthesis that identifies common themes or patterns
    2. "title": A short, descriptive title for this semantic cluster (3-5 words)
    3. "importance": Number from 1-10 indicating how central this theme is
    
    Be specific and substantive. Focus on finding meaningful connections.
    `
  };

  // If we have message context, provide it for better summaries
  let messageHint = '';
  if (messageContext.length > 0) {
    messageHint = `\n\nThese concepts appeared in the following conversation:\n${
      messageContext
        .filter(m => m.role !== 'system')
        .map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 150)}...`)
        .join('\n\n')
    }`;
  }

  const summaryRequest = {
    messages: [
      summaryPrompt,
      { 
        role: 'user', 
        content: `Create a summary connecting these concepts: ${nodeIds.join(', ')}${messageHint}` 
      }
    ],
    model: 'openai:gpt-4o',
    structured: false
  };

  try {
    // Create a mock request/response for the handleLLMRequest function
    const mockRequest = {
      body: summaryRequest,
      query: { structured: 'false' }
    } as any;
    
    const mockResponse = {
      json: (data: any) => data,
      status: (_: number) => ({ json: (data: any) => data })
    } as any;

    const result = await handleLLMRequest(mockRequest, mockResponse);
    
    if (result && result.message && result.message.content) {
      try {
        // Extract JSON object from response
        const jsonMatch = result.message.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Create a summary node
          const summaryNode: BubbleNode = {
            id: `summary-${Date.now()}`,
            content: parsed.summary || 'Semantic summary',
            type: 'summary',
            importance: parsed.importance || 8,
            keywords: nodeIds,
            position: {
              x: Math.random() * 10 - 5,
              y: Math.random() * 10 - 5, 
              z: Math.random() * 10 - 5
            },
            metadata: {
              title: parsed.title || 'Semantic Cluster',
              source: 'semantic_analysis',
              timestamp: Date.now()
            }
          };
          
          // Add the summary node to the database
          const createdNode = await createNode(summaryNode);
          
          // Create edges from the summary node to each concept node
          for (const nodeId of nodeIds) {
            try {
              await createEdge(
                createdNode.id,
                nodeId,
                'summarizes',
                7 // Relatively strong connection
              );
            } catch (e) {
              console.error(`Error creating edge from summary to ${nodeId}:`, e);
            }
          }
          
          return createdNode;
        }
      } catch (e) {
        console.error('Error parsing summary response:', e);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error creating summary node:', error);
    return null;
  }
}

/**
 * Entry point for semantic analysis
 * Can be called periodically or after N messages to enhance the graph without disrupting conversations
 */
export async function runAsyncSemanticAnalysis(messageHistory: Message[]): Promise<{
  success: boolean;
  summary: string;
  nodesAdded: number;
  edgesAdded: number;
  summaryNode?: BubbleNode;
}> {
  try {
    // Only analyze if we have enough messages
    if (messageHistory.length < 3) {
      return {
        success: false,
        summary: "Not enough message history for semantic analysis",
        nodesAdded: 0,
        edgesAdded: 0
      };
    }
    
    // Extract the most recent messages (last 10 or all if fewer)
    const recentMessages = messageHistory.slice(-Math.min(10, messageHistory.length));
    
    // Generate semantic connections
    const { nodesCreated, edgesCreated, summary } = await generateSemanticConnections(recentMessages);
    
    // Create a summary node if we found enough connections
    let summaryNode = null;
    if (nodesCreated >= 3) {
      // For this example, we'll use the most recent node IDs - in production, you'd determine the most relevant nodes
      const nodeIds = Array.from({ length: Math.min(5, nodesCreated) }, (_, i) => 
        `semantic-concept-${i}`
      );
      
      summaryNode = await createSummaryNode(nodeIds, recentMessages);
    }
    
    return {
      success: true,
      summary,
      nodesAdded: nodesCreated,
      edgesAdded: edgesCreated,
      summaryNode: summaryNode || undefined
    };
  } catch (error) {
    console.error('Error running async semantic analysis:', error);
    return {
      success: false,
      summary: "Error during semantic analysis",
      nodesAdded: 0,
      edgesAdded: 0
    };
  }
}