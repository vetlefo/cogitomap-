import { BaseTransformer } from './_baseTransformer';
import { BubbleNode, Edge } from '../../../client/src/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Keyword Extraction Transformer
 * 
 * This transformer extracts keywords from node content and creates
 * topic nodes for significant keywords, establishing relationships
 * between the original nodes and the extracted topics.
 */
export class KeywordExtractionTransformer implements BaseTransformer {
  readonly transformerId: string = 'keyword-extractor';
  readonly name: string = 'Keyword Extraction';
  readonly description: string = 'Extracts keywords from text content and creates topic nodes';
  
  private config: {
    minKeywordLength: number;
    maxKeywords: number;
    minWordOccurrences: number;
    excludedWords: string[];
    createTopicNodes: boolean;
  };
  
  constructor() {
    // Default configuration
    this.config = {
      minKeywordLength: 4,
      maxKeywords: 5,
      minWordOccurrences: 1,
      excludedWords: [
        'this', 'that', 'these', 'those', 'there', 'their', 'they', 'them',
        'have', 'has', 'had', 'not', 'but', 'and', 'with', 'for', 'the',
        'from', 'your', 'will', 'would', 'could', 'should', 'because',
      ],
      createTopicNodes: true,
    };
  }
  
  /**
   * Initialize with configuration
   */
  async initialize(config?: Record<string, any>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }
  
  /**
   * Transform nodes by extracting keywords
   */
  async transform(
    nodes: Partial<BubbleNode>[], 
    context?: any
  ): Promise<{ 
    nodes: Partial<BubbleNode>[], 
    edges?: Partial<Edge>[] 
  }> {
    const newNodes: Partial<BubbleNode>[] = [...nodes];
    const newEdges: Partial<Edge>[] = [];
    const extractedTopics: Map<string, Partial<BubbleNode>> = new Map();
    
    for (const node of nodes) {
      // Skip nodes without content
      if (!node.content) continue;
      
      // Extract keywords from content
      const keywords = this.extractKeywords(node.content);
      
      // Update the node with extracted keywords
      node.keywords = keywords;
      
      // If configured to create topic nodes
      if (this.config.createTopicNodes) {
        // Create topic nodes for each keyword
        for (const keyword of keywords) {
          let topicNode: Partial<BubbleNode>;
          
          // Use existing topic node if we already extracted this keyword
          if (extractedTopics.has(keyword)) {
            topicNode = extractedTopics.get(keyword)!;
          } else {
            // Create a new topic node
            topicNode = this.createTopicNode(keyword);
            extractedTopics.set(keyword, topicNode);
            newNodes.push(topicNode);
          }
          
          // Create an edge between original node and topic
          newEdges.push(this.createEdge(node, topicNode, 'mentions'));
        }
      }
    }
    
    return { nodes: newNodes, edges: newEdges };
  }
  
  /**
   * Extract keywords from text content
   */
  private extractKeywords(content: string): string[] {
    // Lowercase and remove punctuation
    const normalizedText = content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
      
    // Split into words
    const words = normalizedText.split(' ');
    
    // Count occurrences of each word
    const wordCounts: Record<string, number> = {};
    for (const word of words) {
      if (word.length >= this.config.minKeywordLength && 
          !this.config.excludedWords.includes(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }
    
    // Filter by minimum occurrences and sort by frequency
    const keywords = Object.entries(wordCounts)
      .filter(([_, count]) => count >= this.config.minWordOccurrences)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, this.config.maxKeywords);
      
    return keywords;
  }
  
  /**
   * Create a topic node for a keyword
   */
  private createTopicNode(keyword: string): Partial<BubbleNode> {
    const topicId = `topic-${keyword}-${uuidv4().slice(0, 8)}`;
    
    return {
      id: topicId,
      content: keyword,
      type: 'topic',
      importance: 0.6,
      title: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      description: `Topic related to "${keyword}"`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceSystem: 'keyword_extractor',
    };
  }
  
  /**
   * Create an edge between two nodes
   */
  private createEdge(
    source: Partial<BubbleNode>, 
    target: Partial<BubbleNode>,
    relationship: string
  ): Partial<Edge> {
    const edgeId = `edge-${source.id}-${target.id}-${relationship}`;
    
    return {
      id: edgeId,
      source: source.id!,
      target: target.id!,
      strength: 0.7,
      relationship: relationship as any,
      createdAt: new Date().toISOString(),
      sourceSystem: 'keyword_extractor',
    };
  }
}