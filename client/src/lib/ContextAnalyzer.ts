import { BubbleNode } from '../types';

/**
 * Analyzes a message and its context to determine its position in 3D space
 * and other visualization properties
 */
export function analyzeMessage(
  message: { role: string; content: string },
  previousMessages: Array<{ role: string; content: string }>
): {
  position: { x: number; y: number; z: number };
  importance: number;
  keywords: string[];
} {
  // Extract keywords from the message
  const keywords = extractKeywords(message.content);
  
  // Calculate the position based on the message content and position in conversation
  let position = calculatePosition(message, previousMessages, keywords);
  
  // Calculate how important this message is (for sizing the bubble)
  const importance = calculateImportance(message, previousMessages, keywords);
  
  return {
    position,
    importance,
    keywords
  };
}

/**
 * Extracts keywords from message content using simple NLP techniques
 */
function extractKeywords(content: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
    'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
    'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could',
    'may', 'might', 'must', 'of', 'from', 'then', 'than', 'that', 'this', 'these',
    'those', 'it', 'its', 'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he',
    'him', 'his', 'she', 'her', 'hers', 'we', 'us', 'our', 'ours', 'they', 'them',
    'their', 'theirs'
  ]);
  
  // Tokenize, filter, count frequency
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/) // Split on whitespace
    .filter(word => word.length > 2 && !stopWords.has(word)); // Filter stop words and short words
  
  // Count word frequency
  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }
  
  // Sort by frequency and take top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Calculate the 3D position for a message node
 */
function calculatePosition(
  message: { role: string; content: string },
  previousMessages: Array<{ role: string; content: string }>,
  keywords: string[]
): { x: number; y: number; z: number } {
  // Initialize with some random offset for variety
  const randomOffset = {
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
    z: (Math.random() - 0.5) * 2
  };
  
  // Base position is influenced by message role
  let position = {
    x: message.role === 'user' ? -5 : 5,
    y: 0,
    z: 0
  };
  
  // If there are previous messages, position relative to them
  if (previousMessages.length > 0) {
    // Each new message moves outward and in a slight spiral
    const angle = (previousMessages.length * 0.3) % (Math.PI * 2);
    const radius = 3 + (previousMessages.length * 0.2);
    
    position.x += Math.cos(angle) * radius;
    position.z += Math.sin(angle) * radius;
    
    // User messages are positioned lower, AI messages higher
    position.y += message.role === 'user' ? -1 : 1;
    
    // Add the index in the conversation to the y-position to create a timeline effect
    position.y += (previousMessages.length * 0.2) * (message.role === 'user' ? -1 : 1);
  }
  
  // Add the random offset for variety
  position.x += randomOffset.x;
  position.y += randomOffset.y;
  position.z += randomOffset.z;
  
  return position;
}

/**
 * Calculate importance of a message based on its content and context
 */
function calculateImportance(
  message: { role: string; content: string },
  previousMessages: Array<{ role: string; content: string }>,
  keywords: string[]
): number {
  // Base importance
  let importance = 0.5;
  
  // Longer messages are potentially more important
  importance += Math.min(message.content.length / 1000, 0.3);
  
  // Messages with more keywords might be more important
  importance += Math.min(keywords.length * 0.1, 0.2);
  
  // AI responses to user questions might be more important
  if (message.role === 'assistant' && 
      previousMessages.length > 0 && 
      previousMessages[previousMessages.length - 1].role === 'user') {
    importance += 0.2;
  }
  
  // Cap importance between 0.1 and 1.0
  return Math.max(0.1, Math.min(importance, 1.0));
}
