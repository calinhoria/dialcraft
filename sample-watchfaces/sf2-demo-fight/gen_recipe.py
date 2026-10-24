#!/usr/bin/env python3
"""Generate the Dialcraft recipe for the SF2 demo-fight watchface (Bip 6, 390x450).

The fight is generated at run time from a seeded PRNG: every round picks its own
winner, move order, blocks, knockdowns and damage, and a match is best of three.
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
BUILD = ROOT                      # recipe.json sits at the sample root, like the other samples
OUT = f'{ROOT}/out'


def repo_root(p):
    d = p
    while d != '/':
        if os.path.exists(os.path.join(d, 'package.json')) and os.path.isdir(os.path.join(d, 'tools')):
            return d
        d = os.path.dirname(d)
    return p


REPO = repo_root(ROOT)


def rel(p):
    """The face-cli runs from the repository root, so image paths are stored relative to it."""
    return os.path.relpath(p, REPO)
W, H = 390, 450

CLIPS = ['idle', 'punch', 'punchH', 'crouchP', 'kickL', 'kickB', 'kickH', 'kickR',
         'sweep', 'tatsu', 'shoryu', 'block', 'fire', 'hit', 'down', 'up', 'win']
COUNTS = {'idle': 4, 'punch': 2, 'punchH': 3, 'crouchP': 2, 'kickL': 3, 'kickB': 3,
          'kickH': 2, 'kickR': 5, 'sweep': 4, 'tatsu': 6, 'shoryu': 6, 'block': 2,
          'fire': 4, 'hit': 4, 'down': 5, 'up': 4, 'win': 3}
HERO = {'ryu': ('punchH', 2), 'ken': ('hit', 1)}

man = json.load(open(f'{A}/manifest.json'))
CELL = man['cell']


def frames(who):
    hero = f'{HERO[who][0]}_{HERO[who][1]}.png'
    order = [hero]
    for clip in CLIPS:
        for i in range(COUNTS[clip]):
            fn = f'{clip}_{i}.png'
            if fn == hero:
                continue
            order.append(fn)
    return order


def index_map(who):
    order = frames(who)
    return {clip: [order.index(f'{clip}_{i}.png') for i in range(COUNTS[clip])] for clip in CLIPS}


images = [('sf2/bg.png', f'{ROOT}/bg_final.png')]
for who in ('ryu', 'ken'):
    for fn in frames(who):
        images.append((f'sf2/{who}/{fn}', f'{A}/{who}/{fn}'))
for i in range(10):
    images.append((f'sf2/hud/digit_{i}.png', f'{A}/hud/digit_{i}.png'))
    images.append((f'sf2/hud/timer_{i}.png', f'{A}/hud/timer_{i}.png'))
images += [
    ('sf2/hud/colon.png', f'{A}/hud/colon.png'),
    ('sf2/hud/name_ryu.png', f'{A}/hud/name_ryu.png'),
    ('sf2/hud/name_ken.png', f'{A}/hud/name_ken.png'),
    ('sf2/hud/ko.png', f'{A}/hud/ko.png'),
    ('sf2/hud/ko_small.png', f'{A}/hud/ko_small.png'),
    ('sf2/hud/round_1.png', f'{A}/hud/round_1.png'),
    ('sf2/hud/round_2.png', f'{A}/hud/round_2.png'),
    ('sf2/hud/round_3.png', f'{A}/hud/round_3.png'),
    ('sf2/hud/youwin.png', f'{A}/hud/youwin.png'),
    ('sf2/hud/fight.png', f'{A}/hud/fight.png'),
    ('sf2/fx/spark_1.png', f'{A}/fx/spark_1.png'),
    ('sf2/fx/spark_0.png', f'{A}/fx/spark_0.png'),
    ('sf2/fx/spark_2.png', f'{A}/fx/spark_2.png'),
    ('sf2/fx/orb_0.png', f'{A}/fx/orb_0.png'),
    ('sf2/fx/orb_1.png', f'{A}/fx/orb_1.png'),
    ('sf2/fx/empty.png', f'{A}/fx/empty.png'),
]

ryu_imgs = [n for n, _ in images if n.startswith('sf2/ryu/')]
ken_imgs = [n for n, _ in images if n.startswith('sf2/ken/')]
RI, KI = index_map('ryu'), index_map('ken')

FEET = 442
RYU_X = 132
KEN_X = 258
RYU_L = (RYU_X - CELL['ryu']['ax'], FEET - CELL['ryu']['ay'])
KEN_L = (KEN_X - CELL['ken']['ax'], FEET - CELL['ken']['ay'])

BAR_Y, BAR_H, BAR_W = 26, 18, 158
BAR_L_X, BAR_R_X = 12, 220
HOUR_X, MIN_X, COLON_X, TIME_Y, COLON_Y = 56, 203, 187, 140, 155
AOD_Y = 197
ORB_X, ORB_Y = 158, 286
ORB_W, ORB_H = 76, 80

script_images = '\n'.join(f"  [{json.dumps(n)}, {json.dumps(rel(p))}]," for n, p in images)

maker = f"""
const FILES = [
{script_images}
];
let added = 0;
for (const [name, path] of FILES) {{
  const r = await API.readImage(path);
  if (!r) throw new Error('cannot read ' + path);
  project.images.push({{ name, width: r.width, height: r.height, url: 'data:image/png;base64,' + r.dataBase64 }});
  added++;
}}
const mk = (kind, patch) => {{ const e = newElement(kind, patch); project.elements.push(e); return e; }};
project.appId = 2023129;   // keep the same id across rebuilds so an install replaces the old face

// ---- stage -------------------------------------------------------------
mk('IMG', {{ name: 'Stage', src: 'sf2/bg.png', x: 0, y: 0, w: {W}, h: {H} }});

// ---- fighters ----------------------------------------------------------
mk('IMG', {{ name: 'Ken', images: {json.dumps(ken_imgs)}, x: {KEN_L[0]}, y: {KEN_L[1]}, w: {CELL['ken']['w']}, h: {CELL['ken']['h']}, handle: 'ken' }});
mk('IMG', {{ name: 'Ryu', images: {json.dumps(ryu_imgs)}, x: {RYU_L[0]}, y: {RYU_L[1]}, w: {CELL['ryu']['w']}, h: {CELL['ryu']['h']}, handle: 'ryu' }});

// ---- round win pips: parked under the bars so the still shows none ----------
const pip = (n, x, handle) => {{ const e = mk('FILL_RECT', {{ name: n, x, y: {BAR_Y}, w: 9, h: 9, color: '#ffd400', radius: 4, show: 'normal' }}); e.handle = handle; return e; }};
pip('Win RYU 1', 12, 'pip1'); pip('Win RYU 2', 25, 'pip2');
pip('Win KEN 1', 369, 'pip3'); pip('Win KEN 2', 356, 'pip4');

// ---- health bars (damage eats from the outside edge inwards) ------------
mk('FILL_RECT', {{ name: 'Health RYU lost', x: {BAR_L_X}, y: {BAR_Y}, w: {BAR_W}, h: {BAR_H}, color: '#f41c1c', radius: 0, show: 'normal' }});
mk('FILL_RECT', {{ name: 'Health KEN lost', x: {BAR_R_X}, y: {BAR_Y}, w: {BAR_W}, h: {BAR_H}, color: '#f41c1c', radius: 0, show: 'normal' }});
const hpL = mk('FILL_RECT', {{ name: 'Health RYU', x: {BAR_L_X + 158 - 114}, y: {BAR_Y}, w: 114, h: {BAR_H}, color: '#ffe600', radius: 0, show: 'normal' }});
const hpR = mk('FILL_RECT', {{ name: 'Health KEN', x: {BAR_R_X}, y: {BAR_Y}, w: 87, h: {BAR_H}, color: '#ffe600', radius: 0, show: 'normal' }});
hpL.handle = 'hpL'; hpR.handle = 'hpR';
mk('STROKE_RECT', {{ name: 'Frame RYU', x: {BAR_L_X - 2}, y: {BAR_Y - 2}, w: {BAR_W + 4}, h: {BAR_H + 4}, color: '#0c0c0c', lineWidth: 2, radius: 0, show: 'normal' }});
mk('STROKE_RECT', {{ name: 'Frame KEN', x: {BAR_R_X - 2}, y: {BAR_Y - 2}, w: {BAR_W + 4}, h: {BAR_H + 4}, color: '#0c0c0c', lineWidth: 2, radius: 0, show: 'normal' }});

// ---- names + round win pips (two per fighter, like the arcade) ----------
mk('IMG', {{ name: 'Name RYU', src: 'sf2/hud/name_ryu.png', x: 12, y: 48, w: 56, h: 18, show: 'normal' }});
mk('IMG', {{ name: 'Name KEN', src: 'sf2/hud/name_ken.png', x: 318, y: 48, w: 60, h: 18, show: 'normal' }});
// ---- clock: the arcade digits, hour / colon / minute --------------------
const digits = ['sf2/hud/digit_0.png','sf2/hud/digit_1.png','sf2/hud/digit_2.png','sf2/hud/digit_3.png','sf2/hud/digit_4.png','sf2/hud/digit_5.png','sf2/hud/digit_6.png','sf2/hud/digit_7.png','sf2/hud/digit_8.png','sf2/hud/digit_9.png'];
// the Layers panel lists the top layer first, so the parts go in last-to-first
mk('IMG_TIME', {{ name: 'Minute Main', part: 'minute', images: digits, zero: 1, space: 4, x: {MIN_X}, y: {TIME_Y}, alignH: 'LEFT', show: 'normal' }});
mk('IMG', {{ name: 'Colon Main', src: 'sf2/hud/colon.png', x: {COLON_X}, y: {COLON_Y}, w: 12, h: 30, show: 'normal' }});
mk('IMG_TIME', {{ name: 'Hour Main', part: 'hour', images: digits, zero: 1, space: 4, x: {HOUR_X}, y: {TIME_Y}, alignH: 'RIGHT', show: 'normal' }});
mk('IMG_TIME', {{ name: 'Minute AOD', part: 'minute', images: digits, zero: 1, space: 4, x: {MIN_X}, y: {AOD_Y}, alignH: 'LEFT', show: 'aod' }});
mk('IMG', {{ name: 'Colon AOD', src: 'sf2/hud/colon.png', x: {COLON_X}, y: {AOD_Y + 15}, w: 12, h: 30, show: 'aod' }});
mk('IMG_TIME', {{ name: 'Hour AOD', part: 'hour', images: digits, zero: 1, space: 4, x: {HOUR_X}, y: {AOD_Y}, alignH: 'RIGHT', show: 'aod' }});

// ---- round timer + KO between the bars --------------------------------
const tdigits = ['sf2/hud/timer_9.png','sf2/hud/timer_0.png','sf2/hud/timer_1.png','sf2/hud/timer_2.png','sf2/hud/timer_3.png','sf2/hud/timer_4.png','sf2/hud/timer_5.png','sf2/hud/timer_6.png','sf2/hud/timer_7.png','sf2/hud/timer_8.png'];   // picture 0 = 9, so the still reads 99
const tens = mk('IMG', {{ name: 'Timer tens', images: tdigits, x: 171, y: 47, w: 24, h: 20, show: 'normal', handle: 'tens' }});
const ones = mk('IMG', {{ name: 'Timer ones', images: tdigits, x: 195, y: 47, w: 24, h: 20, show: 'normal', handle: 'ones' }});
mk('IMG', {{ name: 'KO small', images: ['sf2/fx/empty.png','sf2/hud/ko_small.png'], x: 177, y: 24, w: 36, h: 14, show: 'normal', handle: 'koko' }});

// ---- banners -----------------------------------------------------------
mk('IMG', {{ name: 'Round banner', images: ['sf2/fx/empty.png','sf2/hud/round_1.png','sf2/hud/round_2.png','sf2/hud/round_3.png'], x: 53, y: 98, w: 284, h: 40, show: 'normal', handle: 'round' }});
mk('IMG', {{ name: 'Win banner', images: ['sf2/fx/empty.png','sf2/hud/youwin.png'], x: 53, y: 98, w: 284, h: 40, show: 'normal', handle: 'youwin' }});
mk('IMG', {{ name: 'Fight banner', images: ['sf2/fx/empty.png','sf2/hud/fight.png'], x: 100, y: 246, w: 189, h: 81, show: 'normal', handle: 'fight' }});
mk('IMG', {{ name: 'KO banner', images: ['sf2/fx/empty.png','sf2/hud/ko.png'], x: 123, y: 50, w: 144, h: 56, show: 'normal', handle: 'ko' }});

// ---- effects -----------------------------------------------------------
mk('IMG', {{ name: 'Hit spark', images: ['sf2/fx/spark_1.png','sf2/fx/spark_0.png','sf2/fx/spark_2.png'], x: 208, y: 294, w: 64, h: 60, show: 'normal', handle: 'spark' }});
mk('IMG', {{ name: 'Hadouken', images: ['sf2/fx/empty.png','sf2/fx/orb_0.png','sf2/fx/orb_1.png'], x: {ORB_X}, y: {ORB_Y}, w: {ORB_W}, h: {ORB_H}, show: 'normal', handle: 'orb' }});

// ---- groups ------------------------------------------------------------
project.groups = project.groups || {{}};
const grp = (id, label, names) => {{ project.groups[id] = label; let n = 0; for (const nm of names) {{ const e = project.elements.find((x) => x.name === nm); if (e) {{ e.group = id; n++; }} }} return n; }};
const g = {{}};
g.Stage = grp('gStage', 'Stage', ['Stage']);
g.Fighters = grp('gFighters', 'Fighters', ['Ryu', 'Ken']);
g.HUD = grp('gHud', 'Health bars', ['Health RYU lost', 'Health KEN lost', 'Health RYU', 'Health KEN', 'Frame RYU', 'Frame KEN', 'Name RYU', 'Name KEN', 'Win RYU 1', 'Win RYU 2', 'Win KEN 1', 'Win KEN 2', 'Timer tens', 'Timer ones', 'KO small']);
g.Clock = grp('gClock', 'Clock', ['Hour Main', 'Colon Main', 'Minute Main']);
g.ClockAod = grp('gClockAod', 'Clock (AOD)', ['Hour AOD', 'Colon AOD', 'Minute AOD']);
g.Banners = grp('gBanners', 'Banners', ['Fight banner', 'KO banner', 'Round banner', 'Win banner']);
g.FX = grp('gFx', 'Effects', ['Hit spark', 'Hadouken']);
return {{ images: added, layers: project.elements.length, groups: g }};
"""

USER_CODE = f"""
{{
  // Attract-mode demo: two CPU fighters, every round generated from a seed, best of three.
  // 0 = Ryu (left), 1 = Ken (right). The clock is the real time; the bars show the round's HP.
  const MS = 55, BARW = {BAR_W}, RYU_L = [{RYU_L[0]}, {RYU_L[1]}], KEN_L = [{KEN_L[0]}, {KEN_L[1]}];
  const RY = {json.dumps(RI)};
  const KN = {json.dumps(KI)};

  const mkClips = (M) => ({{
    idle:    {{ f: M.idle,    d: [200, 160, 200, 160], loop: 1 }},
    punch:   {{ f: M.punch,   d: [60, 90] }},
    punchH:  {{ f: M.punchH,  d: [70, 80, 120] }},
    crouchP: {{ f: M.crouchP, d: [80, 110] }},
    kickL:   {{ f: M.kickL,   d: [70, 90, 110] }},
    kickB:   {{ f: M.kickB,   d: [70, 80, 110] }},
    kickH:   {{ f: M.kickH,   d: [80, 120] }},
    kickR:   {{ f: M.kickR,   d: [70, 70, 70, 90, 120] }},
    sweep:   {{ f: M.sweep,   d: [80, 90, 90, 110] }},
    tatsu:   {{ f: M.tatsu,   d: [70, 70, 70, 70, 80, 100] }},
    shoryu:  {{ f: M.shoryu,  d: [70, 70, 80, 80, 90, 110] }},
    block:   {{ f: M.block,   d: [110, 240] }},
    fire:    {{ f: M.fire,    d: [60, 70, 70, 180] }},
    hit:     {{ f: M.hit,     d: [60, 80, 60, 90] }},
    down:    {{ f: M.down,    d: [80, 80, 90, 100, 140] }},
    up:      {{ f: M.up,      d: [90, 90, 90, 110] }},
    win:     {{ f: M.win,     d: [150, 150, 170] }},
  }});
  const CL = [mkClips(RY), mkClips(KN)];
  const DUR = (side, k) => {{ let s = 0; for (const d of CL[side][k].d) s += d; return s; }};
  const HIT_T = DUR(0, 'hit'), BLOCK_T = DUR(0, 'block'), DOWN_T = DUR(0, 'down'), UP_T = DUR(0, 'up');

  // every attack: when it connects (ms after the clip starts), damage, lunge, knockdown, weight
  const MOVES = [
    {{ k: 'punch',   hit: 60,  dmg: 9,  lunge: 8,  w: 3 }},
    {{ k: 'punchH',  hit: 150, dmg: 13, lunge: 12, w: 3 }},
    {{ k: 'crouchP', hit: 80,  dmg: 10, lunge: 6,  w: 2 }},
    {{ k: 'kickL',   hit: 120, dmg: 11, lunge: 8,  w: 4 }},
    {{ k: 'kickB',   hit: 140, dmg: 12, lunge: 8,  w: 4 }},
    {{ k: 'kickH',   hit: 80,  dmg: 13, lunge: 7,  w: 4 }},
    {{ k: 'kickR',   hit: 250, dmg: 15, lunge: 10, w: 5 }},
    {{ k: 'sweep',   hit: 90,  dmg: 12, lunge: 8,  w: 3, knock: 1 }},
    {{ k: 'tatsu',   hit: 150, dmg: 13, lunge: 6,  w: 4 }},
    {{ k: 'shoryu',  hit: 200, dmg: 15, lunge: 4,  w: 4, knock: 1 }},
    {{ k: 'fire',    hit: 500, dmg: 16, lunge: 4,  w: 2, knock: 1, orb: 1 }},
  ];
  const POOL = [];
  MOVES.forEach((m, i) => {{ for (let k = 0; k < m.w; k++) POOL.push(i); }});

  // ---- seeded PRNG (LCG): a new seed every round, so the demo never repeats ----
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  let rngState = seed;
  const rnd = () => {{ rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; }};
  const pickMove = (last) => {{
    let i = POOL[Math.floor(rnd() * POOL.length)];
    for (let n = 0; n < 3 && i === last; n++) i = POOL[Math.floor(rnd() * POOL.length)];
    return i;
  }};

  const buildPlan = () => {{
    const winner = rnd() < 0.5 ? 0 : 1, loser = 1 - winner;   // the round's winner is drawn first
    const beats = [];
    let hp = [100, 100], t = 820, ko = null;
    let atk = rnd() < 0.5 ? 0 : 1;
    const lastMove = [-1, -1];
    for (let n = 0; n < 30 && ko === null; n++) {{
      let who = atk;
      if (hp[loser] <= 28 && rnd() < 0.7) who = winner;        // go for the finish
      else if (rnd() < 0.3) who = 1 - atk;
      const mi = pickMove(lastMove[who]);
      lastMove[who] = mi;
      const mv = MOVES[mi];
      const def = 1 - who;
      const blocked = rnd() < 0.22;
      let dmg = blocked ? 0 : mv.dmg;
      if (who !== winner) dmg = Math.round(dmg * 0.5);         // the loser only chips away
      hp[def] = Math.max(0, hp[def] - dmg);
      if (def === winner) hp[winner] = Math.max(1, hp[winner]);
      const start = t, hitT = start + mv.hit;
      const react = blocked ? 'block' : (mv.knock ? 'down' : 'hit');
      beats.push({{
        atk: who, k: mv.k, start: start, hitT: hitT, lunge: mv.lunge, orb: mv.orb || 0,
        react: react, hp: [hp[0], hp[1]],
      }});
      if (hp[loser] <= 0) {{ ko = hitT; break; }}
      const rd = react === 'down' ? DOWN_T + UP_T : react === 'block' ? BLOCK_T : HIT_T;
      t = hitT + rd + 150 + Math.floor(rnd() * 220);
      atk = def;
    }}
    if (ko === null) {{                                          // ran long: the winner finishes it
      const mi = pickMove(-1), mv = MOVES[mi];
      hp[loser] = 0;
      const start = t, hitT = start + mv.hit;
      beats.push({{ atk: winner, k: mv.k, start: start, hitT: hitT, lunge: mv.lunge, orb: mv.orb || 0, react: 'down', hp: [hp[0], hp[1]] }});
      ko = hitT;
    }}
    return {{ beats: beats, ko: ko, winner: winner, end: ko + 2600 }};
  }};

  let P = null, t0 = 0, hpRd = 100, hpKd = 100, matchWins = [0, 0], phase = 0, endT = 0, roundNo = 1;
  const newRound = (now) => {{
    seed = (seed * 1664525 + 1013904223 + (now & 0xffff)) >>> 0;
    rngState = seed;
    P = buildPlan();
    t0 = now;
    hpRd = 100; hpKd = 100;
    roundNo = matchWins[0] + matchWins[1] + 1;
  }};

  const frameOf = (side, clip, el) => {{
    const c = CL[side][clip];
    let total = 0; for (const d of c.d) total += d;
    const x = c.loop ? el % total : el;
    let acc = 0;
    for (let i = 0; i < c.d.length; i++) {{ if (x < acc + c.d[i]) return c.f[i]; acc += c.d[i]; }}
    return c.f[c.f.length - 1];
  }};

  const stateOf = (side, t, b) => {{
    if (P.ko !== null && t >= P.ko + 500) {{
      return side === P.winner ? {{ clip: 'win', el: t - P.ko - 500 }} : {{ clip: 'down', el: 9999 }};
    }}
    if (b) {{
      if (b.atk === side && t >= b.start) {{
        const tot = DUR(side, b.k);
        if (t < b.start + tot) return {{ clip: b.k, el: t - b.start }};
        return {{ clip: 'idle', el: t - b.start - tot }};
      }}
      if (b.atk !== side && t >= b.hitT) {{
        const e2 = t - b.hitT;
        if (b.react === 'block') return e2 < BLOCK_T ? {{ clip: 'block', el: e2 }} : {{ clip: 'idle', el: e2 - BLOCK_T }};
        if (b.react === 'hit') return e2 < HIT_T ? {{ clip: 'hit', el: e2 }} : {{ clip: 'idle', el: e2 - HIT_T }};
        if (e2 < DOWN_T) return {{ clip: 'down', el: e2 }};
        if (e2 < DOWN_T + UP_T) return {{ clip: 'up', el: e2 - DOWN_T }};
        return {{ clip: 'idle', el: e2 - DOWN_T - UP_T }};
      }}
    }}
    return {{ clip: 'idle', el: t }};
  }};

  const pips = [[W.pip1, 12], [W.pip2, 25], [W.pip3, 369], [W.pip4, 356]];

  const tick = () => {{
    const now = Date.now();
    if (!P) newRound(now);
    let t = now - t0;
    if (phase === 1) {{
      if (now - endT > 3000) {{ phase = 0; matchWins = [0, 0]; newRound(now); t = 0; }}
    }} else if (t >= P.end) {{
      matchWins[P.winner]++;
      if (matchWins[P.winner] >= 2) {{ phase = 1; endT = now; }}   // match won: hold the win screen
      else {{ newRound(now); t = 0; }}
    }}
    let b = null, prevB = null;
    for (let i = 0; i < P.beats.length; i++) {{ if (t >= P.beats[i].start) {{ prevB = b; b = P.beats[i]; }} else break; }}

    // health: the target only changes when the blow lands
    const hpSrc = b ? (t >= b.hitT ? b : (prevB || b)) : null;
    const hp = hpSrc ? hpSrc.hp : [100, 100];
    hpRd += (hp[0] - hpRd) * 0.3; hpKd += (hp[1] - hpKd) * 0.3;
    const wl = Math.round(BARW * hpRd / 100), wk = Math.round(BARW * hpKd / 100);
    W.hpL.setProperty(ui.prop.MORE, {{ x: pxv({BAR_L_X} + BARW - wl), y: pxv({BAR_Y}), w: pxv(wl), h: pxv({BAR_H}) }});
    W.hpR.setProperty(ui.prop.MORE, {{ x: pxv({BAR_R_X}), y: pxv({BAR_Y}), w: pxv(wk), h: pxv({BAR_H}) }});

    // round timer 99 → 0, hitting 0 on the KO; the little KO takes its place
    const left = Math.max(0, Math.min(99, Math.round(99 * (1 - t / Math.max(1, P.ko)))));
    W.tens.setProperty(ui.prop.MORE, {{ x: pxv(171), y: pxv(P.ko !== null && t >= P.ko ? -40 : 47), src: F.tens[(Math.floor(left / 10) + 1) % 10] }});
    W.ones.setProperty(ui.prop.MORE, {{ x: pxv(195), y: pxv(P.ko !== null && t >= P.ko ? -40 : 47), src: F.ones[(left % 10 + 1) % 10] }});
    W.koko.setProperty(ui.prop.MORE, {{ x: pxv(177), y: pxv(24), src: F.koko[P.ko !== null && t >= P.ko ? 1 : 0] }});

    // round win pips
    for (let i = 0; i < 4; i++) {{
      const on = i < 2 ? matchWins[0] > i : matchWins[1] > (i - 2);
      pips[i][0].setProperty(ui.prop.MORE, {{ x: pxv(pips[i][1]), y: pxv(on ? 72 : {BAR_Y}), w: pxv(9), h: pxv(9) }});
    }}

    // fighters
    for (const side of [0, 1]) {{
      const st = stateOf(side, t, b);
      let dx = 0;
      if (b && b.atk === side && t >= b.start && t < b.start + DUR(side, b.k)) dx = side === 0 ? b.lunge : -b.lunge;
      if (b && b.atk !== side) {{
        const dt = t - b.hitT;
        if (dt >= 0 && dt < 200) dx = (side === 0 ? -1 : 1) * Math.round(12 * (1 - dt / 200));
      }}
      const base = side === 0 ? RYU_L : KEN_L;
      const w = side === 0 ? W.ryu : W.ken;
      const pics = side === 0 ? F.ryu : F.ken;
      w.setProperty(ui.prop.MORE, {{ x: pxv(base[0] + dx), y: pxv(base[1]), src: pics[frameOf(side, st.clip, st.el)] }});
    }}

    // hit spark
    let sparkAt = null;
    if (b && t >= b.hitT && t < b.hitT + 180) sparkAt = b.atk === 0 ? [236, 286] : [150, 286];
    if (sparkAt) {{
      W.spark.setProperty(ui.prop.MORE, {{ x: pxv(sparkAt[0]), y: pxv(sparkAt[1]),
        src: F.spark[[1, 0, 2][Math.min(2, Math.floor((t - b.hitT) / 60))]] }});
    }} else W.spark.setProperty(ui.prop.MORE, {{ x: pxv(-200), y: pxv(-200), src: F.spark[0] }});

    // hadouken: leaves the thrower's hands and lands on the hit frame
    let ox = -300, oy = -300, of = 0;
    if (b && b.orb && t >= b.hitT - 200 && t < b.hitT) {{
      const k = (t - (b.hitT - 200)) / 200;
      const to = b.atk === 0 ? {ORB_X + 54} : {ORB_X - 46};
      ox = Math.round({ORB_X} + (to - {ORB_X}) * k);
      oy = {ORB_Y};
      of = 1 + (Math.floor((t - (b.hitT - 200)) / 70) % 2);
    }}
    W.orb.setProperty(ui.prop.MORE, {{ x: pxv(ox), y: pxv(oy), src: F.orb[of] }});

    // banners: ROUND n → FIGHT!, the big KO on a knockout, YOU WIN when the match is won
    const koNow = P.ko !== null && t >= P.ko;
    W.round.setProperty(ui.prop.MORE, {{ x: pxv(53), y: pxv(98), src: F.round[!koNow && t < 800 ? Math.min(3, roundNo) : 0] }});
    W.fight.setProperty(ui.prop.MORE, {{ x: pxv(100), y: pxv(246), src: F.fight[!koNow && t >= 800 && t < 1500 ? 1 : 0] }});
    W.ko.setProperty(ui.prop.MORE, {{ x: pxv(123), y: pxv(50), src: F.ko[koNow && phase === 0 ? 1 : 0] }});
    W.youwin.setProperty(ui.prop.MORE, {{ x: pxv(53), y: pxv(98), src: F.youwin[phase === 1 ? 1 : 0] }});
  }};

  // the animation only runs while the face is on screen: pause_call clears the
  // interval, resume_call starts it again and continues where it stopped
  let id = null, pausedAt = 0;
  const safe = () => {{ try {{ tick(); }} catch (e) {{}} }};
  const start = () => {{
    if (pausedAt) {{ t0 += Date.now() - pausedAt; pausedAt = 0; }}
    if (id === null) {{ try {{ id = setInterval(safe, MS); }} catch (e) {{}} }}
    safe();
  }};
  const stop = () => {{
    if (id !== null) {{ try {{ clearInterval(id); }} catch (e) {{}} id = null; }}
    pausedAt = Date.now();
  }};
  ui.createWidget(ui.widget.WIDGET_DELEGATE, {{ resume_call: start, pause_call: stop }});
  safe();
  start();
}}
"""

recipe = {
    'name': 'SF2 Demo Fight',
    'device': 'bip-6',
    'language': 'en-US',
    'optimizePng': 32,
    'description': 'Street Fighter II attract-mode demo fight between Ryu and Ken: best of three rounds, every round generated from a seed, with hadouken, shoryuken and hurricane kicks.',
    'userCode': USER_CODE,
    'steps': [{'script': maker}],
    'preview': 'preview.png',
    'previewAod': 'preview-aod.png',
    'save': 'project',
    'out': 'out/sf2-demo-fight',
    'build': True,
}

os.makedirs(BUILD, exist_ok=True)
json.dump(recipe, open(f'{BUILD}/recipe.json', 'w'), indent=1)
print('recipe:', f'{BUILD}/recipe.json')
print('cells', CELL, 'ryu layer', RYU_L, 'ken layer', KEN_L)
print('clips', len(CLIPS), 'images', len(images))
