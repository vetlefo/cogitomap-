import { BubbleNode, Edge } from '../types';

/**
 * Analyzes a message and its context to determine its position in 3D space
 * and other visualization properties. Now also returns potential connections to other nodes.
 */
export function analyzeMessage(
  message: { role: string; content: string },
  previousMessages: Array<{ role: string; content: string }>,
  existingNodes: BubbleNode[] = []
): {
  node: BubbleNode;
  connections: Edge[];
} {
  // Extract keywords from the message
  const keywords = extractKeywords(message.content);
  
  // Calculate the position based on the message content and position in conversation
  let position = calculatePosition(message, previousMessages, keywords);
  
  // Calculate how important this message is (for sizing the bubble)
  const importance = calculateImportance(message, previousMessages, keywords);
  
  // Create unique ID for the node
  const id = `message-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Create the bubble node
  const node: BubbleNode = {
    id,
    content: message.content,
    type: message.role as 'user' | 'assistant',
    position,
    importance,
    keywords
  };
  
  // Generate connections to other relevant nodes
  const connections: Edge[] = [];
  
  // If this is a direct response to the previous message, create a strong connection
  if (previousMessages.length > 0 && existingNodes.length > 0) {
    const lastMessage = previousMessages[previousMessages.length - 1];
    const lastNode = existingNodes.find(n => 
      n.content === lastMessage.content && 
      n.type === (lastMessage.role as 'user' | 'assistant')
    );
    
    if (lastNode) {
      // Direct sequential connection (Q&A pair or conversation flow)
      connections.push({
        id: `edge-${lastNode.id}-${node.id}`,
        source: lastNode.id,
        target: node.id,
        strength: message.role === 'assistant' && lastMessage.role === 'user' ? 0.9 : 0.7 // Stronger for Q&A pairs
      });
    }
  }
  
  // Find connections based on semantic similarity (shared keywords)
  for (const existingNode of existingNodes) {
    // Skip the most recent node as we already connected to it
    if (previousMessages.length > 0 && 
        existingNode.content === previousMessages[previousMessages.length - 1].content) {
      continue;
    }
    
    // Calculate semantic similarity
    const sharedKeywords = keywords.filter(keyword => 
      existingNode.keywords.some(k => 
        k.includes(keyword) || keyword.includes(k)
      )
    );
    
    const contentSimilarity = sharedKeywords.length / 
                             Math.max(keywords.length, existingNode.keywords.length);
    
    // Only create connections for sufficiently related nodes
    if (sharedKeywords.length >= 2 || contentSimilarity > 0.3) {
      connections.push({
        id: `edge-semantic-${existingNode.id}-${node.id}`,
        source: existingNode.id,
        target: node.id,
        strength: 0.2 + (contentSimilarity * 0.6) // 0.2 to 0.8 based on similarity
      });
    }
  }
  
  // Return both the node and its connections
  return {
    node,
    connections
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
 * Calculate the 3D position for a message node based on semantic meaning and conversation flow
 */
function calculatePosition(
  message: { role: string; content: string },
  previousMessages: Array<{ role: string; content: string }>,
  keywords: string[]
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
  
  const messageIndex = previousMessages.length;
  const conversationProgress = Math.min(messageIndex / 15, 1); // Scale factor, max at 15 messages
  
  // Create a pseudo-topic vector based on message keywords
  const topicSeed = keywords.join('').length % 8; // 0-7 based on keywords
  
  // Calculate main conversation angle - this creates a spiral effect
  const angle = (messageIndex * 0.4 + topicSeed * 0.3) % (Math.PI * 2);
  
  // Calculate radial distance - further out as conversation progresses
  // But keep a minimum distance to avoid cluttering at center
  const baseRadius = 4 + (conversationProgress * 8);
  
  // Messages are positioned on a spiral pattern - users on negative X half, AI on positive X half
  // But with semi-random placement within their domain to create clusters
  let radius = baseRadius;
  
  // Position based on semantic relationship to previous messages if they exist
  if (messageIndex > 0 && previousMessages.length > 0) {
    const prevMsg = previousMessages[previousMessages.length - 1];
    const isPrevMsgSameTopic = 
      prevMsg && 
      keywords.some(keyword => 
        prevMsg.content.toLowerCase().includes(keyword.toLowerCase())
      );
    
    // Related messages are closer to their predecessors
    radius = isPrevMsgSameTopic ? baseRadius * 0.7 : baseRadius * 1.1;
    
    // Direct responses stay closer to their questions
    if (message.role === 'assistant' && prevMsg.role === 'user') {
      radius *= 0.8;
    }
  }
  
  // Apply trigonometric positioning for the spiral pattern
  position.x = (message.role === 'user' ? -1 : 1) * Math.cos(angle) * radius;
  position.z = Math.sin(angle) * radius;
  
  // Y-position based on message importance, length, and conversation depth
  const importanceFactor = Math.min(message.content.length / 300, 2); // Max 2x boost based on length
  position.y = (message.role === 'user' ? -1.5 : 1.5) + 
               (messageIndex * 0.15) + // Gradual rise with conversation
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
