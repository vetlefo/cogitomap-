/**
 * Test script to create nodes for semantic search testing
 */
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

// Test nodes to create
const testNodes = [
  {
    id: "topic-semantic-search",
    content: "Semantic search uses AI to find content based on meaning rather than exact keywords",
    type: "topic",
    position: { x: 10, y: 5, z: -8 },
    importance: 0.85,
    keywords: ["semantic search", "AI", "meaning", "search"]
  },
  {
    id: "entity-vector-embeddings",
    content: "Vector embeddings represent text as numerical vectors capturing semantic meaning",
    type: "entity",
    position: { x: -5, y: 2, z: -12 },
    importance: 0.8,
    keywords: ["vector embeddings", "numerical vectors", "semantics", "text representation"]
  },
  {
    id: "user_message-question-about-search",
    content: "How can I find information that's related by meaning?",
    type: "user_message",
    position: { x: 3, y: -4, z: -6 },
    importance: 0.75,
    keywords: ["search", "information", "meaning", "related"]
  },
  {
    id: "ai_message-semantic-explanation",
    content: "You can use semantic search which understands the meaning behind your query, not just matching exact words. It works by converting text into vector embeddings that capture semantic relationships.",
    type: "ai_message",
    position: { x: 8, y: -3, z: -9 },
    importance: 0.9,
    keywords: ["semantic search", "vector embeddings", "meaning", "query understanding"]
  }
];

// Test edges to create
const testEdges = [
  {
    source: "topic-semantic-search",
    target: "entity-vector-embeddings",
    relationship: "elaborates",
    strength: 0.82
  },
  {
    source: "user_message-question-about-search",
    target: "ai_message-semantic-explanation",
    relationship: "response_to",
    strength: 0.95
  },
  {
    source: "ai_message-semantic-explanation",
    target: "topic-semantic-search",
    relationship: "mentions",
    strength: 0.78
  },
  {
    source: "ai_message-semantic-explanation",
    target: "entity-vector-embeddings",
    relationship: "mentions",
    strength: 0.85
  }
];

// Create nodes
async function createNodes() {
  console.log("Creating test nodes...");
  
  for (const node of testNodes) {
    try {
      const response = await fetch(`${API_BASE}/graph/node`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(node)
      });
      
      if (response.ok) {
        console.log(`Successfully created node: ${node.id}`);
      } else {
        console.error(`Failed to create node ${node.id}: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(errorText);
      }
    } catch (error) {
      console.error(`Error creating node ${node.id}:`, error);
    }
    
    // Small delay to ensure proper ordering
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Create edges
async function createEdges() {
  console.log("Creating test edges...");
  
  for (const edge of testEdges) {
    try {
      const response = await fetch(`${API_BASE}/graph/edge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(edge)
      });
      
      if (response.ok) {
        console.log(`Successfully created edge: ${edge.source} -> ${edge.target}`);
      } else {
        console.error(`Failed to create edge ${edge.source} -> ${edge.target}: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(errorText);
      }
    } catch (error) {
      console.error(`Error creating edge ${edge.source} -> ${edge.target}:`, error);
    }
    
    // Small delay to ensure proper ordering
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

// Run test
async function runTest() {
  await createNodes();
  await createEdges();
  
  console.log("Test data creation complete!");
  
  // Test a semantic search
  console.log("\nTesting semantic search...");
  try {
    const searchResponse = await fetch(`${API_BASE}/semantic/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: "How do vector embeddings work?",
        vectorSearch: true,
        textSearch: true,
        limit: 5,
        minSimilarity: 0.5
      })
    });
    
    if (searchResponse.ok) {
      const searchResults = await searchResponse.json();
      console.log("Search results:", JSON.stringify(searchResults, null, 2));
    } else {
      console.error(`Search request failed: ${searchResponse.status} ${searchResponse.statusText}`);
      const errorText = await searchResponse.text();
      console.error(errorText);
    }
  } catch (error) {
    console.error("Error performing search:", error);
  }
}

// Run the test
runTest();