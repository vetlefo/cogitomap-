import neo4j, { type Driver, type Session, type Result } from "neo4j-driver";
import { log } from "../vite"; // Assuming your log function is accessible

const MEMGRAPH_URI =
  process.env.MEMGRAPH_URI ||
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME || 
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD ||

let driver: Driver | undefined;

export async function initMemgraph(): Promise<void> {
  if (!MEMGRAPH_URI || !MEMGRAPH_USERNAME || !MEMGRAPH_PASSWORD) {
    log(
      "Memgraph credentials not fully configured in environment variables!",
      "memgraph-client",
    );
    throw new Error("Memgraph credentials not fully configured!");
  }
  try {
    driver = neo4j.driver(
      MEMGRAPH_URI,
      neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD),
    );
    log("Attempting to verify Memgraph connectivity...", "memgraph-client");
    await driver.verifyConnectivity();
    log("Successfully connected to Memgraph Cloud.", "memgraph-client");
  } catch (error) {
    log(`Failed to connect to Memgraph Cloud: ${error}`, "memgraph-client");
    throw error;
  }
}

export async function runMemgraphQuery(
  query: string,
  params?: Record<string, any>,
): Promise<Result> {
  if (!driver) {
    log(
      "Driver not initialized. Attempting to initialize...",
      "memgraph-client",
    );
    // In a real app, initMemgraph() should be called reliably at server startup.
    // For robustness, you might re-attempt initialization here or ensure it's always available.
    // Throwing an error if not initialized might be safer to catch setup issues early.
    await initMemgraph();
    // Or: throw new Error('Memgraph driver not initialized. Call initMemgraph() first.');
  }
  const session: Session = driver.session();
  log(
    `Executing query: ${query.substring(0, 100)}... with params: ${JSON.stringify(params)}`,
    "memgraph-client",
  );
  try {
    const result = await session.run(query, params);
    return result;
  } catch (error) {
    log(`Error running Memgraph query: ${error}`, "memgraph-client");
    throw error; // Re-throw to be handled by API error handlers
  } finally {
    await session.close();
  }
}

export async function closeMemgraph(): Promise<void> {
  if (driver) {
    await driver.close();
    log("Disconnected from Memgraph Cloud.", "memgraph-client");
  }
}
