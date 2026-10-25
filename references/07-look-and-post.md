# 07 · 质感与后处理：颜色、光、字

> 「高级感」不是一种滤镜，是**一致的物理 + 克制的对比 + 精确的文字**。

## 7.1 色彩管线：先对，再美

Three.js r152+ 默认：

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
```

三条硬规则：

1. **贴图颜色**（albedo）用 `SRGBColorSpace`；**数据贴图**（normal/roughness/metalness/AO）
   用 `NoColorSpace`。
2. **光照在线性空间计算**，色调映射在最后一步。不要在材质里手动 gamma。
3. **后处理链在线性空间**（Bloom），**颗粒/暗角/色差在显示空间**（tone map 之后）。

推荐顺序：

```
Scene render (linear HDR)
  → Bloom (linear, threshold in linear)
  → Tone mapping (ACES)
  → Exposure / contrast / saturation (display-referred)
  → Vignette / grain / chromatic aberration
  → Transition (ink/flash/iris)
  → Output (sRGB)
```

如果你把颗粒放在 tone mapping 之前，它会被压暗、变脏；如果放在 Bloom 之前，
它会被放大成噪点。**颗粒永远是最后一步**（除了转场）。

## 7.2 曝光与对比

- 曝光不是「亮度」，是「中灰落在哪」。先让主体中灰落在 0.18–0.22（线性），再调对比。
- 对比 1.0–1.08 足够；超过 1.15 会压死暗部。
- 饱和度 0.9–1.05；风格化可以 0.7（墨/黑白）或 1.2（霓虹）。
- 黑位不要 0；留 0.01–0.02 的蓝/棕，避免死黑。
- 白位不要 1；高光留 0.95，给 Bloom 余量。

**判断方法**：把画面缩到 320px 宽，眯眼看。如果只剩一片灰，说明对比不够；
如果暗部糊成一团，说明黑位太低。

## 7.3 Bloom

Bloom 是最容易被滥用的效果。它应该模拟「镜头/眼睛在高光周围的光晕」，不是「让画面发光」。

| 参数 | 建议 | 说明 |
|---|---|---|
| threshold | 0.75–0.9 | 只让真正的高光溢出；太低会让整个画面发灰 |
| strength | 0.15–0.45 | 抒情 0.2–0.3；霓虹/星海 0.35–0.5 |
| radius | 0.5–0.8 | 太小像描边，太大像雾 |
| resolution | 0.5× | 半分辨率足够，性能好 |

规则：

- 全片 Bloom 强度只能随段落能量变化（±0.1），不能每场景不同。
- 峰值可以让 Bloom 瞬时 +0.1，持续 0.3 秒，然后回落。
- 白色文字不要 Bloom 太强；会糊成光斑。
- 月亮/门/星海可以强 Bloom；纸张/皮肤不可以。

## 7.4 颗粒（Grain）

颗粒是「胶片感」的核心，但必须**低对比、随亮度变化、逐帧变化**。

```glsl
float grain = hash12(gl_FragCoord.xy + uTime * 137.0) - 0.5;
float luma = dot(color, vec3(.299, .587, .114));
float amount = uGrain * (0.35 + 0.65 * (1.0 - luma)); // 暗部颗粒更明显
color += grain * amount;
```

- 强度 0.02–0.045；超过 0.05 会像电视雪花。
- 颗粒尺寸：以 1080p 为基准 1px；4K 下要放大到 1.5–2px，否则看不见。
- 不要在暗部加纯白噪声；会破坏黑位。
- 导出后 H.264 会平滑颗粒；如果要保留，CRF ≤18 或加 `-tune grain`。

## 7.5 暗角、色差、halation

| 效果 | 建议 | 作用 | 陷阱 |
|---|---|---|---|
| 暗角 | 0.25–0.45，柔和 | 聚焦中心 | 太强像望远镜 |
| 色差 | 0.0005–0.0015 | 镜头感 | 2.39:1 边缘会露黑边 |
| halation | 高光阈值 0.8，红色偏移 | 胶片/霓虹 | 全片开会腻 |
| 扫描线 | 0.02–0.05 | CRT/故障 | 会摩尔纹 |
| 运动模糊 | 0.5–1 帧 | 速度感 | 渲染成本高；可用后期方向模糊替代 |

色差的正确做法：按到画面中心的距离采样 R/B 通道，**不是**整体偏移。

## 7.6 景深与运动模糊

- 微距必须景深；广角不必。
- 景深用 CoC（circle of confusion）：`coc = abs(z - focus) / z * strength`。
- 焦点转移要 `lerp`，不要跳。
- 运动模糊：真实渲染需要多采样；低成本用「沿速度方向 8 次采样」的后期。
- 粒子/透明物体在运动模糊下会拖尾；这是好事，但要让拖尾方向一致。

## 7.7 文字：比 3D 更容易毁掉质感

### 字体选择

| 用途 | 中文 | 英文 | 注意 |
|---|---|---|---|
| 抒情/文学 | 思源宋体 300 | Cormorant Garamond Italic | 字距 +0.06–0.1em |
| 现代/冷 | 思源黑体 200–400 | Inter / Helvetica | 字距 0 |
| 复古/城市 | 思源宋体 500 | Oswald / Playfair | 全大写 |
| 手作/纸雕 | 手写体（OFL） | Caveat | 少量使用 |

**不要**用系统默认字体（微软雅黑/宋体）做片名；它们会立刻暴露「网页感」。

### 加载与测量

1. 先用 `document.fonts.load()` 加载，再 `await document.fonts.ready`。
2. 用 `ctx.measureText()` 测实际宽度；不要用字符数 × 字号估算。
3. 中文的 `actualBoundingBoxAscent/Descent` 与英文不同；基线要分别调。
4. 字体子集化：只保留用到的字（fonttools `pyftsubset`），否则中文 woff2 会有 5–10MB。
5. 字体加载失败要有 fallback；但交付前必须确认 fallback 没有生效。

### 排版规则

- 片名：字距 0.1–0.2em，字号是正文的 3–5 倍，居中或严格左对齐。
- 字幕：中文 42–56px（1080p），英文 24–30px；行高 1.5。
- 一行中文 ≤18 字，英文 ≤42 字符；超过就断行。
- 断行不要在词中间（中文避免「的/了/是」开头）。
- 文字与背景的对比：ΔL ≥ 40；不够时加底板/阴影。
- 底板不要纯黑；用背景色加深 20%，柔边 40–80px。
- 字距（tracking）用手动逐字绘制，不要依赖 CSS `letter-spacing`（Canvas 不支持）。

```js
function drawTracked(ctx, text, cx, y, { tracking = 0, font }) {
  ctx.font = font;
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y);
    x += widths[i] + tracking;
  }
}
```

### Canvas 叠加 vs 场景内文字

| 方式 | 优点 | 缺点 | 适用 |
|---|---|---|---|
| Canvas 2D 叠加 | 清晰、排版精确、便宜 | 不参与景深/遮挡/Bloom | 字幕、片名、片尾卡 |
| SDF/MSDF 3D | 可透视、可发光、可遮挡 | 中文图集大、边缘可能糊 | 场景内的字、字城 |
| 贴图平面 | 最便宜 | 分辨率受限、透视模糊 | 远景招牌、墙面字 |

参考实现用 Canvas 2D 叠加做字幕/片名，用 3D 文字做场景元素。**字幕永远不要进 3D**，
否则会被景深/遮挡/色调映射毁掉。

### 字幕底板的自适应

底板透明度应由**局部背景亮度**决定：

```js
const lum = averageLuma(region);           // 0–1
const plate = smoothstep(.32, .66, lum);   // 亮背景才加底板
```

参考实现：`plate = smoothstep(.32,.66,lum) * .8`，渐变从 0.6× 到 0，柔边。
这样暗场景字幕干净，亮场景字幕可读。

## 7.8 分辨率、画幅与像素

- 固定内部渲染分辨率（本项目 1920×804），输出 canvas 按 DPR 缩放；**不要**让场景随窗口改变构图。
- 2.39:1 = 1920×804（精确 2.388）；不要用 1920×800（差 4px，缩放会糊）。
- 导出时用固定 viewport；不要依赖窗口大小。
- 截图/导出用 `preserveDrawingBuffer: true`，并在同一个任务里 `toDataURL`。
- 文字叠加要按渲染分辨率绘制，不要按 CSS 像素。

## 7.9 三条 look-dev 迭代法

1. **黑白迭代**：先把画面变成黑白，检查构图、明度层次、主体分离。黑白不过，彩色也救不了。
2. **缩略图迭代**：缩到 320px 宽，检查「第一眼看到什么」。如果第一眼不是主体，重做构图。
3. **并排迭代**：把当前帧与风格帧并排（同一尺寸），检查色温、对比、颗粒、暗角是否一致。

每次只调一个参数，记录在 `art-direction.json` 的 changelog。**不要在无 Bloom 的编辑器里
判断最终颜色**——后处理会改变一切。

## 7.10 色彩 QA

对每个段落抽 1 帧，检查：

- 黑位：最暗 1% 像素的亮度在 0.01–0.05（不是 0）。
- 白位：最亮 1% 像素在 0.85–0.98（不是 1）。
- 饱和度：平均饱和度在 0.15–0.45（黑白风格除外）。
- 色相：主色相不超过 3 个（色板约束）。
- 主体分离：主体区域的局部对比 ≥ 背景的 1.3 倍。

工具：

- `ffmpeg -vf signalstats` 看 YAVG/YMIN/YMAX。
- `ffmpeg -vf histogram` 或 `waveform` 可视化。
- Python/Pillow 计算直方图与平均饱和度。
- [colour-science](https://github.com/colour-science/colour)（BSD-3）做色度计算。
- [OpenColorIO](https://github.com/AcademySoftwareFoundation/OpenColorIO)（BSD-3）做 LUT/色彩管理。

## 7.11 质感的五个廉价信号

1. 纯黑背景 + 纯白文字（没有中间调）。
2. 均匀的 Bloom（整个画面发光）。
3. 完美对称、完美圆、完美直线（没有手工痕迹）。
4. 字体是系统默认。
5. 颗粒是静态的（每帧一样）。

修法：加一点噪声/污渍/不对称；Bloom 只给高光；字体子集 + 手动字距；颗粒逐帧变化。

## 7.12 抄作业：调色与后处理的现成实现

后处理是「装错一个 pass 就毁全片」的地方。下面这些实现都能直接读源码，
重点是**顺序**和**颜色空间**，不是效果多少。

| 环节 | 现成实现 | 许可 | 抄什么 | 别抄什么 |
|---|---|---|---|---|
| 合成通路 | three.js `EffectComposer` + `RenderPass` + `OutputPass` | MIT | 三段式通路；`OutputPass` 负责最终的 tone mapping + sRGB 转换 | 别在 `OutputPass` 之后再挂一个会做 tone mapping 的自写 pass |
| Bloom | `UnrealBloomPass`（three）/ `BloomEffect`（pmndrs） | MIT / Zlib | 半分辨率金字塔、threshold 在线性空间 | 别用 threshold 0；别把 Bloom 放在 tone mapping 之后 |
| 色调映射 | three.js `ACESFilmicToneMapping` / `AgXToneMapping`；[shaders-tone-map](https://github.com/dmnsgn/shaders-tone-map) | MIT | AgX 的高光滚降、ACES 的中灰 | 别在同一帧混用两套曲线 |
| LUT / 调色 | three.js `LUTPass` + `.cube`；[OpenColorIO](https://github.com/AcademySoftwareFoundation/OpenColorIO) | MIT / BSD-3 | 3D LUT 采样、LUT 生成流程 | 别在 sRGB 空间套 LUT；别用 8-bit 精度存 LUT |
| 颗粒 | [glsl-film-grain](https://github.com/mattdesl/glsl-film-grain)；drei `Noise` | MIT | hash 随亮度变化、逐帧变化 | 别用 `Math.random()`（不可复现）；别用静态噪声贴图 |
| 色差 | pmndrs `ChromaticAberrationEffect` | Zlib | 按到画面中心的距离采样 R/B | 别整体平移 RGB（会像重影不像镜头） |
| 景深 | three.js `webgl_postprocessing_dof`；pmndrs `DepthOfFieldEffect` | MIT / Zlib | CoC 计算与 bokeh 采样 | 别给透明/粒子写深度后再开 DOF（会出硬边） |
| 运动模糊 | pmndrs `MotionBlurEffect`（需速度缓冲） | Zlib | 按速度向量多次采样 | 别为省事用整屏方向模糊（转头时穿帮） |
| 抗锯齿 | `SMAAPass`；或 `WebGLRenderTarget({ samples: 4 })` | MIT | 后期 AA 用于无法开 MSAA 的通路 | 别同时开 MSAA 和 SMAA，白花性能 |
| 文字 | [troika-three-text](https://github.com/protectwise/troika)、[msdfgen](https://github.com/Chlumsky/msdfgen)、[opentype.js](https://github.com/opentypejs/opentype.js)、[fonttools](https://github.com/fonttools/fonttools) | MIT | SDF 图集、字距、子集化 | 别把字幕放进 3D（见 7.7） |
| 色彩 QA | `ffmpeg -vf signalstats`、[colour-science](https://github.com/colour-science/colour) | — / BSD-3 | 黑位/白位/饱和度统计 | 别只看平均亮度判断曝光 |

移植时按这个骨架接（three 官方顺序，r152+）：

```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // OutputPass 会读它
renderer.outputColorSpace = THREE.SRGBColorSpace;

const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }); // HDR，别用 8-bit
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));       // 渲染到 RT 时 three 自动跳过 tone mapping
composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), strength, radius, threshold));
composer.addPass(new OutputPass());                    // tone mapping + sRGB
// 颗粒/暗角/色差：自写 ShaderPass 挂在 OutputPass 之后（显示空间）
```

四条最容易踩的：

- **双重 tone mapping**：`renderer.toneMapping` 已设置，又在自写 final pass 里做一次 ACES → 高光死白、暗部发灰。
- **8-bit 中间缓冲**：Bloom 前就用 `UnsignedByteType`，高光一溢出就断层；用 `HalfFloatType`。
- **顺序错位**：颗粒放到 Bloom 前会被放大成噪点；暗角放到 tone mapping 前会压暗线性亮度，暗部直接死。
- **尺寸不同步**：`composer.setSize(w, h)` 与 `renderer.setSize` / DPR 不一致，画面会糊一层；固定内部署分辨率时两者都用同一组数。

