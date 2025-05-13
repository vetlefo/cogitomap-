/**
 * Memgraph Connection Diagnostic Tool
 * This script tests the connection to Memgraph and outputs detailed diagnostic information
 */

import neo4j from 'neo4j-driver';

// Import environment variables
const MEMGRAPH_URI = process.env.MEMGRAPH_URI;
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME;
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD;

console.log('============ MEMGRAPH CONNECTION DIAGNOSTICS ============');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('\n1. CHECKING ENVIRONMENT VARIABLES:');
console.log(`URI availability: ${MEMGRAPH_URI ? 'PRESENT' : 'MISSING'}`);
console.log(`Username availability: ${MEMGRAPH_USERNAME ? 'PRESENT' : 'MISSING'}`);
console.log(`Password availability: ${MEMGRAPH_PASSWORD ? 'PRESENT' : 'MISSING'}`);

if (!MEMGRAPH_URI || !MEMGRAPH_USERNAME || !MEMGRAPH_PASSWORD) {
  console.log('\n❌ ERROR: Missing required environment variables!');
  process.exit(1);
}

// Try to parse the URI
try {
  console.log('\n2. VALIDATING URI FORMAT:');
  const uri = new URL(MEMGRAPH_URI);
  console.log(`Protocol: ${uri.protocol}`);
  console.log(`Hostname: ${uri.hostname}`);
  console.log(`Port: ${uri.port || 'default'}`);
  console.log('URI format is valid ✓');
} catch (e) {
  console.log(`\n❌ ERROR: Invalid URI format: ${e.message}`);
  process.exit(1);
}

async function testConnection() {
  console.log('\n3. ATTEMPTING CONNECTION:');
  const connectionTimeout = 15000; // 15 seconds
  
  console.log('Creating Neo4j driver...');
  const driver = neo4j.driver(
    MEMGRAPH_URI,
    neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD),
    {
      connectionTimeout,
      disableLosslessIntegers: true
    }
  );
  
  try {
    console.log('Verifying connectivity...');
    
    // Set timeout
    const connectPromise = driver.verifyConnectivity();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timed out after ${connectionTimeout}ms`)), connectionTimeout);
    });
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('Basic connectivity verified ✓');
    
    console.log('\n4. TESTING QUERY EXECUTION:');
    console.log('Opening session...');
    const session = driver.session();
    
    try {
      console.log('Running test query: RETURN "Connected" AS status');
      const result = await session.run('RETURN "Connected" AS status');
      console.log(`Query result: ${result.records[0]?.get('status')}`);
      console.log('Query execution successful ✓');
      
      // Try a more complex query
      console.log('\nRunning complex test query (creating and returning a node)...');
      
      const complexResult = await session.run(
        'CREATE (n:TestNode {message: "Diagnostic test", timestamp: datetime()}) RETURN n.message'
      );
      
      console.log(`Complex query result: ${complexResult.records[0]?.get(0)}`);
      console.log('Complex query execution successful ✓');
      
      console.log('\n5. CHECKING DATABASE INFORMATION:');
      const dbInfoResult = await session.run('CALL dbms.version()');
      if (dbInfoResult.records && dbInfoResult.records.length > 0) {
        console.log('Version information:');
        console.log(dbInfoResult.records[0]?.get(0));
      } else {
        console.log('Could not retrieve version information');
      }
      
    } catch (error) {
      console.log(`\n❌ QUERY ERROR: ${error.message}`);
      if (error.code) {
        console.log(`Error code: ${error.code}`);
      }
      console.log('\nStack trace:');
      console.log(error.stack);
    } finally {
      await session.close();
      console.log('Session closed');
    }
  } catch (error) {
    console.log(`\n❌ CONNECTION ERROR: ${error.message}`);
    if (error.code) {
      console.log(`Error code: ${error.code}`);
    }
    console.log('\nStack trace:');
    console.log(error.stack);
  } finally {
    await driver.close();
    console.log('Driver closed');
  }
  
  console.log('\n============ DIAGNOSTICS COMPLETE ============');
}

testConnection().catch(error => {
  console.log(`\n❌ UNHANDLED ERROR: ${error.message}`);
  console.log(error.stack);
}).finally(() => {
  console.log('Diagnostic script finished');
});