import neo4j, { type Driver, type Session, type Result } from "neo4j-driver";
import { log } from "../vite"; // Assuming your log function is accessible

const MEMGRAPH_URI = process.env.MEMGRAPH_URI || "";
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME || "";
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD || "";

let driver: Driver | undefined;

export async function initMemgraph(): Promise<void> {
  // First, log the credential status (without revealing values)
  const uriStatus = MEMGRAPH_URI ? (MEMGRAPH_URI.length > 0 ? 'present' : 'empty') : 'missing';
  const usernameStatus = MEMGRAPH_USERNAME ? (MEMGRAPH_USERNAME.length > 0 ? 'present' : 'empty') : 'missing';
  const passwordStatus = MEMGRAPH_PASSWORD ? (MEMGRAPH_PASSWORD.length > 0 ? 'present' : 'empty') : 'missing';
  
  log(`Memgraph credentials check - URI: ${uriStatus}, Username: ${usernameStatus}, Password: ${passwordStatus}`, "memgraph-client-debug");
  
  // IMPORTANT CHANGE: If credentials are missing, log details but allow operation to continue with fallback
  if (!MEMGRAPH_URI || !MEMGRAPH_USERNAME || !MEMGRAPH_PASSWORD) {
    log(
      "Memgraph credentials not fully configured! Will operate in fallback mode.",
      "memgraph-client",
    );
    throw new Error("Memgraph credentials not fully configured! Operating in fallback mode.");
  }
  
  // Print the censored URI format for debugging (without revealing credentials)
  try {
    const uri = new URL(MEMGRAPH_URI);
    log(`Attempting connection to Memgraph at ${uri.protocol}//${uri.hostname}:${uri.port || 'default port'}`, "memgraph-client-debug");
  } catch (e) {
    log(`Could not parse Memgraph URI: ${e}. URI format may be incorrect.`, "memgraph-client-debug");
  }
  
  // Connection timeout setting (15 seconds - increased from 10)
  const connectionTimeout = 15000;
  
  try {
    log(`Creating Neo4j driver for Memgraph...`, "memgraph-client");
    
    // Create driver with config
    driver = neo4j.driver(
      MEMGRAPH_URI,
      neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD),
      {
        connectionTimeout,
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        disableLosslessIntegers: true,
        // Enhanced logging
        logging: {
          level: 'info', // Changed from debug to info for less noise
          logger: (level, message) => {
            log(`[Neo4j Driver ${level}] ${message}`, 'memgraph-driver');
          }
        }
      }
    );
    
    log("Driver created, verifying connectivity...", "memgraph-client");
    
    // Set timeout for the verification
    const verifyPromise = driver.verifyConnectivity();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout after ${connectionTimeout}ms`)), connectionTimeout);
    });
    
    try {
      await Promise.race([verifyPromise, timeoutPromise]);
      log("Basic connectivity verified", "memgraph-client");
    } catch (connError) {
      log(`Connection verification failed: ${connError}`, "memgraph-client-error");
      if (connError.code) {
        log(`Error code: ${connError.code}`, "memgraph-client-error");
      }
      throw connError;
    }
    
    // Try a simple test query to truly verify the connection
    const session = driver.session();
    try {
      log("Running test query to verify full connectivity...", "memgraph-client");
      const result = await session.run("RETURN 'Connected' AS status");
      const status = result.records[0]?.get('status');
      log(`Test query result: ${status}`, "memgraph-client");
      await session.close();
    } catch (queryError) {
      log(`Test query failed: ${queryError}`, "memgraph-client-error");
      if (queryError.code) {
        log(`Query error code: ${queryError.code}`, "memgraph-client-error");
      }
      if (queryError.message) {
        log(`Query error message: ${queryError.message}`, "memgraph-client-error");
      }
      throw queryError;
    }
    
    log("Successfully connected to Memgraph.", "memgraph-client");
  } catch (error) {
    log(`Failed to connect to Memgraph: ${error}`, "memgraph-client");
    
    // Log more error details
    if (error instanceof Error) {
      log(`Error name: ${error.name}`, "memgraph-client-error");
      log(`Error message: ${error.message}`, "memgraph-client-error");
      if ('code' in error) {
        log(`Error code: ${(error as any).code}`, "memgraph-client-error");
      }
      if (error.stack) {
        log(`Error stack: ${error.stack}`, "memgraph-client-error");
      }
    }
    
    // Close the driver if it was created
    if (driver) {
      await driver.close();
      driver = undefined;
    }
    
    log("Connection failed, will continue with fallback in-memory storage", "memgraph-client");
    // We'll throw here to indicate there was an error, but the app can continue
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
    } catch (queryError) {
      log(`Query execution error: ${queryError}`, "memgraph-client-error");
      
      // Enhanced error logging
      if (queryError instanceof Error) {
        // Check for specific Neo4j/Memgraph error types
        if ('code' in queryError) {
          log(`Query error code: ${(queryError as any).code}`, "memgraph-client-error");
        }
        
        // Check for syntax errors in particular
        const errorMsg = queryError.message.toLowerCase();
        if (errorMsg.includes('syntax') || errorMsg.includes('parse')) {
          log(`Likely syntax error in Cypher query`, "memgraph-client-error");
          // Log the query with line numbers for easier debugging
          queryLines.forEach((line, idx) => {
            log(`Line ${idx+1}: ${line}`, "memgraph-client-error");
          });
        }
      }
      
      throw queryError;
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