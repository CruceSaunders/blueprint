#!/usr/bin/env node
// Entry point for running the server from source: `node mcp/dist/index.js`.
import { runStdio } from "./server.js";
// Keep stdout for protocol bytes only.
console.log = (...a: unknown[]) => console.error(...a);
await runStdio();
process.exit(0);
