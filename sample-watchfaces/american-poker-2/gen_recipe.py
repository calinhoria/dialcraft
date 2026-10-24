#!/usr/bin/env python3
"""Generate the Dialcraft recipe for the American Poker 2 demo face (Bip 6, 390x450).

The face plays itself: every round is dealt from a seeded deck, the machine holds
the sensible cards, draws, scores the hand, sometimes gambles the win on red/black,
and tops the player up with 1000 when the credits run out.
"""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
A = f'{ROOT}/assets'
W, H = 390, 450

LABELS = ['DEAL', 'DRAW', 'GAMBLE', 'RED', 'BLACK', 'NO WIN',
          'JACKS OR BETTER', 'TWO PAIR', 'THREE OF A KIND', 'STRAIGHT',
          'FLUSH', 'FULL HOUSE', 'FOUR OF A KIND', 'STRAIGHT FLUSH',
          'ROYAL FLUSH', '5 OF A KIND', 'MINI BONUS!', 'YOU WIN']

images = []
for i in range(52):
    images.append((f'poker/cards/card_{i:02d}.png', f'{A}/cards/card_{i:02d}.png'))
images.append(('poker/cards/card_52.png', f'{A}/cards/card_52.png'))
images.append(('poker/cards/back.png', f'{A}/cards/back.png'))
for i in range(10):
    images.append((f'poker/ui/clock_{i}.png', f'{A}/ui/clock_{i}.png'))
    images.append((f'poker/ui/digit_{i}.png', f'{A}/ui/digit_{i}.png'))
for extra in ['clock_colon', 'hold', 'paytable', 'empty']:
    images.append((f'poker/ui/{extra}.png', f'{A}/ui/{extra}.png'))
for i in range(len(LABELS)):
    images.append((f'poker/ui/label_{i:02d}.png', f'{A}/ui/label_{i:02d}.png'))
for n in ('mini', 'bet', 'credit'):
    images.append((f'poker/ui/panel_{n}.png', f'{A}/ui/panel_{n}.png'))

CARD_BASE = [f'poker/cards/card_{i:02d}.png' for i in range(52)] + ['poker/cards/card_52.png', 'poker/cards/back.png']
DIG_BASE = [f'poker/ui/digit_{i}.png' for i in range(10)]
LBL_BASE = ['poker/ui/empty.png'] + [f'poker/ui/label_{i:02d}.png' for i in range(len(LABELS))]

STILL_CARDS = [0, 12, 11, 10, 9]      # A K Q J 10 of spades: royal flush
STILL_LABEL = 'ROYAL FLUSH'
STILL = {'win': '1900', 'credit': '1000', 'mini': '00', 'bet': '5'}


def rotate(base, still_idx):
    arr = [base[still_idx]] + [x for i, x in enumerate(base) if i != still_idx]
    return arr, [arr.index(x) for x in base]


card_arrays, card_maps = [], []
for k in range(5):
    a, m = rotate(CARD_BASE, STILL_CARDS[k])
    card_arrays.append(a)
    card_maps.append(m)

win_arrays, win_maps = [], []
for j, ch in enumerate(STILL['win']):
    a, m = rotate(DIG_BASE, int(ch))
    win_arrays.append(a)
    win_maps.append(m)

cr_arrays, cr_maps = [], []
for ch in STILL['credit']:
    a, m = rotate(DIG_BASE, int(ch))
    cr_arrays.append(a)
    cr_maps.append(m)

mi_arrays, mi_maps = [], []
for ch in STILL['mini']:
    a, m = rotate(DIG_BASE, int(ch))
    mi_arrays.append(a)
    mi_maps.append(m)

bet_arr, bet_map = rotate(DIG_BASE, int(STILL['bet']))
lbl_arr, lbl_map = rotate(LBL_BASE, 1 + LABELS.index(STILL_LABEL))

# ---------------------------------------------------------------- geometry --
CARD_X = [11, 85, 159, 233, 307]
CARD_Y, CARD_W, CARD_H = 88, 72, 108
HOLD_Y = 70
PAY_X, PAY_Y = 10, 296
PANEL_Y, PANEL_H = 230, 48
P1, P2, P3 = (8, 150), (156, 240), (246, 382)
CLOCK_Y = 10
HOUR_X, COLON_X, MIN_X = 83, 187, 211
CRX = [288, 310, 332, 354]
MIX = [100, 122]
WINX = [284, 308, 332, 356]
CAP_Y = PANEL_Y + 5
VAL_Y = PANEL_Y + 22


def repo_root(p):
    d = p
    while d != '/':
        if os.path.exists(os.path.join(d, 'package.json')) and os.path.isdir(os.path.join(d, 'tools')):
            return d
        d = os.path.dirname(d)
    return p


REPO = repo_root(ROOT)
script_images = '\n'.join(f"  [{json.dumps(n)}, {json.dumps(os.path.relpath(p, REPO))}]," for n, p in images)

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
project.appId = 2024131;   // fixed so a rebuild replaces the same face

// ---- table -------------------------------------------------------------
mk('FILL_RECT', {{ name: 'Table', x: 0, y: 0, w: {W}, h: {H}, color: '#0000e6', radius: 0, show: 'normal' }});
mk('IMG', {{ name: 'Payout table', src: 'poker/ui/paytable.png', x: {PAY_X}, y: {PAY_Y}, w: 370, h: 130, show: 'normal' }});

// ---- MINI BONUS / BET / CREDIT panels ----------------------------------
for (const [n, x0, x1] of [['Mini', {P1[0]}, {P1[1]}], ['Bet', {P2[0]}, {P2[1]}], ['Credit', {P3[0]}, {P3[1]}]]) {{
  mk('FILL_RECT', {{ name: n + ' panel', x: x0, y: {PANEL_Y}, w: x1 - x0, h: {PANEL_H}, color: '#21ffff', radius: 3, show: 'normal' }});
}}
mk('IMG', {{ name: 'Mini caption', src: 'poker/ui/panel_mini.png', x: {P1[0] + 6}, y: {CAP_Y}, w: 92, h: 11, show: 'normal' }});
mk('IMG', {{ name: 'Bet caption', src: 'poker/ui/panel_bet.png', x: {P2[0] + 6}, y: {CAP_Y}, w: 29, h: 11, show: 'normal' }});
mk('IMG', {{ name: 'Credit caption', src: 'poker/ui/panel_credit.png', x: {P3[0] + 6}, y: {CAP_Y}, w: 56, h: 11, show: 'normal' }});

const digitLayer = (name, arr, x, handle) => {{
  const e = mk('IMG', {{ name, images: arr, x, y: {VAL_Y}, w: 22, h: 22, show: 'normal', handle }}); return e;
}};
{chr(10).join(f"digitLayer('{n}', {json.dumps(a)}, {x}, '{h}');" for n, a, x, h in [
    ('Mini tens', mi_arrays[0], MIX[0], 'mini1'),
    ('Mini ones', mi_arrays[1], MIX[1], 'mini2'),
    ('Bet value', bet_arr, 212, 'betv'),
    ('Credit m', cr_arrays[0], CRX[0], 'cr1'),
    ('Credit c', cr_arrays[1], CRX[1], 'cr2'),
    ('Credit d', cr_arrays[2], CRX[2], 'cr3'),
    ('Credit u', cr_arrays[3], CRX[3], 'cr4'),
])}

// ---- the five cards ----------------------------------------------------
{chr(10).join(f"mk('IMG', {{ name: 'Card {i+1}', images: {json.dumps(card_arrays[i])}, x: {CARD_X[i]}, y: {CARD_Y}, w: {CARD_W}, h: {CARD_H}, show: 'normal', handle: 'c{i}' }});" for i in range(5))}

// ---- HOLD tags ---------------------------------------------------------
{chr(10).join(f"mk('IMG', {{ name: 'Hold {i+1}', src: 'poker/ui/hold.png', x: {CARD_X[i] + 17}, y: {HOLD_Y}, w: 38, h: 16, show: 'normal', handle: 'h{i}' }});" for i in range(5))}

// ---- result line -------------------------------------------------------
mk('IMG', {{ name: 'Result label', images: {json.dumps(lbl_arr)}, x: 14, y: 202, w: 280, h: 24, show: 'normal', handle: 'lbl' }});
{chr(10).join(f"mk('IMG', {{ name: 'Win {j+1}', images: {json.dumps(win_arrays[j])}, x: {WINX[j]}, y: 200, w: 22, h: 22, show: 'normal', handle: 'w{j+1}' }});" for j in range(4))}

// ---- clock (top, in both states) --------------------------------------
mk('IMG_TIME', {{ name: 'Minute Main', part: 'minute', images: {json.dumps([f'poker/ui/clock_{i}.png' for i in range(10)])}, zero: 1, space: 0, x: {MIN_X}, y: {CLOCK_Y}, alignH: 'LEFT', show: 'both' }});
mk('IMG', {{ name: 'Colon Main', src: 'poker/ui/clock_colon.png', x: {COLON_X}, y: {CLOCK_Y + 3}, w: 20, h: 54, show: 'both' }});
mk('IMG_TIME', {{ name: 'Hour Main', part: 'hour', images: {json.dumps([f'poker/ui/clock_{i}.png' for i in range(10)])}, zero: 1, space: 0, x: {HOUR_X}, y: {CLOCK_Y}, alignH: 'RIGHT', show: 'both' }});

// ---- groups ------------------------------------------------------------
project.groups = project.groups || {{}};
const grp = (id, label, names) => {{ project.groups[id] = label; let n = 0; for (const nm of names) {{ const e = project.elements.find((x) => x.name === nm); if (e) {{ e.group = id; n++; }} }} return n; }};
const g = {{}};
g.Table = grp('gTable', 'Table', ['Table', 'Payout table']);
g.Panels = grp('gPanels', 'Panels', ['Mini panel', 'Bet panel', 'Credit panel', 'Mini caption', 'Bet caption', 'Credit caption', 'Mini tens', 'Mini ones', 'Bet value', 'Credit m', 'Credit c', 'Credit d', 'Credit u']);
g.Cards = grp('gCards', 'Cards', ['Card 1', 'Card 2', 'Card 3', 'Card 4', 'Card 5', 'Hold 1', 'Hold 2', 'Hold 3', 'Hold 4', 'Hold 5']);
g.Result = grp('gResult', 'Result', ['Result label', 'Win 1', 'Win 2', 'Win 3', 'Win 4']);
g.Clock = grp('gClock', 'Clock', ['Hour Main', 'Colon Main', 'Minute Main']);
return {{ images: added, layers: project.elements.length, groups: g }};
"""

USER_CODE = f"""
{{
  // Demo play: the machine deals, holds, draws, pays and gambles on its own.
  // Credits start at 1000, the bet is 5, and a broke machine tops up with another 1000.
  const MS = 60, BET = 5, ROUND = 5400, BACK = 53;
  const CX = {json.dumps(CARD_X)}, CY = {CARD_Y};
  const PAY = [0, 15, 15, 25, 35, 45, 60, 200, 400, 1900, 3000];
  const NAME = ['', 'JACKS OR BETTER', 'TWO PAIR', 'THREE OF A KIND', 'STRAIGHT', 'FLUSH',
                'FULL HOUSE', 'FOUR OF A KIND', 'STRAIGHT FLUSH', 'ROYAL FLUSH', '5 OF A KIND'];
  const LIDX = {{ 'DEAL': 1, 'DRAW': 2, 'GAMBLE': 3, 'RED': 4, 'BLACK': 5, 'NO WIN': 6,
    'JACKS OR BETTER': 7, 'TWO PAIR': 8, 'THREE OF A KIND': 9, 'STRAIGHT': 10, 'FLUSH': 11,
    'FULL HOUSE': 12, 'FOUR OF A KIND': 13, 'STRAIGHT FLUSH': 14, 'ROYAL FLUSH': 15,
    '5 OF A KIND': 16, 'MINI BONUS!': 17, 'YOU WIN': 18 }};
  // picture lists are rotated so their first picture is the still frame
  const CMAP = {json.dumps(card_maps)};
  const WMAP = {json.dumps(win_maps)};
  const RMAP = {json.dumps(cr_maps)};
  const MMAP = {json.dumps(mi_maps)};
  const BMAP = {json.dumps(bet_map)};
  const LMAP = {json.dumps(lbl_map)};
  const CARD = [F.c0, F.c1, F.c2, F.c3, F.c4];
  const WIN = [F.w1, F.w2, F.w3, F.w4];
  const CRD = [F.cr1, F.cr2, F.cr3, F.cr4];
  const MNI = [F.mini1, F.mini2];

  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const rnd = () => {{ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }};
  const isJoker = (c) => c === 52;
  const rankOf = (c) => c % 13, suitOf = (c) => (c / 13) | 0;

  const evalPlain = (h) => {{
    const rc = new Array(13).fill(0), sc = [0, 0, 0, 0];
    for (const c of h) {{ rc[rankOf(c)]++; sc[suitOf(c)]++; }}
    const flush = sc.some(x => x === 5);
    const ranks = h.map(rankOf).sort((a, b) => a - b);
    let straight = false, high = -1;
    if (new Set(ranks).size === 5) {{
      if (ranks[4] - ranks[0] === 4) {{ straight = true; high = ranks[4]; }}
      if (ranks[0] === 0 && ranks[1] === 1 && ranks[2] === 2 && ranks[3] === 3 && ranks[4] === 12) {{ straight = true; high = 3; }}
    }}
    const counts = rc.filter(x => x > 0).sort((a, b) => b - a);
    if (straight && flush) return high === 12 ? 9 : 8;
    if (counts[0] === 4) return 7;
    if (counts[0] === 3 && counts[1] === 2) return 6;
    if (flush) return 5;
    if (straight) return 4;
    if (counts[0] === 3) return 3;
    if (counts[0] === 2 && counts[1] === 2) return 2;
    if (counts[0] === 2) {{
      for (let r = 9; r < 13; r++) if (rc[r] === 2) return 1;
      return 0;
    }}
    return 0;
  }};

  const evalHand = (hand) => {{
    if (!hand.some(isJoker)) return evalPlain(hand);
    const real = hand.filter(c => !isJoker(c));
    const rc = new Array(13).fill(0);
    for (const c of real) rc[rankOf(c)]++;
    if (rc.some(x => x === 4)) return 10;          // four of a kind + joker
    let best = 0;
    for (let c = 0; c < 52; c++) best = Math.max(best, evalPlain(real.concat([c])));
    return best;
  }};

  const shuffle = () => {{
    const d = [];
    for (let i = 0; i < 53; i++) d.push(i);
    for (let i = 52; i > 0; i--) {{ const k = Math.floor(rnd() * (i + 1)); const t = d[i]; d[i] = d[k]; d[k] = t; }}
    return d;
  }};

  const chooseHold = (hand) => {{
    if (evalHand(hand) >= 1) return [true, true, true, true, true];   // made hand: stand pat
    const keep = [false, false, false, false, false];
    const sc = [0, 0, 0, 0];
    hand.forEach(c => {{ if (!isJoker(c)) sc[suitOf(c)]++; }});
    const fs = sc.indexOf(4);
    if (fs >= 0) {{
      hand.forEach((c, i) => {{ if (isJoker(c) || suitOf(c) === fs) keep[i] = true; }});
      return keep;
    }}
    const rc = new Array(13).fill(0);
    hand.forEach(c => {{ if (!isJoker(c)) rc[rankOf(c)]++; }});
    let pair = false;
    hand.forEach((c, i) => {{
      if (isJoker(c)) keep[i] = true;
      else if (rc[rankOf(c)] >= 2) {{ keep[i] = true; pair = true; }}
    }});
    if (!pair) {{
      let best = -1, bi = -1;
      hand.forEach((c, i) => {{ if (!isJoker(c) && rankOf(c) > best) {{ best = rankOf(c); bi = i; }} }});
      if (bi >= 0 && best >= 9) keep[bi] = true;    // jack or better
    }}
    return keep;
  }};

  let credit = 1000, mini = 0, P = null, t0 = 0;

  const planRound = () => {{
    const deck = shuffle();
    const deal = deck.slice(0, 5);
    const hold = chooseHold(deal);
    const need = hold.filter(x => !x).length;
    const draws = deck.slice(5, 5 + need);
    let di = 0;
    const finalHand = deal.map((c, i) => (hold[i] ? c : draws[di++]));
    const rDeal = evalHand(deal), rFinal = evalHand(finalHand);
    // a pair of jacks on the deal only pays if the second draw was bought; otherwise it fills the meter
    const win = rFinal >= 2 ? PAY[rFinal] : (rFinal === 1 && need > 0 ? PAY[1] : 0);
    const miniAdd = rDeal >= 1;
    let miniPaid = false;
    const gamble = win > 0 && rnd() < 0.5;
    const guessRed = rnd() < 0.5;
    const gWin = rnd() < 0.5;
    const wantRed = (guessRed === gWin);
    const pool = [];
    for (let c = 0; c < 52; c++) if ((suitOf(c) >= 2) === wantRed) pool.push(c);
    const gCard = pool[Math.floor(rnd() * pool.length)];
    if (miniAdd) {{
      mini += 10;
      if (mini >= 50) {{ mini = 0; credit += 50; miniPaid = true; }}
    }}
    return {{ deal, hold, finalHand, need, rDeal, rFinal, win, gamble, guessRed, gWin, gCard, miniPaid, c0: credit }};
  }};

  const newRound = (now) => {{
    if (credit < BET) credit += 1000;      // the machine tops the player up
    t0 = now;
    P = planRound();
  }};

  const creditsAt = (t) => {{
    let c = P.c0 - BET;
    if (P.need > 0 && t >= 1300) c -= BET;
    if (t >= 1900) c += P.win;
    if (P.gamble && t >= 4400) c += P.gWin ? P.win : -P.win;
    return Math.max(0, c);
  }};

  const setDigits = (widgets, lists, maps, n, xs, y) => {{
    for (let i = 0; i < widgets.length; i++) {{
      const d = Math.floor(n / Math.pow(10, widgets.length - 1 - i)) % 10;
      widgets[i].setProperty(ui.prop.MORE, {{ x: pxv(xs[i]), y: pxv(y), src: lists[i][maps[i][d]] }});
    }}
  }};

  const tick = () => {{
    const now = Date.now();
    if (!P) newRound(now);
    let t = now - t0;
    if (t >= ROUND) {{ credit = creditsAt(ROUND); newRound(now); t = 0; }}

    for (let i = 0; i < 5; i++) {{
      let pic;
      if (t < 600) pic = t >= 90 + i * 100 ? P.deal[i] : BACK;
      else if (t < 1300) pic = P.deal[i];
      else if (t < 1900) pic = P.hold[i] ? P.deal[i] : (t >= 1300 + (i + 1) * 90 ? P.finalHand[i] : BACK);
      else pic = P.finalHand[i];
      if (P.gamble && i === 2 && t >= 3400) pic = t >= 4000 ? P.gCard : BACK;
      W['c' + i].setProperty(ui.prop.MORE, {{ x: pxv(CX[i]), y: pxv(CY), src: CARD[i][CMAP[i][pic]] }});
      const held = t >= 600 && t < 1900 && P.hold[i];
      W['h' + i].setProperty(ui.prop.MORE, {{ x: pxv(CX[i] + 17), y: pxv(held ? {HOLD_Y} : -40) }});
    }}

    let lbl = 0, amt = 0;
    if (t < 600) lbl = LIDX['DEAL'];
    else if (t < 1300) lbl = 0;
    else if (t < 1900) lbl = LIDX['DRAW'];
    else if (t < 3400) {{
      lbl = P.win ? LIDX[NAME[P.rFinal]] : (P.rDeal >= 1 ? LIDX['MINI BONUS!'] : LIDX['NO WIN']);
      amt = P.win;
      if (P.miniPaid && !P.win) {{ lbl = LIDX['MINI BONUS!']; amt = 50; }}
    }} else if (P.gamble && t < 4000) lbl = LIDX['GAMBLE'];
    else if (P.gamble && t < 4400) lbl = P.guessRed ? LIDX['RED'] : LIDX['BLACK'];
    else if (P.gamble) {{ lbl = P.gWin ? LIDX['YOU WIN'] : LIDX['NO WIN']; amt = P.gWin ? P.win * 2 : 0; }}
    W.lbl.setProperty(ui.prop.MORE, {{ x: pxv(14), y: pxv(202), src: F.lbl[LMAP[lbl]] }});
    setDigits([W.w1, W.w2, W.w3, W.w4], WIN, WMAP, Math.min(9999, amt), {json.dumps(WINX)}, 200);

    setDigits([W.cr1, W.cr2, W.cr3, W.cr4], CRD, RMAP, Math.min(9999, creditsAt(t)), {json.dumps(CRX)}, {VAL_Y});
    setDigits([W.mini1, W.mini2], MNI, MMAP, Math.min(99, mini), {json.dumps(MIX)}, {VAL_Y});
    setDigits([W.betv], [F.betv], [BMAP], BET, [212], {VAL_Y});
  }};

  const safe = () => {{ try {{ tick(); }} catch (e) {{}} }};
  let id = null, pausedAt = 0;
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
    'name': 'American Poker 2',
    'device': 'bip-6',
    'language': 'en-US',
    'optimizePng': 32,
    'description': 'American Poker 2 demo play: the machine deals, holds, draws, scores the hand and gambles the win on red or black, with the arcade payout table and the real time on top.',
    'userCode': USER_CODE,
    'steps': [{'script': maker}],
    'preview': 'preview.png',
    'previewAod': 'preview-aod.png',
    'save': 'project',
    'out': 'out/american-poker-2',
    'build': False,
}

json.dump(recipe, open(f'{ROOT}/recipe.json', 'w'), indent=1)
print('recipe:', f'{ROOT}/recipe.json', 'images', len(images), 'layers expect ~33')
