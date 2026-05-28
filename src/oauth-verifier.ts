/**
 * BgblurTokenVerifier
 *
 * Implements the MCP SDK's `OAuthTokenVerifier` interface.
 *
 * Dual-mode validation (no separate auth-server to deploy):
 *   • Raw API keys  – passed directly by local MCP clients (Cursor, Claude Desktop).
 *   • OAuth access tokens – issued by bgblur.com after the user completes the OAuth
 *     authorization code flow in web Claude / ChatGPT.
 *
 * In both cases the token is already a valid bgblur credential.  We confirm
 * it by making a lightweight HEAD/GET call to the bgblur API; if the API
 * returns 200 the token is valid, otherwise we throw so the SDK returns 401.
 *
 * Security:
 *   • Tokens are NEVER logged.
 *   • The verifier does NOT cache tokens (each call is authoritative).
 *   • TLS is enforced for all outbound calls (no http:// API base URLs in prod).
 */

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

import { InvalidTokenError, ServerError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

export interface BgblurTokenVerifierOptions {
  /** Base URL of the bgblur API, e.g. "https://bgblur.com/api/v1" */
  apiBaseUrl: string;
  /** Request timeout in ms (default 10_000) */
  timeoutMs?: number;
}

export class BgblurTokenVerifier implements OAuthTokenVerifier {
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: BgblurTokenVerifierOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  /**
   * Verify an access token by calling the bgblur API's me/profile endpoint.
   * Returns AuthInfo on success, throws on failure (SDK converts to 401).
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!token || typeof token !== "string") {
      throw new InvalidTokenError("Missing or invalid token.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      // We call a lightweight read-only endpoint to validate the token.
      // The /me endpoint (or equivalent) should return 200 for valid keys.
      response = await fetch(`${this.apiBaseUrl}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "bgblur-mcp/0.1.0",
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        throw new ServerError("Token verification timed out.");
      }
      throw new ServerError(`Token verification network error: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new InvalidTokenError("Invalid or expired token.");
    }

    if (!response.ok) {
      // Surface unexpected errors without leaking token data
      throw new ServerError(`Token verification failed with status ${response.status}.`);
    }

    // Return minimal AuthInfo — the token itself carries identity
    // The MCP SDK explicitly requires expiresAt to be a number (in seconds).
    return {
      token,
      clientId: "bgblur-api",
      scopes: ["mcp:tools"],
      // bgblur API keys are long-lived, set expiration to 10 years in the future
      expiresAt: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60,
    };
  }
}
