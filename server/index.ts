import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeMemgraph } from "./db/memgraphClient";
import { initMageVectorService } from "./services/mageVectorService";
import { initializePipeline } from "./services/pipelineController";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize Memgraph connection
    log("Initializing Memgraph connection...", "server-startup");
    await initializeMemgraph();
    log("Memgraph initialized successfully", "server-startup");
    
    // Initialize MAGE vector service
    log("Initializing MAGE vector service...", "server-startup");
    try {
      await initMageVectorService();
      log("MAGE vector service initialized successfully", "server-startup");
    } catch (error) {
      log(`MAGE vector service initialization failed: ${error instanceof Error ? error.message : String(error)}`, "server-startup-warning");
      log("Vector search capabilities may be limited", "server-startup-warning");
    }
    
    // Initialize the pipeline architecture
    log("Initializing pipeline architecture...", "server-startup");
    try {
      await initializePipeline();
      log("Pipeline architecture initialized successfully", "server-startup");
    } catch (error) {
      log(`Pipeline initialization failed: ${error instanceof Error ? error.message : String(error)}`, "server-startup-warning");
      log("Advanced pipeline features may be limited", "server-startup-warning");
    }
  } catch (error) {
    log(`Error initializing Memgraph: ${error instanceof Error ? error.message : String(error)}`, "server-startup-error");
    // Continue even if Memgraph fails, as the app can still function with limited capabilities
    console.error("Memgraph initialization failed. Some graph functionality may be unavailable.");
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Handle graceful shutdown
  const gracefulShutdown = async () => {
    log("Shutting down server...", "server-shutdown");
    
    try {
      // Close Memgraph connection
      const { closeDriver } = await import("./db/memgraphClient");
      await closeDriver();
      log("Closed Memgraph connection", "server-shutdown");
    } catch (error) {
      log(`Error closing Memgraph: ${error}`, "server-shutdown-error");
    }
    
    process.exit(0);
  };

  // Listen for termination signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
})();
