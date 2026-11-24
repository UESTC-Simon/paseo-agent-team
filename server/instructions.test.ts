import { describe, expect, it } from "vitest";
import { MODE_METADATA_KEY, ROLE_METADATA_KEY, teamSettings, WORKER_LABEL_KEY } from "../shared/settings";
import { buildModeInstructions, isWorkerAgent, resolveEffectiveMode } from "./instructions";

const defaults = teamSettings.schema.parse({});

describe("worker exclusions", () => {
  it("excludes any background agent and both forms of the worker marker", () => {
    expect(isWorkerAgent({ background: true })).toBe(true);
    expect(isWorkerAgent({ labels: { [WORKER_LABEL_KEY]: "worker" } })).toBe(true);
    expect(isWorkerAgent({ metadata: { [ROLE_METADATA_KEY]: "worker" } })).toBe(true);
    expect(isWorkerAgent({
      background: false, labels: { [WORKER_LABEL_KEY]: "primary" }, metadata: { [MODE_METADATA_KEY]: "team" },
    })).toBe(false);
  });
});

describe("mode resolution", () => {
  it("prefers a valid saved mode over the host default", () => {
    expect(resolveEffectiveMode({ [MODE_METADATA_KEY]: "single" }, defaults))
      .toEqual({ mode: "single", source: "agent" });
  });

  it("uses the host default for older agents or unsupported stored values", () => {
    expect(resolveEffectiveMode(undefined, defaults)).toEqual({ mode: "team", source: "default" });
    expect(resolveEffectiveMode({ [MODE_METADATA_KEY]: "invalid" }, { ...defaults, defaultMode: "single" }))
      .toEqual({ mode: "single", source: "default" });
  });
});

describe("mode instructions", () => {
  it("identifies the worker, permissions, and mandatory label", () => {
    const text = buildModeInstructions("team", { ...defaults, customInstructions: "Review the diff." });
    expect(text).toContain("create_agent");
    expect(text).toContain("send_agent_prompt");
    expect(text).toContain('provider "codex/gpt-6.2-sol"');
    expect(text).toContain('settings: { modeId: "full-access" }');
    expect(text).toContain('labels: { "agent-team/role": "worker" }');
    expect(text).toContain(defaults.delegationScope);
    expect(text).toContain("Review the diff.");
  });

  it("asks for provider discovery when optional worker selections are empty", () => {
    const text = buildModeInstructions("team", { ...defaults, workerModel: "", workerModeId: "" });
    expect(text).toContain('provider "codex"');
    expect(text).toContain("Discover an available model");
    expect(text).not.toContain("settings:");
  });

  it("provides an optional single-agent hint without team instructions", () => {
    expect(buildModeInstructions("single", defaults)).toContain("Delegate only when the user explicitly asks");
    expect(buildModeInstructions("single", defaults)).not.toContain("create_agent");
    expect(buildModeInstructions("single", { ...defaults, singleModeHint: false })).toBeNull();
  });
});
