import { defineAgentTool, type PluginServerContext } from "@getpaseo/plugin/server";
import { z } from "zod";
import { buildModeInstructions, isWorkerAgent, resolveEffectiveMode } from "./server/instructions";
import { StateStore } from "./server/state-store";
import { getRuntimeStatusRpc } from "./shared/protocol";
import {
  formatWorkerSpec,
  MODE_METADATA_KEY,
  parseWorkMode,
  ROLE_METADATA_KEY,
  teamSettings,
  WORKER_LABEL_KEY,
  WORKER_ROLE_VALUE,
} from "./shared/settings";

const liveModeInstruction =
  "At the start of each user task, call agent_team_status if available. Its current mode and delegation instructions supersede the launch guidance below.";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(teamSettings);
  let currentSettings = teamSettings.schema.parse({});
  const stateStore = new StateStore(currentSettings);
  const labelledWorkers = new Set<string>();

  function writeState(write: Promise<void>) {
    return write.catch((error: unknown) => console.error("Agent Team: could not write state.json", error));
  }

  let receivedUpdate = false;
  const unsubscribe = settings.subscribe((state) => {
    receivedUpdate = true;
    if (state.status === "ready") currentSettings = state.values;
    return writeState(stateStore.updateSettings(currentSettings));
  });
  const initialized = settings.read().then((state) => {
    if (!receivedUpdate && state.status === "ready") currentSettings = state.values;
  }).catch((error: unknown) => {
    console.error("Agent Team: could not read host settings", error);
  }).then(() => writeState(stateStore.updateSettings(currentSettings)));

  const agentTeamStatusTool = defineAgentTool({
    name: "agent_team_status",
    description: "Check whether this conversation is currently in Agent Team mode or Single Agent mode, and return the configured worker subagent target and delegation instructions.",
    input: z.object({}),
    async execute(_, { agent, paseo }) {
      function excluded() {
        return { text: "Agent Team status is unavailable for this session.", isError: true };
      }
      if (isWorkerAgent(agent) || labelledWorkers.has(agent.id)) return excluded();

      const refreshed = await paseo.agents.ref(agent.id).refresh().catch(() => null);
      if (refreshed && (isWorkerAgent(refreshed.agent) || refreshed.agent.archivedAt)) return excluded();
      const settings = currentSettings;
      if (!settings.exposeAgentTool || labelledWorkers.has(agent.id)) return excluded();

      const effectiveMode = refreshed || parseWorkMode(agent.metadata[MODE_METADATA_KEY])
        ? resolveEffectiveMode(refreshed ? refreshed.agent.metadata : agent.metadata, settings)
        : stateStore.getAgentMode(agent.id) ?? resolveEffectiveMode(undefined, settings);
      const { mode } = effectiveMode;
      const instructions = buildModeInstructions(mode, settings);
      const workerSpec = formatWorkerSpec(settings);
      return {
        text: [
          `Current mode: ${mode}. Worker: ${workerSpec}${settings.workerModeId ? ` (${settings.workerModeId})` : ""}.`,
          instructions,
        ].filter(Boolean).join("\n"),
        structuredContent: {
          ...effectiveMode,
          workerProvider: settings.workerProvider,
          workerModel: settings.workerModel,
          workerSpec,
          workerModeId: settings.workerModeId,
          instructions,
        },
      };
    },
  });

  const removeHooks = [
    server.addHook("agent.create.before", async ({ request }) => {
      if (isWorkerAgent(request) || request.metadata?.[MODE_METADATA_KEY] != null) return;
      await initialized;
      return {
        ...request,
        metadata: { ...request.metadata, [MODE_METADATA_KEY]: currentSettings.defaultMode },
      };
    }),
    server.addHook("agent.open.before", async ({ request }, { paseo }) => {
      if (request.purpose === "history") return;
      const { agentId } = request;
      if (request.labels[WORKER_LABEL_KEY] === WORKER_ROLE_VALUE) {
        labelledWorkers.add(agentId);
        if (request.metadata[ROLE_METADATA_KEY] !== WORKER_ROLE_VALUE) {
          // Agent creation tools can supply labels. Mirror the role for the composer,
          // which only exposes metadata. Awaiting this inside the open hook would deadlock.
          void paseo.agents.ref(agentId).setMetadata({ [ROLE_METADATA_KEY]: WORKER_ROLE_VALUE })
            .catch((error: unknown) => console.error("Agent Team: could not mark worker metadata", error));
        }
      }
      if (isWorkerAgent(request)) {
        void writeState(stateStore.removeAgent(agentId));
        return;
      }

      await initialized;
      const settings = currentSettings;
      const effectiveMode = resolveEffectiveMode(request.metadata, settings);
      const { mode } = effectiveMode;
      void writeState(stateStore.setAgentMode(agentId, effectiveMode));
      const instructions = buildModeInstructions(mode, settings);
      return {
        ...request,
        appendSystemPrompt: instructions
          ? [
              ...(request.appendSystemPrompt ?? []),
              ...(settings.exposeAgentTool ? [liveModeInstruction] : []),
              instructions,
            ]
          : request.appendSystemPrompt,
        tools: settings.exposeAgentTool ? [...request.tools, agentTeamStatusTool] : request.tools,
        env: {
          ...request.env,
          PASEO_AGENT_TEAM_MODE: mode,
          PASEO_AGENT_TEAM_WORKER: formatWorkerSpec(settings),
        },
      };
    }),
    server.addHook("agent.turn.before", async ({ agent }) => {
      await initialized;
      if (isWorkerAgent(agent) || labelledWorkers.has(agent.id)) return;
      await writeState(stateStore.setAgentMode(agent.id, resolveEffectiveMode(agent.metadata, currentSettings)));
    }),
    server.addHook("agent.archive.after", async ({ agent }) => {
      await initialized;
      labelledWorkers.delete(agent.id);
      await writeState(stateStore.removeAgent(agent.id));
    }),
  ];

  server.handle(getRuntimeStatusRpc, async () => {
    await initialized;
    return {
      stateFilePath: stateStore.filePath,
      defaultMode: currentSettings.defaultMode,
      workerSpec: formatWorkerSpec(currentSettings),
    };
  });

  return async () => {
    for (const remove of removeHooks) remove();
    unsubscribe();
    await initialized;
    await stateStore.flush();
  };
}
