// ---- live Tetris: an AI plays real games on the well while the screen is on ----
{
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
  const tile = (mat, c, r) => ui.createWidget(ui.widget.IMG, { x: px(WX + c * CS), y: px(WY + r * CS), src: A('tiles/' + mat + '.png'), show_level: norm })
  const kill = (w) => { try { ui.deleteWidget(w) } catch (e) {} }
  const linesText = ui.createWidget(ui.widget.TEXT, { x: px(318), y: px(238), w: px(56), h: px(22), text: '0', text_size: px(18), color: 0xffffff, align_h: ui.align.CENTER_H, align_v: ui.align.CENTER_V, show_level: norm })

  let bag = [], next = null, cur = null, state = 'play', anim = 0, clearRows = [], lines = 0, nextW = [], pending = null
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
  // the classic "El-Tetris" heuristic: low stack, no holes, a flat surface, lines when they come
  const plan = (type) => {
    const o = occ()
    let best = null
    ROTS[type].forEach((cells, ri) => {
      const w = Math.max(...cells.map((c) => c[0])) + 1
      for (let x = 0; x <= COLS - w; x++) {
        let y = 0
        if (!fits(o, cells, x, y)) continue
        while (fits(o, cells, x, y + 1)) y++
        const g = o.map((r) => r.slice())
        for (const [dx, dy] of cells) g[y + dy][x + dx] = true
        let ln = 0
        const rows = g.filter((r) => { const f = r.every(Boolean); if (f) ln++; return !f })
        while (rows.length < ROWS) rows.unshift(new Array(COLS).fill(false))
        const hs = []
        let holes = 0
        for (let c = 0; c < COLS; c++) {
          let r = 0
          while (r < ROWS && !rows[r][c]) r++
          hs.push(ROWS - r)
          for (let k = r + 1; k < ROWS; k++) if (!rows[k][c]) holes++
        }
        let agg = 0, bump = 0
        hs.forEach((h, i) => { agg += h; if (i) bump += Math.abs(h - hs[i - 1]) })
        const sc = -0.510066 * agg + 0.760666 * ln - 0.35663 * holes - 0.184483 * bump
        if (!best || sc > best.sc) best = { sc, rot: ri, x }
      }
    })
    return best
  }
  const showNext = () => {
    nextW.forEach(kill)
    nextW = []
    const cells = ROTS[next][0]
    const pw = Math.max(...cells.map((c) => c[0])) + 1, ph = Math.max(...cells.map((c) => c[1])) + 1
    const ox = 24 + (48 - pw * 12) / 2, oy = 186 + (40 - ph * 12) / 2
    for (const [dx, dy] of cells) nextW.push(ui.createWidget(ui.widget.IMG, { x: px(ox + dx * 12), y: px(oy + dy * 12), src: A('tiles/mini_' + MAT[next] + '.png'), show_level: norm }))
  }
  const place = () => {
    const cells = ROTS[cur.type][cur.rot]
    cells.forEach(([dx, dy], i) => cur.w[i].setProperty(ui.prop.MORE, { x: px(WX + (cur.x + dx) * CS), y: px(WY + (cur.y + dy) * CS) }))
  }
  const spawn = () => {
    const type = next || draw7()
    next = draw7()
    showNext()
    const cells = ROTS[type][0]
    const w = Math.max(...cells.map((c) => c[0])) + 1
    const x = Math.floor((COLS - w) / 2)
    if (!fits(occ(), cells, x, 0)) { state = 'reset'; anim = 0; next = type; return }
    const pl = plan(type) || { rot: 0, x }
    cur = { type, rot: 0, x, y: 0, tr: pl.rot, tx: pl.x, w: cells.map(([dx, dy]) => tile(MAT[type], x + dx, dy)) }
  }
  const lockPiece = () => {
    const cells = ROTS[cur.type][cur.rot]
    cells.forEach(([dx, dy], i) => { board[cur.y + dy][cur.x + dx] = { w: cur.w[i], mat: MAT[cur.type] } })
    cur = null
    const full = []
    for (let r = 0; r < ROWS; r++) if (board[r].every(Boolean)) full.push(r)
    if (full.length) { state = 'clear'; clearRows = full; anim = 0 } else spawn()
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
      if (cur) step()
    } else if (state === 'clear') {
      anim++
      dissolveRows(clearRows)
      if (anim >= 7) {
        for (const r of clearRows) for (let c = 0; c < COLS; c++) { if (board[r][c]) kill(board[r][c].w); board[r][c] = null }
        const keep = board.filter((row, i) => !clearRows.includes(i))
        while (keep.length < ROWS) keep.unshift(new Array(COLS).fill(null))
        pending = keep
        keep.forEach((row, r) => row.forEach((cell, c) => { if (cell) cell.w.setProperty(ui.prop.MORE, { x: px(WX + c * CS), y: px(WY + r * CS - CS / 2) }) }))
        state = 'drop'
      }
    } else if (state === 'drop') {
      pending.forEach((row, r) => row.forEach((cell, c) => { if (cell) cell.w.setProperty(ui.prop.MORE, { x: px(WX + c * CS), y: px(WY + r * CS) }) }))
      for (let r = 0; r < ROWS; r++) board[r] = pending[r]
      lines += clearRows.length
      linesText.setProperty(ui.prop.TEXT, String(lines))
      state = 'play'
      spawn()
    } else if (state === 'reset') {
      // topped out: the whole board dissolves and a fresh game starts
      anim++
      dissolveRows(Array.from({ length: ROWS }, (_, r) => r))
      if (anim >= 7) {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (board[r][c]) kill(board[r][c].w); board[r][c] = null }
        lines = 0
        linesText.setProperty(ui.prop.TEXT, '0')
        state = 'play'
      }
    }
  }
  // a small red note at the bottom says what went wrong, if anything does
  const note = ui.createWidget(ui.widget.TEXT, { x: px(60), y: px(432), w: px(270), h: px(16), text: '', text_size: px(11), color: 0xff4040, align_h: ui.align.CENTER_H, show_level: norm })
  const say = (t) => { try { note.setProperty(ui.prop.TEXT, String(t).slice(0, 44)) } catch (e) {} }
  let timerId = null, via = ''
  const safeTick = () => { try { tick() } catch (e) { say('game: ' + (e && e.message ? e.message : e)); stop() } }
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
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop })
  start()
}
