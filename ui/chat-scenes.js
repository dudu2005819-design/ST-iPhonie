// Chat backgrounds as scenes: a still picture behind the messages and a light moving layer over it (the home
// screen's: drifting clouds, twinkling stars and meteors, falling petals, rising bubbles, fireflies). The messages
// scroll over the scene, which stays put. A picture has three layers so it suits any screen: the sky fills the space
// (cropping it costs nothing), what hangs from the top (a branch, the moon, auroras) keeps to the top, and the ground
// (hills, the sea, flowers) to the bottom, both scaled to the width. The same picture is the swatch in 个性装扮 and
// the shop. The chat is drawn again for every message: the moving layer's clock is set from the time of day
// (syncMotion), so it carries on instead of starting over.
import {motionLayer} from './wallpapers.js';

function seeded(text) {
  let h = [...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
  return () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const f = n => n.toFixed(1);
/** Small stars: n dots between y0 and y1, seeded so a scene is the same every time. */
function starField(key, n, y0, y1, w = 400) {
  const r = seeded(key);
  return Array.from({length: n}, () => `<circle cx="${f(r() * w)}" cy="${f(y0 + r() * (y1 - y0))}" r="${f(.5 + r() * 1.3)}" fill="#fff" opacity="${f(.35 + r() * .6)}"/>`).join('');
}
/** A five-petal flower at (x, y). */
const blossom = (x, y, s, petal, heart = '#ffe27a') => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-6" rx="4.6" ry="6.4" fill="${petal}" transform="rotate(${a})"/>`).join('')}<circle r="2.6" fill="${heart}"/></g>`;
const grad = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const glow = (id, c, a = 1) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;

// Each scene: sky (a 400×800 body, cropped to fit), top [height, body] and ground [height, body] (400 wide), its
// moving layer, and whether it is dark (dates and notes over it are drawn light).
const SCENES = {
  clouds: {motion: 'clouds', dark: false,
    sky: () => `<defs>${grad('csc-sky', [[0, '#76c1ff'], [.55, '#bfe5ff'], [1, '#f1f9ff']])}</defs><rect width="400" height="800" fill="url(#csc-sky)"/>`,
    top: [220, () => `<defs>${glow('csc-sun', '#fff7d1')}</defs><circle cx="330" cy="40" r="150" fill="url(#csc-sun)"/>`],
    ground: [260, () => `<g fill="#fff" opacity=".5"><circle cx="50" cy="100" r="70"/><circle cx="150" cy="75" r="88"/><circle cx="265" cy="95" r="74"/><circle cx="360" cy="70" r="82"/><rect y="100" width="400" height="160"/></g>
      <g fill="#fff"><circle cx="10" cy="195" r="62"/><circle cx="110" cy="172" r="78"/><circle cx="225" cy="190" r="66"/><circle cx="325" cy="165" r="84"/><circle cx="420" cy="195" r="60"/><rect y="195" width="400" height="65"/></g>`]},
  stars: {motion: 'stars', dark: true,
    sky: () => `<defs>${grad('css-sky', [[0, '#0a1233'], [.6, '#1d2a63'], [1, '#3b3f80']])}</defs><rect width="400" height="800" fill="url(#css-sky)"/>${starField('stars', 80, 0, 800)}`,
    top: [220, () => `<defs>${glow('css-moon', '#fff3c4', .45)}</defs><circle cx="300" cy="90" r="80" fill="url(#css-moon)"/><circle cx="300" cy="90" r="26" fill="#fff6d8"/><circle cx="313" cy="80" r="24" fill="#0e1840"/>`],
    ground: [200, () => `<path d="M0 60 Q60 10 130 40 T260 20 T400 30 V200 H0Z" fill="#26326e"/><path d="M0 120 Q80 70 170 110 T320 90 T400 110 V200 H0Z" fill="#141c48"/>`]},
  grid: {motion: '', dark: false,
    sky: () => `<defs><pattern id="csg-p" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#d5e5f3" stroke-width="1"/></pattern></defs>
      <rect width="400" height="800" fill="#fffdf6"/><rect width="400" height="800" fill="url(#csg-p)"/><path d="M44 0V800" stroke="#ffb8b8" stroke-width="1.6"/>
      <g fill="none" stroke-linecap="round" stroke-width="2.4"><path d="M330 380q12-12 24 0t24 0" stroke="#8cc8ff"/><circle cx="96" cy="470" r="7" stroke="#b9a3ff"/></g>`,
    top: [150, () => `<defs><pattern id="csg-t" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="10" fill="#fff" opacity=".45"/></pattern></defs>
      <g transform="rotate(-14 70 40)"><rect x="18" y="26" width="112" height="28" fill="#ffc8dc" opacity=".9"/><rect x="18" y="26" width="112" height="28" fill="url(#csg-t)"/></g>
      <path d="M352 82c-6-9-20-4-16 6l16 15 16-15c4-10-10-15-16-6z" fill="none" stroke="#ff8fb3" stroke-width="2.4" stroke-linejoin="round"/>`],
    ground: [150, () => `<g transform="rotate(10 340 110)"><rect x="285" y="96" width="112" height="28" fill="#bfe6d8" opacity=".9"/><rect x="285" y="96" width="112" height="28" fill="url(#csg-t)"/></g>
      <path d="M60 50l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="none" stroke="#ffc94d" stroke-width="2.4" stroke-linejoin="round"/>`]},
  sakura: {motion: 'petals', dark: false,
    sky: () => `<defs>${grad('csk-sky', [[0, '#ffe6ef'], [.6, '#fff6f9'], [1, '#ffdbe8']])}</defs><rect width="400" height="800" fill="url(#csk-sky)"/>`,
    top: [260, () => {
      const r = seeded('sakura'), flowers = Array.from({length: 28}, () => blossom(250 + r() * 150, 10 + r() * 200, .7 + r() * .7, r() < .5 ? '#ffc2d6' : '#ffd9e5', '#ff8fb3')).join('');
      return `<g fill="none" stroke="#7a5650" stroke-linecap="round"><path d="M410 30 Q330 60 290 120 T230 190" stroke-width="9"/><path d="M340 70 Q330 120 360 170" stroke-width="5"/><path d="M300 110 Q270 100 250 70" stroke-width="4"/><path d="M262 160 Q240 210 250 240" stroke-width="3.5"/></g>${flowers}`;
    }],
    ground: [120, () => `<ellipse cx="200" cy="140" rx="320" ry="80" fill="#ffc9db" opacity=".55"/>${(() => { const r = seeded('sakura-ground'); return Array.from({length: 14}, () => { const x = r() * 400, y = 90 + r() * 30; return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4" ry="2.6" fill="#ffb3cb" opacity=".8" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`; }).join(''); })()}`]},
  aurora: {motion: 'stars', dark: true, extra: '<b class="wm-band"></b><b class="wm-band"></b>',
    sky: () => `<defs>${grad('csa-sky', [[0, '#020a18'], [.55, '#082338'], [1, '#0f3b46']])}</defs><rect width="400" height="800" fill="url(#csa-sky)"/>${starField('aurora', 70, 0, 800)}`,
    top: [320, () => `<defs>${grad('csa-band', [[0, '#3cffb0', 0], [.5, '#3cffb0', .55], [1, '#8a6cff', 0]], 1, 0)}<filter id="csa-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs>
      <g filter="url(#csa-blur)" opacity=".85"><path d="M-40 90 C80 20 180 170 300 80 S440 50 460 100 L460 160 C340 130 260 230 140 160 S0 160 -40 180Z" fill="url(#csa-band)"/><path d="M-40 190 C120 140 200 260 330 190 S440 180 460 200 L460 230 C330 220 200 310 60 250 S-20 250 -40 260Z" fill="#7c6cff" opacity=".35"/></g>`],
    ground: [300, () => {
      const far = [[0, 120], [60, 60], [100, 90], [160, 20], [215, 85], [265, 45], [330, 100], [400, 55]];
      const line = pts => pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x} ${y}`).join(' ');
      return `<defs>${grad('csa-far', [[0, '#3a6f86'], [1, '#17394c']])}${grad('csa-lake', [[0, '#123d4d'], [1, '#061823']])}</defs>
      <path d="${line(far)} V170 H0Z" fill="url(#csa-far)"/>
      <path d="M160 20 L146 40 L155 36 L164 44 L172 35 L178 38Z M60 60 L51 73 L59 70 L66 76 L72 70Z M265 45 L255 59 L264 56 L272 62 L278 56Z M400 55 L392 66 L400 64Z" fill="#eaf8ff"/>
      <path d="M0 150 L50 112 L110 140 L170 98 L240 140 L300 112 L360 146 L400 122 V172 H0Z" fill="#0c2333"/>
      <rect y="170" width="400" height="130" fill="url(#csa-lake)"/>
      <path d="${line(far.map(([x, y]) => [x, 340 - y]))} V170 H0Z" fill="#3a6f86" opacity=".18"/>
      <g fill="#7fffd0" opacity=".35">${[[60, 190, 70], [230, 204, 110], [120, 224, 60], [300, 240, 80], [40, 258, 50]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="2" rx="1"/>`).join('')}</g>`;
    }]},
  sunset: {motion: 'clouds', dark: true,
    sky: () => `<defs>${grad('csu-sky', [[0, '#2b2160'], [.35, '#7a3f8f'], [.62, '#e0679a'], [.8, '#ff9a68'], [1, '#ffc77a']])}</defs><rect width="400" height="800" fill="url(#csu-sky)"/>`,
    top: [300, () => `<g fill="#ffd6e6" opacity=".45"><ellipse cx="90" cy="150" rx="110" ry="9"/><ellipse cx="300" cy="210" rx="130" ry="8"/><ellipse cx="160" cy="280" rx="90" ry="6"/></g>
      <g fill="none" stroke="#3b2350" stroke-width="2.2" stroke-linecap="round"><path d="M70 60 q7 -7 14 0 q7 -7 14 0"/><path d="M110 90 q5 -5 10 0 q5 -5 10 0"/><path d="M300 40 q6 -6 12 0 q6 -6 12 0"/></g>`],
    ground: [230, () => `<defs>${grad('csu-sea', [[0, '#7b4a86'], [1, '#231a47']])}${glow('csu-glow', '#ffe3a3', .85)}</defs><circle cx="200" cy="80" r="190" fill="url(#csu-glow)"/><circle cx="200" cy="80" r="58" fill="#fff0c4"/>
      <rect y="85" width="400" height="145" fill="url(#csu-sea)"/><g fill="#ffd690">${[[101, 120], [119, 92], [139, 70], [161, 50], [185, 34], [211, 22]].map(([y, w]) => `<rect x="${200 - w / 2}" y="${y}" width="${w}" height="4" rx="2" opacity=".8"/>`).join('')}</g>`]},
  ocean: {motion: 'bubbles', dark: true,
    sky: () => `<defs>${grad('cso-sea', [[0, '#62d3f6'], [.35, '#2a90d6'], [.75, '#0d4f96'], [1, '#08305f']])}</defs><rect width="400" height="800" fill="url(#cso-sea)"/>
      <g opacity=".9"><path d="M290 420 q22 -14 40 0 q-18 14 -40 0z M330 420 l12 -9 v18z" fill="#ffb26b"/><path d="M80 340 q16 -10 30 0 q-14 10 -30 0z M110 340 l9 -7 v14z" fill="#ffe27a"/></g>`,
    top: [420, () => `<defs>${grad('cso-ray', [[0, '#ffffff', .35], [1, '#ffffff', 0]])}</defs><g fill="url(#cso-ray)">${[[60, 40], [140, 26], [215, 44], [300, 30], [365, 22]].map(([x, w]) => `<path d="M${x} -10 L${x + w} -10 L${x + w * 3} 420 L${x - w} 420Z" opacity=".55"/>`).join('')}</g>`],
    ground: [260, () => { const r = seeded('ocean'); return `<path d="M0 195 Q100 165 200 188 T400 178 V260 H0Z" fill="#e8d4a2" opacity=".85"/>${Array.from({length: 9}, (_, i) => { const x = 10 + i * 46 + r() * 20, h = 90 + r() * 120; return `<path d="M${f(x)} 260 C${f(x - 18)} ${f(260 - h * .4)} ${f(x + 18)} ${f(260 - h * .7)} ${f(x + 4)} ${f(260 - h)}" fill="none" stroke="${i % 2 ? '#0f6b66' : '#0a5250'}" stroke-width="${f(5 + r() * 4)}" stroke-linecap="round"/>`; }).join('')}`; }]},
  meteor: {motion: 'stars', dark: true, extra: '<b class="cs-meteor"></b><b class="cs-meteor"></b><b class="cs-meteor"></b>',
    sky: () => `<defs>${grad('csm-sky', [[0, '#04061f'], [.6, '#15133f'], [1, '#2d1b54']])}<radialGradient id="csm-way" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d6c8ff" stop-opacity=".42"/><stop offset=".6" stop-color="#8f7cff" stop-opacity=".14"/><stop offset="1" stop-color="#8f7cff" stop-opacity="0"/></radialGradient></defs>
      <rect width="400" height="800" fill="url(#csm-sky)"/><ellipse cx="200" cy="330" rx="360" ry="80" fill="url(#csm-way)" transform="rotate(-32 200 330)"/>
      <g transform="rotate(-32 200 330)">${starField('meteor-way', 100, 280, 380)}</g>${starField('meteor', 70, 0, 800)}<path d="M330 120 L250 180" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
    top: [10, () => ''],
    ground: [150, () => `<path d="M0 40 Q90 0 180 30 T400 10 V150 H0Z" fill="#0b0a24"/>`]},
  garden: {motion: 'fireflies', dark: true,
    sky: () => `<defs>${grad('csd-sky', [[0, '#171f43'], [.5, '#38386d'], [.8, '#76598d'], [1, '#b98196']])}</defs><rect width="400" height="800" fill="url(#csd-sky)"/>${starField('garden', 40, 0, 500)}`,
    top: [220, () => `<defs>${glow('csd-moon', '#fff2cc', .4)}</defs><circle cx="90" cy="100" r="60" fill="url(#csd-moon)"/><circle cx="90" cy="100" r="16" fill="#fff6d8"/>`],
    ground: [180, () => {
      const r = seeded('garden'), colors = ['#ff9ec4', '#ffd76a', '#ffffff', '#c7a8ff'];
      const flowers = Array.from({length: 32}, () => { const x = r() * 400, y = 30 + r() * 140; return `<path d="M${f(x)} 180 Q${f(x + 6)} ${f(y + 40)} ${f(x)} ${f(y)}" stroke="#244a35" stroke-width="2" fill="none"/>${blossom(x, y, .55 + r() * .5, colors[Math.floor(r() * 4)])}`; }).join('');
      return `<path d="M0 70 Q100 40 200 60 T400 50 V180 H0Z" fill="#1f3b2e"/>${flowers}`;
    }]}
};
const cache = new Map();
/** The still picture of a background ('' for none, the photo, or an unknown one). */
export function sceneArt(bg) {
  const s = SCENES[bg];
  if (!s) return '';
  if (!cache.has(bg)) {
    const svg = (cls, h, body, fit) => `<svg class="${cls}" viewBox="0 0 400 ${h}" preserveAspectRatio="${fit}" focusable="false">${body}</svg>`;
    cache.set(bg, `<div class="cs-art" aria-hidden="true">${svg('cs-sky', 800, s.sky(), 'xMidYMid slice')}${svg('cs-top', s.top[0], s.top[1](), 'xMidYMin meet')}${svg('cs-ground', s.ground[0], s.ground[1](), 'xMidYMax meet')}</div>`);
  }
  return cache.get(bg);
}
/** Whether the scene is dark (dates and notes over it are drawn light). */
export const sceneDark = bg => !!SCENES[bg]?.dark;
/** The whole scene behind a chat's messages: picture and moving layer. */
export function chatScene(bg) {
  const s = SCENES[bg];
  if (!s) return '';
  const motion = s.motion ? motionLayer(s.motion, {className: 'cs-motion'}) : '';
  return `<div class="chat-scene" data-scene-bg="${bg}" aria-hidden="true">${sceneArt(bg)}${motion}${s.extra ? `<div class="cs-motion">${s.extra}</div>` : ''}</div>`;
}
/** Sets the moving layer's clock from the time of day, so a scene drawn again carries on where it was. */
export function syncMotion(root, win = globalThis) {
  const now = Date.now() / 1000;
  [...root.querySelectorAll('.chat-scene .cs-motion > *')].forEach((el, i) => {
    const d = parseFloat(win.getComputedStyle?.(el).animationDuration || '');
    if (d > 0) el.style.setProperty('--delay', `-${((now + i * 7.31) % d).toFixed(2)}s`);
  });
}
