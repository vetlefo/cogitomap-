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
import { generateEmbedding, embedding3DPosition } from '../services/embeddingService';

/**
 * Extract keywords from a set of messages
 */
export async function extractKeywordsFromConversation(messages: Message[]): Promise<string[]> {
  // Create a specialized one-shot prompt for keyword extraction
  const keywordExtractionPrompt: Message = {
    role: 'system',
    content: `
    Extract 5-10 significant keywords or phrases from this conversation.
    You MUST return ONLY a JSON array of strings with no explanations.
    Example correct output: ["love", "emotion", "relationships", "human connection", "affection"]
    Focus on substantive concepts and important entities.
    Even for simple or short conversations, always try to extract at least 3-5 keywords.
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
    // Use a widely available model
    model: 'openai:gpt-3.5-turbo',
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
      
      const content = result.message.content.trim();
      console.log('Keyword extraction raw result:', content);
      
      try {
        // Try several approaches to extract a JSON array
        // First, see if the entire string is a valid JSON array
        if (content.startsWith('[') && content.endsWith(']')) {
          try {
            keywords = JSON.parse(content);
            console.log('Parsed keywords as direct JSON array:', keywords);
          } catch (e) {
            console.log('Failed to parse direct JSON, trying regex extraction');
            // Try to extract any JSON array with regex
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
              try {
                keywords = JSON.parse(jsonMatch[0]);
                console.log('Parsed keywords via regex match:', keywords);
              } catch (innerE) {
                console.error('Failed to parse regex-extracted JSON array');
              }
            }
          }
        } else {
          // Look for JSON array pattern in the text
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            try {
              keywords = JSON.parse(jsonMatch[0]);
              console.log('Parsed keywords via regex match from text:', keywords);
            } catch (e) {
              console.error('Failed to parse JSON array from text content');
            }
          }
        }
        
        // If still no keywords, try to extract quoted strings as a fallback
        if (keywords.length === 0) {
          console.log('No keywords array found, trying to extract quoted strings');
          const potentialKeywords = content.match(/"([^"]*)"|'([^']*)'|`([^`]*)`/g);
          if (potentialKeywords) {
            keywords = potentialKeywords.map((k: string) => k.replace(/["'`]/g, ''));
            console.log('Extracted keywords from quotes:', keywords);
          }
        }
      } catch (e) {
        console.error('Error parsing keywords response:', e);
        // Final fallback: extract words that might be keywords (in quotation marks or with special formatting)
        const potentialKeywords = content.match(/"([^"]*)"|'([^']*)'|`([^`]*)`/g);
        if (potentialKeywords) {
          keywords = potentialKeywords.map((k: string) => k.replace(/["'`]/g, ''));
          console.log('Extracted fallback keywords from quotes:', keywords);
        }
      }
    }
    
    // If we still have no keywords, use some minimal defaults based on common concepts
    if (keywords.length === 0) {
      console.log('Warning: No keywords found. Using minimal defaults for conversation concepts');
      
      // Extract some basic default concepts from the messages
      const defaultKeywords = new Set<string>();
      
      // Extract meaningful words from messages (more aggressive approach)
      const allWords = new Set<string>();
      const importantWords = new Set<string>();
      
      // Common stopwords to filter out
      const stopwords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 
        'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
        'out', 'of', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would',
        'shall', 'should', 'may', 'might', 'must', 'that', 'which', 'who', 'whom',
        'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'me', 'him', 'her', 'us', 'them'
      ]);
      
      // Collect words from all messages
      for (const msg of messages) {
        // Split into words, filter out stopwords, and keep words longer than 3 characters
        const words = msg.content.toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
          .split(/\s+/)
          .filter(word => !stopwords.has(word) && word.length > 3);
        
        words.forEach(word => allWords.add(word));
        
        // Also add explicit key concepts
        if (msg.content.toLowerCase().includes('love')) importantWords.add('love');
        if (msg.content.toLowerCase().includes('knowledge')) importantWords.add('knowledge');
        if (msg.content.toLowerCase().includes('graph')) importantWords.add('graph');
        if (msg.content.toLowerCase().includes('visualization')) importantWords.add('visualization');
        if (msg.content.toLowerCase().includes('semantic')) importantWords.add('semantic');
        if (msg.content.toLowerCase().includes('data')) importantWords.add('data');
        if (msg.content.toLowerCase().includes('conversation')) importantWords.add('conversation');
        if (msg.content.toLowerCase().includes('analysis')) importantWords.add('analysis');
        if (msg.content.toLowerCase().includes('relationship')) importantWords.add('relationship');
      }
      
      // First use important words
      if (importantWords.size >= 3) {
        keywords = Array.from(importantWords);
        console.log('Using important keywords as fallback:', keywords);
      } 
      // Then try using all extracted words
      else if (allWords.size >= 3) {
        // Take up to 10 keywords to avoid overwhelming the system
        keywords = Array.from(allWords).slice(0, 10);
        console.log('Using extracted words as fallback:', keywords);
      }
      // Last resort - hard-coded default keywords 
      else {
        keywords = ['conversation', 'knowledge graph', 'visualization', 'semantic analysis', 'connection'];
        console.log('Using hard-coded fallback keywords:', keywords);
      }
    }
    
    return keywords;
  } catch (error) {
    console.error('Error extracting keywords:', error);
    // Even on error, provide some fallback keywords for a basic visualization
    return ['conversation', 'knowledge graph', 'visualization', 'connection', 'analysis'];
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
    // Use a widely available model
    model: 'openai:gpt-3.5-turbo',
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
        // Extract JSON object from response (more robust method)
        let parsed: any = null;
        
        // Try several methods to extract valid JSON
        
        // Method 1: Regular expression to find JSON block
        const jsonMatch = result.message.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            console.log('Successfully parsed JSON with method 1');
          } catch (jsonError) {
            console.log('Failed to parse with method 1, trying method 2');
          }
        }
        
        // Method 2: Try to detect JSON with triple backticks markdown
        if (!parsed) {
          const codeBlockMatch = result.message.content.match(/```(?:json)?([\s\S]*?)```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            try {
              parsed = JSON.parse(codeBlockMatch[1].trim());
              console.log('Successfully parsed JSON with method 2');
            } catch (jsonError) {
              console.log('Failed to parse with method 2, trying method 3');
            }
          }
        }
        
        // Method 3: Attempt to repair and extract JSON
        if (!parsed) {
          // Add fallback JSON creation based on keywords
          console.log('Creating fallback semantic nodes from keywords');
          
          // Generate a synthetic graph structure from keywords if real parsing failed
          const concepts = keywords.map(keyword => ({
            id: keyword.toLowerCase().replace(/\s+/g, '_'),
            content: keyword,
            type: 'topic',
            importance: 6 + Math.floor(Math.random() * 4) // 6-9 importance
          }));
          
          // Create connections between concepts
          const conceptEdges = [];
          if (concepts.length >= 2) {
            // Connect each concept to at least one other
            for (let i = 0; i < concepts.length; i++) {
              const target = (i === concepts.length - 1) ? 0 : i + 1;
              conceptEdges.push({
                source: concepts[i].id,
                target: concepts[target].id,
                relationship: 'mentions',
                strength: 6 + Math.floor(Math.random() * 4) // 6-9 strength
              });
            }
            
            // Add a few more random connections for richness
            for (let i = 0; i < Math.min(concepts.length, 3); i++) {
              const source = Math.floor(Math.random() * concepts.length);
              let target = Math.floor(Math.random() * concepts.length);
              if (target === source) target = (target + 1) % concepts.length;
              
              conceptEdges.push({
                source: concepts[source].id,
                target: concepts[target].id,
                relationship: 'mentions',
                strength: 6 + Math.floor(Math.random() * 4)
              });
            }
          }
          
          parsed = {
            nodes: concepts,
            edges: conceptEdges,
            summary: `This visualization shows relationships between ${keywords.join(', ')}.`
          };
          console.log('Created fallback semantic structure:', parsed);
        }
        
        // Process the parsed data (either from JSON or fallback)
        if (parsed) {
          // Map the parsed nodes to BubbleNode objects
          if (parsed.nodes && Array.isArray(parsed.nodes)) {
            // First generate embeddings for all nodes
            const nodeEmbeddingPromises = parsed.nodes.map(async (node: any) => {
              try {
                // Generate embedding for node content
                const content = node.content || '';
                const embedding = await generateEmbedding(content);
                
                // Use embedding to determine position
                const position = embedding3DPosition(embedding);
                
                return {
                  ...node,
                  embedding_vector: embedding,
                  calculatedPosition: position
                };
              } catch (error) {
                console.error(`Error generating embedding for node: ${error}`);
                return node;
              }
            });
            
            // Wait for all embeddings to be generated
            const nodesWithEmbeddings = await Promise.all(nodeEmbeddingPromises);
            
            // Map to BubbleNode objects with embeddings and positions
            nodes = nodesWithEmbeddings.map((node: any) => ({
              id: `semantic-${node.id || node.content.toLowerCase().replace(/\s+/g, '_')}`,
              content: node.content,
              type: node.type || 'topic',
              importance: node.importance || 5,
              // Include the embedding vector for storage
              embedding_vector: node.embedding_vector,
              // Use embedding-derived position when available or random position
              position: node.calculatedPosition || {
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
              relationship: edge.relationship || 'supports',
              strength: edge.strength || 5
            }));
          }
          
          // Extract the summary
          if (parsed.summary) {
            summary = parsed.summary;
          }
        }
      } catch (e) {
        console.error('Error in relationship analysis processing:', e);
        
        // Last resort fallback - create basic semantic structure from keywords
        if (keywords.length > 0) {
          console.log('Using last-resort fallback to create semantic nodes');
          
          // Create a node for each keyword
          nodes = keywords.map((keyword, index) => ({
            id: `semantic-keyword-${index}`,
            content: keyword,
            type: 'topic',
            importance: 7,
            position: {
              x: Math.random() * 10 - 5,
              y: Math.random() * 10 - 5,
              z: Math.random() * 10 - 5
            }
          }));
          
          // Create edges connecting keywords in sequence
          if (nodes.length >= 2) {
            for (let i = 0; i < nodes.length - 1; i++) {
              edges.push({
                id: `semantic-fallback-edge-${i}`,
                source: nodes[i].id,
                target: nodes[i+1].id,
                relationship: 'mentions',
                strength: 6
              });
            }
            
            // Connect last to first to make a loop
            edges.push({
              id: `semantic-fallback-edge-last`,
              source: nodes[nodes.length-1].id,
              target: nodes[0].id,
              relationship: 'mentions',
              strength: 5
            });
          }
          
          summary = `Basic visualization of key concepts: ${keywords.join(', ')}`;
        }
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
          { strength: edge.strength || 5 }
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
    model: 'openai:gpt-3.5-turbo',
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
                { strength: 7 } // Relatively strong connection
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