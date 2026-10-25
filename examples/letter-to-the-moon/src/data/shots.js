export const DURATION = 310.16;
export const ASPECT = 1920 / 804;

// 27 camera set-ups / 18 environments. Times are cut points on or near the 72 BPM grid.
export const SHOTS = [
  {
    id: 'ink-rise', scene: 'prologue', view: 'macro', start: 0, end: 19.1,
    name: '墨起', nameEn: 'INK, RISING',
    desc: '一滴墨落进水里，散成星云。片名在涟漪中心显影。',
    cam: '微距俯拍 · 15° 环绕 · 缓推',
    trans: { type: 'fade', dur: 2.4 }
  },
  {
    id: 'sea-letter', scene: 'seaNight', view: 'low', start: 19.1, end: 31.2,
    name: '海 · 信', nameEn: 'THE LETTER',
    desc: '无垠墨海，银月低垂。火漆信浮在水面，红绳拖出一道细痕。',
    cam: '贴水面低机位 · 跟拍前推',
    trans: { type: 'ink', dur: 1.4 }
  },
  {
    id: 'sea-moon', scene: 'seaNight', view: 'wide', start: 31.2, end: 44.04,
    name: '海 · 月', nameEn: 'THE MOON',
    desc: '摇臂升起，信变得渺小；月亮与倒影把海面分成两半。',
    cam: '广角侧拍 · 摇臂升起 30° · 半环绕',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'fish-track', scene: 'fish', view: 'track', start: 44.04, end: 52.4,
    name: '字鱼', nameEn: 'PAPER FISH',
    desc: '失重的墨水里，信纸化成鳐鱼群，围绕信札游弋。',
    cam: '横向轨道跟拍 · 前景鱼群掠过',
    trans: { type: 'ink', dur: 1.2 }
  },
  {
    id: 'fish-close', scene: 'fish', view: 'close', start: 52.4, end: 60.2,
    name: '字鱼 · 近', nameEn: 'WORDS ALIVE',
    desc: '近景里，纸纤维与墨迹若隐若现；红印在鱼群中央呼吸。',
    cam: '50mm 近景环绕',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'stairs-wide', scene: 'stairs', view: 'wide', start: 60.2, end: 67.7,
    name: '纸阶', nameEn: 'PAPER STEPS',
    desc: '纸页悬成螺旋阶梯，红绳作扶手，通往顶端的月孔。',
    cam: '广角仰拍 · 摇臂沿阶上升',
    trans: { type: 'ink', dur: 1.2 }
  },
  {
    id: 'stairs-follow', scene: 'stairs', view: 'follow', start: 67.7, end: 74.04,
    name: '纸阶 · 随', nameEn: 'ASCENT',
    desc: '跟随信封上升，纸张依次翻边，光斑从页缝漏下。',
    cam: '35mm 跟随 · 轻微侧倾',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'threads-orbit', scene: 'threads', view: 'orbit', start: 74.04, end: 89.0,
    name: '红线', nameEn: 'RED THREADS',
    desc: '百缕红线从信札中心放射，纸签与结在虚空里轻响。',
    cam: '85mm 长焦环绕 · 压缩空间',
    trans: { type: 'ink', dur: 1.2 }
  },
  {
    id: 'threads-dive', scene: 'threads', view: 'dive', start: 89.0, end: 104.04,
    name: '红线 · 穿', nameEn: 'THROUGH',
    desc: '穿过红线丛林，逼近火漆印；所有线在强拍上同时震颤。',
    cam: '手持感穿越 · 前景红线掠过',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'breath', scene: 'drop', view: 'hold', start: 104.04, end: 110.33,
    name: '息', nameEn: 'A BREATH',
    desc: '一切安静下来。一滴水悬在红线上方，远处信札失焦。',
    cam: '微距固定 · 极缓推进',
    trans: { type: 'dip', dur: 1.8 }
  },
  {
    id: 'mirror-glide', scene: 'mirror', view: 'glide', start: 110.33, end: 124.3,
    name: '镜我', nameEn: 'THE MIRROR',
    desc: '黑镜水面倒映银月与纸剪影。信悬在镜上，像一句未落地的话。',
    cam: '贴水面横移 · 倒影完整',
    trans: { type: 'iris', dur: 1.5 }
  },
  {
    id: 'mirror-enter', scene: 'mirror', view: 'enter', start: 124.3, end: 134.04,
    name: '镜我 · 入', nameEn: 'BEHIND THE GLASS',
    desc: '镜头穿过镜面，进入倒置世界；尘埃与月都翻了过来。',
    cam: '下潜穿镜 · 空间翻转',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'mirror-shatter', scene: 'mirror', view: 'shatter', start: 134.04, end: 144.04,
    name: '镜碎', nameEn: 'SHATTER',
    desc: '镜面炸裂成一百二十片玻璃，碎片向上升，镜头随之下坠。',
    cam: '甩镜 + 下坠 · 碎片近景掠过',
    trans: { type: 'flash', dur: 0.55, color: '#f4e6dc' }
  },
  {
    id: 'rain-orbit', scene: 'rain', view: 'orbit', start: 144.04, end: 153.9,
    name: '逆雨', nameEn: 'REVERSE RAIN',
    desc: '雨向天空落。黑水地面的涟漪反向收拢，红纸伞悬在空中。',
    cam: '低机位环绕 · 伞面透光',
    trans: { type: 'ink', dur: 1.2 }
  },
  {
    id: 'rain-wide', scene: 'rain', view: 'wide', start: 153.9, end: 164.04,
    name: '逆雨 · 伞', nameEn: 'UNDER THE UMBRELLA',
    desc: '伞下信札微光；远处纸剪影站在雨里。雨幕突然加密。',
    cam: '中景仰拍 · 缓慢拉开',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'city-fly', scene: 'city', view: 'fly', start: 164.04, end: 173.6,
    name: '字城', nameEn: 'CITY OF WORDS',
    desc: '巨型汉字碑林夹出一条峡谷，信在字缝间飞行。',
    cam: '广角穿越 · 轻微侧倾',
    trans: { type: 'ink', dur: 1.4 }
  },
  {
    id: 'city-plunge', scene: 'city', view: 'plunge', start: 173.6, end: 180.2,
    name: '字城 · 坠', nameEn: 'THE FALL',
    desc: '尽头是一面巨字「爱」。信被吸入字下的墨池。',
    cam: '快速推近巨字 · 俯冲',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'descent', scene: 'descent', view: 'fall', start: 180.2, end: 195.0,
    name: '坠', nameEn: 'DEEP WATER',
    desc: '垂直坠入深水。气泡、字碑碎片与光柱快速退后。',
    cam: '俯拍跟随 → 仰拍反向',
    trans: { type: 'flash', dur: 0.5, color: '#e3d6c6' }
  },
  {
    id: 'moon-under', scene: 'moongate', view: 'under', start: 195.0, end: 209.77,
    name: '月渡 · 水', nameEn: 'UNDER THE MOON',
    desc: '水下仰拍巨大的月亮，水母灯漂浮；信开始上浮。',
    cam: '仰拍缓升 → 加速',
    trans: { type: 'ink', dur: 1.2 }
  },
  {
    id: 'moon-flight', scene: 'moongate', view: 'flight', start: 209.77, end: 224.04,
    name: '月渡 · 翔', nameEn: 'TO THE MOON',
    desc: '破水而出。信化成纸鹤，飞向天空中的月环。',
    cam: '大远景 → 侧向跟拍 → 环绕',
    trans: { type: 'flash', dur: 0.65, color: '#f1f5fa' }
  },
  {
    id: 'moon-portal', scene: 'moongate', view: 'portal', start: 224.04, end: 240.71,
    name: '月渡 · 穿', nameEn: 'THROUGH THE GATE',
    desc: '穿过月环光洞，字符环与粒子流向后飞逝，白场吞没画面。',
    cam: '第一人称穿环 · FOV 拉宽',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'star-sea', scene: 'starsea', view: 'wide', start: 240.71, end: 260.71,
    name: '星海', nameEn: 'SEA OF STARS',
    desc: '星光落在海上。纸鹤盘旋，信浮在两种夜空之间。',
    cam: '俯拍 → 摇臂升起 → 大远景',
    trans: { type: 'flash', dur: 1.3, color: '#f6f8fb' }
  },
  {
    id: 'dissolve', scene: 'starsea', view: 'dissolve', start: 260.71, end: 270.71,
    name: '光解', nameEn: 'DISSOLVE',
    desc: '信从边缘化成光粒，火漆印最后熄灭。',
    cam: '50mm 环绕 · 缓推',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'form', scene: 'starsea', view: 'form', start: 270.71, end: 280.71,
    name: '成字', nameEn: 'I LOVE YOU',
    desc: '光粒在海上聚成「我爱你」。字不是终点，是走过的距离。',
    cam: '缓慢拉开 · 居中构图',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'return', scene: 'seaDawn', view: 'return', start: 280.71, end: 294.04,
    name: '潮归', nameEn: 'THE TIDE RETURNS',
    desc: '月落。海面恢复空寂，纸屑像雪一样落在水上。',
    cam: '大远景极缓后拉',
    trans: { type: 'ink', dur: 1.6 }
  },
  {
    id: 'outro', scene: 'seaDawn', view: 'outro', start: 294.04, end: 304.97,
    name: '余', nameEn: 'AFTERGLOW',
    desc: '晨昏墨海。片尾字与最终片名先后显影，红线下沉。',
    cam: '固定大远景 · 仅微呼吸',
    trans: { type: 'cut', dur: 0 }
  },
  {
    id: 'end', scene: 'end', view: 'black', start: 304.97, end: 310.16,
    name: '黑', nameEn: 'BLACK',
    desc: '黑场。极细的红线沉入画外。',
    cam: '静止',
    trans: { type: 'dip', dur: 3.0 }
  }
];

export const SHOT_COUNT = SHOTS.length;

export function shotAt(t) {
  const time = Math.max(0, Math.min(DURATION - 0.0001, t));
  let lo = 0, hi = SHOTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (SHOTS[mid].start <= time) lo = mid;
    else hi = mid - 1;
  }
  return SHOTS[lo];
}

export function shotByIndex(i) {
  return SHOTS[Math.max(0, Math.min(SHOTS.length - 1, i))];
}

export function chapterAt(t) {
  const s = shotAt(t);
  return `${String(s.start / 60 | 0).padStart(2, '0')}:${String(Math.floor(s.start % 60)).padStart(2, '0')} · ${s.name}`;
}
