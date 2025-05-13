/**
 * Keyword Extraction Transformer
 * 
 * Extracts keywords and key phrases from text content
 * and creates nodes for them with relationships.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseTransformer, TransformerResult, TransformContext } from './_baseTransformer';
import { BubbleNode } from '../../../client/src/types';

export class KeywordExtractionTransformer implements BaseTransformer {
  readonly transformerId: string = 'keyword-extraction';
  readonly transformerName: string = 'Keyword Extraction';
  
  private minKeywordLength: number = 4;
  private maxKeywords: number = 8;
  private minWordOccurrences: number = 1;
  private createTopicNodes: boolean = true;
  private stopWords: Set<string>;
  
  constructor() {
    // Initialize stop words (common words to ignore)
    this.stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
      'at', 'from', 'by', 'on', 'off', 'for', 'in', 'out', 'over', 'to',
      'into', 'with', 'without', 'about', 'between', 'among',
      'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
      'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might',
      'must', 'ought', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
      'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
      'whose', 'where', 'when', 'why', 'how', 'all', 'any', 'both',
      'each', 'few', 'more', 'most', 'some', 'such', 'no', 'nor',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'just', 'even', 'also', 'much', 'many'
    ]);
  }
  
  async initialize(config?: Record<string, any>): Promise<void> {
    // Set configuration if provided
    if (config) {
      this.minKeywordLength = config.minKeywordLength || this.minKeywordLength;
      this.maxKeywords = config.maxKeywords || this.maxKeywords;
      this.minWordOccurrences = config.minWordOccurrences || this.minWordOccurrences;
      this.createTopicNodes = config.createTopicNodes !== undefined ? config.createTopicNodes : this.createTopicNodes;
      
      // Add custom stop words if provided
      if (config.additionalStopWords && Array.isArray(config.additionalStopWords)) {
        config.additionalStopWords.forEach((word: string) => this.stopWords.add(word.toLowerCase()));
      }
    }
  }
  
  async transform(context: TransformContext): Promise<TransformerResult> {
    const nodes: Partial<BubbleNode>[] = [];
    const edges: any[] = [];
    
    try {
      const { node, content, type } = context;
      
      // Skip empty content
      if (!content || content.trim().length === 0) {
        return { nodes, edges };
      }
      
      // Extract keywords from content
      const keywords = this.extractKeywords(content);
      
      // Create nodes for the top keywords
      const topKeywords = keywords.slice(0, this.maxKeywords);
      
      // Skip if no keywords found
      if (topKeywords.length === 0) {
        return { nodes, edges };
      }
      
      // Add keywords directly to the source node metadata
      if (node.metadata) {
        if (typeof node.metadata === 'object') {
          const metadata = node.metadata as Record<string, any>;
          metadata.keywords = topKeywords.map(kw => kw.text);
        }
      }
      
      // Create topic nodes if enabled
      if (this.createTopicNodes) {
        for (const keyword of topKeywords) {
          const keywordId = `topic-${this.slugify(keyword.text)}-${uuidv4().substr(0, 8)}`;
          
          // Position slightly around the source node
          const jitter = 5;
          const position = {
            x: (node.position?.x || 0) + (Math.random() * jitter - jitter/2),
            y: (node.position?.y || 0) + (Math.random() * jitter - jitter/2),
            z: (node.position?.z || 0) + (Math.random() * jitter - jitter/2),
          };
          
          // Create a topic node
          const topicNode: Partial<BubbleNode> = {
            id: keywordId,
            type: 'topic',
            content: keyword.text,
            position,
            importance: 0.5 + (keyword.score / 10), // Base importance on keyword relevance
            source_id: node.id, // Set parent node ID for hub-and-spoke positioning
            metadata: {
              extracted_from: node.id,
              source_type: type,
              occurrences: keyword.count,
              extraction_method: 'keyword_frequency'
            }
          };
          
          nodes.push(topicNode);
          
          // Create an edge from the source node to this topic
          edges.push({
            id: `${node.id}-mentions-${keywordId}`,
            source: node.id,
            target: keywordId,
            relationship: 'mentions',
            strength: keyword.score / 10, // Normalize to 0-1 range
            metadata: {
              occurrences: keyword.count
            }
          });
        }
      }
      
      return { nodes, edges };
    } catch (error) {
      console.error('Error in keyword extraction:', error);
      return { nodes, edges };
    }
  }
  
  /**
   * Extract keywords from text content
   */
  private extractKeywords(text: string): Array<{ text: string, count: number, score: number }> {
    try {
      // Normalize and clean the text
      const normalizedText = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ')     // Replace multiple spaces with a single space
        .trim();
      
      // Split into words and count occurrences
      const words = normalizedText.split(' ');
      const wordCounts: Record<string, number> = {};
      
      for (const word of words) {
        // Skip stop words and short words
        if (this.stopWords.has(word) || word.length < this.minKeywordLength) {
          continue;
        }
        
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
      
      // Now look for phrases (bigrams and trigrams)
      const phraseCounts: Record<string, number> = {};
      
      // Bigrams (two-word phrases)
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        
        // Skip if either word is a stop word or too short
        if (this.stopWords.has(words[i]) || 
            this.stopWords.has(words[i + 1]) ||
            words[i].length < 3 || 
            words[i + 1].length < 3) {
          continue;
        }
        
        phraseCounts[bigram] = (phraseCounts[bigram] || 0) + 1;
      }
      
      // Trigrams (three-word phrases)
      for (let i = 0; i < words.length - 2; i++) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        
        // Skip if any word is a stop word or too short
        if (this.stopWords.has(words[i]) || 
            this.stopWords.has(words[i + 1]) || 
            this.stopWords.has(words[i + 2]) ||
            words[i].length < 3 || 
            words[i + 1].length < 3 || 
            words[i + 2].length < 3) {
          continue;
        }
        
        phraseCounts[trigram] = (phraseCounts[trigram] || 0) + 1;
      }
      
      // Combine words and phrases
      const combinedCounts = { ...wordCounts, ...phraseCounts };
      
      // Filter by minimum occurrences
      const filteredEntries = Object.entries(combinedCounts)
        .filter(([text, count]) => count >= this.minWordOccurrences);
      
      // Sort by count (frequency) and then by length (for equal counts, prefer longer phrases)
      const sortedKeywords = filteredEntries
        .map(([text, count]) => ({
          text,
          count,
          // Score is a weighted combination of frequency and length
          score: count * (1 + (text.length / 20))
        }))
        .sort((a, b) => b.score - a.score);
      
      return sortedKeywords;
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }
  
  /**
   * Convert a text string to a URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove non-word chars
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }
}