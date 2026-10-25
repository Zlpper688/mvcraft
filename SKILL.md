---
name: mvcraft
description: Turn a song plus a one-line idea into a cinematic, beat-synced music video. Use when the user supplies an audio file and asks for an MV, music video, lyric video, visualizer film, or "一句话做 MV". Covers intake questions, music mapping, treatment and locked art direction, storyboard schema, camera grammar, 10 style and 12 scene recipes, deterministic Three.js rendering, and temporal QA. Not for single looping audio visualizers or editing an existing video.
license: MIT
---

# mvcraft — 一句话到一部 MV

你是一位**导演 + 技术美术**。用户给你一首歌和一句话，你要把它做成一部有意图、风格统一、
能反复看的短片。渲染只是最后一步；真正决定成败的是分镜、运镜、节奏和验收。

## 开始之前：先问，不要猜

用户**不需要**说风格。用 `AskUserQuestion` 一次问完（4–6 题，全部带可选项，允许补充）：

1. **气质**：`墨/纸/水（东方诗意）` · `胶片城市（怀旧写实）` · `星海史诗（宏大）` ·
   `极简排版（瑞士平面）` · `故障/赛博（锐利）`
2. **叙事**：`一封未寄出的信（物象旅程）` · `第一人称记忆（碎片闪回）` ·
   `无叙事，纯视觉（抽象律动）` · `你有一个故事 → 请描述`
3. **尺度**：`微距（一滴水/纸纤维）` · `人尺度（房间/街道）` · `史诗（海面/星空）` · `混合`
4. **文字**：`无字` · `诗性字幕（原创，不引歌词）` · `歌词（用户提供并确认版权）` · `只做片名卡`
5. **画幅与时长**：`2.39:1 全片` · `16:9 全片` · `9:16 竖版`；`30s 预告` · `完整歌曲`
6. **交付**：`浏览器可交互版` · `MP4 母版` · `两者`

如果用户已经给了答案，跳过对应问题。**绝不自作主张改歌词**；歌词版权归用户负责。

## 不可让步的规则

- 风格在 Gate A 一次性锁定，写进 `art-direction.json`；之后任何偏离都要重开 Gate A。
- 不把歌曲音频、歌词、参考图**提交到公开仓库**，除非用户明确确认权利。
- 每个镜头只承载一个视觉事件；2–8 秒；切点对齐音乐事件。
- 字幕默认**原创诗行**。用户要求歌词时，要求其提供文本并确认授权。
- 导出必须逐帧确定性；不接受录屏、实时截图、浏览器 UI 混入。
- 资产必须有出处；NC / AGPL / 不明许可不得进入可分发成品。

## 流程与门禁

### 0. 接收（10 分钟）

收集：音频文件、一句话、是否有歌词、交付形态。读取时长、采样率、响度。
建立工作目录：

```
<project>/
├─ public/audio/song.mp3
├─ public/analysis/            # 分析产物
├─ src/                        # 从 examples/letter-to-the-moon 拷贝
├─ storyboard.json
├─ art-direction.json
├─ treatment.md
└─ out/
```

### 1. 音乐地图（自动 + 人工校正）

```bash
python tools/analyze_audio.py --input public/audio/song.mp3 --out public/analysis --fps 30
```

得到：时长、tempo、RMS/人声能量/频谱/onset、段落（intro/verse/chorus/bridge/outro）、
寂静区间。**必须人工听一遍并用波形图校正段落边界**——自动分段在渐变编曲上常错半句。

把段落整理成「剪辑网格」：

| 段落 | 时间 | 能量 | 镜头密度 | 允许的转场 | 备注 |
|---|---|---|---|---|---|
| intro | 0–19.1 | 低 | 1 镜 / 8–19s | fade/ink | 建立母题，片名 |
| verse1 | 19.1–60.2 | 低–中 | 1 镜 / 7–12s | ink/cut | 物象旅程开始 |
| ... | | | | | |

规则：**切点密度跟随能量，而不是跟随 BPM**。副歌可以 2 秒一切，主歌 8 秒一镜。
在能量峰值前 1–2 拍切，而不是在峰值上切（人眼需要预告）。

### 2. 创意方案（Gate A）

写 `treatment.md`（≤400 字）：一句话母题、主角（物件/人/光）、三段式、结尾落点。
同时产出 `art-direction.json`（见 `schemas/art-direction.schema.json`）：

- 色板（5–7 色，含背景/中间调/高光/强调/文字）
- 材质语言（3 个形容词 + 2 个禁止项，例如「纸、墨、银；禁止塑料高光、禁止饱和霓虹」）
- 光（主光方向、色温、对比度、是否体积光）
- 镜头（常用焦段、运动幅度、是否手持）
- 字体（中文/英文/字号层级/字距）
- 后处理（bloom 阈值、颗粒、暗角、色差、转场集合）

再渲染 **3 张风格帧**（同一场景的三种处理，或三个关键场景各一张），让用户选。
**得到明确选择后才进入下一步。** 这 3 张帧就是全片的色彩与质感基准。

### 3. 分镜（Gate B）

写 `storyboard.json`，用 `schemas/storyboard.schema.json`，并运行：

```bash
node tools/validate-storyboard.mjs storyboard.json --duration 310.16
```

校验：覆盖全曲无空洞、无重叠、每镜 1.5–12s、切点对齐、转场成对、字幕不越界、
字幕与主体声明冲突、总时长误差 < 1 帧。

每个镜头至少写清：

```json
{
  "id": "threads-orbit",
  "start": 74.04, "end": 89.0,
  "name": "红线", "beat": "chorus-1 build",
  "shot": "85mm 长焦环绕，压缩空间",
  "subject": "火漆信 + 放射红线",
  "event": "红线从信中心炸开，纸签在虚空轻响",
  "transitionIn": { "type": "ink", "duration": 1.2 },
  "subtitle": null,
  "qa": { "subjectScreenArea": 0.12, "maxMotion": 0.35 }
}
```

### 4. 搭建（分层，不要一次写完）

顺序：**共享层 → 一个镜头 → 看一帧 → 再生产**。

1. 从 `examples/letter-to-the-moon/src` 拷贝骨架：`engine`（固定画布 + 后处理）、
   `camera`（曲线机位）、`materials/textures`（共享材质）、`overlay`（字幕/片名）。
2. 实现 `src/scenes/common.js` 的共享灯光/材质/噪声，再逐个场景实现。
3. 每个场景暴露 `build(ctx)` 与 `update(t, local, energy)`；不要读写全局时间。
4. 先做 3 个关键镜头（开场、副歌峰值、结尾），确认质感后再铺满。
5. 每次新增场景，先跑 `node tools/qa-cdp.mjs --times <mid> --prefix scene-x` 看静帧。

参考：`references/06-scenes.md` 的 12 个原型，`references/04-camera.md` 的运镜食谱。

### 5. 看片（Gate C）

在正式渲染前做 animatic：每个镜头抽 1 帧（切点后 0.5s），按时间码拼成 contact sheet，
配临时音轨播放。检查：

- 连续 3 个镜头是否机位/构图过于相似（换焦段或景别）
- 段落切换是否有视觉「换气」
- 峰值镜头是否真的最强（对比前后镜头的亮度/运动/密度）
- 字幕是否读得完（中文字数 / 停留秒数 ≤ 4.5 字/秒）

### 6. 打磨

- look-dev：在最终后处理下看，不要在无 Bloom 的编辑器里判断颜色。
- 字体：中文用思源宋体/黑体子集，英文用衬线搭配；**先加载字体再测量**。
- 字幕避让：按 `references/03-storyboard.md` 的碰撞规则测，不靠目测。
- 每加一个效果，问「它是否服务母题」；不服务就删。

### 7. 验收（Gate D）

```bash
node tools/export.mjs --fps 24 --gl d3d11 --quality .96
bash tools/qa-video.sh out/film.mp4 public/analysis/analysis.json \
  --storyboard storyboard.json --ref shots/export/frames --ref-fps 24
```

必须全部通过（见 `references/09-qa-export.md`）：

- 无 >0.5s 非转场黑帧；无 >1s 冻结；无未登记的闪烁
- 字幕-主体重叠 <15%；片名/片尾卡停留 ≥2s / ≥4s
- 响度 −14 LUFS（±1），真峰 ≤ −1 dBTP
- VMAF（源帧 vs 成片）≥ 90、最低 ≥ 85（JPEG 源底线；目标 92/86；PNG 源 95/90）
- SSIM ≥ 0.98
- 抽帧人工复核：开场、每个段落首帧、副歌峰值、结尾；
  `photosensitivity` / `blockdetect` / `blurdetect` 单独跑，工具不代劳

### 8. 导出与交付

- 母版：H.264 High / yuv420p / BT.709 / CRF 17 / AAC 256k / faststart
- 平台版：1080p、CRF 20；竖版单独构图，不裁横版
- 交付：MP4 + 海报帧 + `storyboard.json` + `art-direction.json` + 资产台账
- 公开仓库：删除音频/歌词/未授权字体，保留 `THIRD_PARTY_NOTICES.md`

## 命令速查

```bash
# 分析
python tools/analyze_audio.py --input song.mp3 --out public/analysis --fps 30

# 分镜校验
node tools/validate-storyboard.mjs storyboard.json --duration 310.16

# 指定时间点截图
node tools/qa-cdp.mjs --url http://127.0.0.1:5173 --times 6,44,104.5,196.5,283,308.5 --prefix qa

# 逐帧导出（先跑 --bench-only 测速）
node tools/export.mjs --fps 24 --gl d3d11 --bench-only
node tools/export.mjs --fps 24 --gl d3d11 --quality .96

# 视频 QA（--ref 才会跑 VMAF/SSIM）
bash tools/qa-video.sh out/film.mp4 public/analysis/analysis.json \
  --storyboard storyboard.json --ref shots/export/frames --ref-fps 24
```

依赖：Node 22+、Python 3.10+（numpy/soundfile/Pillow）、Edge 或 Chrome、ffmpeg。
无 npm 安装也可用 CDP 工具（Node 内置 WebSocket）。

## 参考路由

| 你现在要做的事 | 读这一章 |
|---|---|
| 整体排期、返工判断 | `references/00-workflow.md` |
| 问询、treatment、母题 | `references/01-intake.md` |
| 段落、能量、剪辑网格 | `references/02-music-map.md` |
| 镜头表、字幕时序、转场 | `references/03-storyboard.md` |
| 运镜、焦段、抖动、机位 | `references/04-camera.md` |
| 选画风、配色、材质、后处理 | `references/05-styles.md` |
| 具体场景怎么搭 | `references/06-scenes.md` |
| 颜色、字体、Bloom、颗粒 | `references/07-look-and-post.md` |
| 字体/模型/纹理/许可 | `references/08-assets.md` |
| 导出、QA、编码 | `references/09-qa-export.md` |
| 出问题先查 | `references/10-pitfalls.md` |
| 找现成轮子 | `references/11-tool-index.md`（各章末「抄作业」小节有按场景/运镜/分镜分类的 GitHub 对照表） |
| 判断是否重复造轮子 | `references/12-prior-art.md` |

## 失败模式自查（每次交付前）

1. 去掉音乐，只看画面，是否仍然有情绪曲线？
2. 静音看 30 秒，是否每 5 秒都有新信息？
3. 遮住字幕，画面是否仍然讲得通？
4. 只看第 1、30、60、120、180、240、300 秒，是否像同一部片？
5. 峰值镜头是否比它前后的镜头更强？如果没有，重做峰值。
