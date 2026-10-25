# 03 · 分镜：镜头语法、时长与字幕时序

> 分镜不是「镜头列表」，是**观众注意力的一份预算表**。每个镜头都要回答：观众现在看哪、为什么看、看完知道什么。

## 3.1 镜头不是画面，是功能

每个镜头只承担一个功能。功能重复 = 浪费观众注意力。

| 功能 | 作用 | 典型景别/焦段 | 时长 |
|---|---|---|---|
| 建立（establish） | 告诉观众「这是哪、多大」 | 广角 24–35mm | 4–10s |
| 跟随（follow） | 让观众进入运动 | 35–50mm，稳定器 | 3–8s |
| 细节（detail） | 提供质感与证据 | 50–85mm，浅景深 | 2–5s |
| 微距（macro） | 制造陌生感/放大情绪 | 85–100mm 微距 | 3–8s |
| 插入（insert） | 强调一个物件/动作 | 任意，短 | 0.5–2s |
| 反应（reaction） | 情绪落点（有人物时） | 85mm+ | 2–4s |
| 转场镜（transition） | 连接两个世界 | 任意 | 1–3s |
| 呼吸（breathe） | 让观众消化 | 固定/极慢 | 3–8s |

**检验**：把分镜表的功能列连起来读。如果连续三个都是「细节」，观众会疲劳；
连续三个「建立」，观众会失去焦点。

## 3.2 镜头卡（每一镜必须写清楚）

```json
{
  "id": "sea-letter",
  "start": 19.1,
  "end": 31.2,
  "name": "海 · 信",
  "function": "establish",
  "scene": "seaNight",
  "shot": "贴水面低机位，跟拍前推，35mm",
  "subject": "火漆信 + 红绳",
  "event": "信从画面右侧漂入，红绳在水面拖出细痕",
  "entry": "从上一镜的墨色涟漪中显影",
  "exit": "摇臂升起，切广角",
  "transitionIn": { "type": "cut", "duration": 0 },
  "beat": "verse-1 bar 4",
  "subtitle": "把一封信，交给潮汐。",
  "qa": { "subjectScreenArea": 0.09, "maxMotion": 0.22, "minLuma": 0.04 }
}
```

字段解释：

- `function`：见上表。强制从枚举里选，防止写「好看的空镜」。
- `subject`：画面里观众**必须看到**的东西。QA 会测它的可见像素。
- `event`：这一镜从头到尾发生了什么。如果写不出变化，这镜就是静止图，考虑合并。
- `entry`/`exit`：与前后镜的衔接方式。写不出来 = 剪辑点会跳。
- `beat`：对应音乐事件。用于检查对齐率。
- `qa`：这一镜的个性化阈值（见 09 章）。

## 3.3 镜头长度

| 段落能量 | 平均镜长 | 最短 | 最长 |
|---|---|---|---|
| 0–0.2（intro/breath） | 8–19s | 4s | 全段一镜 |
| 0.2–0.45（verse） | 6–10s | 3s | 12s |
| 0.45–0.7（pre/chorus） | 3–6s | 1.5s | 8s |
| 0.7–1.0（peak） | 1.5–3.5s | 0.8s | 5s |

硬规则：

- **< 1.5 秒**：只允许作为冲击/闪回，且前后必须各有一个 ≥3 秒的镜头缓冲。
- **> 8 秒**：必须有内部事件（光变、主体入场、焦点转移、形态变化），否则切。
- 全片至少有一个 ≥8 秒的镜头和一个 ≤2 秒的镜头；否则节奏没有张弛。

## 3.4 转场：语法，不是特效

只允许六类转场，每类有明确语义：

| 类型 | 语义 | 时长 | 用法 | 注意 |
|---|---|---|---|---|
| cut | 「同时/继续」 | 0 | 默认，70–80% 的切点 | 无 |
| fade / dip | 「时间过去了/章节结束」 | 1.2–2.4s | 段落交界、呼吸 | 别每段都用 |
| ink / dissolve | 「形态连续，世界变了」 | 0.8–1.6s | 同母题变形、场景切换 | 需要自定义 shader |
| iris | 「聚焦/进入内部」 | 1.2–1.8s | 从局部放大到全屏 | 圆心要对准主体 |
| flash | 「冲击/断点」 | 0.3–1.3s | 强拍、碎裂、破水 | **必须登记**；>0.8s 只能是柔和白场，不能频闪 |
| match | 「形状/运动连续」 | 0 | 两个镜头首尾帧对齐 | 靠分镜设计，不是后期 |

**不要**每 10 秒换一种转场。全片转场类型 ≤ 5，每个段落 ≤ 2，且必须在
`art-direction.json` 的 `transitions` 里登记。

### 转场的数学：必须跨切点居中

约定：**转场写在「进入的镜头」上**（`transitionIn`），切点 = 该镜头的 `start`。

```
transition.start = shot.start - duration / 2
transition.end   = shot.start + duration / 2
```

原因：如果转场从切点开始，观众会感觉「新镜头晚了半拍」；如果转场在切点结束，
观众会感觉「旧镜头拖了半拍」。居中才让切点落在转场最不可见的时刻。

实现上，转场通常由**后处理 shader 的进度**驱动，而不是两个场景同时渲染：

```js
// 找到当前时间落在哪个转场窗口
for (const shot of SHOTS) {
  const tr = shot.transitionIn;
  if (tr.type === 'cut') continue;
  const a = shot.start - tr.duration / 2;
  const b = shot.start + tr.duration / 2;
  if (t >= a && t <= b) {
    return { type: tr.type, progress: (t - a) / (b - a) };
  }
}
```

转场期间画面会变暗/模糊/溶解，**这是正常的**。QA 检查黑帧时必须排除转场窗口，
否则会误报（本项目就曾被 27 个转场边界误报为「黑帧」）。把分镜传给 QA 即可自动排除：

```bash
bash tools/qa-video.sh out/film.mp4 --storyboard storyboard.json
```

只有 `fade`/`dip`/`ink` 三种转场会把画面压到黑；`flash` 是白场，`iris`/`match`
通常不黑。黑段与转场窗口的重叠不足 60% 时，仍按真实黑帧报错。

## 3.5 构图与连续性

### 景别节奏

- 不要连续两个镜头同景别、同焦段、同机位高度。
- 推荐交替：广角 → 微距 → 中景 → 特写 → 广角。
- 每次切镜，至少改变两项：景别、角度、运动方向、色温、主体位置。

### 方向

- 主体从画面右侧向左运动，下一个镜头应保持大致方向（屏幕方向连续性）。
- 环绕镜头改变方向时，用「切到正面」或「切到背面」作为缓冲，不要直接反向环绕。
- 俯拍/仰拍交替会制造不安；抒情段落保持同一侧。

### 视线与留白

- 主体看画面右侧 → 右侧留白多；看左 → 左侧留白多。
- 微距主体的留白不超过画面 60%，否则会显得「小」。
- 字幕区（通常底部 12%）不要放关键主体。

### 匹配剪辑

三种可靠的 match cut：

1. **形状匹配**：圆月 → 火漆印 → 瞳孔 → 唱片。
2. **运动匹配**：下坠 → 继续下坠（换场景，速度方向一致）。
3. **颜色匹配**：红色火漆 → 红色雨伞 → 红色信号灯。

match cut 必须让观众**先感觉到连续，再意识到换了世界**。如果两个形状差异 >30%，
观众会觉得是穿帮而不是匹配。

## 3.6 结构模板

### A. 三幕（最稳）

```
建立 25% → 变形/升级 50% → 回落/落点 25%
```

适合：有明确物象旅程的歌。

### B. 回旋（A-B-A-C-A）

```
A（母题）→ B（世界 1）→ A'（母题变形）→ C（世界 2）→ A''（母题终极形态）
```

适合：副歌重复多的流行歌。每次回到 A，机位/尺度必须不同。

### C. 下坠-上升

```
高空 → 穿过云/水/城市 → 最深处（最暗）→ 反向上升 → 光
```

适合：有明显 build-drop 的电子/摇滚。注意「最深处」要真的最暗、最慢。

### D. 三联画

```
同一空间的三块时间（左/中/右），或三个并置的世界
```

适合：极简排版、概念强的歌。成本低，风格强，但容易单调——需要至少一次「打破画框」。

### E. 一镜到底（伪）

```
一个连续运动（穿门/穿雾/穿水），靠遮挡完成场景切换
```

适合：30 秒预告。实现上用「黑场/雾/水花遮住整个画面」的 0.3 秒完成替换。

## 3.7 字幕：时序、行长、避让

### 文案

- 默认**原创诗行**，不引用受版权保护的歌词。
- 一行一个意象，不要解释画面。
- 全片 8–16 条；超过 20 条会变成 KTV。
- 字幕不是歌词的替代品；它是画面的「第二声部」。

### 时间

| 规则 | 数值 |
|---|---|
| 最短停留 | 1.2s |
| 最长停留 | 8s（6s 以上优先拆分；>10s 不可接受） |
| 阅读速度 | ≤4.5 字/秒（中文），目标 3–4 |
| 条间空隙 | ≥0.3s |
| 入点 | 比乐句早 0.1–0.2s |
| 出点 | 比乐句晚 0.2–0.4s（留余韵） |
| 同时最多 | 1 条（双语可 2 行） |

计算：`duration >= chars / 4.5 + 0.6`。例如 12 字 → ≥3.27s。

### 位置与避让

- 默认底部居中，距底 8–12%；2.39:1 画面可用底部 14%。
- 安全区：左右各 6%，底部 8%，顶部 6%。
- 字号：1080p 下中文 42–56px，英文 24–30px；2.39:1 宽幅可 +10%。
- 对比：文字与局部背景的亮度差 ΔL ≥ 40；不足时加 25–40% 黑色底板或柔边阴影。
- **主体避让**：主体屏幕包围盒与字幕框重叠面积 / 字幕框面积 < 15%。

避让的三种解法（按优先级）：

1. 移动字幕到主体反方向（上/左/右）。
2. 移动机位/主体（改变构图留白）。
3. 缩短字幕或拆成两条，避开主体经过的时刻。

不要用「加一块更大的底板」解决——那会让画面变脏。

### 碰撞检测（可自动化）

在 `renderAt(t)` 后读取主体屏幕包围盒与字幕框，计算重叠比：

```js
const overlap = intersectArea(subjectRect, subtitleRect) / area(subtitleRect);
if (overlap > 0.15) report(`subtitle collision at ${t}`);
```

主体包围盒可以从场景里导出（推荐在 `window.__MV.subjects()` 暴露），
也可以对「隐藏主体前后」两帧做像素差分，取差分区域的包围盒。后者更真实，
但更慢；交付前至少对每条字幕的中间时刻跑一次。

## 3.8 分镜表的自检

在写代码前，回答这 10 个问题：

1. 每个段落的第一镜，是否都在「建立新世界」？
2. 连续三个镜头，是否至少有两项不同（景别/角度/运动/色温）？
3. 全片最亮的镜头，是否在音乐最强处？
4. 全片最暗的镜头，是否在呼吸/转折处？
5. 有没有一个镜头，删掉后完全不影响理解？有就删。
6. 有没有两个镜头，可以合并成一个？有就合。
7. 每个转场，是否都能用一句话说出「为什么这里要转」？
8. 字幕是否覆盖了所有「观众需要文字才能懂」的时刻？
9. 结尾是否停留在母题的最终形态，而不是随便一个空镜？
10. 把分镜表给别人看，他们能否在 2 分钟内复述这个故事？

## 3.9 示例：27 镜的结构

《我爱你》的分镜（完整版见 `examples/storyboard.example.json`）：

| # | 时间 | 场景 | 名称 | 功能 | 事件 | 转入 |
|---|---|---|---|---|---|---|
| 1 | 0–19.1 | prologue | 墨起 | 建立 | 墨滴散成星云，片名显影 | fade 2.4 |
| 2 | 19.1–31.2 | seaNight | 海·信 | 建立 | 信漂入，红绳拖痕 | ink 1.4 |
| 3 | 31.2–44.04 | seaNight | 海·月 | 呼吸 | 摇臂升起，月亮与倒影 | cut |
| 4 | 44.04–52.4 | fish | 字鱼 | 跟随 | 纸鱼群环绕信札 | ink 1.2 |
| 5 | 52.4–60.2 | fish | 字鱼·近 | 细节 | 纸纤维与红印呼吸 | cut |
| 6 | 60.2–67.7 | stairs | 纸阶 | 建立 | 纸阶螺旋上升 | ink 1.2 |
| 7 | 67.7–74.04 | stairs | 纸阶·随 | 跟随 | 沿阶上升，光斑漏下 | cut |
| 8 | 74.04–89.0 | threads | 红线 | 细节 | 红线放射，纸签轻响 | ink 1.2 |
| 9 | 89.0–104.04 | threads | 红线·穿 | 跟随 | 穿越红线，逼近火漆 | cut |
| 10 | 104.04–110.33 | drop | 息 | 呼吸 | 水滴悬停，全片最静 | dip 1.8 |
| 11 | 110.33–124.3 | mirror | 镜我 | 建立 | 镜面横移，倒影完整 | iris 1.5 |
| 12 | 124.3–134.04 | mirror | 镜我·入 | 跟随 | 进入镜后世界 | cut |
| 13 | 134.04–144.04 | mirror | 镜碎 | 冲击 | 镜面碎裂，碎片化光 | flash 0.55 |
| 14 | 144.04–153.9 | rain | 逆雨 | 建立 | 雨从地面升向天空 | ink 1.2 |
| 15 | 153.9–164.04 | rain | 逆雨·伞 | 跟随 | 伞下视角，雨幕 | cut |
| 16 | 164.04–173.6 | city | 字城 | 建立 | 字城飞行，招牌呼吸 | ink 1.4 |
| 17 | 173.6–180.2 | city | 字城·坠 | 跟随 | 俯冲入城，招牌掠过 | cut |
| 18 | 180.2–195.0 | descent | 坠 | 跟随 | 深水下坠，光带掠过 | flash 0.5 |
| 19 | 195.0–209.77 | moongate | 月渡·水 | 建立 | 水下仰望月亮 | ink 1.2 |
| 20 | 209.77–224.04 | moongate | 月渡·翔 | 跟随 | 破水飞向月亮 | flash 0.65 |
| 21 | 224.04–240.71 | moongate | 月渡·穿 | 穿越 | 穿过月门，光吞没画面 | cut |
| 22 | 240.71–260.71 | starsea | 星海 | 建立 | 星海展开，信成为星尘 | flash 1.3 |
| 23 | 260.71–270.71 | starsea | 光解 | 细节 | 星尘溶解成字 | cut |
| 24 | 270.71–280.71 | starsea | 成字 | 呼吸 | 字成形为「我爱你」 | cut |
| 25 | 280.71–294.04 | seaDawn | 潮归 | 回落 | 黎明海面，字退成潮水 | ink 1.6 |
| 26 | 294.04–304.97 | seaDawn | 余 | 呼吸 | 拉远，海天一线 | cut |
| 27 | 304.97–310.16 | end | 黑 | 片尾 | 黑场，片尾卡 | dip 3.0 |

注意结构：**每个段落的第一镜都是「建立」，第二镜是「跟随/细节」**。
观众每进入一个新世界，先给 4–10 秒看清楚，再开始运动。这是全片不晕的原因。

另外三个可复用的结构选择：

- **能量不是单调上升**：第 10 镜（104s）在全片中间插入 6.3 秒的「息」，之后才进副歌。
- **尺度交替**：海底（195s）→ 破水（209s）→ 月门（224s），同一场景三种尺度。
- **结尾不是最后一个音符**：304.97s 进入黑场，片尾卡到 310.16s；音乐在 310.17s 结束。

## 3.10 从分镜到代码

分镜表是唯一真相源。代码里的镜头时间必须从 `storyboard.json` 生成，
不要在 `shots.js` 里手抄一遍（本项目就曾因为两处时间不一致，导致转场偏移 0.5 秒）。

```js
// 示例：需要时另存为 tools/build-shots.mjs
import storyboard from '../storyboard.json' with { type: 'json' };
export const SHOTS = storyboard.shots.map(s => ({
  id: s.id, scene: s.scene, start: s.start, end: s.end,
  transitionIn: { type: s.transitionIn.type, duration: s.transitionIn.duration }
}));
```

## 3.11 抄作业：分镜与 animatic 的现成轮子

分镜这一段最容易「自己造编辑器」。先看清楚哪些轮子值得借、借哪一层：

| 要做的事 | 项目 | 许可 | 借什么 | 不要借什么 |
|---|---|---|---|---|
| 画分镜板、3D 预演、导出 animatic | [wonderunit/storyboarder](https://github.com/wonderunit/storyboarder) | MIT | 分镜卡字段、镜头类型命名、Shot Generator 用 three.js 摆机位的做法 | 它的项目文件格式（我们的真相源是 `storyboard.json`） |
| 和剪辑软件交换时间线 | [AcademySoftwareFoundation/OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) | Apache-2.0 | `.otio` 读写；把镜头表导进 Resolve/Premiere 做正式剪辑 | 为了用它而引入整套 Python 媒体管线 |
| 静帧 + 音乐快速出 animatic | [mifi/editly](https://github.com/mifi/editly) | MIT | 声明式 JSON 时间线、转场、字幕、音频 | 它的默认转场风格（很「模板感」） |
| React 组件化时间线 | [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | ⚠️ 自定义（>3 人公司付费） | `useCurrentFrame()` 的确定性时间轴、音频同步 | 商用前不查许可就直接上 |
| 2D/排版类 animatic | [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) | MIT | generator 写法、`yield*` 顺序编排、可视化时间轴 | 3D 场景（它不是干这个的） |
| Python 里拼帧/加字幕 | [Zulko/moviepy](https://github.com/Zulko/moviepy) | MIT | `concatenate_videoclips`、`TextClip`、淡入淡出 | 逐帧渲染性能（比 FFmpeg 慢一个量级） |
| 零依赖拼 animatic | [FFmpeg](https://github.com/FFmpeg/FFmpeg) `concat` demuxer | LGPL/GPL | 静帧按时长拼、叠临时音轨、加时间码 | — |

**本项目的选择**：`storyboard.json` → `qa-cdp.mjs --each-shot` 出静帧 → FFmpeg concat。
理由不是别的工具不好，而是 animatic 只需要「看节奏」，不需要画质；多一个编辑器就多一个真相源。

如果要把镜头表交给剪辑师，写 `.otio` 比 CSV 好，因为时长、轨道、帧率、标记点都不会丢：

```python
# 示例：需要时另存为 tools/storyboard-to-otio.py（pip install opentimelineio）
import json, sys
import opentimelineio as otio

FPS = 24
data = json.load(open(sys.argv[1], encoding="utf-8"))
timeline = otio.schema.Timeline(name=data.get("title", "MV"))
track = otio.schema.Track(kind=otio.schema.TrackKind.Video)
for shot in data["shots"]:
    dur = round((shot["end"] - shot["start"]) * FPS)
    clip = otio.schema.Clip(
        name=shot["id"],
        source_range=otio.opentime.TimeRange(
            otio.opentime.RationalTime(0, FPS),
            otio.opentime.RationalTime(dur, FPS),
        ),
        metadata={"scene": shot["scene"], "function": shot.get("function")},
    )
    clip.media_reference = otio.schema.ExternalReference(
        target_url=f"stills/{shot['id']}.jpg", available_range=clip.source_range
    )
    track.append(clip)
timeline.tracks.append(track)
otio.adapters.write_to_file(timeline, sys.argv[2])
```

三个坑：

- **animatic 看节奏，不看画面**。静帧上写清景别/运动/字幕；别在 animatic 阶段打磨材质。
- **still 的时长按帧取整**。24fps 下 6.21s 是 149 帧，不是 149.04 帧；累积误差会让最后一镜对不上音乐。
- **导出物都是衍生物**。PDF、`.otio`、animatic MP4 都可以重生成；改时间只改 `storyboard.json`。
