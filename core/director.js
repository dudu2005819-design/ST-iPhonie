import { TTSParameters as P } from './parameters.js';

export const DELIVERY_MODES = Object.freeze([
  ['director', '智能导演（省正文 Token）'],
  ['inline', '正文模型直接写情绪（原版）'],
]);

const UNIVERSAL = new Set(['neutral','happy','sad','angry','fearful','disgusted','surprised','calm']);
const GENERIC = new Set(['breath','sigh','chuckle','laugh','inhale','exhale','gasp','sniff','emm']);
const MIMO_FROM = {neutral:'平静',happy:'开心',sad:'悲伤',angry:'愤怒',fearful:'恐惧',disgusted:'冷漠',surprised:'惊讶',calm:'平静'};
const FISH_S1_FROM = {neutral:'calm',happy:'happy',sad:'sad',angry:'angry',fearful:'scared',disgusted:'disgusted',surprised:'surprised',calm:'calm'};
const FISH_FALLBACK = {
  neutral:'natural, conversational, expressive',
  calm:'warm, relaxed, conversational',
  happy:'bright, warm, lightly animated',
  sad:'soft, subdued, emotionally heavy',
  angry:'cold, clipped, controlled anger',
  fearful:'tense, uneasy, slightly breathless',
  disgusted:'cold, restrained, faintly disdainful',
  surprised:'caught off guard, alert, quick'
};

export const DIRECTOR_PROMPT = [
  '正常续写正文与叙事，不改变角色人设、文风或剧情。',
  '每一次角色真正说出口的台词都写成 {{格式}}；旁白、动作、环境和心理活动保持普通正文。',
  '角色、译文和文本填写实际内容；情绪字段统一写 auto，不要判断情绪。',
  '台词语言遵循：{{语言}}。',
  '不要在朗读文本里写任何 TTS 情绪标签、声音标签、呼吸标签或停顿码；这些由播放时的智能导演处理。',
  '不要解释规则或输出代码块。'
].join('\n');

export function compactDialogueContract(format) {
  return [
    '【低 Token 配音格式】',
    '真正说出口的每段对白使用：' + format,
    '情绪字段固定写 auto；角色字段写真名；译文与朗读文本必须是同一句话，不增写、不漏写。',
    '中文台词的译文与朗读文本保持一致；长台词可按自然句或短意群拆开。',
    '不要写任何语气、情绪、声音或停顿标签；播放时由插件单独判断。'
  ].join('\n');
}

export function directorMode(settings) {
  const p = settings?.presets?.find(x => x.id === settings.activePreset);
  return p?.deliveryMode === 'director';
}

function plainSource(text='') {
  return String(text)
    .replace(/<tts>[^<]*<\/tts>/gi, '')
    .replace(/<img\b[^>]*>[\s\S]*?<\/img>/gi, '')
    .replace(/<(?:sfx|ambience)\b[^>]*>[\s\S]*?<\/(?:sfx|ambience)>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const LEVEL_RULES = {
  natural: [
    '表演强度：自然克制。优先像真人日常说话，只在语义明确需要时给明显情绪；声音动作通常 0–1 个。',
    '亲密、嘴硬、疲惫等细节可以有，但不要把轻微情绪演成戏剧高潮。'
  ],
  rich: [
    '表演强度：饱满自然。情绪必须能被听见，但不能变成夸张广播腔；重点表现潜台词、关系感、克制程度和句子里的转折。',
    '普通句也要有具体说话意图，不要大量退回 neutral / calm；声音动作通常 0–2 个，明显转折时可以有自然停顿。'
  ],
  dramatic: [
    '表演强度：强表演。允许更明显的情绪起伏、停顿和声音动作，但仍要符合角色和剧情，不能无缘无故哭喊、喘息或耳语。',
    '声音动作通常 1–3 个；强情绪场景可以更明显，但日常对白仍要像真人。'
  ]
};

export function buildDirectorPrompt({message='', previousUser='', profiles='', lines=[], performanceLevel='rich', performanceCues=true} = {}) {
  const level = LEVEL_RULES[performanceLevel] ? performanceLevel : 'rich';
  const rows = lines.map((l, i) => `${i}. ${l.role}${l.engine ? ` [${l.engine}${l.model ? ' · '+l.model : ''}]` : ''}：${l.text}`).join('\n');
  return [
    '你是中文角色扮演的 TTS 表演导演。你的任务只有一个：判断这些已经写好的台词应该怎么念。不要改剧情、不要改台词。',
    '',
    '【表演原则】',
    '- 先读懂人物关系、当前动作、上一轮对话、潜台词和角色一贯性，再决定声音；不要只按句面情绪分类。',
    '- 每句都要回答：这个人现在想让对方感受到什么、又在压住什么。把“嘴硬但心软、疲惫但照顾人、吃醋却装平静、亲近后自然放软”这类混合状态听出来。',
    '- 同一角色连续几句要有情绪惯性，也要随着句式和动作产生细微变化，避免整段一个播报腔。',
    ...LEVEL_RULES[level].map(x => '- ' + x),
    '- Fish Audio S2 / S2.1：delivery_en 不要只写 happy / sad / calm。用 2–5 个英文短词同时描述主情绪、说话意图/关系感、能量或克制程度，优先具体而自然。',
    '- Fish Audio S2 / S2.1 示例：warm, affectionate, softly amused；restrained, fond, trying to hide it；hurt, subdued, holding back tears；cold, clipped, controlled anger；gentle, protective, slightly tired。只作表达方式参考，不要机械套模板。',
    performanceCues
      ? '- 声音动作与停顿已开启。只在有表演价值的位置加入；不要机械地每句叹气、喘息、笑或停顿。'
      : '- 声音动作与停顿已关闭。annotated 必须原样返回台词，不插入任何标记。',
    '- annotated 必须保留原台词的每一个字和标点，唯一允许的改动是插入允许的标记。',
    '',
    '【允许插入的通用标记】',
    performanceCues
      ? '<pause=0.30>（0.12–0.90 秒）、<breath>、<sigh>、<chuckle>、<laugh>、<inhale>、<exhale>、<gasp>、<sniff>、<emm>'
      : '无。原样返回。',
    '',
    '【输出字段】',
    'emotion：只能是 neutral / happy / sad / angry / fearful / disgusted / surprised / calm 之一。rich 或 dramatic 模式下，不要因为拿不准就大量使用 neutral；应从上下文选最接近的主情绪。',
    'style_zh：给中文语音模型的 1–2 个中文语气词，例如 温柔、无奈、委屈、慵懒、克制、冷淡、心虚；没有必要就空字符串。',
    'delivery_en：给支持自然语言语气提示的模型。Fish Audio S2 / S2.1 优先写 2–5 个英文短词，最多 40 个字符；例如 warm, teasing, softly amused / restrained, fond, slightly awkward / cold, clipped, controlled anger。',
    '',
    '只输出严格 JSON 数组，不要 Markdown，不要解释。每句必须有一项：',
    '[{"id":0,"emotion":"calm","style_zh":"温柔","delivery_en":"warm, affectionate, softly amused","annotated":"<breath>原台词<pause=0.30>"}]',
    '',
    previousUser ? '【上一轮用户】\n' + plainSource(previousUser).slice(-1800) : '',
    profiles ? '【角色设定摘要】\n' + String(profiles).slice(0, 3600) : '',
    message ? '【当前回复上下文】\n' + plainSource(message).slice(-7000) : '',
    '【要导演的台词】\n' + rows
  ].filter(Boolean).join('\n\n');
}

function jsonValue(raw) {
  let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = text.indexOf('['), b = text.lastIndexOf(']');
  if (a >= 0 && b > a) text = text.slice(a, b + 1);
  try { return JSON.parse(text); } catch { return []; }
}

function stripGeneric(text='') {
  return String(text).replace(/<(?:pause=\d+(?:\.\d+)?|breath|sigh|chuckle|laugh|inhale|exhale|gasp|sniff|emm)>/gi, '');
}
function identity(text='') { return stripGeneric(text).replace(/\s+/g, ''); }

function safeAnnotated(original, value, max = 5) {
  let count = 0;
  let text = String(value || original).replace(/<(pause=\d+(?:\.\d+)?|breath|sigh|chuckle|laugh|inhale|exhale|gasp|sniff|emm)>/gi, (whole, token) => {
    if (++count > max) return '';
    const t = String(token).toLowerCase();
    if (t.startsWith('pause=')) {
      const seconds = Math.max(.12, Math.min(.9, Number(t.slice(6)) || .3));
      return `<pause=${Math.round(seconds * 100) / 100}>`;
    }
    return GENERIC.has(t) ? `<${t}>` : '';
  });
  text = text.replace(/<(?!pause=|breath>|sigh>|chuckle>|laugh>|inhale>|exhale>|gasp>|sniff>|emm>)[^>\n]{1,80}>/gi, '');
  return identity(text) === identity(original) ? text : original;
}

export function parseDirectorReply(raw, lines=[]) {
  const list = jsonValue(raw);
  const map = new Map();
  for (const row of Array.isArray(list) ? list : []) {
    const id = Number(row?.id);
    if (!Number.isInteger(id) || id < 0 || id >= lines.length || map.has(id)) continue;
    const emotion = UNIVERSAL.has(String(row.emotion || '').toLowerCase()) ? String(row.emotion).toLowerCase() : 'neutral';
    const style = String(row.style_zh || '').replace(/[()（）[\]<>]/g, '').trim().slice(0, 12);
    const delivery = /^[a-z][a-z ,'-]{0,70}$/i.test(String(row.delivery_en || '').trim()) ? String(row.delivery_en).trim().toLowerCase() : '';
    map.set(id, {emotion, style, delivery, annotated: safeAnnotated(lines[id].text, row.annotated)});
  }
  return lines.map((line, id) => map.get(id) || {emotion:'neutral', style:'', delivery:'', annotated:line.text});
}

function routeFor(settings, name) {
  const route = settings.routes.find(r => r.name === name);
  if (!route) return null;
  return {...route, model: route.model || settings.connections[route.engine]?.model || ''};
}

function validDelivery(value) {
  let text = String(value || '').trim().toLowerCase().replace(/[^a-z ,'-]/g, '').replace(/\s+/g, ' ');
  if (text.length > 40) text = text.slice(0, 40).replace(/\s+\S*$/, '').replace(/[ ,'-]+$/, '');
  return /^[a-z][a-z ,'-]{1,40}$/.test(text) ? text : '';
}
const pauseText = seconds => Number(seconds) >= .52 ? '……' : '…';

function annotate(text, {pause, sounds, maxSounds=2} = {}) {
  let used = 0;
  return String(text).replace(/<(pause=\d+(?:\.\d+)?|breath|sigh|chuckle|laugh|inhale|exhale|gasp|sniff|emm)>/gi, (whole, token) => {
    const t = String(token).toLowerCase();
    if (t.startsWith('pause=')) return pause ? pause(Number(t.slice(6)) || .3) : '';
    if (used >= maxSounds) return '';
    const value = sounds?.[t];
    if (!value) return '';
    used++;
    return value;
  });
}

function levelLimits(level) {
  return level === 'natural' ? {sounds:1} : level === 'dramatic' ? {sounds:3} : {sounds:2};
}

function s1Tone(delivery='') {
  const d = String(delivery).toLowerCase();
  if (/whisper|hushed/.test(d)) return 'whispering';
  if (/soft|gentle|tender|affectionate|quiet/.test(d)) return 'soft tone';
  if (/hurry|urgent|rushed/.test(d)) return 'in a hurry tone';
  if (/shout|furious|explosive/.test(d)) return 'shouting';
  return '';
}

export function applyDirector(lines, decisions, settings, options = {}) {
  const preset = settings?.presets?.find(p => p.id === settings.activePreset) || {};
  const level = ['natural','rich','dramatic'].includes(options.performanceLevel) ? options.performanceLevel
    : ['natural','rich','dramatic'].includes(preset.performanceLevel) ? preset.performanceLevel : 'rich';
  const cues = options.performanceCues !== undefined ? options.performanceCues !== false : preset.performanceCues !== false;
  const limits = levelLimits(level);

  return lines.map((line, i) => {
    const d = decisions?.[i] || {emotion:'neutral',style:'',delivery:'',annotated:line.text};
    const route = routeFor(settings, line.role);
    if (!route) return {...line, emotion:''};
    const {engine, model} = route;
    const base = line.text;
    const annotated = cues ? d.annotated || base : base;
    let text = base, emotion = '';
    let fallbackEmotion = '';

    if (engine === 'fish' && model !== 's1') {
      const sounds = {
        breath:'[soft breath] ', sigh:'[soft sigh] ', chuckle:'[chuckles softly] ', laugh:'[laughs naturally] ',
        inhale:'[inhales softly] ', exhale:'[exhales slowly] ', gasp:'[small gasp] ', sniff:'[sniffs softly] ', emm:'[hesitates softly] '
      };
      text = annotate(annotated, {pause: pauseText, sounds, maxSounds: Math.min(2, limits.sounds)});
      const delivery = validDelivery(d.delivery) || validDelivery(FISH_FALLBACK[d.emotion]) || 'natural, conversational, expressive';
      text = `[${delivery}] ${text}`;
      // One leading delivery tag + at most two in-line sound tags = Fish S2/S2.1's documented three-tag ceiling.
      emotion = '';
      fallbackEmotion = d.emotion && d.emotion !== 'neutral' ? d.emotion : '';
    } else if (engine === 'fish' && model === 's1') {
      const e = FISH_S1_FROM[d.emotion] || 'calm';
      const sounds = {
        sigh:'(sighing) ', chuckle:'(chuckling) ', laugh:'(laughing) ', gasp:'(gasping) ',
        breath:'', inhale:'', exhale:'', sniff:'', emm:''
      };
      text = annotate(annotated, {
        pause: sec => sec >= .5 ? '(long-break) ' : '(break) ',
        sounds,
        maxSounds: limits.sounds
      });
      const tone = s1Tone(d.delivery);
      text = `(${e}) ${tone ? '('+tone+') ' : ''}${text}`;
      emotion = '';
      fallbackEmotion = e;
    } else if (engine === 'mini') {
      const sounds = model.startsWith('speech-2.8') ? {
        breath:'(breath)', sigh:'(sighs)', chuckle:'(chuckle)', laugh:'(laughs)', inhale:'(inhale)', exhale:'(exhale)',
        gasp:'(gasps)', sniff:'(sniffs)', emm:'(emm)'
      } : {};
      text = annotate(annotated, {
        pause: sec => `<#${Math.max(.12, Math.min(.9, Math.round(sec*100)/100))}#>`,
        sounds,
        maxSounds: limits.sounds
      });
      emotion = d.emotion && d.emotion !== 'neutral' ? d.emotion : 'calm';
      fallbackEmotion = emotion;
    } else if (engine === 'mimo') {
      const sounds = {
        breath:'[深呼吸]', sigh:'[叹气]', chuckle:'[轻笑]', laugh:'[笑]', inhale:'[吸气]', exhale:'[呼气]',
        gasp:'[震惊]', sniff:'[鼻音]', emm:'[心虚]'
      };
      text = annotate(annotated, {pause: pauseText, sounds, maxSounds: limits.sounds});
      const style = P.vocab.MIMO_STYLES.includes(d.style) ? d.style : MIMO_FROM[d.emotion] || '平静';
      text = `(${style})${text}`;
      emotion = '';
      fallbackEmotion = style;
    } else if (engine === 'eleven' && /^eleven_v[34]/.test(model)) {
      const sounds = {
        breath:'[breathes softly] ', sigh:'[sighs] ', chuckle:'[chuckles] ', laugh:'[laughs] ', inhale:'[inhales] ',
        exhale:'[exhales] ', gasp:'[gasps] ', sniff:'[sniffs] ', emm:'[hesitates] '
      };
      text = annotate(annotated, {pause: pauseText, sounds, maxSounds: Math.min(2, limits.sounds)});
      const delivery = validDelivery(d.delivery || (d.emotion === 'neutral' ? '' : d.emotion));
      if (delivery) text = `[${delivery}] ${text}`;
      emotion = '';
      fallbackEmotion = delivery || '';
    } else {
      text = base;
      emotion = d.emotion && d.emotion !== 'neutral' ? d.emotion : '';
      fallbackEmotion = emotion;
    }

    return {
      ...line,
      text,
      emotion,
      directorRich: text !== base || emotion !== (line.emotion || ''),
      directorLevel: level,
      fallbackText: base,
      fallbackEmotion
    };
  });
}
