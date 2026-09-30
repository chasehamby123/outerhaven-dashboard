// The whip: opening Today with overdue work darkens the page and puts a pixel knight on screen, whipping a slave
// hunched over his laptop. CRACK! on every lash, "Work harder!" overhead. Click anywhere or press Esc to get back to it.
// Sprites are character maps (one char = one pixel) rendered to SVG; each layer gets a dark outline automatically.
import { esc } from './core.js';

const PAL = {
  w: '#f1f4f8', s: '#c3cbd6', S: '#8d98aa', d: '#5a6478', v: '#06080d', p: '#e23d33', P: '#9e2620', c: '#2d55b0', C: '#1c3675',
  b: '#7b4a26', n: '#4a2c15', B: '#e6b44a', g: '#a07a26', f: '#e8b68c', F: '#c48860', h: '#3a2616', r: '#a38159', R: '#6e5436',
  e: '#10131b', o: '#ffffff', m: '#5a1a14', y: '#8fd6ff', W: '#ff4a3a', L: '#6fb8ff', l: '#0a66c2', M: '#3a4150', N: '#23272f',
  x: '#6b4423', X: '#3b2412', G: '#343947', H: '#252933', Y: '#fff3a0', k: '#0b0d13', z: '#ffffff',
};

// Knight, facing right. Arm and whip are separate layers so they can swing.
const KNIGHT = [
  '....ppp.............',
  '...pPPpp............',
  '..pP..pPp...........',
  '.......pP...........',
  '.....wwssssss.......',
  '.....wsssssssS......',
  '.....sSSSSSSSS......',
  '.....sSSSSvvvvv.....',
  '.....sSSSSSSSSS.....',
  '.....sSSSSSdSdS.....',
  '.....dSSSSSSSSd.....',
  '......ddddddddd.....',
  '...c..BsssssssB.....',
  '..cC.wsssssssssS....',
  '..cCcwsBBBBBBsSS....',
  '..cCcssSSBgSSSSS....',
  '..cCcssSSBgSSSSd....',
  '..cCcsSSSBgSSSSd....',
  '..cCcdSSSBgSSSdd....',
  '..cCcnbbbBBbbbbn....',
  '..cCcbbbbbbbbbbb....',
  '...CcsssSS.sSSSd....',
  '...Cc.sSSd.dSSSd....',
  '.....sSSSd.sSSSd....',
  '.....sSSSd.sSSSd....',
  '.....dSSSd.dSSSd....',
  '.....sSSSd.sSSSd....',
  '.....dSSdd.dSSSd....',
  '....ddddd..ddddddd..',
];
// Arm raised for the wind-up (hand above the helmet) and thrust forward for the lash.
const ARM_UP = [
  '....................',
  '...............BB...',
  '..............sBBs..',
  '..............sSSs..',
  '..............sSd...',
  '..............sSd...',
  '.............sSSd...',
  '.............sSd....',
  '.............sSd....',
  '............sSSd....',
  '............sSd.....',
  '...........sSSd.....',
  '..........wsSSd.....',
  '..........wsSd......',
];
const ARM_OUT = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '..........wssssssBB.',
  '..........wsSSSSsBBs',
  '...........ddddd.ss.',
];
// Slave kneeling at his laptop, back to the knight. Two typing frames and a flinch.
const SLAVE_A = [
  '.........hhhh.......',
  '........hhhhhh......',
  '........hffffff.....',
  '........fffffef.....',
  '........Ffffffff....',
  '.........Fffff......',
  '.......rrrFfrr......',
  '......rRrrrrrrrff...',
  '.....rRrrrrrrrr.ff..',
  '.....rRrrrrrrrr..ff.',
  '.....rRrrrrrrrr.....',
  '.....rRRrrrrrrr.....',
  '.....rrRrrrrrrr.....',
  '....nnnnnnnnnnn.....',
  '...rrrrrrrrrrrrr....',
  '.ffRrrrrrrrrrrrr....',
  '.ffRRRRRRRRRRRRRR...',
];
const SLAVE_B = SLAVE_A.map((row, i) => i === 7 ? '......rRrrrrrrrrff..' : i === 8 ? '.....rRrrrrrrrr..ff.' : i === 9 ? '.....rRrrrrrrrr.ff..' : row);
const SLAVE_HIT = [
  '...y......hhhh....y.',
  '.y.......hhhhhh...y.',
  '.........hfffoof....',
  '..y......ffffoeff...',
  '.........FfffmmFf.ff',
  '..........Fffmm..ff.',
  '........rrrFfrr.ff..',
  '.......rRrrrrrrrf...',
  '......rWrrrrrrrr....',
  '.....rRWrrrrrrrr....',
  '.....rRrWrrrrrrr....',
  '.....rRRrWrrrrrr....',
  '.....rrRrrrrrrrr....',
  '....nnnnnnnnnnnn....',
  '...rrrrrrrrrrrrrr...',
  '.ffRrrrrrrrrrrrrr...',
  '.ffRRRRRRRRRRRRRRR..',
];
const LAPTOP = [
  '.........MM',
  '........MLM',
  '........MLM',
  '.......MLlM',
  '.......MLM.',
  '......MLlM.',
  '......MLM..',
  '.....MLlM..',
  'NNNNNNNNM..',
];

// Scene layout, in pixels of a 110 x 52 grid.
const KX = 12, KY = 19, SX = 58, SY = 31, LX = 77, LY = 39, GROUND = 48;

function cells(map, ox, oy) {
  const out = [];
  map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') out.push([ox + x, oy + y, ch]); }));
  return out;
}
// Dark outline around every filled pixel of a layer (8-neighbour), so layers read against each other.
function outline(px) {
  const on = new Set(px.map(([x, y]) => x + ',' + y)), ring = new Set();
  for (const [x, y, ch] of px) {
    if (ch === 'y') continue; // sweat drops float free
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const k = (x + dx) + ',' + (y + dy); if (!on.has(k)) ring.add(k); }
  }
  return [...ring].map(k => { const [x, y] = k.split(',').map(Number); return [x, y, 'k']; });
}
const rects = px => px.map(([x, y, ch]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[ch]}"/>`).join('');
const layer = (map, ox, oy) => { const px = cells(map, ox, oy); return rects(outline(px)) + rects(px); };

// Whip: a quadratic curve sampled into pixels (dark core, lighter top edge).
function whip(p0, p1, p2, spark) {
  const px = new Map();
  for (let t = 0; t <= 1; t += 0.004) {
    const x = Math.round((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]);
    const y = Math.round((1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]);
    px.set(x + ',' + y, [x, y, 'X']);
    if (t < 0.55 && !px.has(x + ',' + (y - 1))) px.set(x + ',' + (y - 1), [x, y - 1, 'x']);
  }
  let out = rects([...px.values()]);
  if (spark) {
    const [x, y] = p2;
    out += rects([[x + 1, y - 3, 'Y'], [x + 3, y - 1, 'Y'], [x - 1, y - 2, 'Y'], [x + 2, y + 2, 'Y'], [x - 2, y + 1, 'Y'], [x + 4, y + 1, 'Y'], [x, y, 'z'], [x + 1, y, 'Y'], [x, y - 1, 'Y']]);
  }
  return out;
}

function floor() {
  // A pool of light on flagstones; tiles thin out towards the dark.
  let s = `<ellipse cx="52" cy="${GROUND + 1}" rx="50" ry="4" fill="#ffffff" opacity=".06"/>`;
  for (let x = 4; x < 100; x += 6) {
    const edge = Math.min(x - 4, 100 - x), o = edge < 12 ? 0.35 : edge < 24 ? 0.7 : 1;
    s += `<rect x="${x}" y="${GROUND}" width="5" height="1" fill="${PAL.G}" opacity="${o}"/><rect x="${x + 3}" y="${GROUND + 2}" width="5" height="1" fill="${PAL.H}" opacity="${o}"/>`;
  }
  return s;
}

function sceneSvg() {
  const hand = [KX + 17, KY + 1];        // raised gauntlet
  const handOut = [KX + 19, KY + 13];    // thrust gauntlet
  const back = [SX + 6, SY + 9];         // where the lash lands
  return `<svg viewBox="2 6 100 46" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${floor()}
    <ellipse cx="${KX + 9}" cy="${GROUND}" rx="9" ry="1.3" fill="#000" opacity=".45"/><ellipse cx="${SX + 9}" cy="${GROUND}" rx="11" ry="1.3" fill="#000" opacity=".45"/>
    <ellipse cx="${LX}" cy="${LY + 1}" rx="10" ry="6" fill="${PAL.L}" opacity=".07"/>
    <g data-fr="a b">${whip(hand, [KX - 4, KY - 16], [KX - 10, KY + 4])}</g>
    ${layer(KNIGHT, KX, KY)}
    <g data-fr="a b">${layer(ARM_UP, KX, KY - 4)}</g>
    <g data-fr="hit">${layer(ARM_OUT, KX, KY)}${whip(handOut, [KX + 38, KY - 8], back, true)}</g>
    ${layer(LAPTOP, LX, LY)}
    <g data-fr="a">${layer(SLAVE_A, SX, SY)}</g>
    <g data-fr="b">${layer(SLAVE_B, SX, SY)}</g>
    <g data-fr="hit">${layer(SLAVE_HIT, SX, SY - 1)}</g>
  </svg>`;
}

// A short whip crack: a noise snap through a high band-pass plus a low thump. Muted with the toggle.
let audio = null;
const soundOn = () => { try { return localStorage.getItem('hq-whip-sound') !== 'off'; } catch { return true; } };
function crackSound() {
  if (!soundOn()) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime, len = Math.floor(audio.sampleRate * 0.12);
    const buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    const src = audio.createBufferSource(); src.buffer = buf;
    const bp = audio.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
    const g = audio.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp).connect(g).connect(audio.destination); src.start(t);
    const o = audio.createOscillator(), og = audio.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    og.gain.setValueAtTime(0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og).connect(audio.destination); o.start(t); o.stop(t + 0.12);
  } catch { /* no audio, no problem */ }
}

let open = null;
// list: overdue tasks [{ when, task }]; onWork: called when they choose "Back to work".
export function showWhip(list, onWork) {
  if (open || !list.length) return;
  if (!document.querySelector('link[data-pixel-font]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.pixelFont = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'; document.head.appendChild(l);
  }
  const n = list.length;
  const el = document.createElement('div');
  el.className = 'whip'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', `${n} overdue task${n === 1 ? '' : 's'}`);
  el.innerHTML = `<div class="whipStage">
      <div class="whipScene" data-f="a">${sceneSvg()}<div class="say knight">Work harder!</div><div class="sfx">CRACK!</div></div>
      <div class="whipCap">
        <h2><b>${n} task${n === 1 ? '' : 's'}</b> overdue</h2>
        <ul>${list.slice(0, 4).map(t => `<li><span>${esc(t.when)}</span>${esc(t.task)}</li>`).join('')}${n > 4 ? `<li class="s">and ${n - 4} more</li>` : ''}</ul>
        <div class="row"><button type="button" class="btn brass lg" data-work>Back to work</button><button type="button" class="btn ghost sm" data-sound>${soundOn() ? 'Sound on' : 'Sound off'}</button></div>
        <span class="s">Click anywhere or press Esc to close</span>
      </div></div>`;
  document.body.appendChild(el);
  const scene = el.querySelector('.whipScene');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tick = 0;
  const step = () => {
    const i = tick++ % 8;                        // 8 ticks of 150 ms: six of typing wind-up, two of lash
    if (i === 6) { scene.dataset.f = 'hit'; scene.classList.remove('hit'); void scene.offsetWidth; scene.classList.add('hit'); crackSound(); }
    else if (i < 6) { scene.dataset.f = i % 2 ? 'b' : 'a'; scene.classList.remove('hit'); }
  };
  const timer = reduce ? (scene.dataset.f = 'hit', scene.classList.add('hit'), null) : setInterval(step, 150);
  const close = work => {
    if (!open) return; open = null;
    clearInterval(timer); document.removeEventListener('keydown', onKey);
    el.classList.add('out'); setTimeout(() => el.remove(), 250);
    if (work) onWork?.();
  };
  const onKey = e => { if (e.key === 'Escape') close(false); };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => close(false), { once: true });
  el.addEventListener('click', e => {
    if (e.target.closest('[data-sound]')) {
      const on = !soundOn(); try { localStorage.setItem('hq-whip-sound', on ? 'on' : 'off'); } catch { }
      e.target.textContent = on ? 'Sound on' : 'Sound off'; return;
    }
    if (e.target.closest('[data-work]')) return close(true);
    if (!e.target.closest('.whipCap')) close(false);
  });
  open = el;
  el.querySelector('[data-work]').focus({ preventScroll: true });
}
