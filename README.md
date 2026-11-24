# Paseo Agent Team Switcher

[简体中文](README.zh-CN.md)

Switch a Paseo conversation between **Single Agent** and **Agent Team** from the composer toolbar. Team mode asks the primary agent to plan and review while delegating implementation to a configured Paseo worker. Single Agent mode keeps the work in the current conversation. The control is available in running chats, new-agent drafts, and the New workspace composer. On compact screens, look in the composer controls menu.

## Installation

Use Paseo **0.17.3 or later** on both the host and the client. Enable plugins on the selected daemon. From a local checkout, run the following on the daemon machine. Substitute your checkout path.

```sh
paseo plugin install /absolute/path/to/paseo-agent-team
```

After the package is published to npm, it can also be installed with `paseo plugin install npm:paseo-agent-team`. The manifest uses `agent-team` as the plugin ID.

For delegation, enable `daemon.mcp.enabled` and `daemon.mcp.injectIntoAgents` on the host and allow the primary provider to use Paseo tools. Start a new conversation or reopen the provider session after changing tool injection. [Paseo MCP configuration](https://paseo.sh/docs/mcp#configuration)

## Settings and controls

Open **Settings → Plugins → Agent Team** and select the host you want to configure. Command Center also offers **Toggle Agent Team mode** on the focused conversation and **Open Agent Team settings** globally.

| Setting | Behavior |
| --- | --- |
| Default mode | Team by default. New conversations save this value unless the composer already has an explicit selection. Older conversations without a saved mode follow the current host default. |
| Worker provider, model, and permission mode | Defaults to `codex/gpt-6.2-sol` with `full-access`. Pick from the host catalog. The saved option remains available if discovery fails. Changing providers clears the model and permission mode. An empty selection tells the primary agent to discover a suitable value when needed. |
| Delegation scope | Describe what the primary agent should handle and what it should delegate. Use **Save** to apply edits. |
| Custom team instructions | Add team-specific requirements, then select **Save**. |
| Include Single Agent instructions | Include guidance to handle work directly unless the user explicitly requests delegation. |
| Expose the live status tool | Attach `agent_team_status` when a provider session opens. Reopen the session after enabling it. |

The plugin excludes background agents and agents marked with the label `agent-team/role: worker` or the metadata `agent-team.role: worker`. The primary agent is instructed to label each worker when creating it with `create_agent`.

## Provider behavior

Claude and Codex receive role instructions during session open. A running session can call `agent_team_status` to refresh the agent metadata and read the current mode and worker configuration. The toggle changes saved mode immediately. Launch instructions and environment variables are refreshed on session reopen. The plugin does not interrupt a running turn.

### Antigravity and other ACP providers

Paseo's ACP adapter omits appended system prompts. For Antigravity or another ACP provider with Paseo tool injection enabled, copy the rule below into the provider's instructions or a project rules file it reads. The settings screen shows a version with the daemon's absolute state file path. [Paseo hook behavior](https://paseo.sh/docs/plugins/hooks#append-instructions-on-every-session-opening), [Antigravity in Paseo](https://paseo.sh/docs/supported-providers/antigravity)

```text
At the start of each task, call the Paseo tool agent_team_status and follow
its current mode and instructions. If the tool is unavailable, only use the
local fallback when PASEO_AGENT_TEAM_MODE is set. Read
~/.paseo/plugin-data/agent-team/state.json on the daemon host and look up
agents[PASEO_AGENT_ID] if the ID is available. If there is no entry, use
PASEO_AGENT_TEAM_MODE and PASEO_AGENT_TEAM_WORKER from session launch.
When delegating with create_agent, always include labels:
{ "agent-team/role": "worker" }.
```

The state file is updated on settings changes, interactive opens, turn starts, and archives. It contains worker settings, delegation text, and a map of conversation modes observed since the plugin started. An idle toggle reaches the file on the next relevant lifecycle event. ACP tool availability depends on the provider's transport and host tool policy. In deployments where the provider cannot read the daemon file or launch environment, use the live tool. Instructions and status responses can reach the primary provider, and delegated task text goes to the worker provider.

## Architecture

- `index.client.tsx` and `client/` register the composer control, Command Center actions, and localized React Native settings.
- `index.server.ts` registers settings, session hooks, the live status tool, and the settings status RPC.
- `server/instructions.ts` resolves modes and generates delegation guidance. `server/state-store.ts` serializes atomic JSON replacements.
- `shared/` defines settings, metadata keys, and the RPC contract.

## Development

Use Node.js 22.12+ or another supported Vitest Node release.

```sh
npm ci
npm run typecheck
npm test
```

After editing an existing local installation, use `paseo plugin reload agent-team`.

[MIT license](LICENSE)
