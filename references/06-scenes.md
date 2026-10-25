# 06 · 场景原型：12 个可以反复用的搭法

> 每个原型都是「参数化的搭建配方」，不是成品。换色板、换尺度、换机位，就能服务不同风格。

## 通用分层

任何场景都按这五层搭，顺序不要乱：

```
1. 背景   天空/雾/远山/纯色 —— 决定「世界有多大」
2. 中层   主体 + 主要环境 —— 决定「这是什么地方」
3. 前景   遮挡/粒子/光斑 —— 决定「我在哪里看」
4. 光     主光/补光/轮廓光 —— 决定「立体感与情绪」
5. 大气   雾/尘/体积光/水 —— 决定「空气的密度」
```

**先有背景与光，再放主体**。反过来做，主体永远像贴上去的。

性能基线（1920×804，单场景）：

- 三角形 < 15 万；draw call < 80；粒子 < 2 万（加色混合可到 5 万）
- 透明层 < 6 层；每层尽量合批
- 阴影贴图 ≤ 2048；只给主光开阴影
- 后处理链 ≤ 4 个 pass（Bloom + 最终合成算 2 个）

---

## 6.1 墨滴开场（Ink Drop / Prologue）

**用途**：片头、母题第一次出现、片名显影。
**参考实现**：`src/scenes/prologue.js`，0–19.1s。

**画面**：微距俯拍一池黑水，一滴墨落下，扩散成星云；片名从涟漪中心显影。

**搭建**：

1. 水面：`PlaneGeometry(20,20,256,256)`，顶点用两层 fbm 位移（速度不同）。
2. 墨：一个半透明的 `ShaderMaterial` 圆盘，边缘用 fbm 域扭曲；中心密度高。
3. 涟漪：从落点出发的环形波，`sin(r*k - t*w) * exp(-r*decay)`。
4. 星云：墨的密度图采样成粒子（在墨的亮部撒 2000–4000 个点）。
5. 片名：Canvas/SDF 文字，透明度由墨的密度驱动；不要直接淡入。

**参数**：

| 参数 | 建议值 | 作用 |
|---|---|---|
| `dropTime` | 2.5–4s | 墨落下的时刻（对齐第一个音） |
| `spread` | 0.6–1.2 | 扩散速度 |
| `turbulence` | 0.3–0.8 | 边缘扭曲强度 |
| `inkDensity` | 0.7 | 中心不透明度 |
| `rippleAmp` | 0.02 | 水面起伏 |

**动画**：墨落下 → 冲击环 → 扩散 → 星云化 → 片名显影 → 缓慢拉远。
**相机**：俯拍 75–90°，从 6 推到 2.5；fov 35→42；极慢。

**坑**：

- 墨的透明排序：`depthWrite:false`，先画水，再画墨，再画粒子。
- 片名不要用纯白；用宣纸米色，避免过曝。
- 墨扩散不能是完美圆；至少加 2 个不同频率的噪声。

**可抄**：thebookofshaders（fbm/域扭曲）、three.js `webgl_shaders_ocean`。

---

## 6.2 海面信件（Sea Letter / Horizon）

**用途**：建立世界、孤独、尺度、信的旅程起点与终点。
**参考实现**：`src/scenes/seaNight.js`、`seaDawn.js`，19.1–44.04s、280.71–304.97s。

**画面**：无垠海面，银月低垂；一封信浮在水上，红绳拖出细痕。

**搭建**：

1. 海面：大平面 + 两层法线噪声（0.5× 和 1.7× 速度），菲涅尔混合天空色。
2. 天空：渐变球（顶部深、地平线亮）+ 月亮的辉光；不要用纯黑。
3. 月亮：球 + 菲涅尔边缘 + 一个大的加色光晕 sprite；倒影用「拉长的亮斑」。
4. 信：一个略弯的平面（信封），纸材质 + 火漆圆片；红绳用 `CatmullRomCurve3` + `TubeGeometry`。
5. 尾迹：在信的路径上生成带状网格，透明度随时间衰减。

**参数**：

| 参数 | 建议值 |
|---|---|
| `waveHeight` | 0.04–0.12 |
| `waveScale` | 0.8 |
| `moonSize` | 视角 8–15° |
| `fogDensity` | 0.015–0.03 |
| `horizonGlow` | 0.15 |

**相机**：贴水面 0.2–0.5 单位，35mm，缓慢前推或横移；摇臂升起时，保持地平线在画面下 1/3。

**坑**：

- 海面反射不要用真实反射（成本高且会闪）；用菲涅尔 + 天空色 + 高光。
- 月亮倒影是「竖直拉长的光带」，不是圆形倒影。
- 信的纸白要低于月亮亮度，否则会抢焦点。
- 雾会让红色变暗；红绳的 emissive 给 0.05。

---

## 6.3 水下上升 / 坠落（Underwater Ascent / Descent）

**用途**：进入新世界、失重、情绪下沉或释放。
**参考实现**：`src/scenes/fish.js`、`descent.js`、`drop.js`。

**画面**：光从头顶漏下，气泡与尘粒上升；主体在蓝色里穿行。

**搭建**：

1. 水体：`FogExp2`（蓝绿）+ 一个大的渐变背景球。
2. 光柱：3–6 个半透明锥体（加色、噪声遮罩），从水面斜射。
3. 气泡：`Points` + 软圆 sprite，向上漂，速度随机。
4. 尘粒：`Points`，缓慢视差，尺度感的关键。
5. 主体：纸/信/人，材质加轻微蓝色偏移；轮廓光从上方来。
6. 水面：从下往上看时，用「亮斑 + 焦散」纹理；不要真的做水面几何。

**参数**：

| 参数 | 建议值 |
|---|---|
| `fogColor` | `#0a2430`（夜） / `#1b4a5a`（晨） |
| `fogDensity` | 0.03–0.08 |
| `godRayCount` | 4–6 |
| `bubbleCount` | 300–800 |
| `dustCount` | 1000–3000 |

**相机**：上升时仰拍 10–25°，缓慢上移；下坠时俯拍，速度由慢到快（easeIn）。

**坑**：

- 雾太浓会吃掉主体；用「近处清晰、远处消失」的分层雾。
- 气泡不要均匀分布；聚成几股。
- 光柱与雾叠加会过曝；光柱透明度 ≤ 0.15。

---

## 6.4 纸鱼群（Paper Fish / Flocking）

**用途**：把文字/信纸变成生物；环绕、跟随、群体运动。
**参考实现**：`src/scenes/fish.js`，44.04–60.2s。

**画面**：失重的墨水里，信纸化成鳐鱼群，围绕信札游弋。

**搭建**：

1. 鱼：一个薄片几何（菱形/鳐形），顶点做轻微波动；材质双面、半透明。
2. 群体：`InstancedMesh`（100–300 条），每条有相位/半径/速度。
3. 运动：绕中心做椭圆轨道 + 噪声扰动；`boid` 太重，用参数化轨道即可。
4. 朝向：沿速度方向 + 轻微侧倾；不要用 `lookAt`（会僵）。
5. 纸感：在鱼身上贴文字纹理（UV 偏移），边缘略透光。

**参数**：

| 参数 | 建议值 |
|---|---|
| `count` | 120–260 |
| `orbitRadius` | 1.5–4 |
| `speed` | 0.2–0.5 |
| `noiseAmp` | 0.2–0.6 |
| `flapAmp` | 0.05 |

**相机**：横向轨道跟拍（主体在画面左 1/3），35–50mm；前景放 2–3 条鱼掠过。

**坑**：

- 实例化后每条鱼的动画相位要不同，否则会「齐步走」。
- 双面材质 + 透明会排序错；用 `alphaTest` 代替透明。
- 鱼群不要遮住主体超过 30%；用轨道半径控制。

---

## 6.5 纸阶（Paper Stairs / Ascent）

**用途**：上升、成长、通往某处；强引导线。
**参考实现**：`src/scenes/stairs.js`，60.2–74.04s。

**画面**：纸页悬成螺旋阶梯，红绳作扶手，通往顶端的月孔。

**搭建**：

1. 阶梯：`InstancedMesh` 的薄板，按螺旋参数排列：`angle = i * 0.42`，`y = i * 0.28`，`r = 2.2`。
2. 每级纸页有轻微随机旋转/弯曲；不要完全对齐。
3. 扶手：一条 `CatmullRomCurve3` + `TubeGeometry`，红色。
4. 顶端：一个亮的圆孔（月/门），作为视觉终点。
5. 光：从顶端漏下，阶梯底面有光斑（用投影贴图或假光斑）。

**参数**：

| 参数 | 建议值 |
|---|---|
| `steps` | 24–48 |
| `rise` | 0.25–0.35 |
| `turn` | 0.35–0.5 rad/级 |
| `radius` | 1.8–2.6 |
| `pageW/H` | 1.2 × 0.8 |

**相机**：广角仰拍（24–35mm），沿阶梯上升；或 35mm 跟随，轻微侧倾。

**坑**：

- 阶梯太规则会像楼梯间；每级加 2–5° 随机旋转。
- 仰拍时近处的台阶会挡住视线；用「抽掉一级」或降低机位。
- 顶端的亮孔必须真的亮（Bloom），否则没有目标感。

---

## 6.6 红线轨道（Thread Orbit / Web）

**用途**：连接、命运、关系网；强形式感。
**参考实现**：`src/scenes/threads.js`，74.04–104.04s。

**画面**：百缕红线从信札中心放射，纸签与结在虚空里轻响。

**搭建**：

1. 线：`Line2`（支持粗细）或 `TubeGeometry`（更贵但可打光）。
2. 路径：从中心向外，用 3–5 个控制点的 Catmull-Rom，末端加随机弯曲。
3. 纸签：小平面 + 文字纹理，挂在线末端。
4. 结：小圆环/Torus，随机分布。
5. 运动：整体缓慢旋转 + 每根线独立相位抖动（模拟风/呼吸）。

**参数**：

| 参数 | 建议值 |
|---|---|
| `threads` | 60–140 |
| `length` | 1.5–4 |
| `curve` | 0.3–0.8 |
| `sway` | 0.02–0.06 |
| `tags` | 10–20 |

**相机**：85mm 长焦环绕（压缩空间），或手持穿越（前景线掠过）。

**坑**：

- 线太多会糊成红雾；控制线宽 1–2px，透明度 0.8。
- 线的透明排序：用 `depthWrite:false` + 按距离排序。
- 长焦环绕时，中心主体不要被线完全遮住；留一个「窗口」。

---

## 6.7 镜面房间（Mirror Room / Reflection）

**用途**：自我、分裂、真相；强对称。
**参考实现**：`src/scenes/mirror.js`，110.33–144.04s。

**画面**：黑镜水面倒映银月与纸剪影；信悬在镜上，像一句未落地的话。

**搭建**：

1. 镜面：`Reflector`（平面反射）或低分辨率 render target + 模糊。
2. 水面扰动：法线噪声，极轻（0.005–0.02）。
3. 对称构图：主体与倒影各占一半；或让倒影不完整（更有故事）。
4. 进出镜面：穿过镜面时，用一次白闪/涟漪遮住切换。
5. 碎裂：预切分平面 + 每片随机速度/旋转；或屏幕空间裂纹 shader。

**参数**：

| 参数 | 建议值 |
|---|---|
| `reflectionRes` | 512–1024 |
| `ripple` | 0.005–0.02 |
| `shards` | 30–80 |
| `crackTime` | 0.3–0.6s |

**相机**：贴水面横移，保持倒影完整；或从镜后看（反向世界）。

**坑**：

- 平面反射会把相机也反射进去；用 layer 排除。
- 倒影的亮度要略低于实体（0.8–0.9），否则像复制粘贴。
- 碎裂的物理感靠「先慢后快」+ 少量大碎片。

---

## 6.8 逆雨城市（Reverse Rain / Alley）

**用途**：时间倒流、记忆、城市孤独。
**参考实现**：`src/scenes/rain.js`，144.04–164.04s。

**画面**：雨从地面升向天空；纸伞下，字在墙上发光。

**搭建**：

1. 雨：GPU 粒子（点精灵拉长），速度向上（逆雨）；用 `time` 控制。
2. 地面：湿沥青（高反射、噪声粗糙度）+ 积水（平面反射/屏幕空间）。
3. 建筑：简单的盒体 + 窗光（自发光面片）；不要做细节，靠剪影。
4. 字：墙面的发光文字（SDF/纹理），闪烁跟随音乐。
5. 伞：纸伞（圆锥/曲面）+ 骨架线；雨打在伞上有溅射粒子。

**参数**：

| 参数 | 建议值 |
|---|---|
| `rainCount` | 4000–12000 |
| `rainSpeed` | 8–20（向上） |
| `rainLength` | 0.15–0.4 |
| `wetness` | 0.7 |
| `neon` | 2–4 处 |

**相机**：35mm 手持，低机位；一次甩镜；或固定机位看雨。

**坑**：

- 雨点用加色混合，否则会像白线。
- 逆雨违反直觉，需要在前 2 秒给一个「正常雨」的对照，否则观众以为穿帮。
- 湿地面反射要模糊；清晰反射像镜子。

---

## 6.9 城市字谷（City of Words / Typographic Canyon）

**用途**：信息过载、压迫、现代性；强透视。
**参考实现**：`src/scenes/city.js`，164.04–180.2s。

**画面**：高楼是字，招牌是句子；镜头在字谷中飞行、俯冲。

**搭建**：

1. 建筑：盒体 + 文字纹理（每面不同）；用 `InstancedMesh` 或合批。
2. 招牌：自发光面片 + 轻微闪烁；颜色受色板限制。
3. 街道：湿地面 + 反光；车灯用拉长的加色 sprite。
4. 雾：`FogExp2`，让远处消失，制造深度。
5. 文字：用 Canvas 纹理（性能好），不要每个字都 SDF。

**参数**：

| 参数 | 建议值 |
|---|---|
| `buildings` | 40–120 |
| `streetWidth` | 2–4 |
| `signs` | 10–20 |
| `fogDensity` | 0.02–0.05 |

**相机**：24–35mm，飞行/俯冲；速度感靠前景掠过 + 运动模糊。

**坑**：

- 文字纹理太多会爆显存；用一张图集。
- 招牌颜色容易破坏色板；限制在 2 个色相内。
- 俯冲时近裁剪面会切到建筑；near 0.05，路径留 0.3 余量。

---

## 6.10 月门（Moon Gate / Portal）

**用途**：穿越、抉择、结尾的入口。
**参考实现**：`src/scenes/moongate.js`，195.0–240.71s。

**画面**：巨大的月亮/圆环悬在水面或空中；穿过它，世界变白。

**搭建**：

1. 门：Torus（圆环）或球体的一部分；边缘发光，内部是另一个世界（render target/贴图）。
2. 门内：一个更亮的场景（星空/海面），用独立相机的 render target。
3. 光：门是唯一光源；周围变暗。
4. 穿越：相机推进，门内画面逐渐占满；最后用白闪/雾遮住切换。

**参数**：

| 参数 | 建议值 |
|---|---|
| `gateRadius` | 3–8 |
| `glow` | 0.6–1.2 |
| `innerBrightness` | 1.5× 外部 |
| `passDuration` | 2–5s |

**相机**：正面/低角度，缓慢推进；穿过后切到新世界。

**坑**：

- 门内 render target 会增加一次渲染；分辨率降到 0.5×。
- 门的发光会 Bloom 成白饼；控制 emissive 强度。
- 穿越时相机的 near/far 要覆盖门内外。

---

## 6.11 星海成形（Starsea / Formation）

**用途**：峰值、升华、把文字变成星空。
**参考实现**：`src/scenes/starsea.js`，240.71–280.71s。

**画面**：星尘从海面升起，聚成文字/形状，再散开。

**搭建**：

1. 粒子：`Points`，每个粒子有「起点（海面）」和「终点（字形采样点）」。
2. 目标形状：用 Canvas 画字 → 取像素 → 采样 N 个点作为目标位置。
3. 运动：`t` 从 0→1，位置用 `mix(start, target, ease)` + 噪声扰动；到达后轻微呼吸。
4. 层次：3 层粒子（远/中/近），不同大小/亮度/速度。
5. 背景：星云 + 月亮；不要全黑。

**参数**：

| 参数 | 建议值 |
|---|---|
| `count` | 8000–30000 |
| `formTime` | 4–8s |
| `holdTime` | 2–4s |
| `scatter` | 0.3–0.8 |

**相机**：广角（24–35mm），缓慢拉远或上升；成形时轻微推近。

**坑**：

- 粒子太多会糊；用大小衰减 + 加色混合，控制亮度。
- 字形采样要均匀；否则笔画中心密、边缘空。
- 成形后要有 1–2 秒的「静止」；否则观众看不清字。

---

## 6.12 片尾卡（End Card / Credits）

**用途**：结束、署名、版权、彩蛋。
**参考实现**：`src/scenes/end.js` + `src/core/overlay.js`，304.97–310.16s。

**画面**：黑场或极暗的海面；片名、 Credits、版权行依次出现。

**搭建**：

1. 背景：纯黑或极暗的渐变；保留一点颗粒，避免死黑。
2. 文字：Canvas/SDF；分三组：片名（大）、Credits（中）、版权（小）。
3. 时间：片名 ≥2s，Credits ≥3s，版权 ≥2s；总时长 ≥6s。
4. 淡入淡出：每条 0.6–1.0s；不要全部同时出现。
5. 音乐：尾奏/混响；不要突然静音。

**参数**：

| 参数 | 建议值 |
|---|---|
| `titleHold` | 2.5s |
| `creditHold` | 4s |
| `fade` | 0.8s |
| `lineGap` | 1.6× 字号 |

**坑**：

- 片尾卡不要用纯白字 + 纯黑底（会刺眼）；用 0.9 的白。
- 版权行必须包含音乐/字体/素材的来源。
- 片尾卡也是片子的一部分；字体/排版要和正片一致。

---

## 6.13 场景复用策略

一个 5 分钟片子不需要 14 个完全独立的场景。复用方式：

| 方式 | 成本 | 效果 |
|---|---|---|
| 同场景换机位 | 0.3× | 观众感觉「还在这个世界」 |
| 同场景换时间/光 | 0.5× | 晨/夜/雨/晴，情绪完全不同 |
| 同场景换色板 | 0.4× | 风险高，容易破坏风格锁 |
| 同几何换材质 | 0.6× | 纸→金属→冰，适合变形段落 |
| 同构图换主体 | 0.2× | 强形式感，适合极简风格 |

推荐配比：**6 个基础场景 × 平均 2.2 个机位/光位 = 13–14 个视觉段落**。
这样既有变化，又不会让制作量爆炸。

## 6.14 抄作业：12 个原型的现成实现

每个原型都有人写过。下面这张表按「抄哪一段」而不是「用哪个库」组织——
大多数情况下你只需要读 100 行 shader，然后把参数搬进自己的场景。

| 原型 | 现成实现 / 参考 | 许可 | 抄哪一段 | 别抄什么 |
|---|---|---|---|---|
| 6.1 墨滴开场 | [thebookofshaders](https://github.com/patriciogonzalezvivo/thebookofshaders) 的 fbm/域扭曲；[glsl-noise](https://github.com/hughsk/glsl-noise) | 见仓库 / MIT | fbm + domain warping 的叠加方式；[WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) 的 curl/advection（只借 2D 屏幕空间扩散） | 整套流体模拟（分辨率相关、不可复现；固定步长后再考虑） |
| 6.2 海面信件 | three.js `Water.js` / `Water2.js`、`Reflector.js`、`webgl_shaders_ocean` | MIT | 双层法线滚动 + 菲涅尔 + 平面反射；Gerstner 波的顶点位移 | 高面数网格（2.39:1 下 128×128 段就够） |
| 6.3 水下上升 / 坠落 | `Water.js` 从水下看 + `FogExp2`；`webgl_postprocessing_godrays`；`Sky.js` | MIT | 水下吸收色（红先消失）、god rays 的屏幕空间做法、焦散贴图的乘法叠加 | 体积雾的整套 raymarch（成本高，除非是主镜头） |
| 6.4 纸鱼群 | `webgl_gpgpu_birds`（GPU flocking）、`webgl_instancing_dynamic`、`webgl_instancing_performance` | MIT | 位置纹理做 boids；`InstancedMesh` 每帧写矩阵；翅膀用顶点着色器摆动 | 每条鱼一个 SkinnedMesh（1000 条必炸） |
| 6.5 纸阶 | `webgl_geometry_extrude_shapes`、`webgl_shadowmap_pcss`、`SSAOPass` | MIT | 2D 轮廓挤出；软阴影；SSAO 让纸阶「落地」 | 用布尔运算切纸（几何成本高，视觉收益低） |
| 6.6 红线轨道 | `Line2` / `LineGeometry` / `LineMaterial`、[THREE.MeshLine](https://github.com/spite/THREE.MeshLine)、`webgl_lines_fat` | MIT | 屏幕宽度恒定的粗线；沿 Catmull-Rom 的切线做 UV 滚动 | `LineBasicMaterial`（宽度在多数平台恒为 1px） |
| 6.7 镜面房间 | `Reflector.js`、`Refractor.js`、`SSRPass`、drei `MeshReflectorMaterial` | MIT | 平面反射的相机镜像矩阵；模糊反射的 roughness 混合 | 同时开 3 面以上实时镜（每面多渲一遍场景） |
| 6.8 逆雨城市 | `webgl_points_sprites` + 自定义 shader、`Reflector`、`UnrealBloomPass`、`webgl_postprocessing_godrays` | MIT | 点精灵拉长成雨丝；湿地反射；钠灯 halation | 每滴雨一个 Mesh；全屏 SSR（夜景噪点难压） |
| 6.9 城市字谷 | [troika-three-text](https://github.com/protectwise/troika)、[opentype.js](https://github.com/opentypejs/opentype.js)、`webgl_geometry_extrude_shapes`、[msdfgen](https://github.com/Chlumsky/msdfgen) | MIT | SDF 文字排版；字形轮廓挤出成 3D 字；MSDF 图集 | 为每个汉字单独建几何（字体子集 + 图集才是解） |
| 6.10 月门 | three.js `webgl_portal`（模板缓冲传送门）、`Reflector`/`Refractor`、`Lensflare` | MIT | 模板缓冲 + 第二台相机渲染「门后世界」；边缘光晕 | 门后场景也做全量后处理（渲两遍会掉一半帧） |
| 6.11 星海成形 | `webgl_gpgpu_birds`、`webgl_points_sprites`、drei `Sparkles`、[three-nebula](https://github.com/creativelifeform/three-nebula) | MIT | GPU 位置纹理；加色混合的点精灵；Canvas 采样文字像素做目标点 | 每颗粒子一个 Sprite（draw call 爆炸） |
| 6.12 片尾卡 | Canvas 2D + `document.fonts.ready`；[opentype.js](https://github.com/opentypejs/opentype.js)；[fonttools](https://github.com/fonttools/fonttools) | MIT | 字体度量、子集化、按基线排版；SDF 文字用 troika | 3D 场景里放小字号文字（会糊；片尾卡用 2D overlay 最稳） |

**五个共用件**（几乎每个场景都会用到，先抄这五个）：

| 共用件 | 项目 | 许可 | 抄什么 |
|---|---|---|---|
| 噪声 | [glsl-noise](https://github.com/hughsk/glsl-noise)、[simplex-noise.js](https://github.com/jwagner/simplex-noise.js) | MIT | 3D/4D simplex；CPU 端做种子化漂移 |
| 粒子 | three.js `webgl_points_sprites`、[three-nebula](https://github.com/creativelifeform/three-nebula) | MIT | 点精灵的 size attenuation、发射器/力场 |
| 粗线 | `Line2` / `LineMaterial`、[THREE.MeshLine](https://github.com/spite/THREE.MeshLine) | MIT | 屏幕空间线宽、沿线的 UV |
| 文字 | [troika-three-text](https://github.com/protectwise/troika)、[msdfgen](https://github.com/Chlumsky/msdfgen) | MIT | SDF/MSDF、字距、换行 |
| 可见性 | [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | 射线加速：机位碰撞、拾取、遮挡判断 |

**四个许可提醒**（比技术坑更贵）：

- three.js 的**示例代码是 MIT，但示例里的贴图/模型/HDR 不一定**。搬到项目里之前逐个查来源，
  或者直接换 [Poly Haven](https://polyhaven.com)（CC0）/[ambientCG](https://ambientcg.com)（CC0）。
- [lygia](https://github.com/patriciogonzalezvivo/lygia) 是 Prosperity 3.0（**非商用**），
  商用 MV 不要直接复制它的函数；自己按 6.1 的 fbm 写法重写。
- [Hydra](https://github.com/hydra-synth/hydra) 是 AGPL-3.0，不要嵌进在线播放器；
  它的反馈/合成思路可以手动重写。
- [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) 是 MIT，
  但它是 2D 屏幕空间、且默认跟随鼠标；用于成片要固定 `dt`、去掉指针输入。

**一个反直觉的建议**：先把 three.js 自带的 `examples/jsm` 读一遍再决定装不装库。
`Water`、`Reflector`、`Sky`、`Line2`、`UnrealBloomPass` 已经覆盖了本文 80% 的场景；
剩下的 20%（墨、纸、星海成形）通常是一段 100 行的自定义 shader，
比引入一个框架更容易保证确定性。
