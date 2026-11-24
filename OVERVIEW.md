# Agent Team Switcher

Agent Team Switcher adds a Single Agent / Agent Team toggle to the chat composer in existing conversations, new-agent drafts, and the New workspace screen. In Team mode, the primary agent plans and reviews work and can delegate implementation to a configured Paseo worker. The toggle saves the mode with the conversation.

Use Paseo 0.17.3 or newer. Under **Settings → Plugins → Agent Team**, choose a host default, worker provider, model, and permission mode, and edit the delegation instructions. The initial defaults are Team mode and a Codex worker using `gpt-6.2-sol` with `full-access`. Choose a worker and permission mode that are available on the selected daemon. Enable Paseo tool injection for the primary provider to use the delegation tools and the live status tool.

Claude and Codex receive role instructions at session launch. ACP providers such as Antigravity can use the `agent_team_status` tool when their tool transport exposes it. The settings screen includes a rule you can add to the provider to make it check on each task. The tool reads the current conversation mode, including changes made after launch. Session instructions and environment variables reflect the last open. Background agents and marked workers are excluded from orchestration.

The daemon keeps a JSON snapshot of settings and observed agent modes at `~/.paseo/plugin-data/agent-team/state.json`. Role instructions and status tool responses can be sent to the primary provider. Delegation prompts go to the chosen worker provider. The worker runs with the permission mode selected in the settings.
