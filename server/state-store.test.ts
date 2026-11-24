import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { teamSettings } from "../shared/settings";
import { StateStore } from "./state-store";

const defaults = teamSettings.schema.parse({});
let fixture: string;

beforeEach(async () => {
  fixture = await mkdtemp(fileURLToPath(new URL("../node_modules/.agent-team-test-", import.meta.url)));
});

afterEach(async () => {
  await rm(fixture, { recursive: true, force: true });
});

describe("state file", () => {
  it("writes settings and agent modes in order, applies new defaults, and removes archived agents", async () => {
    const filePath = join(fixture, "nested", "state.json");
    const store = new StateStore(defaults, filePath);
    await Promise.all([
      store.setAgentMode("default-chat", { mode: "team", source: "default" }),
      store.setAgentMode("team-chat", { mode: "team", source: "agent" }),
      store.setAgentMode("archived-chat", { mode: "single", source: "agent" }),
      store.updateSettings({ ...defaults, defaultMode: "single", workerProvider: "claude", workerModel: "sonnet" }),
      store.removeAgent("archived-chat"),
    ]);
    await store.flush();

    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      defaultMode: "single",
      workerProvider: "claude",
      workerModel: "sonnet",
      workerModeId: defaults.workerModeId,
      delegationScope: defaults.delegationScope,
      customInstructions: "",
      agents: { "default-chat": "single", "team-chat": "team" },
    });
    expect(store.getAgentMode("default-chat")).toEqual({ mode: "single", source: "default" });
    expect(await readdir(join(fixture, "nested"))).toEqual(["state.json"]);
  });

  it("can retry a failed write and retains subsequent changes", async () => {
    const parent = join(fixture, "blocked");
    await writeFile(parent, "blocks directory creation");
    const store = new StateStore(defaults, join(parent, "state.json"));

    await expect(store.updateSettings(defaults)).rejects.toThrow();
    await rm(parent);
    await store.setAgentMode("chat", { mode: "single", source: "agent" });
    expect(JSON.parse(await readFile(store.filePath, "utf8")).agents).toEqual({ chat: "single" });
  });
});
