/**
 * New Memgraph client implementation based on working test patterns
 */
import neo4j, { Driver, type Session, type Result } from 'neo4j-driver';
import { log } from '../vite';

// Connection credentials
const MEMGRAPH_URI = process.env.MEMGRAPH_URI || '';
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME || '';
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD || '';

// Driver instance
let driver: Driver | undefined;

// Exported test function to verify connection
export async function testMemgraphConnection(): Promise<boolean> {
  try {
    // Create a test session and run simple query
    const testSession = driver?.session();
    if (!testSession) return false;
    
    try {
      await testSession.run('RETURN 1 as test');
      log('Memgraph connection test successful', 'memgraph-client');
      return true;
    } finally {
      await testSession.close();
    }
  } catch (error) {
    log(`Memgraph connection test failed: ${error}`, 'memgraph-client');
    return false;
  }
}

/**
 * Initialize the Memgraph connection
 * Based on the patterns from the working test script
 */
export async function initMemgraph(): Promise<void> {
  // Check credentials
  if (!MEMGRAPH_URI || !MEMGRAPH_USERNAME || !MEMGRAPH_PASSWORD) {
    log('Memgraph credentials not fully configured. Will use fallback storage.', 'memgraph-client');
    throw new Error('Memgraph credentials not configured');
  }
  
  try {
    log(`Connecting to Memgraph at ${MEMGRAPH_URI}...`, 'memgraph-client');
    
    // Create driver with minimal configuration (matching working test script)
    driver = neo4j.driver(
      MEMGRAPH_URI,
      neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD),
      {
        connectionTimeout: 10000, // 10 seconds timeout
        disableLosslessIntegers: true
      }
    );
    
    // Verify connectivity
    log('Verifying connectivity...', 'memgraph-client');
    await driver.verifyConnectivity();
    log('Connection verified successfully!', 'memgraph-client');
    
    // Run test query to confirm full functionality
    const session = driver.session();
    try {
      log('Running test query...', 'memgraph-client');
      const result = await session.run(
        'CREATE (n:TestNode {message: $message, timestamp: timestamp()}) RETURN n', 
        { message: 'Connection test from CogitoMap' }
      );
      
      const node = result.records[0]?.get(0);
      log(`Created test node: ${node?.properties?.message}`, 'memgraph-client');
      log('Successfully connected to Memgraph.', 'memgraph-client');
    } finally {
      await session.close();
    }
  } catch (error) {
    log(`Failed to connect to Memgraph: ${error}`, 'memgraph-client');
    
    // Clean up
    if (driver) {
      await driver.close();
      driver = undefined;
    }
    
    throw error;
  }
}

/**
 * Helper function to prepare Cypher queries for Memgraph
 * Addresses syntax differences between Neo4j and Memgraph
 */
function prepareQuery(query: string): string {
  // Remove trailing semicolons (can cause issues with Memgraph)
  let prepared = query.trim().replace(/;+$/, '');
  
  // Fix for YIELD...WHERE syntax which is not supported in Memgraph
  if (prepared.includes('YIELD') && prepared.includes('WHERE')) {
    log('Query contains YIELD and WHERE which is not supported in Memgraph - transforming', 'memgraph-client-debug');
    
    // Pattern 1: CALL procedure() YIELD * WHERE condition
    if (prepared.match(/CALL\s+[\w\.]+\(\s*.*?\s*\)\s+YIELD\s+\*\s+WHERE/i)) {
      log('Detected pattern: CALL procedure() YIELD * WHERE - splitting into separate queries', 'memgraph-client-debug');
      // This can't be automatically fixed, we'll need to implement client-side filtering
    }
    
    // Pattern 2: CALL vector.queryNodes() YIELD node, similarity WHERE similarity >= X
    const vectorMatch = prepared.match(/CALL\s+db\.index\.vector\.queryNodes\(['"](.+?)['"]\s*,\s*.+?\s*,\s*(\d+)\s*\)\s+YIELD\s+node\s*,\s*similarity\s+WHERE\s+similarity\s*>=\s*([\d\.]+)/i);
    if (vectorMatch) {
      const [_, indexName, limit, minSimilarity] = vectorMatch;
      log(`Detected vector search pattern - converting to use topK=${limit} and cutoff=${minSimilarity}`, 'memgraph-client-debug');
      
      // Memgraph supports passing the min similarity as a parameter in the procedure call
      prepared = prepared.replace(
        /CALL\s+db\.index\.vector\.queryNodes\(['"](.+?)['"]\s*,\s*.+?\s*,\s*(\d+)\s*\)\s+YIELD\s+node\s*,\s*similarity\s+WHERE\s+similarity\s*>=\s*([\d\.]+)/i,
        `CALL db.index.vector.queryNodes('$1', $embedding, $2, ${minSimilarity}) YIELD node, similarity`
      );
    }
  }
  
  return prepared;
}

/**
 * Run a Cypher query against Memgraph
 * Based on the patterns from the working test script
 */
export async function runMemgraphQuery(
  query: string,
  params?: Record<string, any>
): Promise<any> {
  if (!driver) {
    throw new Error('Memgraph connection not initialized');
  }
  
  const session = driver.session();
  try {
    // Prepare the query for Memgraph
    const preparedQuery = prepareQuery(query);
    
    // Log query for debugging
    const queryPreview = preparedQuery.length > 100 
      ? preparedQuery.substring(0, 100) + '...' 
      : preparedQuery;
    
    log(`Executing query: ${queryPreview}`, 'memgraph-client');
    
    // Execute the query directly
    const result = await session.run(preparedQuery, params || {});
    
    log(`Query executed successfully, returned ${result.records?.length || 0} records`, 'memgraph-client');
    return result;
  } catch (error) {
    log(`Error executing query: ${error}`, 'memgraph-client-error');
    
    // Special handling for syntax errors - provide more details
    if (error instanceof Error && 
        error.message && 
        (error.message.toLowerCase().includes('syntax') || 
         error.message.toLowerCase().includes('parse'))) {
      log(`Syntax error in query: ${query}`, 'memgraph-client-error');
    }
    
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Close the Memgraph connection
 */
export async function closeMemgraph(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = undefined;
    log('Disconnected from Memgraph.', 'memgraph-client');
  }
}