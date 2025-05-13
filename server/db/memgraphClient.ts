/**
 * Enhanced Memgraph client implementation
 * Compatible with Memgraph 3.0+ and MAGE vector search
 */

import * as neo4j from 'neo4j-driver';
import { log } from '../vite';

// Import environment variables
const MEMGRAPH_URI = process.env.MEMGRAPH_URI;
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME;
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD;

let driver: neo4j.Driver | null = null;

/**
 * Create or get the Neo4j driver instance
 */
export function getDriver(): neo4j.Driver {
  if (driver) {
    return driver;
  }

  if (!MEMGRAPH_URI) {
    log('Missing MEMGRAPH_URI environment variable, please check your .env file', 'memgraph-client-error');
    throw new Error('Missing MEMGRAPH_URI environment variable');
  }
  
  // Username and password are optional, Memgraph often doesn't require authentication

  try {
    log(`Connecting to Memgraph at ${MEMGRAPH_URI}...`, 'memgraph-client');
    
    // Use authentication only if username and password are provided
    const auth = (MEMGRAPH_USERNAME && MEMGRAPH_PASSWORD) 
      ? neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD)
      : neo4j.auth.basic('', ''); // Empty credentials when not specified
    
    driver = neo4j.driver(
      MEMGRAPH_URI,
      auth,
      {
        connectionTimeout: 10000,  // 10 seconds
        disableLosslessIntegers: true  // Return integers as JavaScript numbers
      }
    );
    
    return driver;
  } catch (error) {
    log(`Failed to create Memgraph driver: ${error}`, 'memgraph-client-error');
    throw error;
  }
}

/**
 * Close the Neo4j driver connection
 */
export async function closeDriver(): Promise<void> {
  if (!driver) {
    return;
  }

  try {
    await driver.close();
    driver = null;
    log('Memgraph driver connection closed', 'memgraph-client');
  } catch (error) {
    log(`Error closing Memgraph driver: ${error}`, 'memgraph-client-error');
    throw error;
  }
}

/**
 * Helper function to prepare Cypher queries for Memgraph
 * Addresses syntax differences between Neo4j and Memgraph 3.x
 */
function prepareQuery(query: string): string {
  // Remove trailing semicolons (can cause issues with Memgraph)
  let prepared = query.trim().replace(/;+$/, '');
  
  // Fix for YIELD...WHERE syntax which is not supported in Memgraph
  // Memgraph requires WITH between YIELD and WHERE
  if (prepared.includes('YIELD') && prepared.includes('WHERE')) {
    log('Query contains YIELD and WHERE - transforming for Memgraph compatibility', 'memgraph-client-debug');
    
    // Pattern: CALL procedure() YIELD * WHERE condition -> Add WITH clause
    prepared = prepared.replace(
      /(\s+YIELD\s+(?:[\w\s,]+)\s+)WHERE(\s+)/i,
      '$1WITH $2'
    );
    
    // Replace db.index.vector.queryNodes with vector_search.search
    if (prepared.includes('db.index.vector.queryNodes')) {
      log('Converting outdated db.index.vector.queryNodes to vector_search.search', 'memgraph-client-debug');
      
      prepared = prepared.replace(
        /CALL\s+db\.index\.vector\.queryNodes\s*\(\s*['"](.+?)['"]\s*,\s*(.+?)\s*,\s*(\d+)(?:\s*,\s*([\d\.]+))?\s*\)/i,
        'CALL vector_search.search("$1", $3, $2)'
      );
    }
  }
  
  // Handle SKIP and LIMIT parameters for Memgraph
  // Memgraph requires actual integers for these parameters
  prepared = prepared.replace(/SKIP\s+\$skip\s+LIMIT\s+\$limit/gi, 'SKIP toInteger($skip) LIMIT toInteger($limit)');
  
  return prepared;
}

/**
 * Run a Cypher query against Memgraph
 */
export async function executeQuery(query: string, params: Record<string, any> = {}): Promise<any[]> {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    // Prepare query for Memgraph compatibility
    const preparedQuery = prepareQuery(query);
    
    // Ensure numeric parameters are proper number types, not strings
    const processedParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key === 'skip' || key === 'limit') {
        // Ensure pagination parameters are integers
        processedParams[key] = Number.isNaN(Number(value)) ? 0 : Math.floor(Number(value));
      } else {
        processedParams[key] = value;
      }
    }
    
    log(`Executing Memgraph query: ${preparedQuery}`, 'memgraph-client-debug');
    log(`Query params: ${JSON.stringify(processedParams)}`, 'memgraph-client-debug');
    
    const result = await session.run(preparedQuery, processedParams);
    
    log(`Query returned ${result.records.length} records`, 'memgraph-client-debug');
    
    // Extract and return records as plain objects
    return result.records.map((record: any) => {
      return record.toObject();
    });
  } catch (error: any) {
    log(`Error executing Memgraph query: ${error.message}`, 'memgraph-client-error');
    
    // Include original query in error for debugging
    const errorWithContext = new Error(`${error.message} (Query: ${query})`);
    errorWithContext.stack = error.stack;
    
    throw errorWithContext;
  } finally {
    await session.close();
  }
}

/**
 * Initialize Memgraph driver and ensure connection
 */
export async function initializeMemgraph(): Promise<boolean> {
  try {
    const driver = getDriver();
    
    log('Verifying Memgraph connectivity...', 'memgraph-client');
    await driver.verifyConnectivity();
    
    // Basic connectivity test with a simple query
    try {
      const testResult = await executeQuery('RETURN 1 as test');
      log(`Test query results: ${JSON.stringify(testResult)}`, 'memgraph-client-debug');
      
      if (!testResult || testResult.length === 0) {
        log('Connection test failed: No results returned', 'memgraph-client-error');
        return false;
      }
    } catch (queryError) {
      log(`Connection test failed: ${queryError}`, 'memgraph-client-error');
      return false;
    }
    
    // Check if MAGE is loaded
    try {
      await ensureMageLoaded();
    } catch (mageError) {
      log(`MAGE initialization error: ${mageError}`, 'memgraph-client-warning');
      // Continue without MAGE - some functionality may still work
    }
    
    log('Memgraph connection verified successfully', 'memgraph-client');
    return true;
  } catch (error) {
    log(`Failed to initialize Memgraph: ${error}`, 'memgraph-client-error');
    return false;
  }
}

/**
 * Check if MAGE is loaded, and load it if not
 */
async function ensureMageLoaded(): Promise<void> {
  try {
    // Check for vector_search module using a client-side filter
    // Memgraph requires WITH clauses to be followed by variables, not expressions
    const procedures = await executeQuery(`
      CALL mg.procedures() 
      YIELD name 
      RETURN name
    `);
    
    // Filter in JavaScript instead of using WHERE in Cypher
    const vectorProcs = procedures.filter(proc => 
      proc.name && proc.name.includes("vector_search")
    );
    
    const count = vectorProcs.length;
    
    if (count === 0) {
      // Load MAGE modules if vector_search not found
      log('Loading MAGE modules...', 'memgraph-client');
      
      try {
        // First check if the modules are already loaded
        log('Checking if MAGE is available...', 'memgraph-client-debug');
        const moduleCheck = await executeQuery(`CALL mg.modules() RETURN *`);
        
        // Check if mage is in the list of modules
        const mageLoaded = moduleCheck.some(module => 
          module.name && module.name.toLowerCase().includes('mage')
        );
        
        if (!mageLoaded) {
          log('MAGE not found in modules list, attempting to load...', 'memgraph-client-debug');
          // Load the module with CALL
          await executeQuery(`CALL mg.load('mage');`);
          log('MAGE modules loaded successfully', 'memgraph-client');
        }
        
        // Try to load vector_search specifically
        await executeQuery('CALL mg.load("vector_search")');
        log('MAGE vector_search module loaded successfully', 'memgraph-client');
        
      } catch (error) {
        log(`Failed to load MAGE modules: ${error}`, 'memgraph-client-error');
        // Continue anyway - some functionality may still work
        log('Continuing without vector search capabilities', 'memgraph-client-warning');
      }
    } else {
      log('MAGE vector_search module already loaded', 'memgraph-client');
    }
  } catch (error) {
    log(`Error checking MAGE modules status: ${error}`, 'memgraph-client-error');
    // Continue anyway - the rest of the graph functionality may still work
    log('Continuing without vector search capabilities', 'memgraph-client-warning');
  }
}

/**
 * Create vector index if it doesn't exist
 */
export async function createVectorIndex(
  indexName: string, 
  nodeLabel: string, 
  propertyName: string, 
  dimension: number = 768
): Promise<void> {
  try {
    // Check if index exists using Memgraph 3.0 compatible query
    const indexQuery = `
      SHOW INDEX INFO
      YIELD index_name
      WITH index_name
      WHERE index_name = '${indexName}'
      RETURN count(index_name) AS count
    `;
    
    const indexResult = await executeQuery(indexQuery);
    const indexExists = indexResult[0]?.count > 0;
    
    if (!indexExists) {
      log(`Creating vector index ${indexName}...`, 'memgraph-client');
      
      const createIndexQuery = `
        CREATE VECTOR INDEX ${indexName} ON :${nodeLabel}(${propertyName})
        WITH CONFIG {
          "dimension": ${dimension},
          "capacity": 100000,
          "metric": "cos"
        }
      `;
      
      await executeQuery(createIndexQuery);
      log(`Vector index ${indexName} created successfully`, 'memgraph-client');
    } else {
      log(`Vector index ${indexName} already exists`, 'memgraph-client');
    }
  } catch (error) {
    log(`Failed to create vector index: ${error}`, 'memgraph-client-error');
    throw error;
  }
}