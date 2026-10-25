# 05 · 画风库：10 种可执行的风格配方

> 每种风格 = 色板 + 材质 + 光 + 镜头 + 字体 + 后处理 + 场景原型。
> 选一种，写进 `art-direction.json`，全片不许漂移。

## 5.0 怎么选风格

不要问用户「喜欢什么风格」，给他三张风格帧。内部选择时看这张表：

| 歌的气质 | 首选 | 次选 | 避免 |
|---|---|---|---|
| 抒情、慢、人声为主 | 01 墨海月信 / 09 自然纪录 | 02 胶片雨城 | 07 故障 |
| 城市、怀旧、雨夜 | 02 胶片雨城 | 10 黑白剪影 | 03 星海 |
| 宏大、弦乐、史诗 | 03 星海史诗 | 01 墨海 | 04 极简 |
| 电子、节奏强、无词 | 04 极简排版 / 07 故障 | 08 液态金属 | 09 自然 |
| 民谣、手作、温暖 | 05 纸雕剧场 | 06 蓝晒 | 08 金属 |
| 冷、理性、设计感 | 06 蓝晒 / 04 极简 | 08 金属 | 05 纸雕 |
| 痛、撕裂、摇滚 | 07 故障 / 10 剪影 | 02 胶片 | 05 纸雕 |
| 未来、欲望、夜店 | 08 液态金属 | 07 故障 | 01 墨海 |

**混搭规则**：70% 主风格 + 20% 辅助材质 + 10% 一个反差点。
例如「墨海 + 10% 故障」= 在墨色里偶尔出现一次扫描线撕裂，作为峰值。
**不要 50/50**，那会变成两部片。

---

## 5.1 墨海月信（Ink & Moon）

**一句话**：宣纸、墨、银月、火漆红；一切都在缓慢呼吸。

| 项 | 配方 |
|---|---|
| 色板 | `#06080d` 墨黑 · `#1b2433` 深海蓝 · `#c9d3e0` 银 · `#e8e2d4` 宣纸 · `#b3342c` 火漆红 |
| 材质 | 纸（粗糙、纤维、微透光）、墨（半透明、边缘扩散）、银（低粗糙度、无彩色反射）、蜡（次表面感） |
| 光 | 顶部柔光 5600K，低对比（0.6–0.75），无体积光；月亮作为唯一硬光源 |
| 镜头 | 35/50/85mm，缓慢推/环绕/升降；抖动 0.03；禁止快速变焦 |
| 字体 | 思源宋体 300（中文） + Cormorant Garamond Italic（英文）；字距 +0.08em |
| 后处理 | Bloom 0.28 @ threshold 0.82；颗粒 0.035；暗角 0.35；色差 0.0008；转场 ink/fade |
| 原型 | 墨滴扩散、海面信件、纸鱼、纸阶、红线、镜面、月光门 |
| 参考实现 | `examples/letter-to-the-moon`（本项目） |

实现要点：

- 墨的扩散用 **fbm + 域扭曲**，不要用贴图序列（会循环穿帮）。
- 纸张用 `MeshStandardMaterial` + 噪声 roughnessMap；背光时开 `transmission` 或假 SSS。
- 月亮不是圆盘，是「有大气散射的球」：边缘亮、中心略暗，加一层菲涅尔光晕。
- 红色只出现在火漆/绳/印，面积 <5%；它是全片的「心跳」。
- 水面用两层法线噪声（不同速度）+ 菲涅尔；不要用镜面反射贴图，会假。

可抄的轮子：

- 噪声/着色器基础：[thebookofshaders](https://github.com/patriciogonzalezvivo/thebookofshaders)、[glsl-noise](https://github.com/hughsk/glsl-noise)
- 后处理：[pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
- 文字：[troika-three-text](https://github.com/protectwise/troika)
- 纸材质参考：three.js `webgl_materials_physical_transmission`

坑：

- 墨的透明排序会闪；用 `depthWrite:false` + 固定 renderOrder。
- 纸张在 Bloom 下容易过曝；把纸的白控制在 0.75 以下。
- 水下场景的雾会把红色吃掉；红色材质的 emissive 要给 0.05–0.1。

---

## 5.2 胶片雨城（Film Noir City）

**一句话**：雨、霓虹、颗粒、手持；城市是一个会呼吸的伤口。

| 项 | 配方 |
|---|---|
| 色板 | `#0a0b0e` 夜 · `#1d2a33` 青灰 · `#d9a441` 钠灯 · `#c2452d` 霓虹红 · `#e6e1d6` 湿白 |
| 材质 | 湿沥青（高反射、粗糙度不均）、玻璃（雨痕）、金属（锈）、布料（伞） |
| 光 | 侧逆光为主，钠灯 2700K + 霓虹 6500K 混合；高对比 0.85；体积光/雨雾 |
| 镜头 | 35/50mm，手持或稳定器；轻微变焦（≤5°）；抖动 0.05；允许一次甩镜 |
| 字体 | 窄体无衬线（如 Oswald/思源黑体 Condensed）；全大写英文；字幕带黑底 |
| 后处理 | 颗粒 0.06；暗角 0.45；色差 0.0015；halation（高光红色溢出）；LUT 偏青绿 |
| 原型 | 雨巷、霓虹招牌、车窗、天台、积水倒影 |
| 参考 | 《堕落天使》《银翼杀手》夜景；three.js `webgl_materials_envmaps` |

实现要点：

- 雨用 GPU 粒子（点精灵拉长）+ 屏幕空间雨痕；不要用几千个 Mesh。
- 湿地面的反射用平面反射（`Reflector`）或 SSR；低预算用「倒置复制 + 模糊」。
- 霓虹的 halation 比 Bloom 更重要：高光先阈值，再单独模糊，再叠加。
- 手持抖动频率略高（1.2–2Hz），幅度 0.04–0.06，模拟呼吸。
- 色彩：阴影偏青绿，高光偏钠黄；中间调去饱和。

可抄的轮子：

- 平面反射：three.js `Reflector`
- 粒子：[three-nebula](https://github.com/creativelifeform/three-nebula)、[tsparticles](https://github.com/tsparticles/tsparticles)
- 后处理 halation：pmndrs/postprocessing 的 `BloomEffect` + 自定义
- 相机控制：[camera-controls](https://github.com/yomotsu/camera-controls)

坑：

- 反射 + 透明雨 = 排序灾难；雨用加色混合，关深度写入。
- 霓虹过曝会糊成白块；把颜色亮度压到 0.8，用 Bloom 提亮。
- 手持 + 运动模糊缺失会「抖得生硬」；加 0.5 帧的屏幕空间拖影。

---

## 5.3 星海史诗（Cosmic Epic）

**一句话**：人很小，光很远；镜头一直在上升。

| 项 | 配方 |
|---|---|
| 色板 | `#02030a` 真空 · `#0d1b3a` 深蓝 · `#4a7fb5` 大气蓝 · `#f2e9d8` 星光 · `#d98e4a` 恒星橙 |
| 材质 | 星尘（加色点）、气体（体积/噪声）、冰（高光）、金属（飞船） |
| 光 | 单一强光源（恒星/月亮），极低环境光；高对比 0.9；体积光 + 镜头光晕（克制） |
| 镜头 | 24/35mm 广角，缓慢升降/拉远；抖动 0.01；允许一次急速俯冲 |
| 字体 | 细无衬线（Helvetica Neue Light / 思源黑体 ExtraLight）；全大写；字距 +0.2em |
| 后处理 | Bloom 0.45；颗粒 0.02；暗角 0.3；色差 0.0005；星芒（diffraction spikes） |
| 原型 | 星海、行星地平线、月门、坠落隧道、破水 |
| 参考 | 《星际穿越》对接；three.js `webgl_points_sprites`、`webgl_shaders_sky` |

实现要点：

- 星空用 3 层：远层（静态点）、中层（缓慢视差）、近层（少量大颗粒 + 星芒）。
- 星云用 raymarching 或 2D fbm 贴在球壳上；注意性能，半分辨率渲染。
- 尺度感靠「前景小物体 + 远处大物体」；没有前景，星球会像贴纸。
- 恒星的光晕分三层：核心（白）、光晕（暖）、大气散射（冷）。
- 镜头上升时，星星要有视差；否则像在移动背景图。

可抄的轮子：

- 天空/大气：three.js `Sky`、[three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples)
- 星尘：[tsparticles](https://github.com/tsparticles/tsparticles)
- 体积光：pmndrs/postprocessing 的 `GodRaysEffect`
- 星芒：自定义卷积或 `UnrealBloomPass` + 十字模糊

坑：

- 星星太密会像噪声；远层控制在 3000–6000 点。
- Bloom 会把星星糊成雾；threshold 要高（0.85+），strength 要低。
- 太空里的「黑」不是纯黑；给 0.005 的蓝，避免死黑。

---

## 5.4 极简排版（Swiss Kinetic Type）

**一句话**：网格、黑白、一个字就是一座建筑。

| 项 | 配方 |
|---|---|
| 色板 | `#f4f1ea` 纸白 · `#111111` 墨黑 · `#e63946` 强调红（仅一处）· 无渐变 |
| 材质 | 纯色、纸张纹理（极轻）、无高光 |
| 光 | 平光，无阴影；靠排版和比例制造张力 |
| 镜头 | 固定或极慢平移/缩放；焦段 50mm 等效；无抖动 |
| 字体 | Helvetica/Inter/思源黑体；字重对比（200 vs 800）；网格 12 列；字距严谨 |
| 后处理 | 无 Bloom；颗粒 0.015；暗角 0；轻微纸张纹理叠加 |
| 原型 | 字谷、字墙、字幕即画面、几何遮罩、网格破裂 |
| 参考 | 瑞士国际主义、Kinetic Typography；[troika-three-text](https://github.com/protectwise/troika)、[opentype.js](https://github.com/opentypejs/opentype.js) |

实现要点：

- 排版先做 2D（HTML/SVG/Canvas），确认网格与断行，再进 3D。
- 3D 文字用 SDF/MSDF；中文用预生成图集或 troika。
- 一个字的变化（字重/字距/大小）比十个特效更有力。
- 红色只出现一次；它是全片的标点。
- 运动用「网格位移」：整行字以不同速度平移，制造视差。

可抄的轮子：

- 文字渲染：[troika-three-text](https://github.com/protectwise/troika)、[msdfgen](https://github.com/Chlumsky/msdfgen)
- 字体子集：[fonttools](https://github.com/fonttools/fonttools)
- 2D 排版：[Curtains.js](https://github.com/martinlaxenaire/curtainsjs)、[PixiJS](https://github.com/pixijs/pixijs)
- 网格/布局：自己写，不要引框架

坑：

- 中文字体文件巨大；必须子集化（只保留用到的字）。
- SDF 文字在极小字号会糊；小字用 Canvas 纹理。
- 纯黑白容易「像 PPT」；加入一个材质反差点（纸纹/噪点/一次红色）。

---

## 5.5 纸雕剧场（Paper Theater）

**一句话**：所有东西都是纸做的，光从纸后面透过来。

| 项 | 配方 |
|---|---|
| 色板 | `#f2e8d5` 米白 · `#d9c7a7` 牛皮 · `#8c6f4e` 深棕 · `#2f3b45` 蓝灰 · `#c85a3f` 朱红 |
| 材质 | 卡纸（厚、哑光）、瓦楞纸（条纹）、半透明描图纸、线 |
| 光 | 背光/侧光，暖 3200K；软阴影；纸边缘有透光（SSS 近似） |
| 镜头 | 35/50mm，微距推近；固定机位多；轻微的定格动画感（12fps 抽帧） |
| 字体 | 手写/活字感衬线；印章式红字；不要无衬线 |
| 后处理 | 颗粒 0.04；暗角 0.4；轻微纸张纹理；无 Bloom（或极低） |
| 原型 | 立体书、纸阶、纸鹤、纸海、纸城门 |
| 参考 | 纸雕动画、立体书；three.js `webgl_materials_cubemap_dynamic` |

实现要点：

- 纸的厚度必须可见：用挤出几何 + 边缘暗线，不要用平面。
- 透光：`MeshPhysicalMaterial` 的 `transmission` + `thickness`，或自定义 SSS。
- 阴影要软：PCFSoft + 大面积光源；硬阴影会像塑料。
- 定格感：每 2 帧更新一次动画（12fps），并加极轻的位移抖动。
- 层次：前景纸框、中景主体、背景纸幕，三层足够。

可抄的轮子：

- 纸张纹理：[ambientCG](https://ambientcg.com)（CC0）
- 阴影：three.js `PCFSoftShadowMap`
- 几何：three.js `ExtrudeGeometry` + `Shape`
- 定格：自己写时间量化

坑：

- 纸的白色在暖光下会变黄；色板要预先偏暖。
- 透光材质性能差；限制使用面积。
- 纸雕最怕「太干净」；加毛边、折痕、指纹。

---

## 5.6 蓝晒蓝图（Cyanotype / Blueprint）

**一句话**：世界是一张工程图，情感是手写的批注。

| 项 | 配方 |
|---|---|
| 色板 | `#0b2e4f` 普鲁士蓝 · `#1f5f8b` 中蓝 · `#a8c8d8` 浅蓝 · `#f0ede4` 纸白 · `#d9822b` 标注橙 |
| 材质 | 蓝晒纸（不均匀、边缘深）、白色线条、手写墨迹、半透明描图 |
| 光 | 平光/扫描光；无立体阴影；靠线条密度 |
| 镜头 | 固定、正交投影（OrthographicCamera）；缓慢平移/缩放；无抖动 |
| 字体 | 等宽打字机 + 手写体；标注线/箭头/尺寸数字 |
| 后处理 | 蓝晒色调映射；颗粒 0.03；暗角 0.3；轻微污渍/曝光不均 |
| 原型 | 蓝图房间、爆炸图、尺寸标注、网格地图、手写批注 |
| 参考 | 工程制图、Anna Atkins 蓝晒；three.js `webgl_lines_dashed` |

实现要点：

- 用正交相机，透视会破坏「图纸感」。
- 线条用 `Line2`/`LineMaterial` 支持粗细；原生 `LineBasicMaterial` 只有 1px。
- 蓝晒的不均匀：用大尺度噪声乘颜色，不要纯色。
- 标注（尺寸线、箭头、手写）是灵魂；没有标注就像蓝色线框。
- 可以叠加一个「纸张卷曲」的顶点位移（极轻）。

可抄的轮子：

- 粗线：three.js `Line2` / `LineSegments2`
- 正交交互：[camera-controls](https://github.com/yomotsu/camera-controls)
- 手写字体：Google Fonts（OFL）如 Caveat
- 纹理：[ambientCG](https://ambientcg.com)（CC0）

坑：

- 蓝色容易偏紫；色板写死 hex，不要靠调色。
- 线条太密会摩尔纹；开 MSAA + 控制线宽。
- 正交下 Bloom 会很脏；不用或极低。

---

## 5.7 模拟故障（Analog Glitch）

**一句话**：信号在坏掉，情绪在泄漏。

| 项 | 配方 |
|---|---|
| 色板 | `#050505` 黑 · `#e8e8e8` 白 · `#ff2e63` 品红 · `#08f7fe` 青 · `#f9f871` 黄（警告） |
| 材质 | 扫描线、噪点、色带、压缩块、CRT 曲面 |
| 光 | 自发光为主；高对比；过曝允许 |
| 镜头 | 手持/固定；突然的位移/跳切；抖动 0.06；允许 1–2 帧错位 |
| 字体 | 等宽/像素字体；OSD 风格；错位重影 |
| 后处理 | RGB split、scanlines、block glitch、VHS 抖动、色带、noise |
| 原型 | 监控画面、磁带、信号中断、故障人脸、数据流 |
| 参考 | [Hydra](https://github.com/hydra-synth/hydra)（**AGPL**，只学思路）、[Butterchurn](https://github.com/jberg/butterchurn)（MIT） |

实现要点：

- 故障要**有节奏**：在强拍前 1–2 帧触发，持续 2–6 帧，然后恢复。
- 三种故障足够：水平位移、RGB split、块状错位。不要全上。
- 扫描线用 `sin(uv.y * 分辨率 * PI)`，避免摩尔纹。
- 压缩块：把画面按 8×8/16×16 量化 UV 再采样。
- 加一层 CRT 曲面（桶形畸变）会更真，但会裁边。

可抄的轮子：

- Butterchurn（Milkdrop 移植，MIT）：https://github.com/jberg/butterchurn
- glsl 噪声：[glsl-noise](https://github.com/hughsk/glsl-noise)
- 后处理：[pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)
- 注意：Hydra 是 **AGPL-3.0**，嵌入网页会触发网络分发条款；只可学习。

坑：

- 闪烁可能触发光敏性癫痫；全片闪白/高频闪烁必须过 09 章的 photosensitivity 检查。
- 故障太多会掩盖音乐；每段最多 1 次。
- RGB split 在 2.39:1 边缘会露黑边；采样时 clamp。

---

## 5.8 液态金属（Liquid Chrome）

**一句话**：欲望有形状，它一直在流动。

| 项 | 配方 |
|---|---|
| 色板 | `#0a0a0c` 黑 · `#c7ccd4` 冷银 · `#6f7f92` 钢蓝 · `#f4f0e6` 高光 · `#b03a48` 暗红（可选） |
| 材质 | 铬（金属度 1、粗糙度 0.05–0.15）、汞（高张力、镜面）、玻璃 |
| 光 | 环境贴图为主（HDRI），加 2–3 个条形灯；高对比；无漫反射 |
| 镜头 | 50/85mm，缓慢环绕/推近；微距看流动；抖动 0.02 |
| 字体 | 极细无衬线/定制字标；金属质感仅用于片名 |
| 后处理 | Bloom 0.35；色差 0.001；颗粒 0.02；暗角 0.4 |
| 原型 | 液态球、金属花、铬海、镜面人、熔融字 |
| 参考 | three.js `webgl_materials_envmaps`、[drei MeshTransmissionMaterial](https://github.com/pmndrs/drei) |

实现要点：

- 没有 HDRI 就没有金属；至少用 `RoomEnvironment` 或程序化环境。
- 液态变形用顶点噪声 + 法线重算；不要只用 scale。
- 高光要有「条纹灯」反射，否则像塑料。
- 金属的暗部要有环境色，不能死黑。
- 片名金属化：法线贴图 + 环境反射；不要用渐变假金属。

可抄的轮子：

- 环境：three.js `RoomEnvironment`、[Poly Haven](https://polyhaven.com)（CC0 HDRI）
- 材质：[pmndrs/drei](https://github.com/pmndrs/drei)（React；思路可移植）
- 后处理：[pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)

坑：

- 金属 + Bloom 容易过曝；把环境亮度压到 0.6。
- 顶点噪声会让法线错；用 `computeVertexNormals()` 或解析法线。
- 液态金属看久了会腻；用它做「峰值」，不要全片。

---

## 5.9 自然纪录（Nature Doc / Macro）

**一句话**：把一滴水拍成一颗行星。

| 项 | 配方 |
|---|---|
| 色板 | `#0d1512` 深林 · `#3f5b45` 苔绿 · `#b7c9a8` 叶 · `#e8d9b5` 日光 · `#8a5a3b` 土 |
| 材质 | 水（透明、表面张力）、叶（次表面散射）、尘（粒子）、玻璃 |
| 光 | 自然光/逆光；暖 5000K；浅景深；体积光（丁达尔） |
| 镜头 | 85/100mm 微距，极慢推；固定机位多；抖动 0.01 |
| 字体 | 细衬线/手写；字幕像标本标签 |
| 后处理 | Bloom 0.2；颗粒 0.025；暗角 0.3；轻微色差；无强风格化 |
| 原型 | 露珠、叶脉、昆虫、水面、花粉、雪 |
| 参考 | BBC Earth；three.js `webgl_materials_physical_transmission` |

实现要点：

- 微距的景深必须真实；用 CoC + 分层模糊。
- 水的表面张力：球冠几何 + 菲涅尔 + 环境折射。
- 逆光下的叶脉：transmission + thickness map。
- 尘粒是尺度感的关键；在光束里加 200–500 个加色点。
- 运动要「有生命但慢」：植物微动 0.1Hz，水滴 0.5Hz。

可抄的轮子：

- 纹理：[Poly Haven](https://polyhaven.com)、[ambientCG](https://ambientcg.com)（CC0）
- 粒子：[tsparticles](https://github.com/tsparticles/tsparticles)
- 景深：three.js `BokehPass`
- 色彩：[colour-science](https://github.com/colour-science/colour)（BSD-3）

坑：

- 微距下的噪点会被放大；提高采样/降噪。
- 透明物体的排序；用 `transmission` 时注意性能。
- 自然纪录最怕「假」；宁可少放模型，多用光和雾。

---

## 5.10 黑白剪影（Silhouette / Shadow Play）

**一句话**：只剩轮廓，情绪反而更清楚。

| 项 | 配方 |
|---|---|
| 色板 | `#000000` 黑 · `#f5f2ea` 暖白 · `#8c8c8c` 中灰（仅过渡）· 一个强调色（可选） |
| 材质 | 纯黑剪影、磨砂玻璃、烟/雾 |
| 光 | 强逆光；主体全黑；背景有渐变/光晕 |
| 镜头 | 35/50mm，固定或横移；构图对称；抖动 0 |
| 字体 | 极简无衬线/衬线；大字；高对比 |
| 后处理 | 无 Bloom（或极低）；颗粒 0.03；暗角 0.5 |
| 原型 | 门框剪影、窗、树、舞者、雨伞、鸟群 |
| 参考 | 皮影戏、Film Noir；three.js `webgl_postprocessing_outline` |

实现要点：

- 剪影的轮廓必须可读；先做 2D 黑白草稿，再建模。
- 逆光用大面积光源 + 雾；主体材质 `color:0x000000, roughness:1`。
- 背景渐变是唯一「颜色」；用径向渐变 + 噪声。
- 运动要慢；剪影的快速运动会变成闪烁。
- 强调色最多一处（一只红鞋/一盏灯）。

可抄的轮子：

- 轮廓：three.js `OutlinePass` / 反向外壳
- 雾：three.js `FogExp2` + 自定义体积雾
- 排版：[troika-three-text](https://github.com/protectwise/troika)

坑：

- 纯黑主体在暗背景里会消失；背景亮度要够。
- 剪影 + 颗粒容易脏；颗粒降低到 0.02。
- 没有颜色时，构图和节奏必须更强；否则会闷。

---

## 5.11 风格锁：把配方变成 `art-direction.json`

```json
{
  "style": "ink-moon",
  "palette": ["#06080d", "#1b2433", "#c9d3e0", "#e8e2d4", "#b3342c"],
  "materials": ["paper", "ink", "silver", "wax"],
  "forbidden": ["plastic specular", "saturated neon", "lens flare", "fast zoom"],
  "light": { "direction": "top", "kelvin": 5600, "contrast": 0.7, "volumetric": false },
  "lens": { "focal": [35, 50, 85], "shake": 0.035, "maxRoll": 0.03 },
  "type": {
    "cjk": "Noto Serif SC", "latin": "Cormorant Garamond",
    "weights": [300, 400], "tracking": 0.08
  },
  "post": {
    "bloom": 0.28, "bloomThreshold": 0.82, "grain": 0.035,
    "vignette": 0.35, "aberration": 0.0008, "toneMapping": "ACES"
  },
  "transitions": ["cut", "ink", "fade", "dip", "iris", "flash"]
}
```

字段含义与校验见 `schemas/art-direction.schema.json`。

## 5.12 风格漂移的五个信号

1. 新场景的色板多了一个高饱和色。
2. 镜头开始用「快速变焦」而设定里禁止。
3. 字体换了一个「更好看」的。
4. 转场多了一种「很酷」的。
5. 颗粒/Bloom 每场景不同。

出现任意一条，停下来，回到 `art-direction.json`，改回来或正式修订（写 changelog）。
