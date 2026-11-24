# Agent Team 切换器

Agent Team 切换器在现有会话、新建 Agent 草稿和新建工作区的聊天输入栏中提供单 Agent／Agent Team 切换。团队模式下，主 Agent 负责规划和审查，并可将实现任务委派给配置好的 Paseo 工作 Agent。切换结果随会话保存。

需要 Paseo 0.17.3 或更新版本。在 **设置 → 插件 → Agent Team** 中，可以为宿主选择默认模式、工作 Agent 的提供商、模型和权限模式，并编辑委派指令。初始配置是团队模式，工作 Agent 使用 Codex 的 `gpt-6.2-sol` 和 `full-access` 权限模式。请选用当前守护进程上可用的工作 Agent 配置，并为主 Agent 的提供商启用 Paseo 工具注入，以便使用委派工具和实时状态工具。

Claude 和 Codex 在会话启动时接收角色指令。Antigravity 等 ACP 提供商可通过支持的工具传输调用 `agent_team_status`。设置页提供一段可添加到提供商的规则，让 Agent 在每项任务开始时查询模式。工具会读取当前会话模式，包括启动后的切换。会话指令和环境变量反映最近一次启动时的配置。后台 Agent 和标记为 worker 的 Agent 不会收到团队编排指令和工具。

守护进程将配置和已观察到的 Agent 模式写入 `~/.paseo/plugin-data/agent-team/state.json`。角色指令和状态工具结果可能发送给主 Agent 的提供商，委派提示词会发送给所选工作 Agent 的提供商。工作 Agent 使用设置中选择的权限模式运行。
