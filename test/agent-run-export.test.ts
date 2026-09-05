import { describe, expect, it } from "vitest";
import {
  buildAgentRunExport,
  sanitizeAgentLogContent,
  type AgentRunExportSource,
} from "../server/agent-run-export.js";

const agent: AgentRunExportSource = {
  agentId: "agent_test123",
  conversationId: "conv_test",
  name: "gmail",
  task: "Summarize the latest message",
  runtime: "codex",
  model: "gpt-test",
  reasoningEffort: "medium",
  billingMode: "codex-subscription",
  status: "completed",
  result: "Done",
  mcpServers: ["gmail"],
  inputTokens: 100,
  outputTokens: 25,
  cacheReadTokens: 10,
  cacheCreationTokens: 5,
  costUsd: 0.0123,
  startedAt: 1_000,
  completedAt: 2_500,
};

describe("agent run export", () => {
  it("builds a versioned portable run with usage, timing, and ordered logs", () => {
    const exported = buildAgentRunExport(
      agent,
      [
        {
          logType: "tool_use",
          toolName: "mcp__gmail__search",
          accounts: ["gmail_primary"],
          content: '{"query":"from:alice"}',
          createdAt: 1_100,
        },
        {
          logType: "tool_result",
          content: '{"count":1}',
          createdAt: 1_200,
        },
      ],
      "2026-09-05T08:00:00.000Z",
    );

    expect(exported).toMatchObject({
      format: "boop-agent-run",
      version: 1,
      exportedAt: "2026-09-05T08:00:00.000Z",
      run: {
        agentId: "agent_test123",
        runtime: "codex",
        model: "gpt-test",
        integrations: ["gmail"],
        usage: {
          inputTokens: 100,
          outputTokens: 25,
          cacheReadTokens: 10,
          cacheCreationTokens: 5,
          costUsd: 0.0123,
        },
        timing: {
          startedAt: 1_000,
          completedAt: 2_500,
          durationMs: 1_500,
        },
      },
    });
    expect(exported.logs.map((log) => log.type)).toEqual(["tool_use", "tool_result"]);
  });

  it("redacts credential-shaped keys recursively in JSON log content", () => {
    const source = JSON.stringify({
      api_key: "top-secret",
      nested: {
        password: "hunter2",
        safe: "keep me",
        list: [{ access_token: "token-value", query: "hello" }],
      },
    });

    expect(JSON.parse(sanitizeAgentLogContent(source))).toEqual({
      api_key: "[redacted]",
      nested: {
        password: "[redacted]",
        safe: "keep me",
        list: [{ access_token: "[redacted]", query: "hello" }],
      },
    });
  });

  it("leaves plain text and malformed JSON unchanged", () => {
    expect(sanitizeAgentLogContent("plain result text")).toBe("plain result text");
    expect(sanitizeAgentLogContent('{"broken"')).toBe('{"broken"');
  });

  it("does not mutate the source agent or log objects", () => {
    const log = {
      logType: "tool_use",
      content: '{"authorization":"Bearer secret","query":"status"}',
    };
    const originalAgent = structuredClone(agent);
    const originalLog = structuredClone(log);

    buildAgentRunExport(agent, [log], "2026-09-05T08:00:00.000Z");

    expect(agent).toEqual(originalAgent);
    expect(log).toEqual(originalLog);
  });
});
