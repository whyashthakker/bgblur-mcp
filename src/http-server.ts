#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Server } from "node:http";

import { BgblurClient } from "./bgblur-client.js";
import { loadBaseConfig } from "./config.js";
import { registerTools } from "./tools/register.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

const startTime = Date.now();

function logInfo(...args: unknown[]) {
  console.log("[INFO]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[ERROR]", ...args);
}

function bearerToken(authorization: unknown) {
  if (typeof authorization !== "string") return null;
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

function createServer() {
  const baseConfig = loadBaseConfig();
  const server = new McpServer({
    name: "bgblur",
    version: "0.1.0",
  });

  registerTools(server, (extra) => {
    const token = extra.authInfo?.token;
    if (!token) {
      throw new Error("Authorization bearer token is required.");
    }

    return new BgblurClient({
      ...baseConfig,
      apiKey: token,
    });
  });

  return server;
}

const app = createMcpExpressApp({
  host: HOST,
  allowedHosts: process.env.ALLOWED_HOSTS?.split(",").map((host) => host.trim()).filter(Boolean),
});

app.use((_req: any, res: any, next: any) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  res.on("finish", () => {
    logInfo(req.method, req.path, res.statusCode, `${Date.now() - start}ms`);
  });
  next();
});

app.get("/health", (_req: any, res: any) => {
  res.json({
    ok: true,
    service: "bgblur-mcp",
    version: "0.1.0",
    uptime: Date.now() - startTime,
    environment: NODE_ENV,
  });
});

app.post("/mcp", async (req: any, res: any) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Authorization bearer token is required.",
      },
      id: null,
    });
    return;
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(
      Object.assign(req, {
        auth: {
          token,
          clientId: "bgblur-api-key",
          scopes: [],
        },
      }),
      res,
      req.body,
    );
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  } finally {
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  }
});

app.get("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
});

app.delete("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
});

const httpServer: Server = app.listen(PORT, HOST, (error?: Error) => {
  if (error) {
    logError(error.message);
    process.exit(1);
  }

  logInfo(`BGBlur MCP HTTP server listening on ${HOST}:${PORT} (${NODE_ENV})`);
});

function shutdown(signal: string) {
  logInfo(`Received ${signal}, shutting down gracefully...`);
  httpServer.close(() => {
    logInfo("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    logError("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
