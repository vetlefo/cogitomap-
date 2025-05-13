import neo4j, { type Driver, type Session, type Result } from "neo4j-driver";
import { log } from "../vite"; // Assuming your log function is accessible

// Connection constants
const MEMGRAPH_URI = process.env.MEMGRAPH_URI || "";
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME || "";
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD || "";

// Global driver instance
let driver: Driver | undefined;

// Check if credentials are provided for clearer error messages
const hasRequiredCredentials = MEMGRAPH_URI && MEMGRAPH_USERNAME && MEMGRAPH_PASSWORD;

export async function initMemgraph(): Promise<void> {
  // Check if we have the required credentials
  if (!hasRequiredCredentials) {
    log("Memgraph credentials not fully configured! Will operate in fallback mode.", "memgraph-client");
    throw new Error("Memgraph credentials not fully configured! Operating in fallback mode.");
  }
  
  // Connection timeout setting (15 seconds)
  const connectionTimeout = 15000;
  
  try {
    // Log the connection attempt (without revealing credentials)
    log(`Connecting to Memgraph at ${new URL(MEMGRAPH_URI).host}...`, "memgraph-client");
    
    // Create driver with minimal config to match the working test script
    driver = neo4j.driver(
      MEMGRAPH_URI,
      neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD),
      {
        connectionTimeout,
        disableLosslessIntegers: true
      }
    );
    
    log("Attempting to verify connectivity...", "memgraph-client");
    
    // Verify connectivity (this matches the working test script)
    await driver.verifyConnectivity();
    log("Connectivity verified successfully!", "memgraph-client");
    
    // Run a test query to confirm full functionality
    const session = driver.session();
    try {
      const result = await session.run(
        "CREATE (n:TestNode {message: $message, timestamp: timestamp()}) RETURN n", 
        { message: "Connection test from CogitoMap" }
      );
      
      const node = result.records[0]?.get(0);
      log(`Created test node: ${node?.properties?.message}`, "memgraph-client");
      log("Successfully connected to Memgraph.", "memgraph-client");
    } finally {
      await session.close();
    }
  } catch (error) {
    // Log the error and cleanup
    log(`Failed to connect to Memgraph: ${error}`, "memgraph-client");
    
    if (driver) {
      await driver.close();
      driver = undefined;
    }
    
    log("Connection failed, will continue with fallback in-memory storage", "memgraph-client");
    throw error;
  }
}

export async function runMemgraphQuery(
  query: string,
  params?: Record<string, any>,
): Promise<any> {
  if (!driver) {
    log(
      "Driver not initialized. Database operations will be unavailable.",
      "memgraph-client",
    );
    throw new Error('Memgraph connection not available. Graph database features are currently disabled.');
  }
  
  let session: Session | null = null;
  try {
    session = driver.session();
    
    // Validate the query before execution - prevent common errors
    if (!query || query.trim() === '') {
      throw new Error('Empty Cypher query provided');
    }
    
    // Add explicit logging of Cypher syntax
    const queryLines = query.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    log(`Running Cypher query with ${queryLines.length} lines:`, "memgraph-client-debug");
    for (let i = 0; i < queryLines.length; i++) {
      log(`Line ${i+1}: ${queryLines[i]}`, "memgraph-client-debug");
    }
    
    // Truncate query and params for logging to avoid excessive output
    const queryPreview = query.length > 100 ? query.substring(0, 100) + "..." : query;
    const paramsPreview = params ? JSON.stringify(params).substring(0, 200) : "{}";
    log(
      `Executing query: ${queryPreview} with params: ${paramsPreview}`,
      "memgraph-client",
    );
    
    // Set timeout for query execution (45 seconds - increased from 30)
    const queryPromise = session.run(query, params);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query execution timed out after 45s')), 45000);
    });
    
    // Race the query against the timeout
    try {
      const result = await Promise.race([queryPromise, timeoutPromise]);
      log(`Query succeeded with ${result.records?.length || 0} records`, "memgraph-client-debug");
      return result;
    } catch (error: any) {
      log(`Query execution error: ${error}`, "memgraph-client-error");
      
      // Enhanced error logging
      if (error instanceof Error) {
        // Check for specific Neo4j/Memgraph error types
        if (typeof error === 'object' && 'code' in error) {
          log(`Query error code: ${error.code}`, "memgraph-client-error");
        }
        
        // Check for syntax errors in particular
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('syntax') || errorMsg.includes('parse')) {
          log(`Likely syntax error in Cypher query`, "memgraph-client-error");
          // Log the query with line numbers for easier debugging
          queryLines.forEach((line, idx) => {
            log(`Line ${idx+1}: ${line}`, "memgraph-client-error");
          });
        }
      }
      
      throw error;
    }
  } catch (error) {
    log(`Error running Memgraph query: ${error}`, "memgraph-client");
    if (error instanceof Error && error.stack) {
      log(error.stack, "memgraph-client-error-stack");
    }
    throw error; // Re-throw to be handled by API error handlers
  } finally {
    if (session) {
      try {
        await session.close();
      } catch (closeErr) {
        log(`Error closing session: ${closeErr}`, "memgraph-client-error");
      }
    }
  }
}

export async function closeMemgraph(): Promise<void> {
  if (driver) {
    await driver.close();
    log("Disconnected from Memgraph Cloud.", "memgraph-client");
  }
}