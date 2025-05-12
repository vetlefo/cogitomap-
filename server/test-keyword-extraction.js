/**
 * Test script for keyword extraction
 */

import 'dotenv/config';
import { extractKeywordsFromConversation } from './services/semanticAnalysisService.js';

async function testKeywordExtraction() {
  console.log('Testing keyword extraction...');
  console.log('Using OpenAI API key:', process.env.OPENAI_API_KEY ? 'Found (hidden)' : 'Not found');
  
  // Test with sample messages
  const testMessages = [
    { role: 'user', content: 'Tell me about knowledge graphs and how they connect related information.' },
    { role: 'assistant', content: 'A knowledge graph is a network of entities, their semantic types, properties, and relationships. Knowledge graphs allow information to be stored in a graph structure with nodes representing entities or concepts, and edges representing relationships. They enable powerful semantic search capabilities and contextual understanding by creating connections between related pieces of information.' },
    { role: 'user', content: 'What are some real-world applications of knowledge graphs?' }
  ];
  
  console.log(`Test messages: ${testMessages.length} messages provided`);
  
  try {
    const keywords = await extractKeywordsFromConversation(testMessages);
    console.log('Extracted keywords:', keywords);
    console.log(`Total keywords found: ${keywords.length}`);
  } catch (error) {
    console.error('Error during keyword extraction test:', error);
  }
}

// Run the test
testKeywordExtraction().catch(console.error);