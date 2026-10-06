// 自动挑音色: a character met for the first time in the story gets a voice picked for them — from the user's 候选音色池
// (voices they trust, marked with gender, age and style) first, and only when none of those fits, from the engine's
// voice library searched by what the character sounds like. The text model picks; the route is marked as picked
// automatically so it can be changed in the 角色 App.
//
// 候选音色池 entry: {engine, voice, model, name, gender: 'female'|'male'|'', age: 'child'|'young'|'adult'|'old'|'', style}.

export const POOL_LIMIT = 200;
export const VOICE_GENDERS = Object.freeze({female: '女', male: '男'});
export const VOICE_AGES = Object.freeze({child: '孩子', young: '少年少女', adult: '成年', old: '老年'});
const ENGINES = ['fish', 'mini', 'eleven', 'mimo'];
const text = (value, max) => String(value ?? '').trim().slice(0, max);

export function normalizePool(list) {
  const out = [], seen = new Set();
  for (const v of Array.isArray(list) ? list : []) {
    const engine = ENGINES.includes(v?.engine) ? v.engine : '', voice = text(v?.voice, 2000);
    if (!engine || !voice || seen.has(engine + '\n' + voice)) continue;
    seen.add(engine + '\n' + voice);
    out.push({engine, voice, model: text(v.model, 120), name: text(v.name, 60) || voice.slice(0, 24),
      gender: VOICE_GENDERS[v.gender] ? v.gender : '', age: VOICE_AGES[v.age] ? v.age : '', style: text(v.style, 120)});
    if (out.length >= POOL_LIMIT) break;
  }
  return out;
}
/** A pool entry as one line for the model: name, gender, age, style. */
export const poolLine = v => [v.name, VOICE_GENDERS[v.gender], VOICE_AGES[v.age], v.style].filter(Boolean).join(' · ');

/**
 * What is known of a character, for picking a voice: their card (when the tavern has one by that name), what they
 * said, and the story lines that mention them. Kept short (the model only needs gender, age and manner).
 */
export function voiceProfile({name, card = '', said = [], story = []}) {
  const lines = [`名字：${name}`];
  if (card.trim()) lines.push(`角色卡：${card.trim().slice(0, 800)}`);
  if (said.length) lines.push(`TA 说过的话：\n${said.slice(-6).map(s => '- ' + s).join('\n').slice(0, 600)}`);
  if (story.length) lines.push(`剧情里提到 TA 的地方：\n${story.slice(-8).map(s => '- ' + s).join('\n').slice(0, 1400)}`);
  return lines.join('\n\n');
}

const RULES = '按角色的性别、年龄、身份、性格和说话方式挑。性别和大致年龄必须对得上（小孩不用成年人的声音，男性不用女声）；其次看气质和语气。';

/** Picking one of a list: {index (from 0), reason} by the reply, or null when the model found none fitting. */
export function pickRequest(profile, candidates, {allowNone = true} = {}) {
  const list = candidates.map((c, i) => `${i + 1}. ${c.label}`).join('\n');
  return [{role: 'system', content: [
    '你在给故事里的角色挑配音音色。',
    RULES,
    allowNone ? '只能从候选里选；都对不上（尤其是性别或年龄对不上）就回答「无」，不要硬选。' : '只能从候选里选，选最接近的一个。',
    '只输出一行：编号｜一句话理由（比如「3｜少女音，清亮活泼，和她的性格对得上」）。不要输出别的。'
  ].join('\n')}, {role: 'user', content: `【角色】\n${profile}\n\n【候选音色】\n${list}\n\n挑一个：`}];
}
export function parsePick(reply, count) {
  const body = String(reply || '').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
  const line = body.split('\n').map(l => l.trim()).filter(Boolean).find(l => /^(?:\d+|无)/.test(l.replace(/^[^\d无]*/, ''))) || '';
  const clean = line.replace(/^[^\d无]*/, '');
  if (!clean || /^无/.test(clean)) return null;
  const index = Number(clean.match(/^\d+/)?.[0]) - 1;
  if (!(index >= 0 && index < count)) return null;
  return {index, reason: clean.replace(/^\d+\s*[|｜:：.、]?\s*/, '').slice(0, 80)};
}

/** What to search a voice library for: {gender, age, words} by the model (words: a few short search terms). */
export function searchRequest(profile, engine) {
  const how = engine === 'fish' ? '搜索词用音色网站上标题里常见的说法，中文为主，比如：少女、御姐、正太、大叔、老奶奶、温柔、元气、冷淡、低沉、播音。'
    : '搜索词用英文，比如 young female、calm、deep、old man。';
  return [{role: 'system', content: ['你在给故事里的角色找配音音色，先判断要找什么样的声音。', RULES, how,
    '只输出一行：性别｜年龄段｜两到四个搜索词（用顿号隔开）。性别写 女、男 或 不确定；年龄段写 孩子、少年少女、成年、老年 之一。例如：女｜少年少女｜少女、元气、清亮'].join('\n')},
    {role: 'user', content: `【角色】\n${profile}\n\n要找什么样的声音？`}];
}
export function parseSearch(reply) {
  const line = String(reply || '').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').split('\n').map(l => l.trim()).find(l => /[|｜]/.test(l)) || '';
  const [g = '', a = '', w = ''] = line.split(/[|｜]/).map(x => x.trim());
  const gender = /女|female/i.test(g) ? 'female' : /男|male/i.test(g) ? 'male' : '';
  const age = /孩|child|kid/i.test(a) ? 'child' : /少|young|teen/i.test(a) ? 'young' : /老|old|elder/i.test(a) ? 'old' : /成|adult/i.test(a) ? 'adult' : '';
  const words = w.split(/[、,，;；/]+/).map(x => x.trim()).filter(Boolean).slice(0, 4);
  return {gender, age, words};
}
