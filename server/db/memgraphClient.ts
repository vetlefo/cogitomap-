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
    
    // Basic validation to prevent empty queries
    if (!query || query.trim() === '') {
      throw new Error('Empty Cypher query provided');
    }
    
    // Normalize query to fix common syntax issues with Memgraph
    // Remove any trailing semicolons that might cause issues with Memgraph
    const normalizedQuery = query.trim().replace(/;+$/, '');
    
    // Simple log for debugging
    const queryPreview = normalizedQuery.length > 100 ? normalizedQuery.substring(0, 100) + "..." : normalizedQuery;
    log(`Executing query: ${queryPreview}`, "memgraph-client");
    
    // Execute the query directly - matches the working test script approach
    const result = await session.run(normalizedQuery, params || {});
    log(`Query executed successfully with ${result.records?.length || 0} records`, "memgraph-client-debug");
    return result;
  } catch (error: any) {
    // Handle common Memgraph errors
    log(`Error executing Memgraph query: ${error}`, "memgraph-client-error");
    
    // Log the query for easier debugging
    if (error instanceof Error) {
      // Special handling for syntax errors
      if (error.message && error.message.toLowerCase().includes('syntax')) {
        log(`Syntax error in query: ${query}`, "memgraph-client-error");
      }
    }
    
    throw error;
  } finally {
    if (session) {
      try {
        await session.close();
      } catch (err) {
        log(`Error closing session: ${err}`, "memgraph-client-error");
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