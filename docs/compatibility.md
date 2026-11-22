# 跨宿主验证

系统为 Windows，Node.js 24.19.0。两套宿主使用项目根的同一个 `.agents/skills/` 和同一份 `examples/sinewave/dial.json`。工具包运行时使用本地 Node.js、标准输入输出文件和可选 Chromium。

## 发现规则

Codex 扫描当前目录的 `.agents/skills`，在 Git 项目内也会向上扫描到项目根。可从项目根运行 `codex` 后用 `/skills` 查看，或用 `$design-exploration` 显式选择。[Codex Skill 文档](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)

DeepSeek Harness 的项目级文件系统提供方扫描 `<projectRoot>/.agents/skills`。项目根是最近的 Git 根，普通目录可直接从该目录启动。Web 界面添加当前项目目录为 Workspace。若存在 `.dsh/skills/` 下同名技能，DeepSeek 的项目级优先级会让该版本先被发现。[DeepSeek Skill 子系统](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/skills) · [Web UI 指南](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart)

## 实测结果

| 验收项 | OpenAI Codex 0.169.0-alpha.11.1 | DeepSeek Harness 0.2.2-rc.5 |
| --- | --- | --- |
| 原生发现 | Codex 本机目录返回三个 Skill，均为 `repo` | 官方文件系统提供方与注册表返回三个 Skill，均为 `project-agents` |
| 读取 Skill 与参考 | 读取三个 Skill 的正文和链接参考，记录内容摘要 | 调用官方 `skill` 工具加载三个正文，用返回的资源目录读取参考 |
| 调用本地 CLI | 在本次 Codex 工作区运行同一 smoke | 官方 `bash` 工具通过本机 subprocess 运行同一 smoke，退出 0 |
| 生成和修改配置 | 保存归一配置，将 `majorInterval` 改为 7，再生成 SVG | 执行同一流程 |
| 原型、测试和截图 | 构建成功，Chromium 12/12 | 构建成功，Chromium 12/12 |
| 复用素材 | 构建产物的刻度 SVG 与原始输入生成一致 | 原始和修改版 SVG 的 SHA-256 与 Codex 对应产物逐项一致 |
| 浏览器不可用 | 显式指定不存在的 Chromium，保存带 `skipped` 的报告，本地 SVG 和配置工作流可用 | 通过官方 Bash 运行 `--no-browser`，配置与原型构建成功，报告保留跳过状态 |

Codex 发现通过其原生本机目录请求实测。DeepSeek 离线测试装载了指定版本的官方 Skill provider、注册表、`skill` 工具、`bash` 工具和本地 subprocess 组件。固定输入由测试探针提供，模型的自然语言路由和线上权限交互仍待实测。在线 DeepSeek 试跑被自动审批拦截，原因是运行会把项目 Skill 和参考文字发送给 DeepSeek。离线探针没有使用账号凭据或模型端点。

自动报告、目录探针和散列记录存放于本次工作区的 `.design/`。可复用报告在 [Sinewave 的评审证据](../examples/sinewave/evidence/evaluation.json)。

## 复现

1. 在项目根运行 `npm ci`。若系统没有支持的 Chromium，运行 `npx playwright install chromium`。
2. 在各宿主的原生目录查看三个 Skill。打开其中一个 Skill，按其相对链接读取参考资料。Codex 用 `/skills`，DeepSeek 的可用技能目录可以从 Web 应用或 `skill` 工具检查。
3. 让宿主运行 `node tools/compat-smoke.mjs codex` 或 `node tools/compat-smoke.mjs deepseek`。比较两个 `.design/compat-*/smoke.json` 的 `files`，再检查各自的 `browser/evaluation.json`。运行标签用于区分输出，宿主身份和原生发现需要从各自会话记录核验。
4. 无浏览器时添加 `--no-browser`。用 CLI 继续验证配置、生成 SVG 和导出。手动浏览器观察发生后可追加独立的评审条目。

Rahoo 原生渲染的附加验证使用同一锁定缓存和 Chromium。Codex 与 DeepSeek Harness 原生 Bash 分别执行 `node tools/design.mjs generate examples/graphics/rahoo-halftone.json <输出路径.svg>`，两个 SVG 的 505,823 字节逐一相同。[Rahoo 原生渲染](rahoo-native.md)
