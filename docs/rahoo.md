# Rahoo 图形目录与参数对照

[逐项实现状态与浏览器截图](generator-status.md)覆盖全部内置图元、补充变体及插件示例。

[RahooSpec 原生渲染](rahoo-native.md)可直接调用锁定的发布版本。下表对应 toolkit 自带的 GraphicSpec SVG 算法。

2026-11-22 检查了 Rahoo 设计工具的公开 Web 构建。主页加载 `index-DK0-HGj1.js`，设计工具路由加载 `index-DmH-F12K.js`，SHA-256 为 `dd80e9b7c827e175fbe6159bd9de3dc7051036fd713e203dfbeb9f2802fd39c6`。静态检查了图形注册表、组件默认值与条件控件。项目通过独立的 SVG 算法离线运行。[设计工具](https://rahoo.online/design-tool) · [公开构建](https://rahoo.online/assets/index-DmH-F12K.js)

| 图形 | CLI 中的主要参数或状态 | 实现边界 |
| --- | --- | --- |
| `concentricCircle` 同心圆 | 内外半径与笔宽、圈数、角度、实线与虚点线 | 使用 SVG 描边 |
| `halftone` 半调 | 网格、形状、梯度、固定大小、掩膜与采样，珠模式 | 图像用 `pixels`，描边对齐和明暗映射近似 |
| `hudLines` HUD 线 | 弧或直线、凹槽、双缺口、端头、副线、图层 | 曲线缺口、端头和填充独立重绘 |
| `scaleCircle` 刻度圆 | 刻度个数、对齐、长短、正弦、抖动和图层 | 抖动由配置种子确定 |
| `barcode` 条形码 | 字符条纹、频谱条、刻度尺、虚线块、颜色渐变 | 字符条纹用于图形构成，扫码兼容性待验证 |
| `waveTexture` 波浪 | 振幅、频率、间距、线宽和背景 | 使用折线采样 |
| `linePattern` 重复线 | 方向、角度、间距、线宽、环形及图像剪裁 | 使用 SVG pattern |
| `dotMatrix` 点阵 | 点形、尺寸与透明度、裁剪、路径节点和参考图 | 用坐标组替代编辑器手势，拐角及布局近似 |
| `polygonGrid` 多边形网格 | 网格类型、单元比例、填充颜色、描边、显式选区 | 手势编辑状态用单元坐标表达 |
| `contour` 等高线 | 经典和专业模式、填充、分层样式、地形笔刷、角度与相机 | 两个模式共用等值线取样；专业相机为 SVG 投影近似 |
| `normalShape` 常见图形 | 箭头、斜线、括号、十字、四角星等及各自尺寸 | 多分支的尺寸用前缀区分，部分圆角和描边独立实现 |
| `nestedPolygons` 嵌套图形 | 边数、旋转、半径步长、线宽、渐变和时间关键帧 | 输出所选时间的 SVG 帧 |
| `globeSphere` 经纬球 | 轴长、经纬密度、纬线斜率、线宽 | SVG 椭圆线 |
| `squareGrid` 方形网格 | 预设、基准线、斜线、节点、角标、填充 | `fills` 按行列指定各格的点或线 |
| `rays` 射线 | 宽度、张角、随机、速度线、长度、对称、渐变 | 部分端帽与速度线算法近似 |
| `y2kRing` 星环 | 椭圆、方向、断口、多颗星、卫星、自定义图章 | 自定义图章用 `stampPaths` 和宽高描述 SVG 路径 |
| `ringArray` 环形排列 | 形状、间距、步长、半径、旋转、渐变 | 随机半径由配置种子确定 |
| `fakeCode` 模拟编码 | 块、间隙、词长、对齐、随机透明度与分档 | 使用独立的确定性随机算法 |
| `ascii` ASCII | 字符集、列数、字号、亮度、对比度、取色、色调 | 支持灰度和像素矩阵输入 |
| `dynamicLight` 流光 | 流光/火焰、速度、噪声、颜色、时间和循环 | SVG 帧近似，原站 WebGL 着色器和视频编码待比对 |

**额外 SVG 原语** `arcs`、`measurementGuides`、`gridField`、`registrationMarks`、`geometricMask`、`typographyOutlines`、`technicalLabels`、`signalBars`、`waveform`。

`catalog <generator>` 显示本项目可用的全部字段。当前证据覆盖 20 项图形类型与已枚举的参数集合。全部控件、默认值、约束、交互状态与像素输出的逐项一致性仍待验证。后续可为每个图形增加源站输入与本地 SVG 的成对样例，并逐项检查选项、组合条件和输出。原站的页面缩放、下载开关、PNG 倍率、录制和手势属于编辑器层。
