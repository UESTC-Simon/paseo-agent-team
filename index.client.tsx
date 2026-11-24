import { type PluginClientContext } from "@getpaseo/plugin/client";
import { AgentTeamComposerToggle } from "./client/composer-toggle";
import { messages } from "./client/i18n";
import { AgentTeamSettingsScreen } from "./client/settings-screen";
import { getRuntimeStatusRpc } from "./shared/protocol";
import { MODE_METADATA_KEY, parseWorkMode, ROLE_METADATA_KEY, WORKER_ROLE_VALUE } from "./shared/settings";

export default function contribute(client: PluginClientContext) {
  const remove = [
    client.addComposerItem({ id: "agent-team-mode", Component: AgentTeamComposerToggle }),
    client.addSettingsScreen({
      id: "settings",
      title: messages.message("settingsScreen"),
      icon: "Users",
      Component: AgentTeamSettingsScreen,
    }),
    client.addCommandCenterItem({
      id: "toggle-mode",
      title: messages.message("commands.toggle"),
      icon: "Users",
      context: "agent",
      async onSelect({ agent, composers, rpc }) {
        const [composer] = composers({ agentId: agent.id });
        if (!composer || agent.background || composer.agent.metadata[ROLE_METADATA_KEY] === WORKER_ROLE_VALUE) return;

        const mode = parseWorkMode(composer.agent.metadata[MODE_METADATA_KEY]) ??
          (await rpc(getRuntimeStatusRpc, {})).defaultMode;
        await composer.setMetadata({ [MODE_METADATA_KEY]: mode === "team" ? "single" : "team" });
      },
    }),
    client.addCommandCenterItem({
      id: "open-settings",
      title: messages.message("commands.settings"),
      icon: "Users",
      context: "global",
      onSelect({ openSettings }) {
        openSettings("settings");
      },
    }),
  ];

  return () => {
    for (const cleanup of remove) cleanup();
  };
}
