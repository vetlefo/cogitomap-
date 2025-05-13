/**
 * Memgraph Connection Diagnostic Tool
 * Tests all critical queries from the application against Memgraph
 */

import neo4j from 'neo4j-driver';

// Import environment variables
const MEMGRAPH_URI = process.env.MEMGRAPH_URI;
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME;
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD;

console.log('============ MEMGRAPH QUERY DIAGNOSTIC ============');
console.log(`Timestamp: ${new Date().toISOString()}`);

// Check environment variables
if (!MEMGRAPH_URI || !MEMGRAPH_USERNAME || !MEMGRAPH_PASSWORD) {
  console.error('❌ ERROR: Missing required environment variables!');
  process.exit(1);
}

// List of test queries to run - these cover the problematic patterns we've seen
const testQueries = [
  {
    name: 'Simple Test Query',
    query: 'RETURN 1 as test',
    params: {}
  },
  {
    name: 'Create Node',
    query: 'CREATE (n:TestNode {message: "Test from diagnostic", timestamp: timestamp()}) RETURN n',
    params: {}
  },
  {
    name: 'MAGE Procedures',
    query: 'CALL mg.procedures() YIELD name RETURN name',
    params: {}
  },
  {
    name: 'YIELD with WHERE (Corrected)',
    query: 'CALL mg.procedures() YIELD name WITH name WHERE name CONTAINS "vector" RETURN name',
    params: {}
  },
  {
    name: 'Vector Index Creation',
    // Assuming :TestNode label and 'embedding' property for test index
    // Updated to use embedding_vector as that's common in the app
    query: `
      CREATE VECTOR INDEX IF NOT EXISTS test_vector_idx ON :TestNode(embedding_vector)
      WITH {
        "dimension": 768,
        "metric": "COSINE"
      }
    `,
    params: {}
  },
  {
    name: 'Graph Query with WHERE',
    query: `
      MATCH (n)
      WHERE n.type = "test_message"
      RETURN n LIMIT 5
    `,
    params: {}
  },
  {
    name: 'Vector Search (Corrected for Memgraph MAGE)',
    // Assumes 'test_vector_idx' exists on :TestNode(embedding_vector)
    // This query requires a node with the :TestNode label and an embedding_vector property.
    // For the diagnostic to pass this step, ensure such a node is created, or adjust the query.
    // A simple way: pre-create a test node like:
    // CREATE (:TestNode {id: "test_vec_node", embedding_vector: [0.1, 0.2, ..., 0.768]})
    query: `
      CALL vector_search.search('test_vector_idx', $embedding, 5)
      YIELD node, similarity
      WITH node, similarity
      WHERE similarity >= 0.1  // Lowered threshold for diagnostic likelihood of match
      RETURN node, similarity
    `,
    params: {
      embedding: Array(768).fill(0).map(() => Math.random() * 2 - 1) // Ensure values are in a typical embedding range
    }
  }
];

// Create new driver with minimal config
async function runDiagnostic() {
  console.log('\n1. CREATING DRIVER CONNECTION:');
  const driver = neo4j.driver(
    MEMGRAPH_URI,
    neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD),
    {
      connectionTimeout: 10000,
      disableLosslessIntegers: true
    }
  );
  
  try {
    console.log('Verifying connectivity...');
    await driver.verifyConnectivity();
    console.log('✓ Connection verified successfully!');
    
    console.log('\n2. TESTING QUERIES:');
    
    // Run each test query and report results
    for (const test of testQueries) {
      console.log(`\nTESTING: ${test.name}`);
      console.log(`Query: ${test.query.replace(/\s+/g, ' ').trim()}`);
      
      const session = driver.session();
      try {
        // Remove trailing semicolons and try to normalize the query
        const normalizedQuery = test.query.trim().replace(/;+$/, '');
        
        const startTime = Date.now();
        const result = await session.run(normalizedQuery, test.params);
        const duration = Date.now() - startTime;
        
        console.log(`✓ SUCCESS (${duration}ms) - Returned ${result.records.length} records`);
        
        // Show a sample of the results
        if (result.records.length > 0) {
          const sample = result.records[0].toObject();
          console.log('Sample result:', JSON.stringify(sample).substring(0, 100) + (JSON.stringify(sample).length > 100 ? '...' : ''));
        }
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        if (error.code) {
          console.log(`Error code: ${error.code}`);
        }
        
        // Provide possible fixes based on error type
        if (error.message.toLowerCase().includes('syntax')) {
          console.log('Possible fix: Check Cypher syntax compatibility with Memgraph');
        } else if (error.message.toLowerCase().includes('procedure')) {
          console.log('Possible fix: The procedure may not exist in Memgraph, check available procedures');
        }
      } finally {
        await session.close();
      }
    }
    
  } catch (error) {
    console.error(`\n❌ CONNECTION ERROR: ${error.message}`);
  } finally {
    await driver.close();
    console.log('\nDriver connection closed');
  }
  
  console.log('\n============ DIAGNOSTIC COMPLETE ============');
}

// Run the diagnostic
runDiagnostic().catch(console.error).finally(() => {
  console.log('Diagnostic script finished');
});