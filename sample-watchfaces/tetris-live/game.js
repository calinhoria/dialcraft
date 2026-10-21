// ---- live Tetris: an AI plays real games on the well while the screen is on ----
{
  const DEBUG = false
  // DEBUG = true prints what the game does to the watch's console (visible over the developer bridge)
  const log = (m) => { if (DEBUG) { try { console.log('[tetris] ' + m) } catch (e) {} } }
  try {
  const COLS = 10, ROWS = 12, CS = 22, WX = 85, WY = 164
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  const MAT = { I: 'cyan', O: 'yellow', T: 'purple', S: 'green', Z: 'red', J: 'blue', L: 'orange' }
  const BASE = {
    I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]],
    S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  }
  const turn = (cells) => {
    const r = cells.map(([x, y]) => [-y, x])
    const mx = Math.min(...r.map((c) => c[0])), my = Math.min(...r.map((c) => c[1]))
    return r.map(([x, y]) => [x - mx, y - my])
  }
  const sig = (cells) => cells.map((c) => c.join()).sort().join(';')
  const ROTS = {}
  for (const k of TYPES) {
    const list = [BASE[k]]
    let c = BASE[k]
    for (let i = 0; i < 3; i++) { c = turn(c); if (!list.some((l) => sig(l) === sig(c))) list.push(c) }
    ROTS[k] = list
  }
  const board = []
  for (let r = 0; r < ROWS; r++) board.push(new Array(COLS).fill(null))

  const norm = ui.show_level.ONLY_NORMAL
  const tile = (mat, c, r) => ui.createWidget(ui.widget.IMG, { x: pxv(WX + c * CS), y: pxv(WY + r * CS), src: A('tiles/' + mat + '.png'), show_level: norm })
  const kill = (w) => { try { ui.deleteWidget(w) } catch (e) {} }
  const linesText = ui.createWidget(ui.widget.TEXT, { x: pxv(318), y: pxv(238), w: pxv(56), h: pxv(22), text: '0', text_size: pxv(18), color: 0xffffff, align_h: ui.align.CENTER_H, align_v: ui.align.CENTER_V, show_level: norm })

  let phase = ''
  let bag = [], next = null, cur = null, state = 'play', anim = 0, clearRows = [], lines = 0, nextW = [], pending = null, drops = []
  const draw7 = () => {
    if (!bag.length) {
      bag = TYPES.slice()
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t }
    }
    return bag.pop()
  }
  const occ = () => board.map((r) => r.map((c) => !!c))
  const fits = (o, cells, x, y) => {
    for (const [dx, dy] of cells) {
      const c = x + dx, r = y + dy
      if (c < 0 || c >= COLS || r >= ROWS) return false
      if (r >= 0 && o[r][c]) return false
    }
    return true
  }
  // the classic "El-Tetris" heuristic: low stack, no holes, a flat surface, lines when they come.
  // The watch is slow, so this is written without allocations (one flat grid, placed and lifted again per candidate) and it
  // can run a few candidates per tick (a "planner"): the next piece is planned while the current one is still falling.
  const flat = (o) => { const g = new Uint8Array(ROWS * COLS); for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (o[r][c]) g[r * COLS + c] = 1; return g }
  const fitsFlat = (g, cells, x, y) => {
    for (const [dx, dy] of cells) {
      const c = x + dx, r = y + dy
      if (c < 0 || c >= COLS || r >= ROWS) return false
      if (r >= 0 && g[r * COLS + c]) return false
    }
    return true
  }
  const fullRows = new Uint8Array(ROWS)
  const scoreCand = (g, cells, x) => {
    if (!fitsFlat(g, cells, x, 0)) return null
    let y = 0
    while (fitsFlat(g, cells, x, y + 1)) y++
    for (const [dx, dy] of cells) g[(y + dy) * COLS + x + dx] = 1
    let ln = 0
    for (let r = 0; r < ROWS; r++) {
      let f = 1
      for (let c = 0; c < COLS; c++) if (!g[r * COLS + c]) { f = 0; break }
      fullRows[r] = f
      ln += f
    }
    let agg = 0, bump = 0, holes = 0, prev = 0
    for (let c = 0; c < COLS; c++) {
      let n = 0, h = 0, filled = 0
      for (let r = ROWS - 1; r >= 0; r--) {
        if (fullRows[r]) continue
        n++
        if (g[r * COLS + c]) { h = n; filled++ }
      }
      agg += h
      holes += h - filled
      if (c) bump += Math.abs(h - prev)
      prev = h
    }
    for (const [dx, dy] of cells) g[(y + dy) * COLS + x + dx] = 0
    return -0.510066 * agg + 0.760666 * ln - 0.35663 * holes - 0.184483 * bump
  }
  let planner = null
  const startPlanner = (type, o) => {
    const g = flat(o), cands = []
    ROTS[type].forEach((cells, ri) => {
      const w = Math.max(...cells.map((c) => c[0])) + 1
      for (let x = 0; x <= COLS - w; x++) cands.push({ cells, rot: ri, x })
    })
    planner = { type, g, key: g.join(''), cands, i: 0, best: null }
  }
  // score candidates until the time budget is spent; true when the plan is complete
  const workPlanner = (budget) => {
    const p = planner
    if (!p) return true
    const t0 = Date.now()
    while (p.i < p.cands.length && Date.now() - t0 < budget) {
      const cd = p.cands[p.i++]
      const sc = scoreCand(p.g, cd.cells, cd.x)
      if (sc !== null && (!p.best || sc > p.best.sc)) p.best = { sc, rot: cd.rot, x: cd.x }
    }
    return p.i >= p.cands.length
  }
  const plan = (type, o) => {
    phase += '+plan'
    const key = flat(o).join('')
    const reuse = !!(planner && planner.type === type && planner.key === key)
    if (!reuse) startPlanner(type, o)   // not the one prepared in advance
    if (DEBUG && !reuse) log('plan ' + type + ': cold (the one prepared in advance did not match)')
    workPlanner(1e9)
    const best = planner.best
    planner = null
    return best
  }
  // once the current piece has its target, the board it will leave behind is known: start planning the next piece on it
  const planAhead = () => {
    if (!cur || !next) return
    const cells = ROTS[cur.type][cur.tr], o = occ()
    let y = 0
    if (!fits(o, cells, cur.tx, 0)) return
    while (fits(o, cells, cur.tx, y + 1)) y++
    for (const [dx, dy] of cells) o[y + dy][cur.tx + dx] = true
    const rows = o.filter((r) => !r.every(Boolean))
    while (rows.length < ROWS) rows.unshift(new Array(COLS).fill(false))
    startPlanner(next, rows)
  }
  const showNext = () => {
    phase += '+next'
    nextW.forEach(kill)
    nextW = []
    const cells = ROTS[next][0]
    const pw = Math.max(...cells.map((c) => c[0])) + 1, ph = Math.max(...cells.map((c) => c[1])) + 1
    const ox = 24 + (48 - pw * 12) / 2, oy = 186 + (40 - ph * 12) / 2
    for (const [dx, dy] of cells) nextW.push(ui.createWidget(ui.widget.IMG, { x: pxv(ox + dx * 12), y: pxv(oy + dy * 12), src: A('tiles/mini_' + MAT[next] + '.png'), show_level: norm }))
  }
  const place = () => {
    const cells = ROTS[cur.type][cur.rot]
    cells.forEach(([dx, dy], i) => cur.w[i].setProperty(ui.prop.MORE, { x: pxv(WX + (cur.x + dx) * CS), y: pxv(WY + (cur.y + dy) * CS) }))
  }
  // small jobs the next ticks do while the new piece is already falling, so no single tick gets long
  let todo = []
  const spawn = () => {
    phase += '+spawn'
    const type = next || draw7()
    next = draw7()
    const cells = ROTS[type][0]
    const w = Math.max(...cells.map((c) => c[0])) + 1
    const x = Math.floor((COLS - w) / 2)
    const o = occ()
    if (!fits(o, cells, x, 0)) { log('topped out after ' + lines + ' lines'); state = 'reset'; anim = 0; next = type; todo = []; return }
    const pl = plan(type, o) || { rot: 0, x }
    cur = { type, rot: 0, x, y: 0, tr: pl.rot, tx: pl.x, w: cells.map(([dx, dy]) => tile(MAT[type], x + dx, dy)) }
    todo = [showNext, planAhead]
  }
  const lockPiece = () => {
    phase += '+lock'
    const cells = ROTS[cur.type][cur.rot]
    cells.forEach(([dx, dy], i) => { board[cur.y + dy][cur.x + dx] = { w: cur.w[i], mat: MAT[cur.type] } })
    cur = null
    const full = []
    for (let r = 0; r < ROWS; r++) if (board[r].every(Boolean)) full.push(r)
    if (full.length) { log('clearing rows ' + full.join(',')); state = 'clear'; clearRows = full; anim = 0 } else spawn()
  }
  const step = () => {
    const o = occ()
    let cells = ROTS[cur.type][cur.rot]
    let busy = false
    // turn and slide first, at the top of the well; then the piece drops onto the planned spot
    if (cur.rot !== cur.tr) {
      const nr = (cur.rot + 1) % ROTS[cur.type].length
      const nc = ROTS[cur.type][nr]
      if (fits(o, nc, cur.x, cur.y)) { cur.rot = nr; cells = nc; busy = true } else cur.tr = cur.rot
    }
    if (cur.x !== cur.tx) {
      const nx = cur.x + (cur.tx > cur.x ? 1 : -1)
      if (fits(o, cells, nx, cur.y)) { cur.x = nx; busy = true } else cur.tx = cur.x
    }
    if (!busy) {
      let landed = false
      for (let i = 0; i < 2; i++) {
        if (fits(o, cells, cur.x, cur.y + 1)) cur.y++; else { landed = true; break }
      }
      place()
      if (landed) lockPiece()
    } else place()
  }
  const dissolveRows = (rows) => {
    for (const r of rows) for (let c = 0; c < COLS; c++) { const cell = board[r][c]; if (cell) cell.w.setProperty(ui.prop.SRC, A('tiles/' + cell.mat + '_d' + (anim - 1) + '.png')) }
  }
  const tick = () => {
    if (state === 'play') {
      if (!cur) spawn()
      if (cur) { const job = todo.shift(); if (job) { phase += '+job'; job() } workPlanner(job ? 20 : 30); step() }
    } else if (state === 'clear') {
      anim++
      dissolveRows(clearRows)
      if (anim >= 7) {
        for (const r of clearRows) for (let c = 0; c < COLS; c++) { if (board[r][c]) kill(board[r][c].w); board[r][c] = null }
        // the rows above a cleared one fall by the number of cleared rows below them; the cells under it stay where they are
        const keep = []
        drops = []
        for (let i = 0; i < ROWS; i++) {
          if (clearRows.includes(i)) continue
          const to = i + clearRows.filter((g) => g > i).length
          board[i].forEach((cell, c) => { if (cell && to !== i) drops.push({ cell, c, from: i, to }) })
          keep.push(board[i])
        }
        while (keep.length < ROWS) keep.unshift(new Array(COLS).fill(null))
        pending = keep
        anim = 0
        state = 'drop'
      }
    } else if (state === 'drop') {
      anim++
      const t = Math.min(1, anim / 3)
      for (const m of drops) m.cell.w.setProperty(ui.prop.MORE, { x: pxv(WX + m.c * CS), y: pxv(WY + (m.from + (m.to - m.from) * t) * CS) })
      if (anim >= 3 || !drops.length) {
        for (let r = 0; r < ROWS; r++) board[r] = pending[r]
        lines += clearRows.length
        linesText.setProperty(ui.prop.TEXT, String(lines))
        state = 'play'
        spawn()
      }
    } else if (state === 'reset') {
      // topped out: the whole board dissolves and a fresh game starts
      anim++
      dissolveRows(Array.from({ length: ROWS }, (_, r) => r))
      if (anim >= 7) {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (board[r][c]) kill(board[r][c].w); board[r][c] = null }
        lines = 0
        planner = null
        todo = []
        linesText.setProperty(ui.prop.TEXT, '0')
        state = 'play'
      }
    }
  }
  // a small red note at the bottom says what went wrong, if anything does
  const note = ui.createWidget(ui.widget.TEXT, { x: pxv(60), y: pxv(432), w: pxv(270), h: pxv(16), text: '', text_size: pxv(11), color: 0xff4040, align_h: ui.align.CENTER_H, show_level: norm })
  const say = (t) => { log(t); try { note.setProperty(ui.prop.TEXT, String(t).slice(0, 44)) } catch (e) {} }
  let timerId = null, via = '', ticks = 0
  let lastStart = 0
  const st = { n: 0, sum: 0, max: 0, over: 0, gapMax: 0, gapOver: 0, worst: '' }
  const safeTick = () => {
    try {
      const t0 = Date.now(), gap = lastStart ? t0 - lastStart : 0
      lastStart = t0
      phase = state
      ticks++
      tick()
      if (DEBUG) {
        const dt = Date.now() - t0
        st.n++; st.sum += dt
        if (dt > st.max) { st.max = dt; st.worst = phase }
        if (dt > 70) st.over++
        if (gap > st.gapMax && gap < 1500) st.gapMax = gap
        if (gap > 180 && gap < 1500) st.gapOver++
        if (st.n >= 100) { log('last 100 ticks: avg=' + Math.round(st.sum / st.n) + 'ms max=' + st.max + 'ms (' + st.worst + ') over70=' + st.over + ' maxGap=' + st.gapMax + 'ms gapsOver180=' + st.gapOver); st.n = st.sum = st.max = st.over = st.gapMax = st.gapOver = 0 }
      }
    } catch (e) { say('game: ' + (e && e.message ? e.message : e)); stop() }
  }
  const start = () => {
    if (timerId !== null) return
    try {
      if (typeof timer !== 'undefined' && timer && timer.createTimer) { timerId = timer.createTimer(0, 110, safeTick); via = 't' }
      else if (typeof setInterval === 'function') { timerId = setInterval(safeTick, 110); via = 'i' }
      else say('no timer available')
    } catch (e) { say('timer: ' + (e && e.message ? e.message : e)) }
  }
  function stop() {
    if (timerId === null) return
    try { if (via === 't') timer.stopTimer(timerId); else clearInterval(timerId) } catch (e) {}
    timerId = null
  }
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: () => { log('resume'); start() }, pause_call: () => { log('pause'); stop() } })
  log('start: setInterval=' + typeof setInterval + ' timer=' + typeof timer + ' deleteWidget=' + typeof ui.deleteWidget + ' pxv(110)=' + pxv(110))
  start()
  } catch (e) { log('FATAL ' + (e && e.message ? e.message : e) + ' | ' + String(e && e.stack ? e.stack : '').replace(/\s+/g, ' ').slice(0, 300)) }
}
