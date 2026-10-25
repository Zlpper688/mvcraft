# 《我爱你》· A LETTER TO THE MOON

mvcraft 的参考实现：一首 5 分 10 秒的曲子，27 个机位、14 个场景、7444 帧，
1920×804 / 24 fps，纯 `render(t)` 确定性渲染。

它演示的不是「怎么用 Three.js 做一个场景」，而是**整条工序怎么落地**：
冻结画风、镜头表驱动、音乐地图、字幕时序、主体可见性、时序 QA、逐帧导出。

> 仓库内**不包含**原曲音频与歌词。`public/audio/song.mp3` 是等长静音占位，
> 只用于开箱运行。画面按原曲的分析数据运动，但听不到声音。

## 静帧

| | |
|---|---|
| ![片名](stills/01-title.jpg) | ![海 · 月](stills/02-sea-moon.jpg) |
| ![纸阶](stills/03-paper-stairs.jpg) | ![镜我](stills/04-mirror.jpg) |
| ![逆雨](stills/05-reverse-rain.jpg) | ![月渡](stills/06-under-the-moon.jpg) |
| ![星海](stills/07-moon-sea.jpg) | ![片尾](stills/08-end-card.jpg) |

## 跑起来

需要 Node 22+、Python 3.10+、一台有 WebGL2 的 Chromium（Edge/Chrome）。

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

没有音频也能播：播放器会退回墙钟计时。想听声音就换成你有权使用的歌：

```bash
cp /path/to/your-song.mp3 public/audio/song.mp3
npm run analyze      # 需要 numpy / soundfile / Pillow
```

换歌会改变时长。同步修改：

1. `src/data/shots.js` 的 `DURATION`、`SHOTS`；
2. `storyboard.json` 的 `duration` / `sections` / `shots`；
3. 跑 `node ../../tools/validate-storyboard.mjs storyboard.json --analysis public/analysis/analysis.json`。

## 导出

先保持 `npm run dev` 在另一个终端运行，然后：

```bash
npm run render                          # 逐帧 → shots/export/frames/*.jpg
npm run render:sw                       # 没有 GPU 时用 SwiftShader（慢 ~13×）
```

编码、时序 QA、VMAF、响度检查见 [../../tools/README.md](../../tools/README.md) 和
[../../references/09-qa-export.md](../../references/09-qa-export.md)。最短路径：

```bash
bash ../../tools/qa-video.sh out/film.mp4 public/analysis/analysis.json \
  --storyboard storyboard.json --ref shots/export/frames --ref-fps 24
```

## 代码地图

```
src/
├─ main.js              播放器、时间轴、UI、__MV 页面契约
├─ core/
│  ├─ engine.js         WebGL 渲染器 + 后处理 + 确定性 capture
│  ├─ camera.js         createRig / key / Catmull-Rom 运镜
│  ├─ overlay.js        字幕、片名、片尾卡（Canvas 2D）
│  ├─ materials.js      共享材质
│  ├─ objects.js        信、纸鱼、红线、月亮等母题
│  ├─ shaders.js        GLSL
│  ├─ textures.js       程序化纹理
│  ├─ audio.js          分析数据读取与插值
│  └─ utils.js
├─ data/
│  ├─ shots.js          27 镜：时间、场景、机位、转场
│  ├─ subtitles.js      原创诗行 + 歌词载入
│  └─ glyphs.js         字形/印章
└─ scenes/              14 个场景，每个导出 views + update(t)
```

场景接口：

```js
build({ tex, analysis, aspect }) -> {
  id, scene, camera,
  rig,                       // createRig 实例，rig.update(progress, t, energy)
  views: { wide, close, ... },// 每个 view 调用 setView 切机位
  setView(name),
  update(t, localT, shot, analysis) -> post | undefined
}
```

## 页面契约（工具依赖）

`window.__MV` 必须提供：

| 字段 | 用途 |
|---|---|
| `ready` | 资源就绪 |
| `duration` / `shots` | 时间轴与分镜 |
| `renderAt(t)` | 纯函数式渲染到时间 t |
| `capture(type, q)` | 同一任务内读回 canvas |
| `scene` / `camera` | `probe.mjs` 做屏幕空间/可见性检查 |

`renderAt(t)` 与 `capture()` 必须在同一个任务里调用（本实现由 `export.mjs` 用一条
`Runtime.evaluate` 完成），否则 WebGL 缓冲可能已被清空。

## 许可

代码 MIT；文档 CC BY 4.0；字体为 SIL OFL；静帧 CC BY 4.0。
原曲音频与歌词**不在仓库内**。详见 [../../THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)。
