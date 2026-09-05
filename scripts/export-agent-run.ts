import "../server/env-setup.js";
import { writeFile } from "node:fs/promises";

const { api } = await import("../convex/_generated/api.js");
const { convex } = await import("../server/convex-client.js");
const { buildAgentRunExport } = await import("../server/agent-run-export.js");

const LOG_LIMIT = 500;
const [agentId, outputPath] = process.argv.slice(2);

if (!agentId || agentId === "--help" || agentId === "-h") {
  console.error("Usage: npx tsx scripts/export-agent-run.ts <agent-id> [output.json]");
  process.exit(agentId ? 0 : 1);
}

const [agent, logs] = await Promise.all([
  convex.query(api.agents.get, { agentId }),
  convex.query(api.agents.getLogs, { agentId, limit: LOG_LIMIT }),
]);

if (!agent) {
  console.error(`Agent run not found: ${agentId}`);
  process.exit(1);
}

if (logs.length === LOG_LIMIT) {
  console.error(
    `Warning: exported ${LOG_LIMIT} log entries, the current query limit. This run may contain additional logs.`,
  );
}

const json = `${JSON.stringify(buildAgentRunExport(agent, logs), null, 2)}\n`;

if (outputPath) {
  await writeFile(outputPath, json, "utf8");
  console.error(`Exported ${agentId} to ${outputPath}`);
} else {
  process.stdout.write(json);
}
