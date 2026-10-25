# mvcraft

**一首歌 + 一句话 → 一部有导演意图的 MV。**

mvcraft 不是一个渲染器，也不是又一套节拍可视化模板。它是一层**导演方法**：
把「好听、好看、耐看」拆成可执行、可校验、可复现的工序——听歌做地图、写分镜、定运镜、
锁画风、搭场景、做看片（animatic）、门禁验收、确定性导出。

附带一套**能跑的 Three.js 参考实现**：27 个机位、14 个场景、5 分 10 秒、1920×804、
7444 帧确定性离线渲染、0 运行时错误。它不是演示图，是工程样片。

> 示例片《我爱你 · A LETTER TO THE MOON》只保留代码、字体、分析、静帧与等长静音占位；
> **不包含歌曲音频和歌词**（版权原因）。替换成你自己的 `public/audio/song.mp3` 即可听到声音。

<p align="center">
  <img src="examples/letter-to-the-moon/stills/02-sea-moon.jpg" width="49%">
  <img src="examples/letter-to-the-moon/stills/03-paper-stairs.jpg" width="49%">
  <br>
  <img src="examples/letter-to-the-moon/stills/05-reverse-rain.jpg" width="49%">
  <img src="examples/letter-to-the-moon/stills/07-moon-sea.jpg" width="49%">
  <br>
  <sub>参考实现静帧：海上信封 / 纸楼梯 / 逆流雨 / 月海 — 全部由 <code>renderAt(t)</code> 确定性渲染，无后期合成</sub>
</p>

完整概念、8 段结构表、27 镜效果图与可复现数据见 **[CONCEPT.md](CONCEPT.md)**。

---

## 它解决什么问题

大多数「AI 做 MV」失败，不是因为模型不会写 Three.js，而是因为：

| 症状 | 根因 | mvcraft 的对策 |
|---|---|---|
| 每一镜都好看，连起来像 PPT | 没有镜头语法和节奏设计 | 分镜表 + 镜头时长/运动/转场规则 + animatic 门禁 |
| 风格每 20 秒漂移一次 | 没有锁定的美术方向 | `art-direction.json`：色板/材质/光/字体/后处理一次锁死 |
| 画面在动，但和歌没关系 | 只用了 RMS 律动 | 音乐地图：段落、能量、人声、频谱、寂静、重拍 |
| 字幕永远挡脸 | 没人测过 | 字幕碰撞检测（主体像素占比）+ 安全区规则 |
| 预览很好，导出变样 | 截图式导出 / 非确定性 | 纯 `render(t)` + 同任务读回，逐帧可复现 |
| 黑帧、冻结、闪烁没人发现 | 只看过几帧截图 | 时序 QA：blackdetect / freezedetect / scdet / VMAF |
| 字体、模型、音频踩版权 | 没有资产台账 | 许可证台账 + 替换清单 + 禁入名单 |

## 工作流（接收 + 8 个阶段 + 4 个门）

```
0 接收        歌 + 一句话（不需要风格）
   ↓  问询 4–6 题，选项可视化，可自由补充
1 音乐地图    段落 / 能量 / 人声 / 重拍 / 寂静 → 剪辑网格
   ↓
2 创意方案    一句话 → 视觉母题 → treatment（300 字）+ 3 张风格帧 + 色板
   ↓  ★ Gate A：风格批准（此后不许漂移）
3 分镜        镜头表（JSON）：秒数、机位、运动、转场、主体、字幕
   ↓  ★ Gate B：结构批准（覆盖全曲、无空段、峰值对齐）
4 搭建        参数化场景原型 + 共享材质/灯光 + 冻结的 art-direction
   ↓
5 看片        animatic（分镜静帧+临时音轨）与 contact sheet
   ↓  ★ Gate C：节奏批准
6 打磨        look-dev、字体、粒子、后处理、字幕避让
   ↓
7 验收        时序 QA + 视觉抽帧 + 音频响度 + 碰撞检测
   ↓  ★ Gate D：QA 通过
8 导出        确定性逐帧 + H.264 母版 + 平台版
```

**时间预算**（参考实现实测）：3 分钟曲子，熟练后 6–10 小时；其中 40% 在分镜与看片，
30% 在打磨，20% 在 QA。跳过看片阶段，后面一定加倍还回来。

## 一句话的两种用法

### A. 作为 Agent Skill（推荐）

把本仓库放进 skills 目录，或直接对 Agent 说：

> 用 mvcraft 给 `song.mp3` 做一支 MV。

Agent 会按 `SKILL.md` 的流程走：先问 4–6 个带选项的问题（气质/叙事/尺度/文字/色彩），
再产出音乐地图、treatment、风格帧、分镜 JSON，逐门确认后搭建与导出。

### B. 作为模板工程

```bash
cd examples/letter-to-the-moon
npm install
# 放入你有权使用的音频
cp /path/to/your-song.mp3 public/audio/song.mp3
npm run analyze          # 生成 public/analysis/analysis.json（Python 依赖见 tools/requirements.txt）
npm run dev              # http://127.0.0.1:5173
npm run render           # 离线逐帧（需要 Edge/Chrome，另开一个终端保持 dev 运行）
```

导出完成后按提示用 ffmpeg 编码；完整 QA 与编码命令见
[tools/README.md](tools/README.md) 与 `references/09-qa-export.md`。

示例自带 310.16s 的**等长静音占位**，开箱即可播放；换成你的歌后跑一次 `npm run analyze`
重建能量曲线。仓库不接收歌曲音频与歌词。

## 仓库地图

```
mvcraft/
├─ SKILL.md                  Agent 入口：问询、门禁、命令、交付物
├─ CONCEPT.md                概念、参考片结构、效果图、设计取舍
├─ docs/animatic-contact.jpg 全片 27 镜效果图
├─ references/               全片创作手册（13 章，00–12，按工序）
│  ├─ 00-workflow.md         端到端流程与角色/时间预算
│  ├─ 01-intake.md           一句话 → 问询 → treatment
│  ├─ 02-music-map.md        音频分析、剪辑网格、能量映射
│  ├─ 03-storyboard.md       镜头语法、时长、转场、字幕时间 + 现成分镜/animatic 轮子
│  ├─ 04-camera.md           运镜食谱、曲线、抖动、焦段 + 可直接移植的相机代码
│  ├─ 05-styles.md           10 种画风的完整配方
│  ├─ 06-scenes.md           12 个场景原型 + 每个原型对应的 three.js/GitHub 实现
│  ├─ 07-look-and-post.md    色彩、色调映射、Bloom、颗粒、字体 + 后处理轮子与 pass 顺序
│  ├─ 08-assets.md           字体/纹理/模型/音频与许可证
│  ├─ 09-qa-export.md        确定性渲染、时序 QA、VMAF、编码
│  ├─ 10-pitfalls.md         43 条踩坑清单（含本项目真实事故）
│  ├─ 11-tool-index.md       按任务索引的 GitHub 项目（含许可证陷阱）
│  └─ 12-prior-art.md        同类项目与生态位分析
├─ schemas/                  storyboard / art-direction / music-map
├─ examples/
│  ├─ storyboard.example.json
│  ├─ art-direction.example.json
│  └─ letter-to-the-moon/    可运行参考实现 + 8 张静帧 + 静音占位
├─ tools/
│  ├─ analyze_audio.py       通用音频分析（段落/能量/人声/onset）
│  ├─ validate-storyboard.mjs 零依赖分镜校验 + 字幕碰撞预算
│  ├─ export.mjs             CDP 确定性逐帧导出
│  ├─ lib/cdp.mjs            共享 CDP 客户端（分块读取、超时、断线即报错）
│  ├─ qa-cdp.mjs             指定时间点截图
│  ├─ probe.mjs              屏幕空间/可见性探针
│  ├─ qa-video.sh            ffmpeg 时序 QA + VMAF + 响度
│  ├─ contact-sheet.sh       抽帧拼图（不依赖 ImageMagick）
│  ├─ README.md              工具契约、参数与排错
│  └─ requirements.txt       Python 依赖（numpy/soundfile/Pillow）
└─ THIRD_PARTY_NOTICES.md
```

## 十条硬规则

1. **风格只批准一次。** `art-direction.json` 批准后冻结；改风格 = 重开 Gate A，不允许「顺手调一下」。
2. **每镜只做一件事。** 一个镜头一个视觉事件；两个事件 = 两个镜头。
3. **镜头 2–8 秒。** 超过 8 秒必须有内部事件（光变/主体入场/焦点转移），否则切。
4. **切点落在音乐事件上。** 至少 60% 的切点距最近 onset 或拍网格 < 80ms（拍相位只拟合一次；慢歌看拍网格，快歌看 onset）。
5. **转场跨切点居中。** `start = cut - dur/2`；否则会出现节奏「拖半拍」。
6. **不靠黑帧换场。** 非转场黑场只允许出现在段落呼吸点，且 < 0.5s；已登记的 `fade`/`dip` 转场按转场时长计算。
7. **主体可见性要测。** 不靠「我看了一眼没问题」；用 Raycaster 采样 + 隐藏渲染差分。
8. **字幕必须让位。** 主体区域与字幕框重叠 < 15%，否则移镜/移字幕/换机位。
9. **导出必须确定性。** 同一时间点两次渲染像素一致；禁止实时截图拼视频。
10. **每个资产有出处。** 字体、纹理、模型、音频、参考图，全部进台账；NC/AGPL 不得进入可分发成品。

## 实测基线

参考实现（Windows 11 / Edge headless / ANGLE D3D11）：

- 7444 帧，24fps，1920×804，5:10.16，渲染 5.7–6.7 分钟（39–54 ms/帧，视 GPU 负载），0 报错
- SwiftShader 对照：516 ms/帧（慢 13 倍）→ 有 GPU 时不要用软件渲染
- VMAF（JPEG 帧 vs 成片，前 2 秒）：mean 90.97 / min 85.43
- 成片：H.264 High、yuv420p、tv range、BT.709、12.9 Mb/s、AAC 256k、faststart
- 运行时：Three.js r180 + Vite 7，无框架、无后处理库

## 同类项目与生态位

- [Win-Hao/music-mv](https://github.com/Win-Hao/music-mv)：最接近的 Agent Skill，偏像素/拼贴，7–10 小时出片，**没有运镜语法与时序 QA**。
- [Remotion](https://github.com/remotion-dev/remotion) / [Revideo](https://github.com/redotvideo/revideo) / [Motion Canvas](https://github.com/motion-canvas/motion-canvas)：代码化视频框架，强在编排，弱在「导演决策」。
- [Butterchurn](https://github.com/jberg/butterchurn) / [projectM](https://github.com/projectM-visualizer/projectm) / [Hydra](https://github.com/hydra-synth/hydra)：实时视觉，强在律动，弱在叙事与镜头。
- [three.js](https://github.com/mrdoob/three.js) / [Theatre.js](https://github.com/theatre-js/theatre)：渲染与编排底座。

**缺口**：没有人把「锁定美术方向 + 镜头语法 + 音乐地图 + 字幕时序 + 确定性 QA」做成一层可复用的导演方法。mvcraft 补的就是这一层。

详见 [references/12-prior-art.md](references/12-prior-art.md) 与 [references/11-tool-index.md](references/11-tool-index.md)。

## 许可

代码 MIT。文档 CC BY 4.0。示例中的字体为 SIL OFL，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
示例片音频与歌词**不在仓库内**；请使用你拥有权利的音乐。
