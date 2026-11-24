import { describe, expect, it } from "vitest";
import { formatWorkerSpec, parseWorkMode, teamSettings } from "./settings";

describe("host settings", () => {
  it("provides the default worker, delegation scope, and mode", () => {
    expect(teamSettings).toMatchObject({ id: "team-mode", scope: "host", version: 1 });
    expect(teamSettings.schema.parse({})).toEqual({
      defaultMode: "team",
      workerProvider: "codex",
      workerModel: "gpt-6.2-sol",
      workerModeId: "full-access",
      delegationScope: "Focus on planning, architecture, and final code review. Delegate concrete code implementation, refactoring, and test writing to the worker subagent.",
      customInstructions: "",
      singleModeHint: true,
      exposeAgentTool: true,
    });
  });

  it("trims provider selections and rejects an empty provider", () => {
    expect(teamSettings.schema.parse({ workerProvider: " claude ", workerModel: " ", workerModeId: " plan " }))
      .toMatchObject({ workerProvider: "claude", workerModel: "", workerModeId: "plan" });
    expect(teamSettings.schema.safeParse({ workerProvider: " " }).success).toBe(false);
  });

  it("accepts only the two supported conversation modes", () => {
    expect(parseWorkMode("team")).toBe("team");
    expect(parseWorkMode("single")).toBe("single");
    for (const invalid of [null, undefined, "Team", true, { mode: "single" }]) {
      expect(parseWorkMode(invalid)).toBeNull();
    }
  });

  it("formats a qualified worker when a model was selected", () => {
    expect(formatWorkerSpec(teamSettings.schema.parse({}))).toBe("codex/gpt-6.2-sol");
    expect(formatWorkerSpec({ workerProvider: "antigravity", workerModel: "" })).toBe("antigravity");
  });
});
