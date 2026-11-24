# Paseo Agent Team 切换器

[English](README.md)

在 Paseo 聊天输入栏一键切换 **单 Agent** 和 **Agent Team**。团队模式让主 Agent 负责规划与审查，把实现委派给配置好的 Paseo 工作 Agent。单 Agent 模式由当前会话独立完成任务。运行中的会话、新 Agent 草稿和新建工作区的输入栏均可切换。在窄屏上，请打开聊天输入栏的控件菜单。

## 安装

宿主与客户端均需使用 **Paseo 0.17.3 或更新版本**。在目标守护进程上启用插件，然后在该宿主执行以下命令，将路径替换为本地仓库目录。

```sh
paseo plugin install /absolute/path/to/paseo-agent-team
```

软件包发布到 npm 后，也可使用 `paseo plugin install npm:paseo-agent-team`。插件清单中的 ID 为 `agent-team`。

要使用委派功能，请在宿主上启用 `daemon.mcp.enabled` 和 `daemon.mcp.injectIntoAgents`，并允许主 Agent 的提供商使用 Paseo 工具。修改注入配置后，请新建会话或重新打开提供商会话。 [Paseo MCP 配置](https://paseo.sh/docs/mcp#configuration)

## 设置和操作

打开 **设置 → 插件 → Agent Team**，选择要配置的宿主。也可以在命令中心对当前会话执行 **切换 Agent Team 模式**，或从任意位置执行 **打开 Agent Team 设置**。

| 设置 | 行为 |
| --- | --- |
| 默认模式 | 初始为团队模式。新会话使用此值，输入栏已选择模式时使用所选值。没有保存模式的旧会话使用当前宿主默认值。 |
| 工作 Agent 的提供商、模型和权限模式 | 初始配置为 `codex/gpt-6.2-sol` 与 `full-access`。从宿主目录选择，目录加载失败时仍可看到已保存选项。更换提供商会清空已选模型和权限模式，留空时由主 Agent 按需查找可用选项。 |
| 委派范围 | 指定主 Agent 负责的工作及应当委派的任务，编辑后选择 **保存**。 |
| 自定义团队指令 | 添加团队模式专用要求，编辑后选择 **保存**。 |
| 添加单 Agent 模式指令 | 提示 Agent 直接完成工作，用户明确要求时才委派。 |
| 提供实时状态工具 | 提供商会话打开时挂载 `agent_team_status`。启用后请重新打开会话。 |

插件会排除后台 Agent，以及带有 `agent-team/role: worker` 标签或 `agent-team.role: worker` 元数据的 Agent。主 Agent 通过 `create_agent` 创建工作 Agent 时会收到添加标签的指令。

## 提供商行为

Claude 和 Codex 在会话打开时接收角色指令。运行中的会话可调用 `agent_team_status`，刷新 Agent 元数据并读取当前模式与工作 Agent 配置。切换会立即更新保存的模式。启动指令和环境变量会在会话重新打开时刷新，正在进行的对话轮次会继续执行。

### Antigravity 和其他 ACP 提供商

Paseo 的 ACP 适配器不会转发追加的系统提示词。对启用了 Paseo 工具注入的 Antigravity 或其他 ACP 提供商，将下面的规则添加到提供商指令或它读取的项目规则中。设置页中也有同样的规则，并显示守护进程上的绝对文件路径。 [Paseo 钩子行为](https://paseo.sh/docs/plugins/hooks#append-instructions-on-every-session-opening)、[在 Paseo 中使用 Antigravity](https://paseo.sh/docs/supported-providers/antigravity)

```text
每项任务开始时调用 Paseo 工具 agent_team_status，遵循返回的当前模式和指令。
工具不可用时，仅在已设置 PASEO_AGENT_TEAM_MODE 的情况下使用本地回退。
读取守护进程宿主上的 ~/.paseo/plugin-data/agent-team/state.json，
如果 PASEO_AGENT_ID 可用，查找 agents[PASEO_AGENT_ID]。
没有对应条目时，使用会话启动时的 PASEO_AGENT_TEAM_MODE 和 PASEO_AGENT_TEAM_WORKER。
通过 create_agent 委派时始终传入 labels: { "agent-team/role": "worker" }。
```

设置变更、交互会话打开、轮次开始和归档都会更新状态文件。文件保存工作 Agent 配置、委派文本及插件启动后观察到的会话模式。空闲时切换后，文件会在下一次相关事件发生时更新。ACP 工具是否可用取决于提供商的工具传输能力和宿主的工具策略。如果提供商无法读取宿主文件或启动环境，可使用实时工具。角色指令和状态响应可能传给主 Agent 的提供商，委派任务文本会传给工作 Agent 的提供商。

## 架构

- `index.client.tsx` 和 `client/` 注册输入栏开关、命令中心操作与本地化 React Native 设置页。
- `index.server.ts` 注册宿主设置、会话钩子、实时状态工具及设置页状态 RPC。
- `server/instructions.ts` 确定模式并生成委派指引。`server/state-store.ts` 对 JSON 文件执行顺序化的原子更新。
- `shared/` 定义设置、元数据键及 RPC 契约。

## 开发与测试

使用 Node.js 22.12 或更新的受 Vitest 支持的 Node 版本。

```sh
npm ci
npm run typecheck
npm test
```

修改已安装的本地插件后，可运行 `paseo plugin reload agent-team`。

[MIT 许可证](LICENSE)
