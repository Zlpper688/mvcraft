# 11 · 工具索引：按任务找轮子

> 原则：**不要重写渲染器、节拍检测、视频编码**。把时间花在导演决策上。
> 许可以各仓库为准；标 ⚠️ 的是明确有坑的。

## 11.0 按工序的「抄作业」表

这一章按「工具类型」索引。如果你已经知道自己在做哪一步，直接跳到对应章节
末尾的对照表——那里写的是「这个场景/这种运镜，去哪个仓库抄哪一段，别抄什么」：

| 工序 | 位置 | 内容 |
|---|---|---|
| 分镜与 animatic | `03-storyboard.md` §3.11 | Storyboarder / OpenTimelineIO / Editly / Remotion / Motion Canvas |
| 运镜与相机 | `04-camera.md` §4.13 | Catmull-Rom 采样、camera-controls、CameraShake、three-story-controls、Theatre |
| 12 个场景原型 | `06-scenes.md` §6.14 | 每个原型对应一个 three.js 示例/GitHub 实现 + 共享零件（噪声/粒子/线/文字/可见性） |
| 画风与后处理 | `05-styles.md`（每种风格末尾「可抄的轮子」）、`07-look-and-post.md` §7.12（Bloom/LUT/颗粒/色差的现成实现） | 调色参数区间 + 后处理通路与顺序 |
| 资产与字体 | `08-assets.md` | 可商用来源、子集化、许可 |

抄代码时只抄「算法/结构」，不要连它的资源、美术风格、命名一起抄——那些是
别人的作者签名，抄了反而不像你的片子。

## 11.1 最小可用栈（本项目验证）

| 任务 | 选择 | 理由 |
|---|---|---|
| 3D | [three.js](https://github.com/mrdoob/three.js)（MIT） | 生态最大，示例多，无框架绑定 |
| 构建 | [Vite](https://github.com/vitejs/vite)（MIT） | 秒开，零配置 |
| 后处理 | 自写 final shader + UnrealBloomPass | 可控；引入大库反而难调 |
| 文字 | Canvas 2D（字幕）+ troika（3D 字） | 字幕要清晰，3D 字要透视 |
| 分析 | numpy + soundfile（自写） | 无重依赖，30fps 特征足够 |
| 渲染 | Edge headless + CDP（自写） | 不依赖 npm/puppeteer；确定性 |
| 编码 | FFmpeg | 唯一选择 |

**总依赖：three + vite。** 这不是极简主义，是减少故障面。

## 11.2 渲染与运行时

| 任务 | 项目 | 许可 | 借什么 |
|---|---|---|---|
| 3D 引擎 | [three.js](https://github.com/mrdoob/three.js) | MIT | 一切基础；examples 是最好的教材 |
| 轻量 WebGL | [OGL](https://github.com/oframe/ogl) | MIT | 更小的包；适合单场景 |
| 2D/WebGL | [PixiJS](https://github.com/pixijs/pixijs) | MIT | 2D 排版/粒子更快 |
| 全功能引擎 | [Babylon.js](https://github.com/BabylonJS/Babylon.js) | Apache-2.0 | PBR/物理/编辑器完整 |
| React 3D | [react-three-fiber](https://github.com/pmndrs/react-three-fiber) | MIT | 声明式场景；状态管理 |
| R3F 工具 | [drei](https://github.com/pmndrs/drei) | MIT | 相机/材质/环境/文字现成组件 |
| 后处理 | [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | Zlib | Bloom/DOF/SSR/色调映射 |
| 后处理（three 官方） | [three/examples/jsm/postprocessing](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/postprocessing) | MIT | EffectComposer/UnrealBloom |
| 3D 文字 | [troika-three-text](https://github.com/protectwise/troika) | MIT | SDF 文字、排版、字距 |
| 相机控制 | [camera-controls](https://github.com/yomotsu/camera-controls) | MIT | 平滑阻尼/触控 |
| 路径/曲线 | three.js `CatmullRomCurve3` | MIT | 机位曲线，够用 |
| 粒子 | [three-nebula](https://github.com/creativelifeform/three-nebula) | MIT | 发射器/力场 |
| 粒子 | [tsparticles](https://github.com/tsparticles/tsparticles) | MIT | 2D/3D 粒子，配置化 |
| BVH/射线 | [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | 可见性/碰撞加速 |
| 路径追踪 | [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) | MIT | 高质量静帧/参考图 |
| 动画 | [anime.js](https://github.com/juliangarnier/anime) | MIT | 时间轴/缓动 |
| 动画 | [GSAP](https://github.com/greensock/GSAP) | ⚠️ 自定义 | 强，但部分插件收费；商用查条款 |
| 编排 | [Theatre.js](https://github.com/theatre-js/theatre) | Apache-2.0（core）/ ⚠️ AGPL（Studio） | 可视化关键帧；Studio 不要进成品 |
| 时间轴 | 自写 `render(t)` | — | 确定性最强；推荐 |

## 11.3 代码化视频 / 合成

| 任务 | 项目 | 许可 | 借什么 |
|---|---|---|---|
| React 视频 | [Remotion](https://github.com/remotion-dev/remotion) | ⚠️ 自定义（>3 人付费） | 组件化时间轴、音频同步 |
| Motion Canvas | [motion-canvas](https://github.com/motion-canvas/motion-canvas) | MIT | 2D 动画/生成器语法 |
| Revideo | [revideo](https://github.com/redotvideo/revideo) | Apache-2.0（见仓库） | Motion Canvas 的视频扩展 |
| 声明式剪辑 | [Editly](https://github.com/mifi/editly) | MIT（见仓库） | JSON 剪辑/转场/字幕 |
| 逐帧合成 | FFmpeg | LGPL/GPL | 编码/滤镜/拼接 |

**注意**：这些框架解决「编排」，不解决「导演」。分镜/风格/QA 仍要自己做。

## 11.4 音频分析

| 任务 | 项目 | 许可 | 借什么 |
|---|---|---|---|
| 通用特征 | [librosa](https://github.com/librosa/librosa) | ISC | STFT/MFCC/onset/beat |
| 节拍/音高 | [aubio](https://github.com/aubio/aubio) | GPL-3.0 | 实时 onset/beat；⚠️ 传染 |
| 和弦/调性 | [Essentia](https://github.com/MTG/essentia) | ⚠️ AGPL-3.0 | 和弦/响度/舞曲检测；不要进网页 |
| 节拍/和弦 | [madmom](https://github.com/CPJKU/madmom) | BSD（代码）/ ⚠️ 模型 CC BY-NC-SA | 高精度 beat/downbeat；模型非商用 |
| 全栈分析 | [allin1](https://github.com/mir-aidj/all-in-one) | 见仓库（模型另有条款） | 段落/节拍/和弦 SOTA；Windows 安装难 |
| 人声分离 | [Demucs](https://github.com/adefossez/demucs) | MIT | 分离后再分析人声 |
| 歌词对齐 | [WhisperX](https://github.com/m-bain/whisperX) | 见仓库 | 词级时间戳；仍需人工听 |
| 语音识别 | [Whisper](https://github.com/openai/whisper) | MIT | 歌词草稿/对齐 |
| 可视化标注 | [Sonic Visualiser](https://github.com/sonic-visualiser/sonic-visualiser) | GPL-2.0 | 手动标段落/波形 |
| 响度 | FFmpeg `ebur128` / `loudnorm` | LGPL/GPL | LUFS/真峰 |

**建议**：先用自写分析（本项目 `tools/analyze_audio.py`）+ 耳朵；
需要和弦/段落 SOTA 时再上 allin1（Linux/WSL）。

## 11.5 生成视觉 / 实时视觉

| 任务 | 项目 | 许可 | 借什么 |
|---|---|---|---|
| Milkdrop | [Butterchurn](https://github.com/jberg/butterchurn) | MIT | 音频驱动预设/反编译 |
| Milkdrop | [projectM](https://github.com/projectM-visualizer/projectm) | LGPL-2.1 | C++ 实现/预设 |
| 实时编程 | [Hydra](https://github.com/hydra-synth/hydra) | ⚠️ AGPL-3.0 | 反馈/合成思路；不要嵌入网页 |
| 节点式 | [cables.gl](https://cables.gl) | 见站点 | 节点式 WebGL 编排 |
| 创意编程 | [p5.js](https://github.com/processing/p5.js) | LGPL-2.1 | 2D/教学/快速原型 |
| Shader 教程 | [thebookofshaders](https://github.com/patriciogonzalezvivo/thebookofshaders) | 见仓库 | fbm/噪声/域扭曲 |
| GLSL 库 | [lygia](https://github.com/patriciogonzalezvivo/lygia) | ⚠️ Prosperity 3.0（非商用） | 噪声/SDF/光照；**不可商用** |
| 噪声 | [glsl-noise](https://github.com/hughsk/glsl-noise) | MIT | simplex/perlin |
| 噪声 | [simplex-noise.js](https://github.com/jwagner/simplex-noise.js) | MIT | JS 端噪声 |
| 生成艺术 | [Deforum](https://github.com/deforum-art/deforum-stable-diffusion) | MIT（见仓库） | 帧间插值/风格化 |
| 节点生成 | [ComfyUI](https://github.com/comfyanonymous/ComfyUI) | ⚠️ GPL-3.0 | 生成资产/参考帧 |

## 11.6 文字与排版

| 任务 | 项目 | 许可 | 借什么 |
|---|---|---|---|
| SDF 文字 | [troika-three-text](https://github.com/protectwise/troika) | MIT | 3D 文字/字距/换行 |
| MSDF 生成 | [msdfgen](https://github.com/Chlumsky/msdfgen) | MIT | 高质量字形图集 |
| 字体解析 | [opentype.js](https://github.com/opentypejs/opentype.js) | MIT | 路径/度量/子集 |
| 字体子集 | [fonttools](https://github.com/fonttools/fonttools) | MIT | `pyftsubset`，必须用 |
| 文本塑形 | [HarfBuzz](https://github.com/harfbuzz/harfbuzz) | MIT | 复杂文字/连字 |
| 字体分发 | [Fontsource](https://github.com/fontsource/fontsource) | MIT | 自托管字体 |
| 字体库 | [Google Fonts](https://github.com/google/fonts) | 多种 OFL/Apache | 找可商用字体 |
| 中文 | [Noto CJK](https://github.com/notofonts/noto-cjk) | OFL-1.1 | 思源宋体/黑体 |

## 11.7 资产

| 任务 | 来源 | 许可 | 备注 |
|---|---|---|---|
| HDRI/PBR/模型 | [Poly Haven](https://polyhaven.com) | CC0 | 首选 |
| PBR 纹理 | [ambientCG](https://ambientcg.com) | CC0 | 种类多 |
| 低模/音效 | [Kenney](https://kenney.nl) | CC0 | 游戏风 |
| 低模 | [Quaternius](https://quaternius.com) | CC0 | 风格化 |
| 模型 | [Sketchfab](https://sketchfab.com) | 逐个查 | 下载前看许可 |
| 模型优化 | [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | MIT | Draco/Meshopt/合并 |
| 纹理压缩 | [KTX-Software](https://github.com/KhronosGroup/KTX-Software) | Apache-2.0 | KTX2/Basis |
| 3D 编辑 | [Blender](https://www.blender.org) | GPL | 仅作为工具，不 distributing |
| 图片处理 | [ImageMagick](https://github.com/ImageMagick/ImageMagick) | ImageMagick License | 批处理；注意策略 |

## 11.8 QA / 编码 / 视觉分析

| 任务 | 项目 | 许可 | 借什么 |
|---|---|---|---|
| 编码/滤镜 | [FFmpeg](https://github.com/FFmpeg/FFmpeg) | LGPL/GPL | 一切 |
| 质量指标 | [VMAF](https://github.com/Netflix/vmaf) | BSD-2-Clause + PATENTS | VMAF/PSNR/SSIM |
| 感知指标 | [Butteraugli](https://github.com/google/butteraugli) | Apache-2.0 | 感知差异 |
| 浏览器自动化 | [Playwright](https://github.com/microsoft/playwright) | Apache-2.0 | 截图/录制/交互 |
| 浏览器自动化 | [Puppeteer](https://github.com/puppeteer/puppeteer) | Apache-2.0 | CDP 封装；npm 装不上时用原生 CDP |
| 原生 CDP | [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface) | MIT | 只看它的 API 形状；本项目用 `tools/lib/cdp.mjs`（Node 22 自带 WebSocket） |
| 图像处理 | [OpenCV](https://github.com/opencv/opencv) | Apache-2.0 | 差分/直方图/光流 |
| 色彩 | [colour-science](https://github.com/colour-science/colour) | BSD-3 | 色度/传递函数 |
| 色彩管理 | [OpenColorIO](https://github.com/AcademySoftwareFoundation/OpenColorIO) | BSD-3 | LUT/ACES |
| 视觉模型 | [Qwen2.5-VL](https://github.com/QwenLM/Qwen2.5-VL) | Apache-2.0 | 画面语义质检 |
| 视觉模型 | [Florence-2](https://huggingface.co/microsoft/Florence-2-large) | MIT（见模型卡） | 检测/描述 |
| 图像质量 | [pyiqa](https://github.com/chaofengc/IQA-PyTorch) | ⚠️ PolyForm Noncommercial | 指标全；**不可商用** |
| 超分 | [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) | BSD-3-Clause | 修复/放大 |
| 插帧 | [Practical-RIFE](https://github.com/hzwer/Practical-RIFE) | MIT | 24→48/60fps |
| 光流 | [RAFT](https://github.com/princeton-vl/RAFT) | BSD-3-Clause | 运动分析/插帧参考 |

## 11.9 许可陷阱（务必看）

| 项目 | 陷阱 |
|---|---|
| [lygia](https://github.com/patriciogonzalezvivo/lygia) | Prosperity 3.0：**非商用**；商用 MV 不能用 |
| [pyiqa](https://github.com/chaofengc/IQA-PyTorch) | PolyForm Noncommercial：**非商用** |
| [Essentia](https://github.com/MTG/essentia) | AGPL-3.0：网页服务可能触发源码开放 |
| [Hydra](https://github.com/hydra-synth/hydra) | AGPL-3.0：嵌入在线播放器风险高 |
| madmom 模型 | CC BY-NC-SA：**非商用** + 相同方式共享 |
| [Theatre.js Studio](https://github.com/theatre-js/theatre) | Studio 是 AGPL；core 是 Apache-2.0，别搞混 |
| [Remotion](https://github.com/remotion-dev/remotion) | 公司 >3 人需付费许可 |
| [GSAP](https://github.com/greensock/GSAP) | 部分插件收费；商用查清单 |
| [p5.sound](https://github.com/processing/p5.js) | LGPL；动态链接注意 |
| [Mixamo](https://www.mixamo.com) | Adobe 许可；不得再分发模型 |
| [Deforum](https://github.com/deforum-art/deforum-stable-diffusion) | 依赖的模型/权重各有许可 |
| [ComfyUI](https://github.com/comfyanonymous/ComfyUI) | GPL-3.0 |
| [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) | AGPL-3.0 |

## 11.10 选轮子的五个问题

1. **许可**：能商用吗？要署名吗？有传染性吗？
2. **维护**：最近 6 个月有提交吗？issue 有人回吗？
3. **体积**：gzip 后多大？会拖慢首屏吗？
4. **依赖**：依赖树有多深？有没有已知漏洞？
5. **可替换**：如果它明天不维护了，我能换掉吗？

三个「不」就自己写。你需要的往往只是一个 100 行的 shader，不是一个 50k 星的框架。

## 11.11 本项目实际用了什么

```
three@0.180        MIT
vite@7             MIT
Edge headless      proprietary (host)
CDP (WebSocket)    protocol
FFmpeg 7.1         GPL build (imageio-ffmpeg)
Python numpy       BSD
soundfile          BSD
Pillow             HPND
```

**没有**用：React、GSAP、Theatre、postprocessing 库、puppeteer、ImageMagick。
不是这些不好，是「少一个依赖，少一种失败方式」。
