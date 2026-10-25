# 音频占位

`song.mp3` 是仓库自带的**等长静音占位**（310.16 秒，32 kbps 单声道），
只为了让示例开箱即可播放、时间轴能走。它不包含任何歌曲。

替换成你有权使用的音频：

```bash
cp /path/to/your-song.mp3 public/audio/song.mp3
npm run analyze
```

注意：

- `npm run analyze` 会用实际音频重写 `public/analysis/analysis.json`。
  请不要在静音占位上运行它，否则示例的能量曲线会被清零。
- 换歌后时长会变：同步修改 `src/data/shots.js` 的 `DURATION` 与 `storyboard.json`，
  再跑 `node ../../tools/validate-storyboard.mjs storyboard.json`。
- 公开分发成品前确认音频授权；仓库默认不接收任何歌曲文件。
