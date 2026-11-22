# Rahoo 原生渲染

用 `npm run studio` 在图元工坊的现有界面编辑 Rahoo 图元，或用 `RahooSpec` 自动调用其绘图与导出程序。两种入口都加载项目内锁定的原版生成脚本，并直接使用原版程序保存导出文件。

## 获取和运行

```sh
npm ci
node tools/design.mjs rahoo-inspect halftone .design/halftone-native.json
node tools/design.mjs generate examples/graphics/rahoo-halftone.json .design/halftone-native.svg
node tools/design.mjs preview examples/graphics/rahoo-halftone.json .design/halftone-native.png
node tools/design.mjs rahoo-verify .design/rahoo-parity/results.json
```

项目的 `vendor/rahoo/` 目录提供从官网获取的锁定版本，包含页面入口、脚本、样式及字体。加载时校验每个文件的 SHA-256。运行时从本地加载。需要另外下载一份同一版本时，可用 `rahoo-sync <目录>`，并用 `--source-cache` 指定该目录。自动化命令使用与原型评审命令相同的 Chromium 选择方式。[官方发布构建](https://rahoo.online/assets/index-DmH-F12K.js)

`rahoo-inspect <generator>` 输出原生参数组、当前默认值与格式列表。也可用 `rahoo-inspect spec.json` 查看应用特定配置后的值。传入的 `settings` 只需写需要修改的字段，列出数组的设置会整体替换。程序校验顶层字段和设置组，启动源站引擎后再核对内层字段和类型。需要浏览器控件的输入范围约束时，用 `actions` 操作相应控件。标准 SVG 合成继续通过 `GraphicSpec` 表达。

## 参数、画布与输出

| 功能 | 使用方法 |
| --- | --- |
| 同心圆、半调、HUD 等通用图元 | 在 `settings.params` 内调用原站字段。示例里的 `strokeAlign: "outer"` 由源站半调算法处理。 |
| 条形码 | `settings.mode` 选择 `barcode`、`spectrum` 或 `ruler`，分别使用 `settings.barcode`、`settings.spectrum` 和 `settings.ruler`。 |
| 3D 等高线 | `settings.mode` 设为 `pro`，另在 `proSettings` 使用原站参数和相机字段。 |
| 流光固定帧 | 用 `frameMs` 指定 WebGL 画面的时间，单位毫秒。 |
| 上传、点选、拖拽 | 用 `actions` 记录原站动作。支持 `click`、`fill`、`press`、`upload`、`drag` 和 `waitFor`。点击可按原站文本或定位器选择。上传路径相对于规格文件。 |
| SVG | `generate <spec.json> <output.svg>` 点击原版「导出 SVG → 保存」，将实际下载的文件原样写到输出路径。 |
| PNG | `generate <spec.json> <output.png>` 返回场景画布。规格中的宽高为浏览器视口，画布像素取决于源站布局。 |
| 原生文件导出 | 通过 `download` 调用对应按钮，可取得源站保存的 PNG、ASCII TXT 或动画文件。MP4 取决于 Chromium 的 H.264 编码支持。 |

流光录制的规格示例如下。

```json
{
  "kind": "RahooSpec",
  "version": 1,
  "generator": "dynamicLight",
  "settings": { "loopDuration": 1 },
  "actions": [{ "do": "click", "text": "导出 WebM" }],
  "download": { "text": "录制" }
}
```

输出路径使用 `.webm` 后缀。导出阶段让原站控制时间进程，规格省略 `frameMs`。嵌套图形通过 `settings.timeline` 提交原站关键帧，`actions` 打开“动画”，再用 `download.text` 选择“导出 GIF”或“导出视频”。`rahoo-inspect nestedPolygons` 可读取可配置的帧率、尺寸和背景。

## 一致性验收

`rahoo-verify` 使用同一发布构建、同一 Chromium、视口和种子运行两次基线。一边直接运行发布代码，一边启用 toolkit 的参数入口。测试逐项比较画布 PNG 和原站可提供的 SVG 的 SHA-256，并检查更改参数确实会改变输出。几项重要模式另外通过原站控件操作进行对照，导出测试检查文件类型与可复现的内容。

Windows 上的 Chromium 159.0.4402.13 共通过 **29 项**。20 种图元的测试画布 PNG 哈希一致，其中 18 种也通过原站 SVG 字节比对。5 项附加对照覆盖同心圆圈数、条形码的频谱和标尺、专业等高线和指定时刻的 WebGL 流光。另验证了 WebM、GIF、MP4 和 ASCII TXT 的原生导出。Codex 与通过 DeepSeek Harness 原生 Bash 执行的半调 SVG 也逐字节一致。[自动验收报告](rahoo-native-results.json)

验收结论绑定到报告记录的浏览器和构建。WebGL 驱动、字体、窗口尺寸与视频编码环境都可影响输出，旧版 `GraphicSpec` 图册中的独立 SVG 图形也有单独的实现差异。[独立 SVG 图元状态](generator-status.md)
