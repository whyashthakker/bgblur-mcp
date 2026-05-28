#!/usr/bin/env node

/**
 * BGBlur MCP HTTP Server
 *
 * Auth strategy (dual-mode, no data leakage):
 * ──────────────────────────────────────────────────────────────────────
 * 1. LOCAL CLIENTS (Cursor, Claude Desktop, CLI):
 *    Users pass their bgblur API key as a Bearer token.
 *    The verifier validates it directly against the bgblur API.
 *
 * 2. WEB CLIENTS (web Claude.ai, ChatGPT, etc.):
 *    Clients discover OAuth endpoints via:
 *      GET /.well-known/oauth-protected-resource  → points to bgblur.com AS
 *      GET /.well-known/oauth-authorization-server → bgblur.com OAuth metadata
 *    They redirect the user to bgblur.com to log in, obtain an OAuth access
 *    token, and send it as a Bearer token — verified the same way as #1.
 *
 * Security guarantees:
 *    • Tokens are NEVER logged (scrubbed in all error paths).
 *    • The `requireBearerAuth` middleware returns a proper 401 + WWW-Authenticate
 *      header on unauthenticated requests, enabling client auto-discovery.
 *    • CORS is intentionally open so web clients can reach the MCP endpoint.
 * ──────────────────────────────────────────────────────────────────────
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  mcpAuthMetadataRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { OAuthMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { Server } from "node:http";

import { BgblurClient } from "./bgblur-client.js";
import { loadBaseConfig } from "./config.js";
import { registerTools } from "./tools/register.js";
import { BgblurTokenVerifier } from "./oauth-verifier.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Public-facing URL of THIS MCP server.
 * Must be set in production (e.g. "https://mcp.bgblur.com").
 * Falls back to localhost for local dev.
 */
const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || `http://localhost:${PORT}`;

/**
 * bgblur.com acts as the OAuth Authorization Server.
 * These values are read from env so they can be overridden for staging.
 */
const BGBLUR_OAUTH_ISSUER =
  process.env.BGBLUR_OAUTH_ISSUER || "https://bgblur.com";
const BGBLUR_OAUTH_AUTHORIZE =
  process.env.BGBLUR_OAUTH_AUTHORIZE || "https://bgblur.com/oauth/authorize";
const BGBLUR_OAUTH_TOKEN =
  process.env.BGBLUR_OAUTH_TOKEN || "https://bgblur.com/oauth/token";
const BGBLUR_OAUTH_REGISTER =
  process.env.BGBLUR_OAUTH_REGISTER || "https://bgblur.com/oauth/register";

const startTime = Date.now();

// ─── Logging ─────────────────────────────────────────────────────────────────

function logInfo(...args: unknown[]) {
  console.log("[INFO]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[ERROR]", ...args);
}

// ─── MCP Server factory ───────────────────────────────────────────────────────

function createServer() {
  const baseConfig = loadBaseConfig();
  const server = new McpServer({
    name: "bgblur",
    version: "0.1.0",
  });

  registerTools(server, (extra) => {
    // `extra.authInfo` is populated by the `requireBearerAuth` middleware.
    // The token here is the raw bearer value — either an API key (local
    // clients) or an OAuth access token (web clients).  Both work identically
    // against the bgblur API.
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

// ─── OAuth metadata ───────────────────────────────────────────────────────────

const mcpServerUrl = new URL(MCP_SERVER_URL);

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414) for bgblur.com.
 * Web clients use this to know where to redirect users for login.
 *
 * NOTE: These URLs must be live endpoints on bgblur.com.  Replace with
 * real values once the OAuth endpoints are deployed on bgblur.com.
 */
const oauthMetadata: OAuthMetadata = {
  issuer: BGBLUR_OAUTH_ISSUER,
  authorization_endpoint: BGBLUR_OAUTH_AUTHORIZE,
  token_endpoint: BGBLUR_OAUTH_TOKEN,
  registration_endpoint: BGBLUR_OAUTH_REGISTER,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  scopes_supported: ["mcp:tools"],
};

/**
 * Token verifier — validates bearer tokens (API keys or OAuth tokens) against
 * the bgblur REST API.  No credentials are cached or logged.
 */
const baseConfig = loadBaseConfig();
const tokenVerifier = new BgblurTokenVerifier({
  apiBaseUrl: baseConfig.apiBaseUrl,
  timeoutMs: Math.min(baseConfig.timeoutMs, 15_000), // cap at 15s for auth checks
});

// ─── Express app ─────────────────────────────────────────────────────────────

const app = createMcpExpressApp({
  host: HOST,
  allowedHosts: process.env.ALLOWED_HOSTS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean),
});

// CORS — required for web Claude / ChatGPT to reach the MCP endpoint
app.use((_req: any, res: any, next: any) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id"
  );
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Request logger — never logs Authorization headers
app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  res.on("finish", () => {
    logInfo(req.method, req.path, res.statusCode, `${Date.now() - start}ms`);
  });
  next();
});

// ─── OAuth discovery endpoints ────────────────────────────────────────────────
//
// These are mounted BEFORE auth middleware so unauthenticated clients (web
// Claude, ChatGPT) can discover the authorization server without needing a token.
//
//   GET /.well-known/oauth-protected-resource
//       → tells clients "this resource server is protected; auth server is at X"
//
//   GET /.well-known/oauth-authorization-server
//       → standard RFC 8414 AS metadata (authorization_endpoint, token_endpoint, …)
//
app.use(
  mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: mcpServerUrl,
    scopesSupported: ["mcp:tools"],
    resourceName: "BGBlur MCP Server",
  })
);

// ─── Health check (public, no auth) ──────────────────────────────────────────

app.get("/health", (_req: any, res: any) => {
  res.json({
    ok: true,
    service: "bgblur-mcp",
    version: "0.1.0",
    uptime: Date.now() - startTime,
    environment: NODE_ENV,
    oauthDiscovery: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });
});

// ─── Bearer auth middleware ───────────────────────────────────────────────────
//
// Applied only to /mcp routes.  On failure it returns:
//   HTTP 401  WWW-Authenticate: Bearer realm="bgblur",
//             resource_metadata="https://mcp.bgblur.com/.well-known/oauth-protected-resource"
//
// This header is what web Claude / ChatGPT read to kick off the OAuth flow.
//
const authMiddleware = requireBearerAuth({
  verifier: tokenVerifier,
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
});

// ─── MCP endpoint ─────────────────────────────────────────────────────────────

app.post("/mcp", authMiddleware, async (req: any, res: any) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    // `req.auth` is populated by requireBearerAuth; the token flows through
    // to registerTools → BgblurClient via extra.authInfo.
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logError(
      "MCP handler error:",
      error instanceof Error ? error.message : String(error)
    );
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
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.delete("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

// ─── Server startup ───────────────────────────────────────────────────────────

const httpServer: Server = app.listen(PORT, HOST, (error?: Error) => {
  if (error) {
    logError(error.message);
    process.exit(1);
  }

  logInfo(`BGBlur MCP HTTP server listening on ${HOST}:${PORT} (${NODE_ENV})`);
  logInfo(`MCP endpoint:          ${MCP_SERVER_URL}/mcp`);
  logInfo(
    `OAuth discovery:       ${getOAuthProtectedResourceMetadataUrl(mcpServerUrl)}`
  );
  logInfo(`OAuth issuer (bgblur): ${BGBLUR_OAUTH_ISSUER}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal: string) {
  logInfo(`Received ${signal}, shutting down gracefully...`);
  httpServer.close(() => {
    logInfo("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    logError("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
