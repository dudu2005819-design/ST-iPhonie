import { TTSParameters as P } from './parameters.js';

export const DELIVERY_MODES = Object.freeze([
  ['director', '智能导演（省正文 Token）'],
  ['inline', '正文模型直接写情绪（原版）'],
]);

const UNIVERSAL = new Set(['neutral','happy','sad','angry','fearful','disgusted','surprised','calm']);
const GENERIC = new Set(['breath','sigh','chuckle','laugh','inhale','exhale','gasp','sniff','emm']);
const MIMO_FROM = {neutral:'平静',happy:'开心',sad:'悲伤',angry:'愤怒',fearful:'恐惧',disgusted:'冷漠',surprised:'惊讶',calm:'平静'};
const FISH_S1_FROM = {neutral:'calm',happy:'happy',sad:'sad',angry:'angry',fearful:'scared',disgusted:'disgusted',surprised:'surprised',calm:'calm'};

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

export function buildDirectorPrompt({message='', previousUser='', profiles='', lines=[]} = {}) {
  const rows = lines.map((l, i) => `${i}. ${l.role}：${l.text}`).join('\n');
  return [
    '你是中文角色扮演的 TTS 表演导演。你的任务只有一个：判断这些已经写好的台词应该怎么念。不要改剧情、不要改台词。',
    '',
    '【表演原则】',
    '- 真人感优先。先理解上下文里的关系、动作、停顿、嘴硬、疲惫、犹豫、克制、亲密程度，再决定声音。',
    '- 不要把每句话都演得很重。没有明确强情绪时，宁可克制、自然。',
    '- 呼吸、叹气、轻笑、迟疑和停顿只在真正有表演价值的位置加；通常每句 0–2 个，最多 4 个。',
    '- 不要为了“活人感”机械地每句都叹气、喘息、耳语或笑。',
    '- annotated 必须保留原台词的每一个字和标点，唯一允许的改动是插入下面的标记。',
    '',
    '【允许插入的通用标记】',
    '<pause=0.30>（0.12–0.90 秒）、<breath>、<sigh>、<chuckle>、<laugh>、<inhale>、<exhale>、<gasp>、<sniff>、<emm>',
    '',
    '【输出字段】',
    'emotion：只能是 neutral / happy / sad / angry / fearful / disgusted / surprised / calm 之一。',
    'style_zh：给中文语音模型的 1–2 个中文语气词，例如 温柔、无奈、委屈、慵懒、平静；没有必要就空字符串。',
    'delivery_en：给支持自然语言语气提示的模型，1–6 个英文词，例如 soft, slightly tired；没有必要就空字符串。',
    '',
    '只输出严格 JSON 数组，不要 Markdown，不要解释。每句必须有一项：',
    '[{"id":0,"emotion":"calm","style_zh":"温柔","delivery_en":"soft, slightly tired","annotated":"<breath>原台词<pause=0.30>"}]',
    '',
    previousUser ? '【上一轮用户】\n' + plainSource(previousUser).slice(-1800) : '',
    profiles ? '【角色设定摘要】\n' + String(profiles).slice(0, 3600) : '',
    message ? '【当前回复上下文】\n' + plainSource(message).slice(-7000) : '',
    '【要导演的台词】\n' + rows
  ].filter(Boolean).join('\n\n');
}

function jsonValue(raw) {
  let text = String(raw || '').trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
  const a = text.indexOf('['), b = text.lastIndexOf(']');
  if (a >= 0 && b > a) text = text.slice(a, b + 1);
  try { return JSON.parse(text); } catch { return []; }
}

function stripGeneric(text='') {
  return String(text).replace(/<(?:pause=\d+(?:\.\d+)?|breath|sigh|chuckle|laugh|inhale|exhale|gasp|sniff|emm)>/gi, '');
}
function identity(text='') { return stripGeneric(text).replace(/\s+/g, ''); }

function safeAnnotated(original, value) {
  let count = 0;
  let text = String(value || original).replace(/<(pause=\d+(?:\.\d+)?|breath|sigh|chuckle|laugh|inhale|exhale|gasp|sniff|emm)>/gi, (whole, token) => {
    if (++count > 4) return '';
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

function tokenMap(text, engine, model) {
  const mini = {breath:'breath',sigh:'sighs',chuckle:'chuckle',laugh:'laughs',inhale:'inhale',exhale:'exhale',gasp:'gasps',sniff:'sniffs',emm:'emm'};
  const mimo = {breath:'深呼吸',sigh:'叹气',chuckle:'轻笑',laugh:'笑',inhale:'吸气',exhale:'呼气',gasp:'震惊',sniff:'鼻音',emm:'心虚'};
  const fishS1 = {breath:'',sigh:'sighing',chuckle:'chuckling',laugh:'laughing',inhale:'',exhale:'',gasp:'gasping',sniff:'',emm:''};
  const square = {breath:'breath',sigh:'sighs',chuckle:'chuckles',laugh:'laughs',inhale:'inhales',exhale:'exhales',gasp:'gasps',sniff:'sniffs',emm:'hesitates'};
  return String(text).replace(/<(pause=\d+(?:\.\d+)?|breath|sigh|chuckle|laugh|inhale|exhale|gasp|sniff|emm)>/gi, (whole, token) => {
    const t = String(token).toLowerCase();
    if (t.startsWith('pause=')) {
      const seconds = Math.max(.12, Math.min(.9, Number(t.slice(6)) || .3));
      if (engine === 'mini') return `<#${Math.round(seconds * 100) / 100}#>`;
      if (engine === 'fish' && model === 's1') return seconds >= .5 ? '(long-break)' : '(break)';
      return seconds >= .45 ? '……' : '…';
    }
    if (engine === 'mini') return model.startsWith('speech-2.8') && mini[t] ? `(${mini[t]})` : '';
    if (engine === 'mimo') return mimo[t] ? `[${mimo[t]}]` : '';
    if (engine === 'fish' && model === 's1') return fishS1[t] ? `(${fishS1[t]})` : '';
    if ((engine === 'fish' && model !== 's1') || (engine === 'eleven' && /^eleven_v[34]/.test(model))) return square[t] ? `[${square[t]}] ` : '';
    return '';
  });
}

function routeFor(settings, name) {
  const route = settings.routes.find(r => r.name === name);
  if (!route) return null;
  return {...route, model: route.model || settings.connections[route.engine]?.model || ''};
}

function validDelivery(value) { return /^[a-z][a-z ,'-]{1,40}$/i.test(String(value || '').trim()) ? String(value).trim().toLowerCase() : ''; }

export function applyDirector(lines, decisions, settings) {
  return lines.map((line, i) => {
    const d = decisions?.[i] || {emotion:'neutral',style:'',delivery:'',annotated:line.text};
    const route = routeFor(settings, line.role);
    if (!route) return {...line, emotion:''};
    const {engine, model} = route;
    let text = tokenMap(d.annotated || line.text, engine, model), emotion = '';
    if (engine === 'mini') {
      emotion = UNIVERSAL.has(d.emotion) ? d.emotion : '';
    } else if (engine === 'mimo') {
      const style = P.vocab.MIMO_STYLES.includes(d.style) ? d.style : MIMO_FROM[d.emotion] || '';
      if (style) text = `(${style})${text}`;
    } else if (engine === 'fish' && model === 's1') {
      const e = FISH_S1_FROM[d.emotion] || '';
      if (e && P.vocab.FISH_S1_EMOTIONS.includes(e)) text = `(${e}) ${text}`;
    } else if (engine === 'fish') {
      const delivery = validDelivery(d.delivery || (d.emotion === 'neutral' ? '' : d.emotion));
      if (delivery) text = `[${delivery}] ${text}`;
    } else if (engine === 'eleven' && /^eleven_v[34]/.test(model)) {
      const delivery = validDelivery(d.delivery || (d.emotion === 'neutral' ? '' : d.emotion));
      if (delivery) text = `[${delivery}] ${text}`;
    }
    return {...line, text, emotion};
  });
}
