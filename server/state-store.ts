import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentTeamSettings, AgentWorkMode } from "../shared/settings";
import type { resolveEffectiveMode } from "./instructions";

type AgentMode = ReturnType<typeof resolveEffectiveMode>;

export const defaultStateFilePath = join(homedir(), ".paseo", "plugin-data", "agent-team", "state.json");

export class StateStore {
  private readonly agents = new Map<string, AgentMode>();
  private pending = Promise.resolve();
  private lastWritten: string | undefined;

  constructor(private settings: AgentTeamSettings, readonly filePath = defaultStateFilePath) {}

  updateSettings(settings: AgentTeamSettings): Promise<void> {
    this.settings = settings;
    return this.persist();
  }

  getAgentMode(agentId: string): AgentMode | undefined {
    const entry = this.agents.get(agentId);
    return entry?.source === "default" ? { mode: this.settings.defaultMode, source: "default" } : entry;
  }

  setAgentMode(agentId: string, entry: AgentMode): Promise<void> {
    this.agents.set(agentId, entry);
    return this.persist();
  }

  removeAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
    return this.persist();
  }

  flush(): Promise<void> {
    return this.pending;
  }

  private persist(): Promise<void> {
    const { defaultMode, workerProvider, workerModel, workerModeId, delegationScope, customInstructions } = this.settings;
    const agents = Object.fromEntries(
      Array.from(this.agents, ([id, entry]): [string, AgentWorkMode] => [
        id, entry.source === "agent" ? entry.mode : defaultMode,
      ]),
    );
    const snapshot = JSON.stringify({
      defaultMode, workerProvider, workerModel, workerModeId, delegationScope, customInstructions, agents,
    }, null, 2) + "\n";

    // Serialize replacements so an older snapshot cannot land after a newer one.
    const write = this.pending.then(async () => {
      if (this.lastWritten === snapshot) return;

      await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
      const temporaryPath = join(dirname(this.filePath), `.agent-team-${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, snapshot, { encoding: "utf8", flag: "wx", mode: 0o600 });
        await rename(temporaryPath, this.filePath);
      } finally {
        await rm(temporaryPath, { force: true }).catch(() => {});
      }
      this.lastWritten = snapshot;
    });

    this.pending = write.catch(() => {});
    return write;
  }
}
