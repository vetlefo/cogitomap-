import neo4j, { type Driver, type Session, type Result } from "neo4j-driver";
import { log } from "../vite"; // Assuming your log function is accessible

const MEMGRAPH_URI = process.env.MEMGRAPH_URI || "";
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME || "";
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD || "";

let driver: Driver | undefined;

export async function initMemgraph(): Promise<void> {
  log(`Checking Memgraph credentials - URI exists: ${!!MEMGRAPH_URI}, Username exists: ${!!MEMGRAPH_USERNAME}, Password exists: ${!!MEMGRAPH_PASSWORD}`, "memgraph-client-debug");
  
  if (!MEMGRAPH_URI || !MEMGRAPH_USERNAME || !MEMGRAPH_PASSWORD) {
    log(
      "Memgraph credentials not fully configured in environment variables!",
      "memgraph-client",
    );
    throw new Error("Memgraph credentials not fully configured!");
  }
  
  // Connection timeout setting (10 seconds)
  const connectionTimeout = 10000;
  
  try {
    log(`Connecting to Memgraph at ${MEMGRAPH_URI}...`, "memgraph-client");
    
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
        // Add logging
        logging: {
          level: 'debug',
          logger: (level, message) => {
            log(`[Neo4j Driver ${level}] ${message}`, 'neo4j-driver');
          }
        }
      }
    );
    
    log("Attempting to verify Memgraph connectivity...", "memgraph-client");
    
    // Set timeout for the verification
    const verifyPromise = driver.verifyConnectivity();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Connection timeout after ${connectionTimeout}ms`)), connectionTimeout);
    });
    
    await Promise.race([verifyPromise, timeoutPromise]);
    
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
      throw queryError;
    }
    
    log("Successfully connected to Memgraph Cloud.", "memgraph-client");
  } catch (error) {
    log(`Failed to connect to Memgraph Cloud: ${error}`, "memgraph-client");
    
    // Close the driver if it was created
    if (driver) {
      await driver.close();
      driver = undefined;
    }
    
    log("Connection failed, will continue with limited functionality", "memgraph-client");
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
    
    // Truncate query and params for logging to avoid excessive output
    const queryPreview = query.length > 100 ? query.substring(0, 100) + "..." : query;
    const paramsPreview = params ? JSON.stringify(params).substring(0, 200) : "{}";
    log(
      `Executing query: ${queryPreview} with params: ${paramsPreview}`,
      "memgraph-client",
    );
    
    // Set timeout for query execution (30 seconds)
    const queryPromise = session.run(query, params);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query execution timed out after 30s')), 30000);
    });
    
    // Race the query against the timeout
    const result = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (error) {
    log(`Error running Memgraph query: ${error}`, "memgraph-client");
    if (error instanceof Error && error.stack) {
      log(error.stack, "memgraph-client-error-stack");
    }
    throw error; // Re-throw to be handled by API error handlers
  } finally {
    if (session) {
      await session.close();
    }
  }
}

export async function closeMemgraph(): Promise<void> {
  if (driver) {
    await driver.close();
    log("Disconnected from Memgraph Cloud.", "memgraph-client");
  }
}