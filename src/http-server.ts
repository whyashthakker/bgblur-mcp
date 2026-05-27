#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { BgblurClient } from "./bgblur-client.js";
import { loadBaseConfig } from "./config.js";
import { registerTools } from "./tools/register.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

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

app.get("/health", (_req: any, res: any) => {
  res.json({ ok: true, service: "bgblur-mcp" });
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
    console.error(error instanceof Error ? error.message : String(error));
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

app.listen(PORT, HOST, (error?: Error) => {
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`BGBlur MCP HTTP server listening on ${HOST}:${PORT}`);
});
