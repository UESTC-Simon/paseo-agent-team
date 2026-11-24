import {
  type AgentTeamSettings,
  type AgentWorkMode,
  formatWorkerSpec,
  MODE_METADATA_KEY,
  parseWorkMode,
  ROLE_METADATA_KEY,
  WORKER_LABEL_KEY,
  WORKER_ROLE_VALUE,
} from "../shared/settings";

export function isWorkerAgent(input: {
  background?: boolean;
  labels?: Readonly<Record<string, string>>;
  metadata?: Readonly<Record<string, unknown>>;
}): boolean {
  return input.background === true ||
    input.labels?.[WORKER_LABEL_KEY] === WORKER_ROLE_VALUE ||
    input.metadata?.[ROLE_METADATA_KEY] === WORKER_ROLE_VALUE;
}

export function resolveEffectiveMode(
  metadata: Readonly<Record<string, unknown>> | undefined,
  settings: AgentTeamSettings,
): { mode: AgentWorkMode; source: "agent" | "default" } {
  const mode = parseWorkMode(metadata?.[MODE_METADATA_KEY]);
  return mode ? { mode, source: "agent" } : { mode: settings.defaultMode, source: "default" };
}

export function buildModeInstructions(mode: AgentWorkMode, settings: AgentTeamSettings): string | null {
  if (mode === "single") {
    return settings.singleModeHint
      ? "Single Agent mode. Handle planning, coding, and verification directly. Delegate only when the user explicitly asks for subagents."
      : null;
  }

  const workerSpec = formatWorkerSpec(settings);
  const workerMode = settings.workerModeId
    ? ` Pass settings: { modeId: ${JSON.stringify(settings.workerModeId)} }.`
    : " If the target requires a permission mode, discover a supported mode before launching it.";
  const workerModel = settings.workerModel
    ? ""
    : " Discover an available model for that provider and pass the resulting provider/model pair.";

  return [
    "Agent Team mode. Act as the primary planner and reviewer. Define the task and review and verify the worker's changes before reporting completion.",
    `Delegate implementation through Paseo's create_agent using provider ${JSON.stringify(workerSpec)}.${workerModel}${workerMode}`,
    `Always pass labels: { "${WORKER_LABEL_KEY}": "${WORKER_ROLE_VALUE}" } when creating a worker. Tell each worker to execute its assignment directly without creating subagents.`,
    "Give the worker its assignment in initialPrompt, or use send_agent_prompt with its agent ID to send the assignment or follow-up instructions.",
    settings.delegationScope,
    settings.customInstructions.trim(),
  ].filter(Boolean).join("\n");
}
