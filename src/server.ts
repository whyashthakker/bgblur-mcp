#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { BgblurClient } from "./bgblur-client.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools/register.js";

async function main() {
  const config = loadConfig();
  const server = new McpServer({
    name: "bgblur",
    version: "0.1.0",
  });
  const client = new BgblurClient(config);

  registerTools(server, () => client, { enableLocalUploads: true });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
