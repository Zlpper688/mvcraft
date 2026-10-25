# 09 · 验收与导出：把「我觉得行」变成数字

> 这一章是整本手册的底线。前面的审美都可以争论，这里的阈值不能。

## 9.1 确定性导出的三条铁律

1. **时间驱动**：场景必须是 `render(t)` 的纯函数。禁止 `requestAnimationFrame` 累积时间、
   禁止 `Date.now()`、禁止物理步进依赖帧率。
2. **同任务读回**：`renderAt(t)` 后立刻在同一个 JS 任务里 `canvas.toDataURL()`；
   不要等下一帧、不要用系统截图（会把浏览器 UI/缩放/字体抗锯齿混进来）。
3. **固定画布**：内部渲染分辨率固定（本项目 1920×804），不随窗口/DPR 变化。

只要这三条成立，同一时间点渲染两次的像素必须一致（JPEG 编码也一致）。

## 9.2 导出器怎么工作

`tools/export.mjs`：

```
启动 Edge headless
  → 打开页面（?render=1）
  → 等 window.__MV.ready
  → 等 document.fonts.ready
  → 逐个场景预热（渲染中段一帧，编译 shader）
  → for each frame:
       t = frame / fps
       dataUrl = renderAt(t) + capture(format, quality)   // 同一任务
       write temp file → rename（原子写）
  → 结束：校验帧数、报错数
```

参数：

```bash
node tools/export.mjs --fps 24 --gl d3d11 --quality .96
node tools/export.mjs --fps 24 --resume           # 断点续跑
node tools/export.mjs --from 120 --to 240         # 只渲染区间
node tools/export.mjs --bench-only                # 只测速，不写帧
node tools/export.mjs --w 1920 --h 804 --url http://127.0.0.1:5173
```

### 先测速，再决定

```bash
node tools/export.mjs --fps 24 --gl d3d11 --bench-only
node tools/export.mjs --fps 24 --gl swiftshader --bench-only
```

本项目实测（1920×804，复杂场景平均）：

| 后端 | 每帧 | 7444 帧预计 |
|---|---|---|
| D3D11 (ANGLE, 硬件) | 39–55 ms | 5.7–6.7 分钟 |
| SwiftShader (CPU) | 516 ms | 64 分钟 |

**先跑 bench，再选后端。** 如果没有 GPU，先用 0.5× 分辨率做 look-dev，
最后再全分辨率渲染。

### 常见错误

| 现象 | 原因 | 修法 |
|---|---|---|
| 字体不对/回退 | 没等 `document.fonts.ready` | 等字体 + 预热 |
| 第一帧黑 | shader 未编译 | 渲染每个场景中段一帧预热 |
| 帧数少 | 页面崩溃/上下文丢失 | 日志、分块、`--resume` |
| 画面有浏览器 UI | 用了系统截图 | 只用 `toDataURL` |
| 每帧都不同 | 实时 rAF/随机数 | 用 `render(t)` + 固定 seed |
| 磁盘满 | JPEG q0.96 全片 2GB+ | 留 3× 空间；考虑 q0.92 |

## 9.3 QA 分五层

| 层 | 检查 | 工具 | 何时 |
|---|---|---|---|
| L1 运行时 | 未捕获异常、console.error、网络 4xx/5xx | CDP | 每次跑 |
| L2 单帧 | 黑帧、冻结、主体可见、字幕碰撞、片名停留 | 截图 + 脚本 | 每镜/每次改 |
| L3 时序 | 黑段、冻结段、场景切换、闪烁 | ffmpeg | 每次成片 |
| L4 编码 | VMAF/SSIM/PSNR、码率、色彩范围 | ffmpeg | 每次导出 |
| L5 人工 | 抽帧、完整看两遍 | 人 | 交付前 |

L1/L2 在渲染前就能发现问题；L3/L4 只验证「导出没坏」，不能替代 L2。

## 9.4 L1：运行时零错误

CDP 监听：

```js
Runtime.exceptionThrown      // 未捕获异常
Runtime.consoleAPICalled     // console.error
Log.entryAdded               // 资源加载失败
Network.responseReceived     // status >= 400
```

允许的例外：

- `favicon.ico` 404（浏览器自动请求，无害）
- 被 `try/catch` 且已上报的音频解码失败（有墙钟 fallback）

**任何其他错误都必须修。** 不要用「画面看起来没事」放过异常。

## 9.5 L2：单帧检查

### 主体可见性

三种方法，按可靠性排序：

1. **隐藏差分**：渲染「有主体」与「无主体」两帧，差分像素数 / 主体投影面积 > 0.5。
   最真实，但需要能隐藏主体。
2. **Raycaster 采样**：从屏幕 5×5 网格发射射线，命中主体包围盒的比例 ≥ 0.6。
   注意：必须断言命中的是**主体对象**，不是同位置的其他物体（本项目曾误选一盏灯，
   得出 dot=0.78 的错误结论）。
3. **投影面积**：主体包围盒投影到屏幕，面积 ≥ 画面 2%。只能证明「在画面里」，
   不能证明「没被挡住」。

建议：日常用 2，交付前用 1 抽查关键镜头。

```js
// 5×5 采样
const hits = [];
for (let y = 0.1; y <= 0.9; y += 0.2) {
  for (let x = 0.1; x <= 0.9; x += 0.2) {
    raycaster.setFromCamera(new THREE.Vector2(x * 2 - 1, -(y * 2 - 1)), camera);
    raycaster.far = 100;
    const hit = raycaster.intersectObjects(subjectMeshes, true)[0];
    hits.push(hit || null);
  }
}
const visible = hits.filter(h => h && isDescendantOfSubject(h.object)).length;
```

### 字幕碰撞

对每条字幕的中间时刻：

```
overlap = 主体屏幕包围盒 ∩ 字幕框 / 字幕框面积
阈值：< 0.15
```

主体包围盒要包含所有可见主体；字幕框要包含底板（不是文字本身）。

### 标题/片尾卡停留

- 片名 ≥ 2s；片尾卡 ≥ 4s；版权行 ≥ 2s。
- 用 overlay 的 `OPEN/FINAL/END_MARK` 时间窗校验，或对已知文字区域做像素差分。

### 黑帧与冻结（单帧版）

- 画面平均亮度 < 0.02 且不是片尾/转场 → 失败。
- 连续两帧差分 < 0.1% → 冻结（除非是刻意的静止镜头，需在分镜里标记 `still: true`）。

## 9.6 L3：时序检查（ffmpeg）

设：

```bash
FFMPEG=ffmpeg   # 或 imageio-ffmpeg 的路径
FILM=out/film.mp4
```

### 黑段

```bash
"$FFMPEG" -hide_banner -i "$FILM" \
  -vf "blackdetect=d=0.5:pix_th=0.10" -an -f null - 2>&1 | grep blackdetect

# 用工具时直接把分镜传给 QA，自动排除已登记的转场窗口
bash tools/qa-video.sh "$FILM" public/analysis/analysis.json --storyboard storyboard.json
```

规则：

- 非转场、非片尾的黑段 > 0.5s → 失败。
- 转场窗口（`shot.start ± trans.duration/2`）内的黑段 → 忽略。
- 片尾黑场允许，但必须 ≥ 4s 且包含片尾卡（不是纯黑）。

**本项目事故**：27 个转场边界被 blackdetect 报为黑帧；原因是转场居中在切点，
边界帧本来就是暗的。修法不是改画面，而是让 QA 排除转场窗口。
`qa-video.sh --storyboard` 只白名单 `fade`/`dip`/`ink` 三种会压到黑的转场；
黑段与转场窗口的重叠 < 60% 时仍然报错。

### 冻结

```bash
"$FFMPEG" -hide_banner -i "$FILM" \
  -vf "freezedetect=n=-60dB:d=1" -an -f null - 2>&1 | grep freezedetect
```

- 非刻意静止镜头 > 1s → 失败。
- 视频编码会把静态画面压成完全相同的帧；`freezedetect` 对「缓慢呼吸」的镜头也可能误报。
  结合分镜的 `still` 标记判断。

### 场景切换 / 闪烁

```bash
"$FFMPEG" -hide_banner -i "$FILM" \
  -vf "scdet=threshold=10" -an -f null - 2>&1 | grep scdet

"$FFMPEG" -hide_banner -i "$FILM" \
  -vf "photosensitivity=frames=30:threshold=0.5:bypass=1" -an -f null - 2>&1 | grep photosensitivity
```

- `scdet` 报出的切点应与分镜切点对齐（误差 < 0.1s）；多出来的切点 = 未登记的跳变。
- 闪烁：`photosensitivity` 报出的帧必须全部在分镜的 `flash` 白名单里
  （本项目只有 4 次 flash，时长 0.5–1.3s）。
- 不允许「频闪式」剪辑（每秒 >3 次全屏明暗跳变）。

### 块效应 / 模糊

```bash
"$FFMPEG" -hide_banner -i "$FILM" -vf "blockdetect=period_min=4:period_max=16" -an -f null - 2>&1 | tail -20
"$FFMPEG" -hide_banner -i "$FILM" -vf "blurdetect=block_pct=80" -an -f null - 2>&1 | tail -20
```

- 块效应分数突然升高 → 码率不够/CRF 太高。
- 模糊分数升高 → 运动模糊过强/编码过度降噪。

## 9.7 L4：编码保真（VMAF/SSIM）

参考 = 导出的帧序列；测试 = 成片。两者必须同分辨率/帧率/像素格式。
libvmaf 的第一个输入是**被测（失真）视频**，第二个是参考。

```bash
# 全片；参考必须是 %06d 序列，不要只传第一张
"$FFMPEG" -hide_banner \
  -i "$FILM" \
  -framerate 24 -start_number 1 -i shots/export/frames/%06d.jpg \
  -lavfi "[0:v]setpts=PTS-STARTPTS,format=yuv420p[d];\
          [1:v]setpts=PTS-STARTPTS,format=yuv420p[r];\
          [d][r]libvmaf=log_fmt=json:log_path=out/vmaf.json:n_threads=8" \
  -f null -

# 或者一条命令带阈值判定
bash tools/qa-video.sh "$FILM" --ref shots/export/frames --ref-fps 24 \
  --storyboard storyboard.json
```

只看前 2 秒时给输出加 `-t 2`（不是给第一个 `-i` 加）。
参考与成片尺寸不同时，先用 `scale` 到同一尺寸再进 libvmaf；工具会自动处理。

阈值（工具默认用「底线」，交付目标更高）：

| 源 | VMAF mean 目标/底线 | VMAF min 目标/底线 | SSIM |
|---|---|---|---|
| PNG 无损帧 | 95 / 93 | 90 / 88 | ≥ 0.99 |
| JPEG q≥0.95 | 92 / 90 | 86 / 85 | ≥ 0.98 |

本项目（JPEG q0.96，前 2 秒）：VMAF mean **90.97**、min **85.43**、SSIM >0.98；
过底线，未到目标。JPEG 源本身有压缩噪声；要提高就用 PNG 导出或更高 CRF。

**本项目事故**：一次 VMAF 只有 **1.07**。原因不是编码坏，而是参考只传了第一张
`000001.jpg`，整段都在和同一帧比。改成 `%06d` 序列后回到 98.9。
VMAF 异常低时，先核对帧序列、起始编号、fps，再怀疑编码。

PSNR 可选（工具不跑）：需要时把 `libvmaf` 换成 `psnr` 再跑一遍。
PSNR 对颗粒和轻微位移很敏感，不作为硬门槛。

注意：

- VMAF 对「颗粒」敏感；颗粒重的风格会天然低 1–2 分。
- VMAF 不测音频、不测字幕可读性、不测叙事。
- 不要用 VMAF 优化「审美」；它只证明编码没坏。

## 9.8 音频检查

### 响度与真峰

```bash
"$FFMPEG" -hide_banner -i "$FILM" -af ebur128=peak=true -f null - 2>&1 | tail -30
```

目标：

- Integrated loudness：−14 LUFS（±1）
- True peak：≤ −1 dBTP
- LRA：5–15 LU（太窄 = 压死，太宽 = 动态过大）

### 与源对比

```bash
"$FFMPEG" -hide_banner -i public/audio/song.mp3 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
"$FFMPEG" -hide_banner -i "$FILM" -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
```

- 成片与源的差应 < 1dB（如果你没有做母带处理）。
- 源本身削波（max 0.0dB）时，不要试图「修复」；保持忠实，或让用户提供更好的源。

### 同步

- 音频起点必须是 0；不要在 ffmpeg 里加 `-itsoffset` 除非有意。
- 用 `-shortest`；视频比音频长 0.1s 会导致最后一帧黑。
- 抽 3 个点（开头/中段/结尾）对齐画面事件与听感；不能只靠波形。

## 9.9 人工复核（不可省）

每次交付前，抽这 10 个时间点截图，拼成一张 contact sheet：

```
0.5s（片名）
段落首帧 × 每个段落
全片最亮帧
全片最暗帧
副歌峰值
最后一句字幕
片尾卡
```

用 `tools/contact-sheet.sh`：

```bash
# 指定时间点
bash tools/contact-sheet.sh out/film.mp4 0.5,19.5,44.5,74.5,104.5,305.5 out/contact.jpg

# 或者均匀抽 24 张，每格带时间码
bash tools/contact-sheet.sh out/film.mp4 --count 24 --cols 6 --label out/contact-all.jpg
```

常用参数：`--every 5`（每 5 秒一张）、`--count N`（总张数）、`--cols N`（列数）、
`--width 640`（单格宽度）、`--quality 3`（ffmpeg qscale，越小越好）、`--label`（烧时间码）。
时间点也可以写成「0:30,1:45」这种分秒格式。

检查：

- 是否像同一部片（色板/字体/颗粒）。
- 是否有明显的构图重复。
- 字幕是否挡主体。
- 片名/片尾是否可读。
- 峰值是否真的最强。

## 9.10 报告模板

```json
{
  "film": "out/film.mp4",
  "duration": 310.16,
  "frames": 7444,
  "fps": 24,
  "resolution": [1920, 804],
  "storyboard": "storyboard.json",
  "registeredTransitions": 37,
  "runtime": { "exceptions": 0, "consoleErrors": 0, "networkFails": 0 },
  "temporal": {
    "blackSegments": [],
    "freezeSegments": [],
    "unregisteredCuts": [],
    "flashes": [134.0, 180.6, 210.1, 240.8]
  },
  "visibility": { "minSubjectRatio": 0.031, "subtitleCollisions": [] },
  "encode": { "vmafMean": 90.97, "vmafMin": 85.43, "ssim": 0.986, "psnr": 39.4 },
  "audio": { "lufs": -14.2, "truePeak": -1.1, "lra": 9.8 },
  "verdict": "pass"
}
```

`qa-video.sh` 会自动写出同结构报告（`<video>.qa.json` 或 `--json`），
其中 `storyboard` / `registeredTransitions` 只有在传了 `--storyboard` 时才有。
`visibility`、`runtime`、`flashes` 由其他工具产出，需要手工合并。

## 9.11 编码与交付

### 母版

```bash
"$FFMPEG" -y \
  -framerate 24 -start_number 1 -i shots/export/frames/%06d.jpg \
  -i public/audio/song.mp3 \
  -vf "scale=in_range=full:out_range=limited:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -tune film \
  -profile:v high -level 4.1 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart -shortest \
  out/film_master.mp4
```

为什么这些参数：

- `in_range=full:out_range=limited`：JPEG/PNG 是全范围，H.264 标准是有限范围；
  不转会导致「发灰/死黑」。
- `in_color_matrix=bt709:out_color_matrix=bt709`：明确矩阵，避免播放器猜。
- `-tune film`：保留颗粒，不抹细节。
- `-crf 17`：视觉无损；颗粒重的片子可以 16。
- `-movflags +faststart`：网页秒开。
- `-shortest`：音频/视频长度不一致时截断。

### 平台版

| 平台 | 分辨率 | 码率 | 备注 |
|---|---|---|---|
| YouTube | 1920×804 | 12–20 Mb/s | 上传母版 |
| Bilibili | 1920×804 | 10–16 Mb/s | 可能二次压缩；CRF 16 |
| 微信/微博 | 1280×536 | 4–6 Mb/s | 文件 <100MB |
| 网页背景 | 1280×536 | 2–4 Mb/s | 无音轨、循环 |

### 竖版

- 不要裁横版；重新构图（主体居中、减少横向信息）。
- 字幕字号 +15%，安全区更大。
- 需要单独渲染（场景的相机/构图不同），不是简单 crop。

### 交付清单

- [ ] `film_master.mp4`（母版）
- [ ] `film_1080p.mp4`（平台版）
- [ ] `poster.jpg`（封面帧）
- [ ] `storyboard.json` / `art-direction.json`
- [ ] `qa-report.json`
- [ ] `assets.json`（台账）
- [ ] `THIRD_PARTY_NOTICES.md`
- [ ] 一段 100 字以内的作品说明（母题、技术、版权）

## 9.12 最后一分钟检查

- 开头 0.5s 是不是黑？片名有没有被切？
- 结尾最后一帧是不是黑？音频有没有被截断？
- 字幕有没有错别字/缺字（尤其子集化后）？
- 片尾卡有没有漏署名？
- 文件能不能在另一台设备/浏览器播放？
- 上传后有没有被二次压缩到糊？
- 公开版本有没有把音频/歌词/未授权字体带上去？

全部通过，才算交付。
