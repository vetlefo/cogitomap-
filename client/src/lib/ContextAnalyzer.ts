import { BubbleNode, Edge, Message, StructuredLLMOutput, NodeType, RelationshipType } from '../types';

/**
 * Generate a hash from a string for stable node IDs
 */
function hashContent(str: string): string {
  let hash = 0;
  const normalizedStr = str.trim().toLowerCase().substring(0, 100); // Normalize and limit length
  
  for (let i = 0; i < normalizedStr.length; i++) {
    const char = normalizedStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `${dateStr}-${Math.abs(hash).toString(16).substring(0, 8)}`;
}

/**
 * Analyzes a message and its structured data to create visualization nodes and connections.
 * Now leverages the LLM's structured output to create a richer knowledge graph.
 */
export function analyzeMessage(
  message: Message,
  structuredData: StructuredLLMOutput | null,
  previousMessageId: string | null,
  existingNodes: BubbleNode[] = []
): {
  newNodes: BubbleNode[];
  newEdges: Edge[];
} {
  // Initialize arrays for new nodes and edges
  const newNodes: BubbleNode[] = [];
  const newEdges: Edge[] = [];
  
  // Generate timestamp for unique ID creation
  const timestamp = Date.now();
  
  console.log(`Analyzing message: ${message.role}, content: ${message.content.substring(0, 50)}...`);
  console.log(`Structured data available: ${structuredData !== null}`);
  if (structuredData) {
    console.log(`Topics: ${structuredData.identified_topics?.length || 0}, Entities: ${structuredData.key_entities?.length || 0}`);
  }
  
  // Create the primary message node (either user or assistant message)
  const nodeType: NodeType = message.role === 'user' ? 'user_message' : 'ai_message';
  
  // If we have structured data, use it to enhance the node
  let keywords: string[] | undefined = undefined;
  let sentiment: 'positive' | 'negative' | 'neutral' | undefined = undefined;
  
  if (structuredData) {
    // Use the structured data for keywords and sentiment if available
    keywords = structuredData.identified_topics || [];
    sentiment = structuredData.sentiment;
  } else {
    // Fallback to basic keyword extraction for unstructured messages
    keywords = extractKeywords(message.content);
  }
  
  // Calculate position based on existing nodes, message type, and context
  const position = calculatePosition({
    role: message.role,
    content: message.content,
    keywords: keywords || []
  }, existingNodes);
  
  // Determine importance of the message
  const importance = structuredData 
    ? calculateSimplifiedImportance(nodeType, message.content, keywords) 
    : calculateImportance({ role: message.role, content: message.content }, [], keywords || []);
    
  // Generate a more stable ID for the main message node based on content hash
  const contentHash = hashContent(message.content);
  const mainNodeId = `${nodeType}-${contentHash}`;
  
  // Create the main message node
  const mainNode: BubbleNode = {
    id: mainNodeId,
    content: structuredData?.summary || message.content,
    type: nodeType,
    position,
    importance,
    keywords,
    sentiment
  };
  
  // Add the main node to our result set
  newNodes.push(mainNode);
  
  // If we have previous message ID, create a connection between messages
  if (previousMessageId) {
    const connectionType: RelationshipType = 
      nodeType === 'ai_message' ? 'response_to' : 'mentions';
      
    newEdges.push({
      id: `edge-${previousMessageId}-${mainNodeId}`,
      source: previousMessageId,
      target: mainNodeId,
      strength: nodeType === 'ai_message' ? 0.9 : 0.7,
      relationship: connectionType
    });
  }
  
  // If we have structured data, create additional nodes and connections
  if (structuredData) {
    // Process identified topics
    if (structuredData.identified_topics) {
      structuredData.identified_topics.forEach((topic, index) => {
        // Create a topic node with slightly offset position
        const topicNodeId = `topic-${hashContent(topic)}`;
        const offset = calculateTopicOffset(index, structuredData.identified_topics?.length || 1);
        
        const topicNode: BubbleNode = {
          id: topicNodeId,
          content: topic,
          type: 'topic',
          position: {
            x: position.x + offset.x,
            y: position.y + offset.y,
            z: position.z + offset.z
          },
          importance: calculateSimplifiedImportance('topic', topic),
          // No keywords for topic nodes
        };
        
        newNodes.push(topicNode);
        
        // Connect the topic to the main message
        newEdges.push({
          id: `edge-${mainNodeId}-${topicNodeId}`,
          source: mainNodeId,
          target: topicNodeId,
          strength: 0.6,
          relationship: 'mentions'
        });
      });
    }
    
    // Process key entities
    if (structuredData.key_entities) {
      structuredData.key_entities.forEach((entity, index) => {
        // Create an entity node with offset position
        const entityNodeId = `entity-${hashContent(entity.entity)}`;
        const offset = calculateEntityOffset(index, structuredData.key_entities?.length || 1);
        
        const entityNode: BubbleNode = {
          id: entityNodeId,
          content: entity.entity,
          type: 'entity',
          position: {
            x: position.x + offset.x,
            y: position.y + offset.y,
            z: position.z + offset.z
          },
          importance: calculateSimplifiedImportance('entity', entity.entity),
          metadata: { entityType: entity.type }
        };
        
        newNodes.push(entityNode);
        
        // Connect the entity to the main message
        newEdges.push({
          id: `edge-${mainNodeId}-${entityNodeId}`,
          source: mainNodeId,
          target: entityNodeId,
          strength: 0.5,
          relationship: 'mentions'
        });
      });
    }
    
    // Create a summary node if provided
    if (structuredData.summary && structuredData.summary !== structuredData.main_response) {
      const summaryNodeId = `summary-${hashContent(structuredData.summary)}`;
      
      const summaryNode: BubbleNode = {
        id: summaryNodeId,
        content: structuredData.summary,
        type: 'summary',
        position: {
          x: position.x,
          y: position.y + 2.5, // Position summary above the main node
          z: position.z,
        },
        importance: calculateSimplifiedImportance('summary', structuredData.summary),
      };
      
      newNodes.push(summaryNode);
      
      // Connect the summary to the main message
      newEdges.push({
        id: `edge-${mainNodeId}-${summaryNodeId}`,
        source: mainNodeId,
        target: summaryNodeId,
        strength: 0.8,
        relationship: 'summarizes'
      });
    }
    
    // Process suggested follow-up questions
    if (structuredData.suggested_followups && structuredData.suggested_followups.length > 0) {
      // Only take the first question to avoid cluttering
      const question = structuredData.suggested_followups[0];
      const questionNodeId = `question-${hashContent(question)}`;
      
      const questionNode: BubbleNode = {
        id: questionNodeId,
        content: question,
        type: 'question',
        position: {
          x: position.x - 1.5, // Position question to the side
          y: position.y - 1,
          z: position.z + 1.5,
        },
        importance: calculateSimplifiedImportance('question', question),
      };
      
      newNodes.push(questionNode);
      
      // Connect the question to the main message
      newEdges.push({
        id: `edge-${mainNodeId}-${questionNodeId}`,
        source: mainNodeId,
        target: questionNodeId,
        strength: 0.4,
        relationship: 'raises_question'
      });
    }
    
    // Process internal links if provided
    if (structuredData.internal_links) {
      // Note: This requires that we can map LLM-provided node IDs to our actual node IDs
      // This could be enhanced in a future iteration
    }
  }
  
  // Also create connections based on semantic similarity to existing nodes
  for (const existingNode of existingNodes) {
    // Skip connecting to the previous message as we've already handled that
    if (existingNode.id === previousMessageId) continue;
    
    // Only try to find connections if the existing node has keywords
    if (!existingNode.keywords || existingNode.keywords.length === 0) continue;
    
    // Only consider connections between message nodes
    if (!['user_message', 'ai_message'].includes(existingNode.type)) continue;
    
    // Calculate semantic similarity if we have keywords to compare
    if (keywords && keywords.length > 0) {
      const sharedKeywords = keywords.filter(keyword => 
        existingNode.keywords?.some(k => 
          k.includes(keyword) || keyword.includes(k)
        )
      );
      
      const keywordsLength = Math.max(keywords.length, existingNode.keywords?.length || 0);
      const contentSimilarity = keywordsLength > 0 ? 
        sharedKeywords.length / keywordsLength : 0;
      
      // Only create connections for sufficiently related nodes
      if (sharedKeywords.length >= 2 || contentSimilarity > 0.3) {
        newEdges.push({
          id: `edge-semantic-${existingNode.id}-${mainNodeId}`,
          source: existingNode.id,
          target: mainNodeId,
          strength: 0.2 + (contentSimilarity * 0.6), // 0.2 to 0.8 based on similarity
          relationship: 'mentions'
        });
      }
    }
  }
  
  // Return all new nodes and edges to be added to the visualization
  return {
    newNodes,
    newEdges
  };
}

/**
 * Enhanced keyword extraction with smarter NLP techniques
 * - Accounts for phrase importance
 * - Identifies key conceptual terms
 * - Evaluates semantic weight of words
 */
function extractKeywords(content: string): string[] {
  // Extended stop words list for improved filtering
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
    'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
    'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could',
    'may', 'might', 'must', 'of', 'from', 'then', 'than', 'that', 'this', 'these',
    'those', 'it', 'its', 'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he',
    'him', 'his', 'she', 'her', 'hers', 'we', 'us', 'our', 'ours', 'they', 'them',
    'their', 'theirs', 'am', 'im', 'who', 'what', 'when', 'where', 'why', 'how',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'too', 'very', 'just', 
    'also', 'get', 'got', 'gets', 'going', 'goes', 'went', 'gone',
    'come', 'coming', 'comes', 'came', 'know', 'knows', 'knew', 'known',
    'take', 'takes', 'took', 'taken', 'see', 'sees', 'saw', 'seen',
    'think', 'thinking', 'thinks', 'thought'
  ]);
  
  // Normalize text and do basic preprocessing
  const normalizedContent = content
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Replace punctuation with spaces, but keep hyphens
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();
  
  // Extract bigrams and trigrams (2-3 word phrases) for better context
  const words = normalizedContent.split(' ');
  const phrases: Record<string, number> = {};
  
  // Single words
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Skip stop words and short words
    if (word.length <= 2 || stopWords.has(word)) continue;
    
    // Add to frequency map
    phrases[word] = (phrases[word] || 0) + 1;
  }
  
  // Bigrams (two-word phrases)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    // Skip if either word is a stop word or too short
    if (words[i].length <= 2 || words[i + 1].length <= 2 || 
        stopWords.has(words[i]) || stopWords.has(words[i + 1])) continue;
    
    // Add to frequency map with a slight boost for multi-word phrases
    phrases[bigram] = (phrases[bigram] || 0) + 1.5;
  }
  
  // Check for special domain terms and concepts - boost their importance
  const importantConcepts = [
    'ai', 'machine', 'learning', 'model', 'neural', 'network', 'data', 'training',
    'algorithm', 'intelligence', 'artificial', 'deep', 'language', 'natural',
    'processing', 'computer', 'vision', 'robotics', 'automation', 'science',
    'research', 'ethics', 'bias', 'privacy', 'security', 'quantum', 'computing',
    'cloud', 'analytics', 'prediction', 'forecasting', 'classification',
    'regression', 'clustering', 'recognition', 'detection', 'generation',
    'synthetic', 'augmented', 'virtual', 'reality', 'blockchain', 'crypto',
    'health', 'medical', 'finance', 'banking', 'education', 'government',
    'transportation', 'energy', 'climate', 'environment', 'sustainability',
    'innovation', 'cognitive', 'autonomous', 'agents', 'robots', 'drones',
    'physics', 'biology', 'chemistry', 'mathematics', 'statistics', 'probability',
    'technology', 'engineering', 'design', 'development', 'software', 'hardware',
    'internet', 'web', 'mobile', 'device', 'phone', 'tablet', 'wearable',
    'social', 'media', 'marketing', 'business', 'economy', 'industry', 'commerce'
  ];
  
  // Boost importance of domain-specific terms
  Object.keys(phrases).forEach(phrase => {
    const phraseTerms = phrase.split(' ');
    phraseTerms.forEach(term => {
      if (importantConcepts.includes(term)) {
        phrases[phrase] *= 1.5; // 50% boost for domain terms
      }
    });
  });
  
  // Additional bonus for title-case words (potential proper nouns/concepts)
  words.forEach(word => {
    if (word.length > 1 && /^[A-Z][a-z]+$/.test(word)) {
      const lowercaseWord = word.toLowerCase();
      if (phrases[lowercaseWord]) {
        phrases[lowercaseWord] *= 1.3; // 30% boost for title case words
      }
    }
  });
  
  // Sort by score (frequency with boosts applied)
  const sortedPhrases = Object.entries(phrases)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // Get more phrases initially
    .map(([phrase]) => phrase);
  
  // Final pass: remove overlapping phrases (keep the higher-scoring ones)
  // e.g., if both "machine learning" and "learning" are present, remove "learning"
  const finalKeywords: string[] = [];
  for (const phrase of sortedPhrases) {
    // Check if this phrase is contained within any higher-ranked phrase we've already kept
    const isOverlapping = finalKeywords.some(keyword => 
      keyword.includes(phrase) && keyword !== phrase
    );
    
    if (!isOverlapping && finalKeywords.length < 5) {
      finalKeywords.push(phrase);
    }
  }
  
  return finalKeywords;
}

/**
 * Helper function to calculate position offset for topic nodes
 */
function calculateTopicOffset(index: number, totalTopics: number): { x: number; y: number; z: number } {
  // Create a circular arrangement around the main node
  const angle = (index / totalTopics) * Math.PI * 2;
  const radius = 3 + (index * 0.2); // Increasing radius for each topic
  
  return {
    x: Math.cos(angle) * radius,
    y: 0.5 + (index * 0.2), // Slight y offset for better visibility
    z: Math.sin(angle) * radius
  };
}

/**
 * Helper function to calculate position offset for entity nodes
 */
function calculateEntityOffset(index: number, totalEntities: number): { x: number; y: number; z: number } {
  // Create a different arrangement for entities (below the main node)
  const angle = (index / totalEntities) * Math.PI + (Math.PI / 4); // Semi-circle below
  const radius = 2.5 + (index * 0.15);
  
  return {
    x: Math.cos(angle) * radius,
    y: -1.0 - (index * 0.3), // Position below the main node
    z: Math.sin(angle) * radius
  };
}

/**
 * Calculate the 3D position for a message node based on semantic meaning and conversation flow
 */
function calculatePosition(
  message: { role: string; content: string; keywords: string[] },
  existingNodes: BubbleNode[]
): { x: number; y: number; z: number } {
  // Base position influenced by message role and content
  let position = {
    x: message.role === 'user' ? -6 : 6,
    y: 0,
    z: 0
  };
  
  // Create a more organized layout:
  // - Arrange messages in chronological rings
  // - Group by semantic similarity (keywords)
  // - User and AI messages form a conversational axis
  
  // Determine message index based on existing nodes
  const messageCount = existingNodes.filter(n => 
    n.type === 'user_message' || n.type === 'ai_message'
  ).length;
  
  const conversationProgress = Math.min(messageCount / 15, 1); // Scale factor, max at 15 messages
  
  // Create a pseudo-topic vector based on message keywords
  const topicSeed = message.keywords.join('').length % 8; // 0-7 based on keywords
  
  // Calculate main conversation angle - this creates a spiral effect
  const angle = (messageCount * 0.4 + topicSeed * 0.3) % (Math.PI * 2);
  
  // Calculate radial distance - further out as conversation progresses
  // But keep a minimum distance to avoid cluttering at center
  const baseRadius = 4 + (conversationProgress * 8);
  
  // Messages are positioned on a spiral pattern - users on negative X half, AI on positive X half
  // But with semi-random placement within their domain to create clusters
  let radius = baseRadius;
  
  // Find the most recent node for continuity in the conversation
  if (messageCount > 0 && existingNodes.length > 0) {
    // Get most recent message node
    const recentMessageNodes = existingNodes
      .filter(n => n.type === 'user_message' || n.type === 'ai_message')
      .sort((a, b) => b.id.localeCompare(a.id)); // Simple timestamp-based sort
      
    if (recentMessageNodes.length > 0) {
      const prevNode = recentMessageNodes[0];
      
      // Check if this message is semantically related to the previous one
      const isPrevMsgSameTopic = message.keywords.some(keyword => 
        prevNode.keywords?.some(k => 
          k.includes(keyword) || keyword.includes(k)
        )
      );
      
      // Related messages are closer to their predecessors
      radius = isPrevMsgSameTopic ? baseRadius * 0.7 : baseRadius * 1.1;
      
      // Direct responses stay closer to their questions
      if (message.role === 'assistant' && prevNode.type === 'user_message') {
        radius *= 0.8;
      }
    }
  }
  
  // Apply trigonometric positioning for the spiral pattern
  position.x = (message.role === 'user' ? -1 : 1) * Math.cos(angle) * radius;
  position.z = Math.sin(angle) * radius;
  
  // Y-position based on message importance, length, and conversation depth
  const importanceFactor = Math.min(message.content.length / 300, 2); // Max 2x boost based on length
  position.y = (message.role === 'user' ? -1.5 : 1.5) + 
               (messageCount * 0.15) + // Gradual rise with conversation
               (importanceFactor * 0.8); // Important messages higher
  
  // Add subtle controlled variance to prevent perfect alignments
  // Use seeded randomness based on message content for consistency
  const contentHash = message.content.length + 
                     (message.content.charCodeAt(0) || 0) +
                     (message.content.charCodeAt(message.content.length - 1) || 0);
  
  const varianceX = (((contentHash * 13) % 100) / 100 - 0.5) * 1.5;
  const varianceY = (((contentHash * 17) % 100) / 100 - 0.5) * 1.0;
  const varianceZ = (((contentHash * 19) % 100) / 100 - 0.5) * 1.5;
  
  position.x += varianceX;
  position.y += varianceY;
  position.z += varianceZ;
  
  return position;
}

/**
 * Simplified importance calculation for structured data
 * Used when we have structured data from the LLM
 */
function calculateSimplifiedImportance(
  messageType: NodeType,
  content: string,
  keywords?: string[]
): number {
  // Base importance based on node type
  let importance = 0.4;
  
  switch (messageType) {
    case 'summary':
      importance = 0.7; // Summaries are important
      break;
    case 'topic':
      importance = 0.5; // Topics are moderately important
      break;
    case 'entity':
      importance = 0.4; // Entities are slightly less important
      break;
    case 'question':
      importance = 0.6; // Questions are somewhat important
      break;
    case 'user_message':
      importance = 0.55; // User messages are more important than AI responses
      break;
    case 'ai_message':
      importance = 0.5; // AI responses are base importance
      break;
  }
  
  // Content length affects importance
  const lengthFactor = Math.min(content.length / 500, 0.3);
  importance += lengthFactor;
  
  // Keyword richness affects importance
  if (keywords && keywords.length > 0) {
    const keywordFactor = Math.min(keywords.length * 0.05, 0.2);
    importance += keywordFactor;
  }
  
  // Cap importance between 0.2 and 1.0
  return Math.max(0.2, Math.min(importance, 1.0));
}

/**
 * Enhanced importance calculation with semantic analysis to identify key messages
 * and create a more meaningful visualization
 */
function calculateImportance(
  message: { role: string; content: string },
  previousMessages: Array<{ role: string; content: string }>,
  keywords: string[]
): number {
  // Starting with a moderate base importance
  let importance = 0.4;
  
  // Content-based importance factors
  
  // 1. Length and complexity
  // Longer messages often contain more information, but with diminishing returns
  const lengthScore = Math.min(message.content.length / 800, 0.3);
  importance += lengthScore;
  
  // 2. Keyword richness 
  // More keywords and multi-word phrases indicate richer content
  const keywordScore = Math.min(
    keywords.length * 0.08 + 
    keywords.filter(k => k.includes(' ')).length * 0.05, 
    0.2
  );
  importance += keywordScore;
  
  // 3. Question detection
  // Messages with questions often introduce important topics
  const hasQuestion = /\?/.test(message.content) || 
                     /\b(what|how|why|when|where|who|which)\b/i.test(message.content);
  if (hasQuestion) {
    importance += message.role === 'user' ? 0.15 : 0.05;
  }
  
  // Context-based importance factors
  
  // 4. Direct responses
  // AI responses to user questions form a key Q&A pair
  if (message.role === 'assistant' && 
      previousMessages.length > 0 && 
      previousMessages[previousMessages.length - 1].role === 'user') {
    importance += 0.15;
    
    // Especially if the user asked a question
    if (/\?/.test(previousMessages[previousMessages.length - 1].content)) {
      importance += 0.1;
    }
  }
  
  // 5. Topic introduction
  // Messages that introduce new keywords are often important turning points
  if (previousMessages.length > 0) {
    const newTopicScore = detectNewTopic(message, previousMessages, keywords);
    importance += newTopicScore * 0.2; // Up to 0.2 boost for brand new topics
  }
  
  // 6. Conceptual importance
  // Check for important domain-specific terms that indicate key concepts
  const importantTerms = [
    'conclusion', 'summary', 'important', 'crucial', 'essential', 'critical',
    'key', 'main', 'primary', 'fundamental', 'core', 'central', 'vital',
    'example', 'definition', 'cause', 'effect', 'result', 'consequence',
    'analysis', 'explanation', 'solution', 'problem', 'challenge', 'opportunity',
    'finding', 'discovery', 'development', 'innovation', 'breakthrough'
  ];
  
  const content = message.content.toLowerCase();
  const containsImportantTerms = importantTerms.some(term => content.includes(term));
  if (containsImportantTerms) {
    importance += 0.15;
  }
  
  // 7. Codeblocks or structured data detection
  // Messages with code or structured data are often important reference points
  if (/```/.test(message.content) || /\{\s*["']/.test(message.content)) {
    importance += 0.2;
  }
  
  // 8. Position in conversation
  // Early messages (e.g., system prompts) and recent messages often have more importance
  const recencyFactor = 
    previousMessages.length < 3 ? 0.1 : // Initial messages are important
    previousMessages.length > 10 && previousMessages.length <= 15 ? 0.05 : // Recent messages in longer threads
    0;
  importance += recencyFactor;
  
  // Cap importance between 0.15 and 1.0
  // Even the least important messages should be somewhat visible
  return Math.max(0.15, Math.min(importance, 1.0));
}

/**
 * Helper function to detect if a message introduces new topics
 * compared to previous conversation
 */
function detectNewTopic(
  message: { role: string; content: string },
  previousMessages: Array<{ role: string; content: string }>,
  currentKeywords: string[]
): number {
  // Get the last few messages to compare against
  const recentMessages = previousMessages.slice(-3);
  let allPreviousContent = recentMessages.map(m => m.content).join(' ').toLowerCase();
  
  // Count how many of the current keywords are new (not in previous messages)
  let newKeywordCount = 0;
  for (const keyword of currentKeywords) {
    if (!allPreviousContent.includes(keyword.toLowerCase())) {
      newKeywordCount++;
    }
  }
  
  // Calculate a score from 0 to 1 based on how many new keywords were introduced
  return currentKeywords.length > 0 
    ? newKeywordCount / currentKeywords.length 
    : 0;
}
