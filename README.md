# Endfieldlize Design Skills

面向 Coding Agent 的交互探索、程序化图形和原型评审工具包。将整个目录放进项目并从项目根启动宿主。`.agents/skills/` 下的三个 Skill 共用相同的 CLI 和设计文件。

| Skill | 适用任务 |
| --- | --- |
| [design-exploration](.agents/skills/design-exploration/SKILL.md) | 对复杂工作流探索多套信息模型，比较同一个困难任务的操作路径 |
| [graphic-composition](.agents/skills/graphic-composition/SKILL.md) | 从参考图提取构成语法，编写参数化图形并建立视觉层级 |
| [design-evaluation](.agents/skills/design-evaluation/SKILL.md) | 审查实际渲染与交互，保存可重现的证据和修订理由 |

## 本地运行

使用 Node.js 22 或更高版本和 npm。AJV 校验 JSON，Playwright 驱动浏览器。生成 SVG、校验配置和打包原型只需要 Node.js 与 npm 依赖。PNG 预览和浏览器验收需要 Chromium。工具会查找 Playwright Chromium 和常见的系统 Chromium 浏览器。也可以设置 `DESIGN_BROWSER` 或传 `--browser`，指定可执行文件。

```sh
npm ci
npm test
node tools/design.mjs catalog
node tools/design.mjs validate examples/sinewave/prototype.json
node tools/design.mjs generate examples/sinewave/dial.json .design/dial.svg
node tools/design.mjs preset examples/sinewave/dial.json .design/dial-preset.json
node tools/design.mjs preview examples/sinewave/dial.json .design/dial.png
node tools/design.mjs prototype examples/sinewave/prototype.json .design/sinewave
node tools/design.mjs serve .design/sinewave
```

打开终端打印的本地地址。Sinewave 的五首示例曲目在浏览器内生成 WAV，加载页面后点击 Play 即可播放。没有可用浏览器时可用 `npx playwright install chromium` 安装。手动验证可使用任意能播放 WAV 的现代浏览器，自动报告保留缺失运行时的跳过记录。

Sinewave 随包提供 Montserrat 与 JetBrains Mono 的 Latin WOFF2 和字体许可。HarmonyOS Sans 在系统安装后作为正文回退字体。原型以中性灰白和黑色构成底色，饱和蓝用于播放状态、焦点和信号线。视觉 Skill 支持根据任务更换高对比强调色。[Montserrat](https://github.com/googlefonts/Montserrat) · [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) · [HarmonyOS Sans](https://developer.huawei.com/consumer/en/design/resource/)

```sh
node tools/design.mjs screenshot examples/sinewave/prototype.json .design/screenshots
node tools/design.mjs test examples/sinewave/prototype.json .design/sinewave-test
node tools/design.mjs export examples/sinewave/prototype.json .design/sinewave-export
```

`prototype` 和 `export` 接受新的输出目录。导出包含可直接用本地服务器预览的页面、源配置与资产，以及文件的 SHA-256 清单。`screenshot` 生成视口基线，`test` 另执行配置中的交互步骤，分别写出 `evaluation.json`。其他命令由 `node tools/design.mjs --help` 列出。

## 图元工坊

运行 `npm run studio`，打开终端打印的本地地址（默认 `http://127.0.0.1:4174/`）。选择图元，在工坊修改参数并导出。20 种 Rahoo 图元直接使用已下载的官方脚本生成，选「SVG 矢量」时下载官方脚本保存的原始 SVG。各图元的导出选项取决于生成器支持的格式。

Rahoo 发布构建存放在 `vendor/rahoo/`，加载时校验文件哈希。安装 Node 依赖后可以断网运行。工坊也可编辑九种工具包 SVG 原语，导入和导出配置。使用 `npm run studio -- --port 4180` 可更改本地端口。

## 图形参数与扩展

需要与 Rahoo 的发布版本一致时使用 [RahooSpec 原生渲染](docs/rahoo-native.md)。随项目带有锁定的原站构建。`generate` 可以直接保存原站导出的 SVG，`preview` 可以截图。

[图形目录对照](docs/rahoo.md)记录所核对的公开构建、20 个图形、九个额外原语和已知差异。[图元实现清单](docs/generator-status.md)逐项附浏览器截图。用 `node tools/design.mjs catalog hudLines` 获取受验证的参数名称、默认值、取值和范围。

地图区域名、图版标题或大型分区编号可在 `typographyOutlines` 中指定 `"font": "Amarillo USAF"`。渲染时查找本机字体，再按 Montserrat、HarmonyOS Sans 的顺序回退。[Amarillo USAF 字体说明](https://www.tlai.com/med_des/amusaf.html)

一个图形文件采用 `GraphicSpec`，由画布和有序图层组成。`x` 与 `y` 相对画布中心，正方向向右和向下，角度单位为度。图层可指定 `id`、`seed`、`rotation`、`scale`、`opacity`。同一 JSON 与生成器版本会得到相同的 SVG。用 `node tools/design.mjs raster photo.png .design/pixels.json --max-side 128` 采样本地图片，把得到的二维 RGBA 数组填入半调、点阵或 ASCII 的 `pixels`。

```json
{
  "kind": "GraphicSpec",
  "version": 1,
  "width": 420,
  "height": 320,
  "seed": "listen",
  "layers": [
    {"id": "scale", "generator": "scaleCircle", "params": {"count": 120, "majorInterval": 6}},
    {"generator": "waveform", "params": {"samples": [0, 0.6, -0.5, 0.2, 0], "width": 380}}
  ]
}
```

用 `--plugin ./path/to/module.mjs` 加载受信任的本地 JavaScript；可重复指定。模块导出 `generators` 数组。每项包含 `name`、用于校验和默认值的 `options` 及 `draw(params, ctx)`。生成函数返回 SVG 片段，可访问画布大小 `ctx.w`、`ctx.h`，使用 `ctx.rng()` 和 `ctx.id(localName)` 生成可复现的随机数和图层内引用。

```sh
node tools/design.mjs generate examples/graphics/orbit-weave.json .design/orbit-weave.svg --plugin examples/graphics/orbit-weave.mjs
```

## 可移植设计文件

| 文件 | 负责描述 |
| --- | --- |
| [InteractionSpec](schemas/InteractionSpec.schema.json) | 用户任务、实体关系、状态转换、候选方案和选择 |
| [CompositionSpec](schemas/CompositionSpec.schema.json) | 版式意图、视觉层与定位、排版、响应式和动态行为 |
| [PrototypeSpec](schemas/PrototypeSpec.schema.json) | 页面与组件、可生成资产、视口和交互用例 |
| [EvaluationReport](schemas/EvaluationReport.schema.json) | 自动检测、评审观察、待验证判断和证据 |

四类文件采用 JSON Schema 2020-12。CLI 同时检查状态、关系和视口的 ID 引用。第一版的生成适配器是静态 Web，Skill 可以在用户现有技术栈中实现行为，再用相同的 InteractionSpec、CompositionSpec 和 EvaluationReport 记录设计。

## 示例与后续

- [AI 对话管理空间](examples/conversation-atlas/exploration.md)比较空间关系图、执行车道与证据索引。第一版提交探索和交互数据。
- [Sinewave](examples/sinewave/prototype.json) 是可运行的播放器。当前曲目、时间域信号、传输控制和两套曲库入口共享同一播放状态。[截图与评审报告](examples/sinewave/evidence/evaluation.json)
- [兼容性验证](docs/compatibility.md)记录两个宿主的测试范围与复现步骤。

后续优先完成 Rahoo 逐参数对照和输出比对，扩展专业等高线投影与动画帧导出，推进对话关系图原型并在真实高密度素材下评估。跨宿主验收需要做完 DeepSeek 完整在线工作流。
