import type { PluginHookAgent, PluginServerContext, PluginSessionOpenRequest } from "@getpaseo/plugin/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import contribute from "../index.server";
import { MODE_METADATA_KEY, ROLE_METADATA_KEY, teamSettings, WORKER_LABEL_KEY } from "../shared/settings";

vi.mock("./state-store", () => ({
  StateStore: class {
    updateSettings = async () => {};
    setAgentMode = async () => {};
    removeAgent = async () => {};
    getAgentMode = () => undefined;
    flush = async () => {};
  },
}));

const defaults = teamSettings.schema.parse({});
const openRequest: PluginSessionOpenRequest = {
  agentId: "agent-1",
  workspaceId: "workspace-1",
  provider: "antigravity",
  cwd: "/workspace",
  title: null,
  reason: "resume",
  purpose: "interactive",
  background: false,
  labels: {},
  metadata: { [MODE_METADATA_KEY]: "team" },
  appendSystemPrompt: ["Earlier instructions"],
  tools: [],
  env: { EXISTING: "preserved" },
  mcpServers: {},
};
const agent: PluginHookAgent = {
  id: openRequest.agentId,
  workspaceId: openRequest.workspaceId,
  parentAgentId: null,
  provider: openRequest.provider,
  cwd: openRequest.cwd,
  title: null,
  background: false,
  metadata: { ...openRequest.metadata },
};
const refresh = vi.fn();
const setMetadata = vi.fn().mockResolvedValue(undefined);
const signal = new AbortController().signal;
const paseo = { agents: { ref: () => ({ refresh, setMetadata }) } };

function start(values = defaults) {
  const current = { status: "ready", revision: "1", values };
  const unsubscribe = vi.fn();
  const removeHook = vi.fn();
  const addHook = vi.fn().mockReturnValue(removeHook);
  const stop = contribute({
    registerSettings: () => ({
      read: async () => current,
      subscribe: () => unsubscribe,
    }),
    addHook,
    handle: vi.fn(),
  } as unknown as PluginServerContext);

  function hook(name: string) {
    const registration = addHook.mock.calls.find(([registeredName]) => registeredName === name);
    if (!registration) throw new Error(`Missing hook: ${name}`);
    return registration[1];
  }

  return { hook, stop, unsubscribe, removeHook };
}

beforeEach(() => {
  refresh.mockReset();
  setMetadata.mockClear();
});

describe("server hooks", () => {
  it("attaches the same live tool to an ACP launch and reads a later toggle", async () => {
    const { hook, stop } = start();
    const launch = await hook("agent.open.before")({ request: openRequest }, { paseo, signal });
    expect(launch.env).toEqual({
      EXISTING: "preserved",
      PASEO_AGENT_TEAM_MODE: "team",
      PASEO_AGENT_TEAM_WORKER: "codex/gpt-6.2-sol",
    });
    expect(launch.appendSystemPrompt[0]).toBe("Earlier instructions");
    expect(launch.appendSystemPrompt.join("\n")).toContain("supersede the launch guidance");
    expect(launch.tools[0].name).toBe("agent_team_status");

    refresh.mockResolvedValue({ agent: { ...agent, metadata: { [MODE_METADATA_KEY]: "single" } } });
    const status = await launch.tools[0].execute({}, { agent, paseo, signal });
    expect(status.structuredContent).toMatchObject({ mode: "single", source: "agent", workerSpec: "codex/gpt-6.2-sol" });
    expect(status.text).toContain("Handle planning, coding, and verification directly.");

    refresh.mockRejectedValue(new Error("Daemon unavailable"));
    const fallback = await launch.tools[0].execute({}, { agent, paseo, signal });
    expect(fallback.structuredContent).toMatchObject({ mode: "team", source: "agent" });
    await stop();
  });

  it("leaves history, background sessions, and workers without contributions", async () => {
    const { hook, stop } = start();
    const open = hook("agent.open.before");
    for (const exclusion of [
      { purpose: "history" },
      { background: true },
      { labels: { [WORKER_LABEL_KEY]: "worker" } },
      { metadata: { [ROLE_METADATA_KEY]: "worker" } },
    ]) {
      expect(await open({ request: { ...openRequest, ...exclusion } }, { paseo, signal })).toBeUndefined();
    }
    expect(setMetadata).toHaveBeenCalledExactlyOnceWith({ [ROLE_METADATA_KEY]: "worker" });
    await stop();
  });

  it("applies host defaults to untouched drafts and preserves explicit modes", async () => {
    const { hook, stop, unsubscribe, removeHook } = start({ ...defaults, defaultMode: "single" });
    const create = hook("agent.create.before");
    const request = { config: { provider: "codex", cwd: "/workspace" }, metadata: { other: "kept" } };
    expect(await create({ request })).toEqual({
      ...request, metadata: { ...request.metadata, [MODE_METADATA_KEY]: "single" },
    });
    expect(await create({ request: { ...request, metadata: { [MODE_METADATA_KEY]: "team" } } })).toBeUndefined();
    expect(await create({ request: { ...request, metadata: { [ROLE_METADATA_KEY]: "worker" } } })).toBeUndefined();
    await stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(removeHook).toHaveBeenCalledTimes(4);
  });
});
