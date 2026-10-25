// Original poetic intertitles, timed to the song's structural beats.
// Not the copyrighted lyrics — the official text can be supplied via /lyrics.json.
export const SUBTITLES = [
  { start: 19.9,  end: 26.5,  cn: '把一封信，交给潮汐。',           en: 'I gave a letter to the tide.' },
  { start: 32.2,  end: 38.8,  cn: '它替我，去看你。',               en: 'It went to see you, for me.' },
  { start: 45.0,  end: 51.5,  cn: '纸很轻，思念很重。',             en: 'Paper is light; longing is heavy.' },
  { start: 61.4,  end: 68.0,  cn: '月亮是唯一的地址。',             en: 'The moon is the only address I know.' },
  { start: 104.8, end: 109.7, cn: '有些话，停在呼吸里。',           en: 'Some words stop at the breath.' },
  { start: 111.2, end: 118.5, cn: '我在每一个倒影里，练习说爱你。', en: 'In every reflection, I practice saying I love you.' },
  { start: 145.0, end: 151.8, cn: '雨落在相反的方向。',             en: 'The rain falls the other way.' },
  { start: 165.0, end: 171.8, cn: '所有的字，都朝你生长。',         en: 'Every word grows toward you.' },
  { start: 181.0, end: 187.8, cn: '于是我，向更深处坠落。',         en: 'So I let myself fall deeper.' },
  { start: 196.0, end: 203.0, cn: '在光抵达之前，我先成为光。',     en: 'Before the light arrives, I become it.' },
  { start: 224.8, end: 231.4, cn: '穿过月亮，就能抵达你吗？',       en: 'If I cross the moon, will I reach you?' },
  { start: 242.0, end: 249.0, cn: '我终于明白，爱不是抵达。',       en: 'I finally learned: love is not arrival.' },
  { start: 261.2, end: 268.4, cn: '它是让一封信，走了很远很远。',   en: 'It is letting a letter travel very, very far.' },
  { start: 282.0, end: 289.2, cn: '我爱你。',                       en: 'I love you.' },
  { start: 294.8, end: 299.6, cn: '写给没有寄出的那封信。',         en: 'For the letter that was never sent.' }
];

export const FILM_TITLE = {
  cn: '我爱你',
  en: 'I LOVE YOU',
  subtitle: 'A LETTER TO THE MOON'
};

export const CREDITS = [
  ['曲', '张亚东'],
  ['词', '萧玮'],
  ['唱', '王菲'],
  ['收录', '《潜流》 · 2009'],
  ['', ''],
  ['视觉短片', '原创非商业影像习作'],
  ['字幕', '原创诗行'],
  ['格式', '1920 × 804 · 24 fps']
];

export async function loadSubtitleCues() {
  try {
    const r = await fetch('/lyrics.json', { cache: 'no-store' });
    if (!r.ok) return { cues: SUBTITLES, mode: 'poem' };
    const data = await r.json();
    const cues = Array.isArray(data.cues) ? data.cues.filter(c => c && c.cn && Number.isFinite(c.start) && Number.isFinite(c.end)) : [];
    if (cues.length) {
      return { cues: cues.map(c => ({ ...c, en: c.en || '' })), mode: 'lyrics' };
    }
  } catch (e) { /* offline / file absent */ }
  return { cues: SUBTITLES, mode: 'poem' };
}
