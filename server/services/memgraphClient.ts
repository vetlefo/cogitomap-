/**
 * Memgraph database client
 * Provides connection and query execution for Memgraph
 */

import { log } from "../vite";

export interface MemgraphClient {
  executeQuery: (query: string, params?: any) => Promise<any[]>;
}

// Singleton client instance
let memgraphClient: MemgraphClient | null = null;

/**
 * Configure and get a Memgraph client instance
 * Uses a singleton pattern to avoid multiple connections
 */
export async function configureMemgraphClient(): Promise<MemgraphClient> {
  if (memgraphClient !== null) {
    return memgraphClient;
  }

  try {
    log("Configuring Memgraph client...", "memgraph-client");
    
    // Create a simple client that executes queries via the graph service API
    // This ensures we have a consistent query interface
    const client: MemgraphClient = {
      executeQuery: async (query: string, params: any = {}) => {
        log(`Executing query: ${query.substring(0, 200)}... with params: ${JSON.stringify(params).substring(0, 100)}`, "memgraph-client");
        
        try {
          // Use direct call to the graphService's executeCustomQuery function
          // This avoids circular dependencies where the client tries to call
          // an API endpoint that's not yet registered
          const result = await import("../db/graphService").then(module => {
            return module.executeCustomQuery(query, params);
          });
          return result;
        } catch (error) {
          log(`Query execution error: ${error}`, "memgraph-client-error");
          throw error;
        }
      }
    };
    
    memgraphClient = client;
    return client;
  } catch (error) {
    log(`Error configuring Memgraph client: ${error}`, "memgraph-client-error");
    
    // Return a dummy client for testing/development that just logs queries
    return {
      executeQuery: async (query: string, params: any = {}) => {
        log(`[DUMMY CLIENT] Would execute: ${query.substring(0, 200)}...`, "memgraph-client-debug");
        log(`[DUMMY CLIENT] With params: ${JSON.stringify(params)}`, "memgraph-client-debug");
        return [];
      }
    };
  }
}