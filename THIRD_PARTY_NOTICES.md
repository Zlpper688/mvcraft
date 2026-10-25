# Third-Party Notices

mvcraft 的代码以 MIT 发布。文档以 CC BY 4.0 发布。
仓库内**不包含**示例片的歌曲音频与歌词；示例仅保留代码、字体、分析数据与静帧。

## 随仓库分发的资产

| 资产 | 位置 | 许可 | 说明 |
|---|---|---|---|
| three.js r180 | `examples/*/package.json`（npm 安装，不 vendored） | MIT | https://github.com/mrdoob/three.js |
| Vite 7 | 同上 | MIT | https://github.com/vitejs/vite |
| Cormorant Garamond | `examples/letter-to-the-moon/public/fonts/cormorant*.woff2` | SIL Open Font License 1.1（全文见同目录 `OFL-Cormorant.txt`） | 字体子集，保留 OFL |
| Noto Serif SC | `examples/letter-to-the-moon/public/fonts/noto-serif-sc*.woff2` | SIL Open Font License 1.1（全文见同目录 `OFL-NotoSerifSC.txt`） | 字体子集，保留 OFL |
| 分析数据 | `examples/letter-to-the-moon/public/analysis/analysis.json` | 由本项目生成 | 仅含数值特征，不含音频 |
| 静音占位 | `examples/letter-to-the-moon/public/audio/song.mp3` | CC0 / 公共领域 | 310.16s 静音，不是歌曲；可删除或替换 |
| 静帧 | `examples/letter-to-the-moon/stills/*.jpg` | CC BY 4.0 | 由本项目渲染 |

字体子集（woff2）为 OFL 允许的再分发形式；若你要在公开成品中使用其他字体，
请自行核对许可，尤其是「个人免费商用需授权」的中文字体。

## 工具依赖（运行时由用户自行安装）

| 工具 | 许可 | 备注 |
|---|---|---|
| FFmpeg | LGPL-2.1+ / GPL（取决于构建） | 本机使用 imageio-ffmpeg 的 GPL 构建；分发成品不涉及 |
| Edge / Chrome | 专有 | 仅作为本地渲染宿主 |
| Python numpy / soundfile / Pillow | BSD / BSD / HPND | 分析脚本依赖 |
| libvmaf（FFmpeg 内置） | BSD-2-Clause + PATENTS | QA 使用 |

## 明确未包含 / 不可分发

- 示例曲目音频、歌词文本、封面图：版权归原权利人。
- 文档中引用的第三方项目**未** vendored；使用时请遵守各自许可。
- 文档中标注为 NC / AGPL / 商业许可的项目，仅作技术参考，**不要**直接并入可分发成品。

## 参考项目

`references/11-tool-index.md` 列出了大量第三方项目及其许可。许可信息以各项目仓库为准；
本项目不对第三方许可的准确性作法律保证。商用前请自行复核。
