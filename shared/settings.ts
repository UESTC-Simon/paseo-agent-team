import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const MODE_METADATA_KEY = "agent-team.mode";
export const ROLE_METADATA_KEY = "agent-team.role";
export const WORKER_LABEL_KEY = "agent-team/role";
export const WORKER_ROLE_VALUE = "worker";

export type AgentWorkMode = "single" | "team";

export function parseWorkMode(value: unknown): AgentWorkMode | null {
  return value === "single" || value === "team" ? value : null;
}

export const teamSettings = defineSettings({
  id: "team-mode",
  scope: "host",
  version: 1,
  schema: z.object({
    defaultMode: z.enum(["team", "single"]).default("team"),
    workerProvider: z.string().trim().min(1).default("codex"),
    workerModel: z.string().trim().default("gpt-6.2-sol"),
    workerModeId: z.string().trim().default("full-access"),
    delegationScope: z.string().trim().default("Focus on planning, architecture, and final code review. Delegate concrete code implementation, refactoring, and test writing to the worker subagent."),
    customInstructions: z.string().default(""),
    singleModeHint: z.boolean().default(true),
    exposeAgentTool: z.boolean().default(true),
  }),
});

export type AgentTeamSettings = z.output<typeof teamSettings.schema>;

export function formatWorkerSpec(settings: Pick<AgentTeamSettings, "workerProvider" | "workerModel">): string {
  const { workerProvider, workerModel } = settings;
  return workerModel ? `${workerProvider}/${workerModel}` : workerProvider;
}
