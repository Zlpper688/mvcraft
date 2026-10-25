# 08 · 资产与许可：能用的、不能用的、必须记的

> 一支 MV 翻车，最常见的原因不是渲染，是字体/音乐/模型的授权。
> 这一章给你一套「先查、再用、留证」的流程。

## 8.1 资产台账（每个项目都要有）

在项目根目录建 `assets.json`（或 CSV），每个资产一条：

```json
{
  "id": "font-noto-serif-sc",
  "type": "font",
  "path": "public/fonts/noto-serif-sc.woff2",
  "source": "https://github.com/notofonts/noto-cjk",
  "license": "OFL-1.1",
  "attribution": "Noto Serif SC, Copyright 2017 Adobe",
  "commercial": true,
  "modifications": "subset to 312 glyphs via pyftsubset",
  "verified": "2026-10-20"
}
```

字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| id | 是 | 唯一标识 |
| type | 是 | font / texture / hdri / model / audio / video / reference / code |
| path | 是 | 仓库内路径（或 `external`） |
| source | 是 | 原始 URL / 购买凭证编号 |
| license | 是 | SPDX 标识或全名 |
| attribution | 否 | 要求的署名文本 |
| commercial | 是 | 是否允许商用 |
| modifications | 否 | 子集/裁剪/改色 |
| verified | 是 | 最后核对日期 |

**没有台账的资产 = 不能用。**

## 8.2 许可证速查

| 许可 | 商用 | 署名 | 传染性 | 典型用途 | 风险 |
|---|---|---|---|---|---|
| MIT / BSD / ISC | ✅ | 保留版权声明 | 无 | 代码、部分字体 | 低 |
| Apache-2.0 | ✅ | 保留 NOTICE | 无（专利授权） | 代码、模型 | 低 |
| OFL-1.1 | ✅ | 保留版权与许可 | 字体本身需同许可 | 字体 | 低（不得单独售卖字体） |
| CC0 | ✅ | 否 | 无 | 纹理、HDRI、音效 | 低 |
| CC BY 4.0 | ✅ | 必须署名 | 无 | 纹理、音乐、图片 | 低 |
| CC BY-SA 4.0 | ✅ | 必须署名 | **相同方式共享** | 音乐、图片 | 成品可能被要求同许可 |
| CC BY-NC 4.0 | ❌ | 必须 | 无 | 音乐、模型 | **不可商用** |
| GPL-2/3 | ✅ | 保留 | **强传染** | 工具、插件 | 分发成品可能触发 |
| AGPL-3.0 | ✅ | 保留 | **网络分发也触发** | Hydra、Essentia | 网页服务风险极高 |
| LGPL | ✅ | 保留 | 弱传染（动态链接） | FFmpeg、p5.sound | 需谨慎 |
| 商业/自定义 | 看合同 | 看合同 | 看合同 | GSAP、Remotion、Mixamo | 必须读条款 |

**SPDX 查询**：https://spdx.org/licenses/

### 常见的坑

- **「免费下载」≠ 可商用**：很多字体/模型站点的免费仅限个人。
- **CC BY-NC 的模型**：不能用于有广告/赞助/付费墙的 MV，哪怕你不直接卖片子。
- **AGPL 的网页库**：如果你把 Hydra/Essentia 放进在线播放器，可能触发源码开放义务。
- **Remotion**：公司 >3 人需要付费许可；个人/小团队免费但有条件。
- **GSAP**：核心免费，但部分插件（SplitText 等）是会员制；商用前查清单。
- **Mixamo**：Adobe 许可，允许商用，但不得再分发模型本身。
- **字体子集**：子集化不改变许可；OFL 仍要求保留版权与许可。
- **AI 生成图/模型**：版权状态因司法辖区而异；商用前查模型卡与平台条款。

## 8.3 字体

### 推荐（可商用）

| 字体 | 语言 | 许可 | 来源 |
|---|---|---|---|
| Noto Serif SC / Noto Sans SC | 中文 | OFL-1.1 | https://github.com/notofonts/noto-cjk |
| Source Han Serif / Sans | 中文 | OFL-1.1 | 同上（Adobe 版本） |
| Cormorant Garamond | 拉丁 | OFL-1.1 | https://github.com/CatharsisFonts/Cormorant |
| Inter | 拉丁 | OFL-1.1 | https://github.com/rsms/inter |
| IBM Plex | 拉丁/多语 | OFL-1.1 | https://github.com/IBM/plex |
| JetBrains Mono | 拉丁 | OFL-1.1 | https://github.com/JetBrains/JetBrainsMono |
| Caveat / Kalam | 手写 | OFL-1.1 | Google Fonts |

**不要**从「字体下载站」拿不知名中文字体；90% 是盗版或仅限个人。

### 子集化（必须做）

中文字体全量 5–20MB，网页/成品都不该全量加载。只保留用到的字：

```bash
pip install fonttools brotli
pyftsubset NotoSerifSC-Regular.otf \
  --text-file=chars.txt \
  --flavor=woff2 \
  --output-file=public/fonts/noto-serif-sc.woff2 \
  --layout-features='*' \
  --no-hinting
```

- `chars.txt`：从字幕/片名/credits 收集所有字符（去重）。
- 保留标点、数字、英文字母；否则会出现「豆腐块」。
- 用 `--layout-features='*'` 保留连字/字距；中文影响不大，英文衬线很重要。
- 改文案后必须重新子集化；否则新字不显示。
- 验证：在浏览器里渲染每一条字幕，检查缺字（`document.fonts.check` 不可靠，直接看截图）。

工具：[fonttools](https://github.com/fonttools/fonttools)、[fontsource](https://github.com/fontsource/fontsource)、
[Google Fonts](https://github.com/google/fonts)。

## 8.4 纹理与 HDRI

### 推荐来源

| 来源 | 许可 | 内容 | 备注 |
|---|---|---|---|
| [Poly Haven](https://polyhaven.com) | CC0 | HDRI、PBR 纹理、模型 | 质量高，首选 |
| [ambientCG](https://ambientcg.com) | CC0 | PBR 纹理 | 种类多 |
| [Kenney](https://kenney.nl) | CC0 | 低多边形模型、UI、音效 | 游戏风 |
| [Quaternius](https://quaternius.com) | CC0 | 低多边形模型 | 风格化 |
| [Wikimedia Commons](https://commons.wikimedia.org) | 多种 | 图片/扫描 | 逐张查许可 |
| [Sketchfab](https://sketchfab.com) | 多种 | 模型 | 必须看每个模型的许可 |

### 优化

- 纹理：2K 足够（1080p 输出）；用 KTX2/Basis 压缩，显存降 4–6×。
- 法线贴图：不要 sRGB；不要和 albedo 共用一张。
- HDRI：2K–4K 足够；用 `RGBE`/`.hdr`，不要 8-bit JPG。
- 模型：Draco/Meshopt 压缩；合并材质；限制材质数 ≤ 4/模型。
- 工具：[glTF-Transform](https://github.com/donmccurdy/glTF-Transform)（MIT）、
  [KTX-Software](https://github.com/KhronosGroup/KTX-Software)（Apache-2.0）、
  [Blender](https://www.blender.org)（GPL，仅作为工具）。

## 8.5 音频

### 权利

一首歌要公开使用，通常需要：

- **母带权（master）**：录音版权，归唱片公司/艺人。
- **词曲权（publishing/sync）**：作曲/作词版权，归词曲作者/版权代理。
- **表演权**：公开播放/广播的授权（平台通常处理）。

用户提供的音频，**默认只用于本地/私人项目**。要公开发布，必须由用户确认拥有或已获授权。
Agent 不应替用户判断「应该没问题」。

### 技术处理

- 分析用 22.05kHz 单声道；成品用原始立体声。
- 响度：流媒体目标 −14 LUFS（±1），真峰 ≤ −1 dBTP。
- 不要过度压缩；MV 的动态是情绪的一部分。
- 淡入/淡出：0.05–0.3s，避免爆音。
- 导出：AAC 256k 或 PCM；采样率保持 44.1/48kHz。

```bash
ffmpeg -i song.mp3 -af loudnorm=I=-14:TP=-1:LRA=11 -ar 48000 -c:a aac -b:a 256k out.m4a
```

### 不要提交

- 歌曲音频、歌词文本、封面图、艺人照片。
- 采样包（即使 CC0，也没必要进仓库）。
- 用户未公开的工程文件。

在 `.gitignore` 里排除 `public/audio/*`，并提供 `public/audio/README.md` 说明放置方式。

## 8.6 参考图与「风格模仿」

- 参考图只用于**内部沟通**，不要放进成品或公开仓库（除非有授权）。
- 「模仿某位导演/艺术家的风格」在版权上通常不违法（风格不受版权保护），
  但**模仿具体作品**（构图/角色/场景）可能侵权。
- 不要把「某电影截图」直接作为纹理/背景。
- 用文字描述提取「视觉规则」（光比、色温、材质），而不是复制画面。

## 8.7 AI 生成资产

- 查模型卡：FLUX.1 [schnell] 是 Apache-2.0；FLUX.1 [dev] 是非商用；
  SDXL 是 CreativeML OpenRAIL++-M；Qwen-Image 是 Apache-2.0（以模型卡为准）。
- 输出图的版权在多数辖区**不明确**；商用前咨询法律意见。
- 保留生成参数（模型、seed、prompt）作为台账。
- 不要用 AI 生成「看起来像某位在世艺术家」的作品并商用。
- 人物肖像：需要肖像权授权；不要生成真实人物。

## 8.8 公开仓库检查清单

- [ ] `public/audio/` 只有 README，没有音频。
- [ ] `public/lyrics.json` 不在仓库（或只有用户原创且授权）。
- [ ] 字体是 OFL/Apache 等可再分发许可，且保留 LICENSE。
- [ ] 纹理/模型有 `assets.json` 台账，许可允许再分发。
- [ ] 没有参考图/电影截图。
- [ ] 没有 `.env`、API key、签名 URL。
- [ ] `THIRD_PARTY_NOTICES.md` 完整。
- [ ] README 明确说明「示例不含音频/歌词」。
- [ ] 成品 MP4 不进 Git（用 Release/LFS/外链）。

## 8.9 许可核对的三个问题

拿到任何资产，问：

1. **我能商用吗？**（有广告/赞助/付费都算商用）
2. **我要署名吗？**（署名写在哪？片尾卡/README/描述）
3. **我改了之后，还能用原许可分发吗？**（SA/AGPL/OFL 修改条款）

三个都答不上来，就换一个资产。**值得为一张纹理冒下架风险吗？不值得。**
